/**
 * Job: Auto-close inactive WhatsApp sessions
 * - human_active sessions inactive > 30 min → back to bot_active
 * - bot_active sessions inactive > 2h → reset
 * Runs every 5 minutes.
 */

import { closeInactiveSessions, getConfig, ensureTables } from "../lib/whatsapp-db"
import { wrapJob } from "../lib/job-runner"

let ready = false

async function whatsappSessionCleanup() {
  if (!ready) {
    try { await ensureTables(); ready = true } catch { /* ignore */ }
  }

  try {
    const humanTimeout = parseInt((await getConfig("human_timeout")) || "30")
    const botTimeout = parseInt((await getConfig("bot_timeout")) || "120")

    const result = await closeInactiveSessions(humanTimeout, botTimeout)

    if (result.humanClosed > 0 || result.botReset > 0) {
      console.log(
        `[wa-cleanup] Closed ${result.humanClosed} human sessions, reset ${result.botReset} bot sessions`
      )
    }
  } catch (err) {
    console.error("[wa-cleanup] Error:", err)
  }
}

export default wrapJob("whatsapp-session-cleanup", whatsappSessionCleanup)

export const config = {
  name: "whatsapp-session-cleanup",
  schedule: "*/5 * * * *", // every 5 minutes
}
