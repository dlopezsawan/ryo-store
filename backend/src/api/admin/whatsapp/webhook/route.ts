/**
 * WhatsApp Webhook — receives incoming messages from WaSenderAPI
 *
 * POST /admin/whatsapp/webhook
 *
 * Flow:
 * 1. Parse WaSenderAPI payload
 * 2. If fromMe → check if bot echo → if human writing, mark session human_active
 * 3. If customer message → check session → if bot_active → LLM → reply
 */

import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  ensureTables,
  getConfig,
  getOrCreateConversation,
  setSessionStatus,
  saveMessage,
  isBotEcho,
} from "../../../../lib/whatsapp-db"
import { chat } from "../../../../lib/whatsapp-bot"
import { sendWhatsApp } from "../../../../lib/whatsapp-sender"

let tablesReady = false

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  // Ensure tables exist on first call
  if (!tablesReady) {
    try {
      await ensureTables()
      tablesReady = true
    } catch (err) {
      console.error("[wa-webhook] Table setup failed:", err)
    }
  }

  try {
    const body = req.body as Record<string, unknown>

    // WaSenderAPI sends messages in different formats — normalize
    const data = (body?.data || body) as Record<string, unknown>
    const message = data?.message || data
    const msgData = (typeof message === "object" ? message : {}) as Record<string, unknown>

    // Extract fields
    const fromMe = msgData.fromMe === true || data?.fromMe === true
    const phone = String(
      msgData.from || msgData.remoteJid || data?.from || data?.phone || ""
    ).replace(/@.*/, "").replace(/\D/g, "")
    const text = String(
      msgData.body || msgData.text || msgData.conversation ||
      data?.body || data?.text || data?.message || ""
    ).trim()
    const messageId = String(msgData.id || msgData.messageId || data?.messageId || "")

    // Ignore empty or non-text
    if (!phone || !text) {
      return res.status(200).json({ ok: true, skipped: "no phone or text" })
    }

    // Check if bot is enabled
    const enabled = await getConfig("enabled")
    if (enabled === "false") {
      return res.status(200).json({ ok: true, skipped: "bot disabled" })
    }

    console.log(`[wa-webhook] ${fromMe ? "OUTGOING" : "INCOMING"} ${phone}: ${text.substring(0, 80)}`)

    // ── Handle outgoing messages (fromMe) ──────────────────────────────
    if (fromMe) {
      // Check if this is an echo of the bot's own message
      if (messageId && (await isBotEcho(messageId))) {
        return res.status(200).json({ ok: true, skipped: "bot echo" })
      }

      // It's the human admin writing → mark session as human_active
      await getOrCreateConversation(phone)
      await setSessionStatus(phone, "human_active")
      await saveMessage(phone, "human", text, messageId)
      console.log(`[wa-webhook] 👤 Human took over conversation with ${phone}`)
      return res.status(200).json({ ok: true, action: "human_active" })
    }

    // ── Handle incoming customer messages ────────────────────────────────
    const conversation = await getOrCreateConversation(phone)

    // Save user message
    await saveMessage(phone, "user", text, messageId)

    // If human is handling this conversation, don't respond
    if (conversation.session_status === "human_active") {
      console.log(`[wa-webhook] Session human_active for ${phone} — bot silent`)
      return res.status(200).json({ ok: true, action: "human_active_silent" })
    }

    // ── Bot responds ────────────────────────────────────────────────────
    const reply = await chat(phone, text)

    // Send via WaSenderAPI
    const sendResult = await sendWhatsApp(phone, reply)

    // Save bot response
    await saveMessage(phone, "assistant", reply, typeof sendResult === "string" ? sendResult : undefined)

    return res.status(200).json({ ok: true, action: "bot_replied" })
  } catch (err) {
    console.error("[wa-webhook] Error:", err)
    return res.status(200).json({ ok: false, error: "internal" })
    // Return 200 even on error to prevent WaSenderAPI retries
  }
}

// GET for health check
export async function GET(_req: MedusaRequest, res: MedusaResponse) {
  const enabled = await getConfig("enabled").catch(() => "unknown")
  return res.status(200).json({ status: "ok", bot_enabled: enabled })
}
