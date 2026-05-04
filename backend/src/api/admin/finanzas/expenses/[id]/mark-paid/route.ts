/**
 * POST /admin/finanzas/expenses/:id/mark-paid
 *   body (optional): { paid_from_wallet_id?, paid_at? }
 *   Convenience endpoint for the auto-generated `pending_payment` rows the
 *   recurring-expenses cron creates. Transitions to status="paid" and writes
 *   the ledger entry on the chosen wallet.
 */

import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import FinanzasModuleService from "../../../../../../modules/finanzas/service"
import { FINANZAS_MODULE } from "../../../../../../modules/finanzas"

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const fin: FinanzasModuleService = req.scope.resolve(FINANZAS_MODULE)
  const id = req.params.id
  const before = await fin.retrieveFinanzasExpense(id).catch(() => null)
  if (!before) return res.status(404).json({ error: "not_found" })
  if (before.status === "paid") return res.json({ expense: before, already_paid: true })

  const body = (req.body || {}) as { paid_from_wallet_id?: string; paid_at?: string }
  const walletId =
    body.paid_from_wallet_id ||
    before.paid_from_wallet_id ||
    (await fin.getDefaultWalletForCurrency("usdt"))?.id ||
    null

  const expenseDate = body.paid_at ? new Date(body.paid_at) : new Date()

  await fin.updateFinanzasExpenses({
    id,
    status: "paid",
    paid_from_wallet_id: walletId,
    expense_date: expenseDate,
  })

  if (walletId) {
    await fin.writeWalletEntry({
      wallet_id: walletId,
      amount: -Math.abs(Number(before.amount_usdt)),
      currency: "usdt",
      source_type: "expense",
      source_id: id,
      note: before.description,
      entry_at: expenseDate,
    })
  }

  await fin.recordAudit({
    entity_type: "expense",
    entity_id: id,
    action: "update",
    before: { status: before.status },
    after: { status: "paid", paid_from_wallet_id: walletId },
    note: "marked paid",
  })

  const fresh = await fin.retrieveFinanzasExpense(id)
  res.json({ expense: fresh })
}
