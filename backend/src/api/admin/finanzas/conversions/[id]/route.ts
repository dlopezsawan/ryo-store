import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import FinanzasModuleService from "../../../../../modules/finanzas/service"
import { FINANZAS_MODULE } from "../../../../../modules/finanzas"

/**
 * PATCH /admin/finanzas/conversions/:id    edit metadata fields (note only)
 */
export async function PATCH(req: MedusaRequest, res: MedusaResponse) {
  const fin: FinanzasModuleService = req.scope.resolve(FINANZAS_MODULE)
  const id = req.params.id
  const body = (req.body || {}) as { note?: string; correction_note?: string }
  const before = await fin.retrieveFinanzasConversion(id).catch(() => null)
  if (!before) return res.status(404).json({ error: "not_found" })
  try {
    await fin.assertNotClosedOrCorrection(before.converted_at, body.correction_note ?? null)
  } catch (e) {
    return res.status(409).json({ error: (e as Error).message })
  }
  if (typeof body.note !== "string") {
    return res.status(400).json({ error: "only `note` editable here" })
  }
  const updated = await fin.updateFinanzasConversions({ id, note: body.note })
  await fin.recordAudit({
    entity_type: "conversion",
    entity_id: id,
    action: "update",
    before: { note: before.note },
    after: { note: body.note },
    note: body.correction_note ?? null,
  })
  res.json({ conversion: Array.isArray(updated) ? updated[0] : updated })
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const fin: FinanzasModuleService = req.scope.resolve(FINANZAS_MODULE)
  const id = req.params.id
  const body = (req.body || {}) as { correction_note?: string }
  const conversion = await fin.retrieveFinanzasConversion(id).catch(() => null)
  if (!conversion) return res.status(404).json({ error: "not_found" })

  try {
    await fin.assertNotClosedOrCorrection(conversion.converted_at, body.correction_note ?? null)
  } catch (e) {
    return res.status(409).json({ error: (e as Error).message })
  }

  await fin.reverseEntriesBySource("conversion_out", id)
  await fin.reverseEntriesBySource("conversion_in", id)
  await fin.deleteFinanzasConversions(id)
  // Only recompute when the conversion was linked to a pago_movil.
  // Standalone conversions (pago_movil_id IS NULL) have nothing to
  // recompute on the parent.
  if (conversion.pago_movil_id) {
    await fin.recomputePagoMovilConversionStatus(conversion.pago_movil_id)
  }
  await fin.recordAudit({
    entity_type: "conversion",
    entity_id: id,
    action: "delete",
    before: conversion as unknown as Record<string, unknown>,
    note: body.correction_note ?? null,
  })
  res.json({ deleted: true })
}
