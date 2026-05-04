/**
 * GET /admin/finanzas/audit-log
 *   Query params: ?entity_type=&entity_id=&limit=50&offset=0
 */

import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import FinanzasModuleService from "../../../../modules/finanzas/service"
import { FINANZAS_MODULE } from "../../../../modules/finanzas"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const fin: FinanzasModuleService = req.scope.resolve(FINANZAS_MODULE)
  const limit = Math.min(Number(req.query.limit) || 100, 500)
  const offset = Number(req.query.offset) || 0
  const filters: Record<string, unknown> = {}
  if (typeof req.query.entity_type === "string") filters.entity_type = req.query.entity_type
  if (typeof req.query.entity_id === "string") filters.entity_id = req.query.entity_id
  const entries = await fin.listFinanzasAuditLogs(filters, {
    take: limit,
    skip: offset,
    order: { at: "DESC" },
  } as never)
  res.json({ entries })
}
