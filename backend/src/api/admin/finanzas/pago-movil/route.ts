import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import FinanzasModuleService from "../../../../modules/finanzas/service"
import { FINANZAS_MODULE } from "../../../../modules/finanzas"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const fin: FinanzasModuleService = req.scope.resolve(FINANZAS_MODULE)
  const limit = Math.min(Number(req.query.limit) || 50, 200)
  const offset = Number(req.query.offset) || 0
  const status = typeof req.query.status === "string" ? req.query.status : undefined
  const filters: Record<string, unknown> = {}
  if (status) filters.status = status

  const rows = await fin.listFinanzasPagoMovils(filters, {
    take: limit,
    skip: offset,
    order: { created_at: "DESC" },
  } as never)
  res.json({ pago_movils: rows, count: rows.length })
}
