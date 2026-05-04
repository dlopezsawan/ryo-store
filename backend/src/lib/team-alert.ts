/**
 * Team alerts — internal Telegram notifications for high-touch remarketing
 * signals where automatic dispatch would feel spammy and a human should engage.
 *
 * Uses the same `telegram_bot_token` + `telegram_chat_id` config keys that the
 * WhatsApp bot uses for order notifications. If unconfigured, returns false
 * silently — the engine will mark the fire as `failed` with a clear reason.
 */

import { getConfig } from "./whatsapp-db"

export async function isTeamAlertConfigured(): Promise<boolean> {
  const token = await getConfig("telegram_bot_token")
  const chatId = await getConfig("telegram_chat_id")
  return !!(token && chatId)
}

export interface TeamAlertPayload {
  /** Top-level header (e.g. "🚨 Lead caliente — 3 checkouts abandonados") */
  title: string
  /** Free-form body (HTML allowed, Telegram parse_mode=HTML) */
  body: string
  /** Optional CTA buttons (label + url). Telegram supports url buttons */
  buttons?: Array<{ text: string; url: string }>
}

/**
 * Sends a team alert via Telegram. Returns true on 2xx response.
 *
 * Designed to be a drop-in dispatcher for the engine when channel === "team_alert".
 * Never throws — caller should treat false as "dispatch failed" and log accordingly.
 */
export async function sendTeamAlert(payload: TeamAlertPayload): Promise<boolean> {
  try {
    const token = await getConfig("telegram_bot_token")
    const chatId = await getConfig("telegram_chat_id")
    if (!token || !chatId) {
      console.warn("[team-alert] Telegram not configured")
      return false
    }

    const text = `${payload.title}\n\n${payload.body}`
    const inline_keyboard = payload.buttons?.length
      ? [payload.buttons.map((b) => ({ text: b.text, url: b.url }))]
      : undefined

    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
        reply_markup: inline_keyboard ? { inline_keyboard } : undefined,
      }),
    })
    if (!r.ok) {
      const errText = await r.text().catch(() => "")
      console.error(`[team-alert] Telegram ${r.status}: ${errText.slice(0, 200)}`)
      return false
    }
    return true
  } catch (err) {
    console.error("[team-alert] dispatch failed:", (err as Error).message)
    return false
  }
}
