/**
 * GET /admin/finanzas/product-costs/:id/history
 *   Returns the version timeline for the variant referenced by this cost row.
 */

import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import FinanzasModuleService from "../../../../../../modules/finanzas/service"
import { FINANZAS_MODULE } from "../../../../../../modules/finanzas"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const fin: FinanzasModuleService = req.scope.resolve(FINANZAS_MODULE)
  const cost = await fin.retrieveFinanzasProductCost(req.params.id).catch(() => null)
  if (!cost) return res.status(404).json({ error: "not_found" })
  const history = await fin.listFinanzasProductCostHistories(
    { variant_id: cost.variant_id },
    { order: { valid_from: "DESC" } } as never
  )
  res.json({ cost, history })
}
