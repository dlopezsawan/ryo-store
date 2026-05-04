import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import FinanzasModuleService from "../../../../../modules/finanzas/service"
import { FINANZAS_MODULE } from "../../../../../modules/finanzas"

export async function PATCH(req: MedusaRequest, res: MedusaResponse) {
  const fin: FinanzasModuleService = req.scope.resolve(FINANZAS_MODULE)
  const id = req.params.id
  const body = (req.body || {}) as { body?: string; resolved?: boolean }
  const update: Record<string, unknown> = { id }
  if (typeof body.body === "string") update.body = body.body.trim()
  if (body.resolved === true) update.resolved_at = new Date()
  if (body.resolved === false) update.resolved_at = null
  const updated = await fin.updateFinanzasComments(update as { id: string })
  res.json({ comment: Array.isArray(updated) ? updated[0] : updated })
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const fin: FinanzasModuleService = req.scope.resolve(FINANZAS_MODULE)
  await fin.deleteFinanzasComments(req.params.id)
  res.json({ deleted: true })
}
