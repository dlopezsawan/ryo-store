/**
 * WaSenderAPI client — sends WhatsApp messages
 * https://wasenderapi.com/api/send-message
 */

import { getConfig } from "./whatsapp-db"

export async function sendWhatsApp(phone: string, text: string): Promise<string | false> {
  const apiKey = await getConfig("wasender_key")
  if (!apiKey) {
    console.warn("[whatsapp] No WaSenderAPI key configured — skipping send")
    return false
  }

  // If the input already contains @ (cached JID from inbound webhook with the
  // user's real `@lid` LID), use as-is. Otherwise it's a raw phone number → use
  // `@s.whatsapp.net` (the standard WhatsApp JID format). DO NOT use `@lid`
  // here because that suffix needs the user's WhatsApp Linked ID number, NOT
  // their phone — appending `@lid` to a raw phone produces a malformed JID
  // that WaSenderAPI silently swallows (200 OK, msgId returned, never delivers).
  const cleanPhone = phone.replace(/[\s+\-()]/g, "")
  const to = cleanPhone.includes("@") ? cleanPhone : `${cleanPhone}@s.whatsapp.net`
  console.log(`[whatsapp] Sending to: ${to} (input: ${phone})`)

  try {
    const res = await fetch("https://wasenderapi.com/api/send-message", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ to, text }),
    })

    const rawBody = await res.text()
    console.log("[whatsapp] WaSenderAPI response:", res.status, rawBody.substring(0, 500))

    if (!res.ok) {
      console.error("[whatsapp] WaSenderAPI error:", res.status, rawBody)
      return false
    }

    let data: Record<string, unknown> = {}
    try { data = JSON.parse(rawBody) } catch {}
    const innerData = (data?.data || {}) as Record<string, unknown>
    const msgId = String(innerData?.msgId || "")
    console.log("[whatsapp] ✅ Message sent to", to, "msgId:", msgId)
    return msgId || "sent"
  } catch (err) {
    console.error("[whatsapp] Send failed:", err)
    return false
  }
}

/**
 * Send a WhatsApp image with optional caption.
 *
 * WaSenderAPI does NOT have a separate /api/send-image endpoint — that path
 * returns a 404 HTML page. Images go through the regular /api/send-message
 * endpoint with an `imageUrl` field; the optional caption is `text`.
 */
export async function sendWhatsAppImage(phone: string, imageUrl: string, caption?: string): Promise<string | false> {
  const apiKey = await getConfig("wasender_key")
  if (!apiKey) return false

  const cleanPhone = phone.replace(/[\s+\-()]/g, "")
  const to = cleanPhone.includes("@") ? cleanPhone : `${cleanPhone}@s.whatsapp.net`

  try {
    const res = await fetch("https://wasenderapi.com/api/send-message", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ to, imageUrl, text: caption || "" }),
    })
    const rawBody = await res.text()
    console.log("[whatsapp] sendImage response:", res.status, rawBody.substring(0, 300))
    if (!res.ok) { console.error("[whatsapp] Image send error:", res.status, rawBody); return false }
    let data: Record<string, unknown> = {}
    try { data = JSON.parse(rawBody) } catch {}
    const innerData = (data?.data || {}) as Record<string, unknown>
    return String(innerData?.msgId || "sent")
  } catch (err) {
    console.error("[whatsapp] Image send failed:", err)
    return false
  }
}

/**
 * Send a WhatsApp message to the store owner (for order notifications etc.)
 */
export async function notifyOwner(text: string): Promise<boolean> {
  const ownerPhone = await getConfig("owner_phone")
  if (!ownerPhone) {
    console.warn("[whatsapp] No owner phone configured — skipping notification")
    return false
  }
  const result = await sendWhatsApp(ownerPhone, text)
  return !!result
}
