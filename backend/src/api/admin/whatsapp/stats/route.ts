/**
 * Bot stats API
 * GET /admin/whatsapp/stats
 */

import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { getBotStats, ensureTables } from "../../../../lib/whatsapp-db"

let ready = false

export async function GET(_req: MedusaRequest, res: MedusaResponse) {
  if (!ready) { await ensureTables(); ready = true }
  const stats = await getBotStats()
  return res.json(stats)
}
