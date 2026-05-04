import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { status as bufferQuotaStatus } from "../../../../lib/buffer-quota"

/**
 * GET /admin/social/buffer-status
 *
 * Returns our current view of Buffer quota:
 *   - used_24h: calls we've made in the last 24h
 *   - cap: our self-imposed daily limit (BUFFER_DAILY_CAP, default 60)
 *   - remaining: cap - used_24h
 *   - rate_limited_until: ISO timestamp if we're in a cooldown, else null
 *   - reset_at: when the oldest call in the window ages out
 *
 * This is what the admin quota badge polls — cheap, no Buffer API calls,
 * just DB counts.
 */
export async function GET(_req: MedusaRequest, res: MedusaResponse) {
  const s = await bufferQuotaStatus()
  return res.json(s)
}
