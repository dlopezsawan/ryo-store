/**
 * WhatsApp Webhook — receives incoming messages from WaSenderAPI
 *
 * POST /webhooks/whatsapp  (public — no auth required)
 *
 * Handles: text, audio (Groq Whisper), images (download + save), location (geocode)
 * Concurrency: per-phone lock prevents race conditions
 */

import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { writeFile, mkdir } from "fs/promises"
import path from "path"
import {
  ensureTables,
  getConfig,
  getOrCreateConversation,
  setSessionStatus,
  saveMessage,
  isBotEcho,
  isRecentBotMessage,
  saveBotMsgId,
  saveJid,
  getJid,
  getMessageCount,
  logFunnelEvent,
  clearOrderDataKey,
  setOrderDataKey,
  getDanaTelegramChatId,
} from "../../../lib/whatsapp-db"
import { chat, buildGreeting } from "../../../lib/whatsapp-bot"
import { sendWhatsApp } from "../../../lib/whatsapp-sender"

let tablesReady = false

// ─── Telegram notification helper (for human handoff alerts) ───────────────

async function notifyTelegramHumanHandoff(phone: string, message: string): Promise<void> {
  const token = await getConfig("telegram_bot_token")
  const chatId = await getDanaTelegramChatId()
  if (!token || !chatId) return

  // Pull last 3 user messages from history to give the agent context (reason).
  // Includes the trigger message plus up to 2 previous turns.
  const Pool = (await import("pg")).Pool
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  let context = ""
  let customerName = ""
  try {
    const recent = await pool.query(
      `SELECT role, content FROM wa_messages
       WHERE phone = $1 AND role IN ('user', 'assistant')
       ORDER BY created_at DESC LIMIT 6`,
      [phone]
    )
    const lines = recent.rows.reverse()
      .map((r) => `${r.role === "user" ? "👤" : "🤖"} ${r.content.substring(0, 140)}`)
      .join("\n")
    context = lines
    const cn = await pool.query(`SELECT customer_name FROM wa_conversations WHERE phone = $1`, [phone])
    customerName = cn.rows[0]?.customer_name || ""
  } catch (err) {
    console.warn("[telegram] handoff context fetch failed:", err)
    context = `👤 ${message.substring(0, 200)}`
  }

  const nameLine = customerName ? `\n👤 Nombre: ${customerName}` : ""
  const text = `🙋 <b>${customerName || "Un cliente"} quiere hablar con un humano</b>

📱 <code>${phone}</code>${nameLine}

<b>Razón / contexto:</b>
<pre>${context.substring(0, 800).replace(/[<>]/g, "")}</pre>

¿Quién toma?`

  const inlineKeyboard = {
    inline_keyboard: [
      [
        { text: "🧑 Daniel", callback_data: `hh:daniel:${phone}` },
        { text: "🧑 Leonardo", callback_data: `hh:leonardo:${phone}` },
      ],
      [
        { text: "🧑 Damian", callback_data: `hh:damian:${phone}` },
        { text: "🧑 Floyd", callback_data: `hh:floyd:${phone}` },
      ],
    ],
  }

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", reply_markup: inlineKeyboard }),
  }).catch((err) => console.error("[telegram] Handoff notif failed:", err))
}

/**
 * B7+ : alert Telegram when a customer who had a recent human handoff (closed)
 * returns to write within 24 h. Sent once per handoff cycle.
 */
async function notifyTelegramHandoffReturn(phone: string, agent: string, message: string): Promise<void> {
  const token = await getConfig("telegram_bot_token")
  const chatId = await getDanaTelegramChatId()
  if (!token || !chatId) return

  const agentDisplay: Record<string, string> = {
    damian: "Damian", floyd: "Floyd", daniel: "Daniel", leonardo: "Leonardo",
  }
  const display = agentDisplay[agent] || agent

  const text = `🔄 <b>Cliente de ${display} volvió a escribir</b>

📱 <code>${phone}</code>
💬 ${message.substring(0, 200).replace(/[<>]/g, "")}

Dana ya está respondiendo. Si quieres tomar otra vez, escríbele directo desde WhatsApp.`

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  }).catch((err) => console.error("[telegram] handoff return notif failed:", err))
}

