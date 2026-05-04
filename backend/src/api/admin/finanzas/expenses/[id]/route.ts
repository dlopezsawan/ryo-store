import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import FinanzasModuleService from "../../../../../modules/finanzas/service"
import { FINANZAS_MODULE } from "../../../../../modules/finanzas"

export async function PATCH(req: MedusaRequest, res: MedusaResponse) {
  const fin: FinanzasModuleService = req.scope.resolve(FINANZAS_MODULE)
  const id = req.params.id
  const body = (req.body || {}) as Record<string, unknown> & { correction_note?: string }

  const before = await fin.retrieveFinanzasExpense(id).catch(() => null)
  if (!before) return res.status(404).json({ error: "not_found" })

  // Closed-month gate.
  try {
    await fin.assertNotClosedOrCorrection(before.expense_date, body.correction_note ?? null)
  } catch (e) {
    return res.status(409).json({ error: (e as Error).message })
  }

  const allowed = [
    "category_id", "description", "amount_usdt", "amount_bs",
    "rate_bs_per_usdt", "paid_from_wallet_id", "receipt_url",
    "expense_date", "notes", "status",
  ] as const
  const update: Record<string, unknown> = { id }
  for (const k of allowed) if (k in body) update[k] = body[k]
  if (typeof update.expense_date === "string") {
    update.expense_date = new Date(update.expense_date)
  }
  const updated = await fin.updateFinanzasExpenses(update as { id: string })
  const after = Array.isArray(updated) ? updated[0] : updated

  // Status transition pending_payment → paid: write ledger entry
  if (before.status !== "paid" && after.status === "paid") {
    const walletId = after.paid_from_wallet_id ||
      (await fin.getDefaultWalletForCurrency("usdt"))?.id
    if (walletId) {
      await fin.writeWalletEntry({
        wallet_id: walletId,
        amount: -Math.abs(Number(after.amount_usdt)),
        currency: "usdt",
        source_type: "expense",
        source_id: after.id,
        note: after.description,
        entry_at: new Date(after.expense_date),
      })
    }
  }
  // Reverse transition paid → pending_payment: reverse the entry
  if (before.status === "paid" && after.status !== "paid") {
    await fin.reverseEntriesBySource("expense", after.id)
  }
  // Amount edited while paid: reverse + rewrite
  if (
    before.status === "paid" &&
    after.status === "paid" &&
    Number(before.amount_usdt) !== Number(after.amount_usdt)
  ) {
    await fin.reverseEntriesBySource("expense", after.id)
    const walletId = after.paid_from_wallet_id ||
      (await fin.getDefaultWalletForCurrency("usdt"))?.id
    if (walletId) {
      await fin.writeWalletEntry({
        wallet_id: walletId,
        amount: -Math.abs(Number(after.amount_usdt)),
        currency: "usdt",
        source_type: "expense",
        source_id: after.id,
        note: after.description,
        entry_at: new Date(after.expense_date),
      })
    }
  }

  await fin.recordAudit({
    entity_type: "expense",
    entity_id: id,
    action: "update",
    before: before as unknown as Record<string, unknown>,
    after: after as unknown as Record<string, unknown>,
    note: body.correction_note ?? null,
  })
  res.json({ expense: after })
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const fin: FinanzasModuleService = req.scope.resolve(FINANZAS_MODULE)
  const id = req.params.id
  const body = (req.body || {}) as { correction_note?: string }
  const before = await fin.retrieveFinanzasExpense(id).catch(() => null)
  if (!before) return res.status(404).json({ error: "not_found" })
  try {
    await fin.assertNotClosedOrCorrection(before.expense_date, body.correction_note ?? null)
  } catch (e) {
    return res.status(409).json({ error: (e as Error).message })
  }
  await fin.reverseEntriesBySource("expense", id)
  await fin.deleteFinanzasExpenses(id)
  await fin.recordAudit({
    entity_type: "expense",
    entity_id: id,
    action: "delete",
    before: before as unknown as Record<string, unknown>,
    note: body.correction_note ?? null,
  })
  res.json({ deleted: true })
}
