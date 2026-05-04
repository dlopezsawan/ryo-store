/**
 * POST /admin/finanzas/pago-movil/:id/recompute
 *
 * Recompute COGS, combo discount, margin and splits for one pago_movil using
 * current product_cost values + current split_rule percentages, preserving the
 * BCV/USDT rate snapshot stored on the row.
 */

import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import FinanzasModuleService from "../../../../../../modules/finanzas/service"
import { FINANZAS_MODULE } from "../../../../../../modules/finanzas"

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const fin: FinanzasModuleService = req.scope.resolve(FINANZAS_MODULE)
  const id = req.params.id
  const pm = await fin.retrieveFinanzasPagoMovil(id).catch(() => null)
  if (!pm) return res.status(404).json({ error: "not_found" })
  await fin.recomputePagoMovil(id)
  const fresh = await fin.retrieveFinanzasPagoMovil(id)
  res.json({ pago_movil: fresh, recomputed: true })
}
