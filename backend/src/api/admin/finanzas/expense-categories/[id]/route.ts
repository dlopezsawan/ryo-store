import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import FinanzasModuleService from "../../../../../modules/finanzas/service"
import { FINANZAS_MODULE } from "../../../../../modules/finanzas"

export async function PATCH(req: MedusaRequest, res: MedusaResponse) {
  const fin: FinanzasModuleService = req.scope.resolve(FINANZAS_MODULE)
  const id = req.params.id
  const body = (req.body || {}) as Record<string, unknown>
  const allowed = [
    "name", "bucket", "description", "is_recurring",
    "recurring_amount_usdt", "recurring_day_of_month", "is_active",
  ] as const
  const update: Record<string, unknown> = { id }
  for (const k of allowed) if (k in body) update[k] = body[k]
  const category = await fin.updateFinanzasExpenseCategories(update as { id: string })
  res.json({ category })
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const fin: FinanzasModuleService = req.scope.resolve(FINANZAS_MODULE)
  await fin.deleteFinanzasExpenseCategories(req.params.id)
  res.json({ deleted: true })
}