// ─── Per-phone concurrency lock ─────────────────────────────────────────────

const phoneLocks = new Map<string, Promise<void>>()

async function withPhoneLock<T>(phone: string, fn: () => Promise<T>): Promise<T> {
  const existing = phoneLocks.get(phone)
  let resolve!: () => void
  const newLock = new Promise<void>((r) => { resolve = r })
  phoneLocks.set(phone, newLock)
  if (existing) await existing.catch(() => {})
  try {
    return await fn()
  } finally {
    resolve()
    if (phoneLocks.get(phone) === newLock) phoneLocks.delete(phone)
  }
}

// ─── Audio transcription (Groq Whisper) ─────────────────────────────────────

/**
 * Download a WhatsApp audio. Audio comes encrypted from the CDN (mmg.whatsapp.net/...enc),
 * so we go through WaSenderAPI's decrypt-media endpoint first — same as we do for images.
 * Falls back to direct URL only if decrypt-media isn't available.
 */
async function downloadAudio(
  audioUrl: string,
  messageId: string,
  audioMessage: Record<string, unknown>
): Promise<Buffer | null> {
  // Try decrypt-media first (handles encrypted .enc URLs)
  if (messageId && audioMessage) {
    const apiKey = await getConfig("wasender_key")
    if (apiKey) {
      try {
        const decryptPayload = {
          data: { messages: { key: { id: messageId }, message: { audioMessage } } },
        }
        const mediaRes = await fetch("https://wasenderapi.com/api/decrypt-media", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify(decryptPayload),
          signal: AbortSignal.timeout(20000),
        })
        if (mediaRes.ok) {
          const mediaData = await mediaRes.json() as { publicUrl?: string }
          if (mediaData.publicUrl) {
            const dl = await fetch(mediaData.publicUrl, { signal: AbortSignal.timeout(15000) })
            if (dl.ok) {
              const buf = Buffer.from(await dl.arrayBuffer())
              console.log("[wa-webhook] 🎤 Audio decrypted:", buf.length, "bytes")
              return buf
            }
          }
        } else {
          console.warn("[wa-webhook] audio decrypt-media failed:", mediaRes.status)
        }
      } catch (err) {
        console.warn("[wa-webhook] audio decrypt-media error:", err)
      }
    }
  }

  // Fallback: direct download (works only for unencrypted URLs, rare)
  if (audioUrl) {
    try {
      const res = await fetch(audioUrl, { signal: AbortSignal.timeout(15000) })
      if (res.ok) return Buffer.from(await res.arrayBuffer())
    } catch { /* ignore */ }
  }
  return null
}

