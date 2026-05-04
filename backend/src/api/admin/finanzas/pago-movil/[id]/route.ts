import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import FinanzasModuleService from "../../../../../modules/finanzas/service"
import { FINANZAS_MODULE } from "../../../../../modules/finanzas"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const fin: FinanzasModuleService = req.scope.resolve(FINANZAS_MODULE)
  const id = req.params.id
  const pagoMovil = await fin.retrieveFinanzasPagoMovil(id).catch(() => null)
  if (!pagoMovil) return res.status(404).json({ error: "not_found" })
  const lines = await fin.listFinanzasPagoMovilLines({ pago_movil_id: id })
  const conversions = await fin.listFinanzasConversions(
    { pago_movil_id: id },
    { order: { converted_at: "DESC" } } as never
  )
  res.json({ pago_movil: pagoMovil, lines, conversions })
}

export async function PATCH(req: MedusaRequest, res: MedusaResponse) {
  const fin: FinanzasModuleService = req.scope.resolve(FINANZAS_MODULE)
  const id = req.params.id
  const body = (req.body || {}) as Record<string, unknown>
  const allowed = ["status", "notes"] as const
  const update: Record<string, unknown> = { id }
  for (const k of allowed) if (k in body) update[k] = body[k]
  const updated = await fin.updateFinanzasPagoMovils(update as { id: string })
  res.json({ pago_movil: updated })
}
