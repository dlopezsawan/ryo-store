/**
 * GET /admin/remarketing/fires
 *   ?rule_key=...       optional filter
 *   ?status=...         optional filter  (sent, failed, skipped_cooldown, ...)
 *   ?since_hours=24     default 168 (7d)
 *   ?limit=100          max 500
 */

import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { listFires, type FireStatus } from "../../../../lib/remarketing-rules-db"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const rule_key = req.query.rule_key ? String(req.query.rule_key) : undefined
    const status = req.query.status ? (String(req.query.status) as FireStatus) : undefined
    const since_hours = req.query.since_hours ? Number(req.query.since_hours) : 168
    const limit = req.query.limit ? Number(req.query.limit) : 100
    const fires = await listFires({ rule_key, status, since_hours, limit })
    res.json({ fires, count: fires.length })
  } catch (err) {
    console.error("[fires GET] error:", err)
    res.status(500).json({ error: (err as Error).message })
  }
}
