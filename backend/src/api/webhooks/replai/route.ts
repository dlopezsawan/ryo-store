/**
 * Replai Webhook — recibe mensajes entrantes de WhatsApp vía Replai (pasarela).
 *
 * POST /webhooks/replai   (público; autenticado por firma HMAC, no por API key)
 *
 * Replai firma cada entrega: header `X-Replai-Signature: t=<unix_ms>,v1=<hex>`
 * donde v1 = HMAC-SHA256(secret, "<t>.<rawBody>"). El raw body lo captura el
 * middleware (ver src/api/middlewares.ts). Tolerancia de replay ±5 min.
 *
 * Payload entrante (event="message.received"):
 *   { event, deliveryId, payload: { sessionId, messageId, remoteJid, keyId, body, pushName } }
 *
 * Reusa el cerebro de Dana (chat/buildGreeting) y el estado (whatsapp-db);
 * responde por Replai (sendViaReplai) en vez de WaSenderAPI.
 */

import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import crypto from "crypto"
import {
  ensureTables,
  getConfig,
  getOrCreateConversation,
  setSessionStatus,
  saveMessage,
  isBotEcho,
  saveBotMsgId,
} from "../../../lib/whatsapp-db"
import { chat, buildGreeting } from "../../../lib/whatsapp-bot"
import { sendViaReplai, resolveReplaiMediaId, downloadReplaiMedia } from "../../../lib/replai-sender"

let tablesReady = false
const WEBHOOK_SECRET = process.env.REPLAI_WEBHOOK_SECRET || ""
const REPLAY_TOLERANCE_MS = 5 * 60 * 1000

/** Verifica la firma HMAC de Replai sobre el body crudo. */
function verifySignature(rawBody: string, header: string): boolean {
  if (!WEBHOOK_SECRET || !header) return false
  const parts: Record<string, string> = {}
  for (const kv of header.split(",")) {
    const i = kv.indexOf("=")
    if (i > 0) parts[kv.slice(0, i).trim()] = kv.slice(i + 1).trim()
  }
  const t = parts.t
  const v1 = parts.v1
  if (!t || !v1) return false
  const tMs = Number(t)
  if (!Number.isFinite(tMs) || Math.abs(Date.now() - tMs) > REPLAY_TOLERANCE_MS) return false
  const expected = crypto.createHmac("sha256", WEBHOOK_SECRET).update(`${t}.${rawBody}`).digest("hex")
  try {
    const a = Buffer.from(expected, "hex")
    const b = Buffer.from(v1, "hex")
    return a.length === b.length && crypto.timingSafeEqual(a, b)
  } catch {
    return false
  }
}

// Saludo standalone → menú completo, salta el LLM (igual que el webhook WaSender).
const GREETING_RE = /^(hola+|hey+|buenas|buenos|saludos|hi+|hello+|qu[ée] tal|ey+|epa|holi+|holis)[\s!¡.¿?❤️🙂🌸👋]*$/i
// "Quiero hablar con un humano" → handoff (pausa el bot).
const HUMAN_RE = /\b(humano|persona real|hablar con (alguien|una persona)|atenci[oó]n humana|agente|operador real|no quiero (un )?bot|quiero un humano|gente real)\b/i