async function transcribeAudio(
  audioUrl: string,
  messageId: string,
  audioMessage: Record<string, unknown>
): Promise<string | null> {
  const groqKey = await getConfig("groq_key")
  if (!groqKey) { console.warn("[wa-webhook] No Groq key — skipping transcription"); return null }

  const audioBuffer = await downloadAudio(audioUrl, messageId, audioMessage)
  if (!audioBuffer || audioBuffer.length < 100) {
    console.error("[wa-webhook] No audio data obtained (encrypted or download failed)")
    return null
  }

  // Verify it's an Ogg/Opus file (magic bytes "OggS" = 0x4F 0x67 0x67 0x53)
  const isOgg = audioBuffer[0] === 0x4F && audioBuffer[1] === 0x67 && audioBuffer[2] === 0x67 && audioBuffer[3] === 0x53
  if (!isOgg) {
    console.warn("[wa-webhook] Audio is not Ogg (magic:", audioBuffer.slice(0, 4).toString("hex"), "). Likely still encrypted.")
    return null
  }

  try {
    const formData = new FormData()
    formData.append("file", new Blob([new Uint8Array(audioBuffer)], { type: "audio/ogg" }), "audio.ogg")
    formData.append("model", "whisper-large-v3")
    formData.append("language", "es")

    const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${groqKey}` },
      body: formData,
      signal: AbortSignal.timeout(30000),
    })
    if (!res.ok) { console.error("[wa-webhook] Groq Whisper error:", res.status, await res.text().catch(() => "")); return null }
    const data = await res.json() as { text?: string }
    console.log("[wa-webhook] 🎤 Transcribed:", data.text?.substring(0, 80))
    return data.text || null
  } catch (err) {
    console.error("[wa-webhook] Transcription failed:", err)
    return null
  }
}

// ─── Image download ─────────────────────────────────────────────────────────

async function downloadAndSaveImage(
  _imageUrl: string,
  phone: string,
  messageId?: string,
  imageMessage?: Record<string, unknown>
): Promise<string | null> {
  try {
    let buffer: Buffer | null = null

    // Use WaSenderAPI decrypt-media endpoint (handles encrypted WhatsApp media)
    if (messageId && imageMessage) {
      const apiKey = await getConfig("wasender_key")
      if (apiKey) {
        try {
          const decryptPayload = {
            data: {
              messages: {
                key: { id: messageId },
                message: { imageMessage },
              },
            },
          }
          console.log("[wa-webhook] Calling decrypt-media for message:", messageId)
          const mediaRes = await fetch("https://wasenderapi.com/api/decrypt-media", {
            method: "POST",
            headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify(decryptPayload),
            signal: AbortSignal.timeout(25000),
          })
          if (mediaRes.ok) {
            const mediaData = await mediaRes.json() as { success?: boolean; publicUrl?: string }
            if (mediaData.publicUrl) {
              console.log("[wa-webhook] 📸 Decrypt-media returned URL:", mediaData.publicUrl)
              // Download the decrypted image from the temporary URL
              const dlRes = await fetch(mediaData.publicUrl, { signal: AbortSignal.timeout(15000) })
              if (dlRes.ok) {
                buffer = Buffer.from(await dlRes.arrayBuffer())
                console.log("[wa-webhook] 📸 Decrypted image downloaded:", buffer.length, "bytes")
              }
            }
          } else {
            const errText = await mediaRes.text().catch(() => "")
            console.warn("[wa-webhook] decrypt-media failed:", mediaRes.status, errText.substring(0, 200))
          }
        } catch (err) {
          console.warn("[wa-webhook] decrypt-media error:", err)
        }
      }
    }

    // Fallback: direct URL download (may produce encrypted data)
    if (!buffer && _imageUrl) {
      const res = await fetch(_imageUrl, { signal: AbortSignal.timeout(15000) })
      if (res.ok) buffer = Buffer.from(await res.arrayBuffer())
    }

    if (!buffer || buffer.length < 100) {
      console.error("[wa-webhook] No image data obtained")
      return null
    }

    // Verify it's actually an image (JPEG: FF D8, PNG: 89 50)
    const isJpeg = buffer[0] === 0xFF && buffer[1] === 0xD8
    const isPng = buffer[0] === 0x89 && buffer[1] === 0x50
    if (!isJpeg && !isPng) {
      console.warn("[wa-webhook] File is not a valid image (magic:", buffer.slice(0, 4).toString("hex"), "). Encrypted — cannot save.")
      return "ENCRYPTED_IMAGE"
    }

    const uploadDir = path.join(process.cwd(), "static", "wa-proofs")
    await mkdir(uploadDir, { recursive: true })

    const ext = isPng ? "png" : "jpg"
    const filename = `proof-${phone}-${Date.now()}.${ext}`
    const filePath = path.join(uploadDir, filename)
    await writeFile(filePath, buffer)

    const publicUrl = `https://api.enrola.shop/static/wa-proofs/${filename}`
    console.log("[wa-webhook] 📸 Image saved:", publicUrl, `(${buffer.length} bytes, ${isJpeg ? "JPEG" : "PNG"})`)
    return publicUrl
  } catch (err) {
    console.error("[wa-webhook] Image download failed:", err)
    return null
  }
}

