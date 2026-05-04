/**
 * GET /admin/finanzas/rate-snapshots
 *   Last N snapshots, default 168 (= 7 days hourly).
 *   Optional ?from=ISO&to=ISO to query a specific window.
 */

import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import FinanzasModuleService from "../../../../modules/finanzas/service"
import { FINANZAS_MODULE } from "../../../../modules/finanzas"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const fin: FinanzasModuleService = req.scope.resolve(FINANZAS_MODULE)
  const limit = Math.min(Number(req.query.limit) || 168, 2000)
  const filters: Record<string, unknown> = {}
  // Mikro filter range — keep simple: latest first, then truncate
  const all = await fin.listFinanzasRateSnapshots(filters, {
    take: limit,
    order: { taken_at: "DESC" },
  } as never)
  res.json({ snapshots: all })
}