/** Transcribe una nota de voz de Replai con Groq Whisper. Devuelve texto o null. */
async function transcribeReplaiAudio(
  remoteJid: string,
  messageId: string,
  payload: { mediaId?: string; media?: { id?: string } },
  groqKey: string | null
): Promise<string | null> {
  if (!groqKey) {
    console.warn("[replai-webhook] sin groq_key — no se transcribe el audio")
    return null
  }
  const mediaId =
    payload.mediaId || payload.media?.id || (await resolveReplaiMediaId(remoteJid, messageId))
  if (!mediaId) {
    console.warn("[replai-webhook] no se pudo resolver el mediaId del audio")
    return null
  }
  const media = await downloadReplaiMedia(mediaId)
  if (!media || media.buffer.length < 100) {
    console.warn("[replai-webhook] descarga de audio vacía / fallida")
    return null
  }
  try {
    const mime = media.mimeType.split(";")[0].trim() || "audio/ogg"
    const ext = mime.includes("ogg")
      ? "ogg"
      : mime.includes("m4a") || mime.includes("mp4")
        ? "m4a"
        : mime.includes("mpeg") || mime.includes("mp3")
          ? "mp3"
          : "ogg"
    const form = new FormData()
    form.append("file", new Blob([new Uint8Array(media.buffer)], { type: mime }), `audio.${ext}`)
    form.append("model", "whisper-large-v3")
    form.append("language", "es")
    const r = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${groqKey}` },
      body: form,
      signal: AbortSignal.timeout(30000),
    })
    if (!r.ok) {
      console.error("[replai-webhook] Groq Whisper error:", r.status, await r.text().catch(() => ""))
      return null
    }
    const data = (await r.json()) as { text?: string }
    console.log("[replai-webhook] 🎤 transcrito:", data.text?.slice(0, 80))
    return (data.text || "").trim() || null
  } catch (e) {
    console.error("[replai-webhook] transcripción falló:", e)
    return null
  }
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  if (!tablesReady) {
    try {
      await ensureTables()
      tablesReady = true
    } catch {
      /* tolerate; ensureTables is idempotent */
    }
  }

  // ── 1. Verificar firma sobre el raw body ──────────────────────────────────
  const rawBody = (req as unknown as { rawBody?: string }).rawBody ?? JSON.stringify(req.body ?? {})
  const sig = String(req.headers["x-replai-signature"] || "")
  if (!verifySignature(rawBody, sig)) {
    return res.status(401).json({ error: "invalid_signature" })
  }

  const body = (req.body ?? {}) as {
    event?: string
    deliveryId?: string
    payload?: {
      sessionId?: string
      messageId?: string
      remoteJid?: string
      body?: { type?: string; text?: string }
      pushName?: string
    }
  }

  // Solo procesamos mensajes ENTRANTES de clientes. message.sent / delivered → ignorar.
  if (body.event !== "message.received") {
    return res.status(200).json({ ok: true, skipped: body.event || "no_event" })
  }

  const p = body.payload || {}
  const remoteJid = String(p.remoteJid || "")

  // Dana NO responde en grupos. Los JIDs de grupo terminan en "@g.us"
  // (los chats 1:1 son @s.whatsapp.net o @lid). Ignoramos sin procesar.
  if (remoteJid.includes("@g.us") || remoteJid.endsWith("@broadcast") || remoteJid.includes("@newsletter")) {
    return res.status(200).json({ ok: true, skipped: "group_or_broadcast" })
  }

  const phone = remoteJid.replace(/@.*/, "").replace(/\D/g, "")
  const messageId = String(p.messageId || "")
  const bodyType = p.body?.type || "unknown"
  if (!phone) {
    return res.status(200).json({ ok: true, skipped: "no_phone" })
  }

  // Dedup de reintentos ANTES de transcribir (no re-procesar la misma entrega).
  if (messageId && (await isBotEcho(messageId))) {
    return res.status(200).json({ ok: true, skipped: "dup" })
  }

  // Bot deshabilitado desde el panel.
  if ((await getConfig("enabled")) === "false") {
    return res.status(200).json({ ok: true, skipped: "bot_disabled" })
  }

  // Resolver el texto: directo, o transcribiendo la nota de voz (Groq Whisper).
  let text = bodyType === "text" ? String(p.body?.text || "").trim() : ""
  if (!text && bodyType === "audio") {
    text =
      (await transcribeReplaiAudio(
        remoteJid,
        messageId,
        p as { mediaId?: string; media?: { id?: string } },
        await getConfig("groq_key")
      )) || ""
  }

  try {
    const conversation = await getOrCreateConversation(phone)

    // Sin texto utilizable (audio no transcrito o tipo no soportado: imagen,
    // ubicación, etc.) → guardar el mensaje y, si el bot está activo, mandar un
    // fallback amable pidiendo texto. No rompemos el flujo de Dana.
    if (!text) {
      await saveMessage(phone, "user", bodyType === "audio" ? "[nota de voz]" : `[${bodyType}]`, messageId)
      if (conversation.session_status !== "human_active") {
        const fb =
          bodyType === "audio"
            ? "Recibí tu nota de voz 🌸 pero no pude escucharla bien. ¿Me lo escribes porfa?"
            : "Recibí tu mensaje 🌸 ¿me lo mandas por texto? Así te ayudo mejor."
        const sent = await sendViaReplai(remoteJid || phone, fb)
        if (sent && sent !== "sent") await saveBotMsgId(sent)
        await saveMessage(phone, "assistant", fb, sent || undefined)
      }
      return res.status(200).json({ ok: true, action: `fallback_${bodyType}` })
    }

    await saveMessage(phone, "user", text, messageId)

    // Operador con control → bot callado.
    if (conversation.session_status === "human_active") {
      return res.status(200).json({ ok: true, action: "human_active_silent" })
    }

    // Pedido explícito de humano → handoff (pausa el bot, no responde).
    if (HUMAN_RE.test(text.toLowerCase())) {
      await setSessionStatus(phone, "human_active")
      return res.status(200).json({ ok: true, action: "human_handoff" })
    }

    // Saludo → menú completo (fast-path). Si no, el LLM de Dana.
    const reply = GREETING_RE.test(text) ? buildGreeting() : await chat(phone, text)

    const sent = await sendViaReplai(remoteJid || phone, reply)
    if (sent && sent !== "sent") await saveBotMsgId(sent)
    await saveMessage(phone, "assistant", reply, sent || undefined)

    return res.status(200).json({ ok: true, action: "bot_replied" })
  } catch (e) {
    console.error("[replai-webhook] error:", e)
    // 200 para que Replai no reintente eternamente un error de lógica;
    // el error queda logueado para depurar.
    return res.status(200).json({ ok: false, error: "internal" })
  }
}

export async function GET(_req: MedusaRequest, res: MedusaResponse) {
  return res.status(200).json({
    ok: true,
    service: "replai-webhook",
    configured: Boolean(WEBHOOK_SECRET),
  })
}
