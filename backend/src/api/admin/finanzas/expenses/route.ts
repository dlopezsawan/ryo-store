/**
 * GET  /admin/finanzas/expenses    — list, ?category_id=, ?status=
 * POST /admin/finanzas/expenses    — create + write ledger entry on payer wallet
 */

import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import FinanzasModuleService from "../../../../modules/finanzas/service"
import { FINANZAS_MODULE } from "../../../../modules/finanzas"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const fin: FinanzasModuleService = req.scope.resolve(FINANZAS_MODULE)
  const limit = Math.min(Number(req.query.limit) || 100, 500)
  const offset = Number(req.query.offset) || 0
  const filters: Record<string, unknown> = {}
  if (typeof req.query.category_id === "string") filters.category_id = req.query.category_id
  if (typeof req.query.status === "string") filters.status = req.query.status
  const expenses = await fin.listFinanzasExpenses(filters, {
    take: limit,
    skip: offset,
    order: { expense_date: "DESC" },
  } as never)
  res.json({ expenses })
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const fin: FinanzasModuleService = req.scope.resolve(FINANZAS_MODULE)
  const body = (req.body || {}) as {
    category_id?: string
    description?: string
    amount_usdt?: number
    amount_bs?: number
    rate_bs_per_usdt?: number
    paid_from_wallet_id?: string
    receipt_url?: string
    expense_date?: string
    notes?: string
    status?: string
  }
  if (!body.category_id || !body.description || body.amount_usdt == null) {
    return res
      .status(400)
      .json({ error: "category_id, description, amount_usdt are required" })
  }
  const expenseDate = body.expense_date ? new Date(body.expense_date) : new Date()
  const status = body.status || "paid"

  // Default wallet: USDT (the canonical pay-from)
  let walletId = body.paid_from_wallet_id ?? null
  if (!walletId) {
    const w = await fin.getDefaultWalletForCurrency("usdt")
    walletId = w?.id ?? null
  }

  const created = await fin.createFinanzasExpenses({
    category_id: body.category_id,
    description: body.description,
    amount_usdt: Number(body.amount_usdt),
    amount_bs: body.amount_bs != null ? Number(body.amount_bs) : null,
    rate_bs_per_usdt: body.rate_bs_per_usdt != null ? Number(body.rate_bs_per_usdt) : null,
    paid_from_wallet_id: walletId,
    receipt_url: body.receipt_url ?? null,
    expense_date: expenseDate,
    notes: body.notes ?? null,
    status,
  })
  const expense = Array.isArray(created) ? created[0] : created

  // Ledger entry only if the expense is "paid" (pending = budget reservation, not money out)
  if (walletId && status === "paid") {
    await fin.writeWalletEntry({
      wallet_id: walletId,
      amount: -Math.abs(Number(body.amount_usdt)),
      currency: "usdt",
      source_type: "expense",
      source_id: expense.id,
      note: body.description,
      entry_at: expenseDate,
    })
  }

  await fin.recordAudit({
    entity_type: "expense",
    entity_id: expense.id,
    action: "create",
    after: expense as unknown as Record<string, unknown>,
  })

  res.status(201).json({ expense })
}