// ─── Location geocoding ─────────────────────────────────────────────────────

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const apiKey = await getConfig("google_maps_key")
  if (!apiKey) return `${lat},${lng}`
  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}&language=es`,
      { signal: AbortSignal.timeout(5000) }
    )
    const data = await res.json() as { results?: Array<{ formatted_address?: string }> }
    return data.results?.[0]?.formatted_address || `${lat},${lng}`
  } catch {
    return `${lat},${lng}`
  }
}

// ─── Main webhook handler ───────────────────────────────────────────────────

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  if (!tablesReady) {
    try { await ensureTables(); tablesReady = true }
    catch (err) { console.error("[wa-webhook] Table setup failed:", err) }
  }

  try {
    const body = req.body as Record<string, unknown>
    console.log("[wa-webhook] RAW:", JSON.stringify(body).substring(0, 800))

    const event = String(body?.event || "")

    // Parse WaSenderAPI payload (multiple formats)
    const data = (body?.data || body) as Record<string, unknown>
    const msgs = (data?.messages || data?.result || data) as Record<string, unknown>
    const key = (msgs?.key || data?.key || {}) as Record<string, unknown>
    const message = (msgs?.message || data?.message || {}) as Record<string, unknown>

    const fromMe = key.fromMe === true || data?.fromMe === true || event === "message.sent"

    // Extract phone
    const rawPhone = event === "message.sent"
      ? String(key.remoteJid || data?.jid || "")
      : String(key.senderPn || key.cleanedSenderPn || key.remoteJid || data?.from || data?.phone || "")
    const phone = rawPhone.replace(/@.*/, "").replace(/\D/g, "")

    // Reply JID (for sending back)
    const replyJid = event !== "message.sent"
      ? String(key.remoteJid || key.senderLid || "")
      : ""

    // Ignore group messages — bot only responds in 1:1 chats
    if (rawPhone.includes("@g.us") || replyJid.includes("@g.us")) {
      return res.status(200).json({ ok: true, skipped: "group message" })
    }

    // ── Extract text (or media) ───────────────────────────────────────────
    const extMsg = message.extendedTextMessage as Record<string, unknown> | undefined
    let text = String(
      msgs?.messageBody || message.conversation || extMsg?.text ||
      data?.body || data?.text || ""
    ).trim()
    const messageId = String(key.id || msgs?.id || data?.messageId || "")

    // ── Audio: decrypt (WaSenderAPI) + transcribe (Groq Whisper) ──────────
    const audioMsg = message.audioMessage as Record<string, unknown> | undefined
    if (audioMsg && !text) {
      const audioUrl = String(audioMsg.url || audioMsg.directPath || "")
      if (audioUrl || audioMsg.mediaKey) {
        const transcribed = await transcribeAudio(audioUrl, messageId, audioMsg)
        if (transcribed) text = transcribed
      }
    }

    // ── Image: download immediately (temp URLs expire) ────────────────────
    const imageMsg = message.imageMessage as Record<string, unknown> | undefined
    if (imageMsg && !fromMe) {
      const imageUrl = String(imageMsg.url || imageMsg.directPath || "")
      const caption = String(imageMsg.caption || "")
      if (imageUrl || imageMsg.mediaKey) {
        const localUrl = await downloadAndSaveImage(imageUrl, phone, messageId, imageMsg)
        if (localUrl === "ENCRYPTED_IMAGE") {
          text = `[IMAGEN_RECIBIDA: imagen_enviada_por_cliente]${caption ? ` ${caption}` : ""}`
        } else if (localUrl) {
          text = `[IMAGEN_RECIBIDA: ${localUrl}]${caption ? ` ${caption}` : ""}`
        }
      }
    }

    // ── Location: geocode ─────────────────────────────────────────────────
    const locationMsg = message.locationMessage as Record<string, unknown> | undefined
    if (locationMsg && !text) {
      const lat = Number(locationMsg.degreesLatitude || 0)
      const lng = Number(locationMsg.degreesLongitude || 0)
      if (lat && lng) {
        const address = await reverseGeocode(lat, lng)
        const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`
        text = `[UBICACION: lat=${lat}, lng=${lng}, address="${address}", maps_url="${mapsUrl}"]`
      }
    }

    // Ignore empty or no phone
    if (!phone || !text) {
      return res.status(200).json({ ok: true, skipped: "no phone or text" })
    }

    // Check if bot is enabled
    const enabled = await getConfig("enabled")
    if (enabled === "false") {
      return res.status(200).json({ ok: true, skipped: "bot disabled" })
    }

    console.log(`[wa-webhook] ${fromMe ? "OUT" : "IN"} ${phone}: ${text.substring(0, 100)}`)

    // ── Handle outgoing (fromMe / message.sent) ──────────────────────────
    if (fromMe) {
      const waMsgId = String(data?.msgId || "")
      if (waMsgId && (await isBotEcho(waMsgId))) return res.status(200).json({ ok: true, skipped: "bot echo" })
      if (messageId && (await isBotEcho(messageId))) return res.status(200).json({ ok: true, skipped: "bot echo" })
      if (text && (await isRecentBotMessage(phone, text))) return res.status(200).json({ ok: true, skipped: "bot echo" })

      await getOrCreateConversation(phone)
      await setSessionStatus(phone, "human_active")
      await saveMessage(phone, "human", text, messageId)
      console.log(`[wa-webhook] 👤 Human took over ${phone}`)
      return res.status(200).json({ ok: true, action: "human_active" })
    }

    // ── Handle incoming — with per-phone lock ────────────────────────────
    const result = await withPhoneLock(phone, async () => {
      const conversation = await getOrCreateConversation(phone)

      if (replyJid && replyJid.includes("@")) await saveJid(phone, replyJid)
      await saveMessage(phone, "user", text, messageId)

      const lowerText = text.toLowerCase()

      // Batch 7 / B7.1: HARD detection of "hablar con humano" requests.
      // Hits BEFORE the LLM runs — guarantees handoff even if Dana misinterprets.
      // Excludes false positives like "humano" inside another word, "atención" alone, etc.
      const humanRegex = /\b(humano|persona real|hablar con (alguien|una persona)|atenci[oó]n humana|agente|hablar con un humano|operador real|no quiero (un )?bot|hablar con un (humano|operador)|quiero un humano|que (me )?atienda alguien|gente real)\b/i
      if (humanRegex.test(lowerText)) {
        const trigger = lowerText.match(humanRegex)?.[0] || ""
        console.log(`[wa-webhook] 🙋 Human handoff requested by ${phone}: "${text}"`)

        await setSessionStatus(phone, "human_active")
        await logFunnelEvent(phone, "human_handoff_requested", { trigger })

        const handoffMessage = `Aviso al equipo 🙋 Te escriben en breve.`
        const jidH = await getJid(phone)
        const sendToH = jidH || phone
        const sentH = await sendWhatsApp(sendToH, handoffMessage)
        if (sentH && sentH !== "sent") await saveBotMsgId(sentH)
        await saveMessage(phone, "assistant", handoffMessage, sentH || undefined)

        // Notify admin Telegram chat
        await notifyTelegramHumanHandoff(phone, text).catch((err) =>
          console.error("[wa-webhook] Telegram handoff notif failed:", err)
        )

        return { action: "human_handoff" }
      }

      // Batch 5 / F3.2: detect price-objection trigger words.
      // Logged before the LLM runs so we capture every occurrence even if Dana's
      // response misfires. Word-boundary regex avoids false positives ("descuento"
      // in a marketing reply matches but Dana's response is also captured).
      const objectionRegex = /\b(car[oa]s?|car[ií]simo|barato|rebaja|descuento|oferta|promo|promoci[oó]n|mejor precio|m[aá]s barato|barato afuera|pensar|pensarlo|pensando|pienso|pensari?a|d[ée]jame pensar|lo veo y te digo|lo decido|indecis[oa]|lo dudo|no s[eé] si)\b/i
      if (objectionRegex.test(lowerText)) {
        const m = lowerText.match(objectionRegex)
        await logFunnelEvent(phone, "objection_detected", {
          trigger: m?.[0] || "",
          full_message_excerpt: text.substring(0, 100),
        })
      }

      // Batch 4 / F1.1: detect response after a recovery message was sent.
      // If order_data.recovery_sent_at is recent (<24h), log recovery_responded
      // and clear the flag so we don't double-count.
      try {
        const od = conversation.order_data as { recovery_sent_at?: string } | null
        if (od?.recovery_sent_at) {
          const sentAt = new Date(od.recovery_sent_at).getTime()
          if (Date.now() - sentAt < 24 * 60 * 60 * 1000) {
            await logFunnelEvent(phone, "recovery_responded", { recovery_sent_at: od.recovery_sent_at })
          }
          // Clear the flag either way so it doesn't re-fire
          await clearOrderDataKey(phone, "recovery_sent_at")
        }
      } catch (err) {
        console.warn("[wa-webhook] recovery_responded detection failed:", err)
      }

      // B7+: detect customer returning after a closed human handoff (<24h).
      // Alert Telegram once per handoff cycle so the agent who took it knows.
      try {
        const od = conversation.order_data as {
          last_handoff_done_at?: string
          last_handoff_agent?: string
          handoff_return_alerted?: boolean
        } | null
        if (od?.last_handoff_done_at && !od.handoff_return_alerted) {
          const doneAt = new Date(od.last_handoff_done_at).getTime()
          if (Date.now() - doneAt < 24 * 60 * 60 * 1000) {
            await notifyTelegramHandoffReturn(phone, od.last_handoff_agent || "alguien", text).catch(() => {})
            // mark alerted = true so we don't spam every subsequent message
            await setOrderDataKey(phone, "handoff_return_alerted", true)
          } else {
            // >24h — clear the marker, return is no longer "recent"
            await clearOrderDataKey(phone, "last_handoff_done_at")
            await clearOrderDataKey(phone, "last_handoff_agent")
          }
        }
      } catch (err) {
        console.warn("[wa-webhook] handoff return detection failed:", err)
      }

      if (conversation.session_status === "human_active") {
        console.log(`[wa-webhook] Human active for ${phone} — bot silent`)
        return { action: "human_active_silent" }
      }

      // Fast-path: standalone greeting — always send full catalog, skip LLM
      // Triggers when the message is ONLY a greeting (no other content), regardless
      // of conversation history. Returning customers saying "hola" after days should
      // also get the full menu, not an LLM-summarized version.
      const isStandaloneGreeting = /^(hola+|hey+|buenas|buenos|saludos|hi+|hello+|qu[ée] tal|ey+|epa|holi+|holis)[\s!¡.¿?❤️🙂🌸👋]*$/i.test(text.trim())
      if (isStandaloneGreeting) {
        const reply = buildGreeting()
        const jid = await getJid(phone)
        const sendTo = jid || phone
        const sendResult = await sendWhatsApp(sendTo, reply)
        if (sendResult && sendResult !== "sent") await saveBotMsgId(sendResult)
        await saveMessage(phone, "assistant", reply, sendResult || undefined)
        await logFunnelEvent(phone, "greeting_sent", { via: "fast_path" })
        return { action: "greeting_fast" }
      }

      // Bot responds via LLM
      const reply = await chat(phone, text)

      const jid = await getJid(phone)
      const sendTo = jid || phone
      const sendResult = await sendWhatsApp(sendTo, reply)

      if (sendResult && sendResult !== "sent") await saveBotMsgId(sendResult)
      await saveMessage(phone, "assistant", reply, sendResult || undefined)

      return { action: "bot_replied" }
    })

    return res.status(200).json({ ok: true, ...result })
  } catch (err) {
    console.error("[wa-webhook] Error:", err)
    return res.status(200).json({ ok: false, error: "internal" })
  }
}

// GET for health check
export async function GET(_req: MedusaRequest, res: MedusaResponse) {
  const enabled = await getConfig("enabled").catch(() => "unknown")
  return res.status(200).json({ status: "ok", bot_enabled: enabled })
}
