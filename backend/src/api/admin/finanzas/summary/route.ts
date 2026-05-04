/**
 * GET /admin/finanzas/summary?month=YYYY-MM
 *
 * Dashboard payload. Wallet balances now come from the wallet ledger
 * (finanzas_wallet_entry) — single source of truth. Negative balances are
 * clamped to 0 (handles small spread-cambiario discrepancies).
 */

import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { Pool } from "pg"
import FinanzasModuleService from "../../../../modules/finanzas/service"
import { FINANZAS_MODULE } from "../../../../modules/finanzas"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

function monthBounds(monthArg?: string) {
  const now = new Date()
  let y = now.getUTCFullYear()
  let m = now.getUTCMonth() + 1
  if (monthArg && /^\d{4}-\d{2}$/.test(monthArg)) {
    const [yy, mm] = monthArg.split("-").map(Number)
    y = yy
    m = mm
  }
  const from = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0))
  const to = new Date(Date.UTC(y, m, 1, 0, 0, 0))
  return { from, to, label: `${y}-${String(m).padStart(2, "0")}` }
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const { from, to, label } = monthBounds(
    typeof req.query.month === "string" ? req.query.month : undefined
  )
  const fin: FinanzasModuleService = req.scope.resolve(FINANZAS_MODULE)

  const totalsR = await pool.query(
    `SELECT
       COUNT(*) AS orders,
       COALESCE(SUM(amount_eur_total),       0) AS rev_eur,
       COALESCE(SUM(amount_bs_total),        0) AS rev_bs,
       COALESCE(SUM(amount_usdt_theoretical),0) AS rev_usdt,
       COALESCE(SUM(amount_eur_cogs),        0) AS cogs_eur,
       COALESCE(SUM(amount_eur_margin),      0) AS margin_eur,
       COALESCE(SUM(split_restock_eur),      0) AS split_restock_eur,
       COALESCE(SUM(split_restock_usdt),     0) AS split_restock_usdt,
       COALESCE(SUM(split_gastos_fijos_eur), 0) AS split_gf_eur,
       COALESCE(SUM(split_gastos_fijos_usdt),0) AS split_gf_usdt,
       COALESCE(SUM(split_marketing_eur),    0) AS split_mkt_eur,
       COALESCE(SUM(split_marketing_usdt),   0) AS split_mkt_usdt,
       COALESCE(SUM(split_ganancia_eur),     0) AS split_gan_eur,
       COALESCE(SUM(split_ganancia_usdt),    0) AS split_gan_usdt,
       COALESCE(SUM(bs_pending),             0) AS bs_pending
     FROM finanzas_pago_movil
     WHERE deleted_at IS NULL
       AND created_at >= $1 AND created_at < $2`,
    [from, to]
  )
  const totals = totalsR.rows[0]

  const expR = await pool.query(
    `SELECT ec.bucket, COALESCE(SUM(e.amount_usdt),0) AS spent_usdt, COUNT(e.*) AS count
     FROM finanzas_expense e
     JOIN finanzas_expense_category ec ON ec.id = e.category_id
     WHERE e.deleted_at IS NULL
       AND e.status = 'paid'
       AND e.expense_date >= $1 AND e.expense_date < $2
     GROUP BY ec.bucket`,
    [from, to]
  )
  const expensesByBucket: Record<string, { spent_usdt: number; count: number }> = {}
  for (const r of expR.rows) {
    expensesByBucket[r.bucket] = { spent_usdt: Number(r.spent_usdt), count: Number(r.count) }
  }

  // Pending expenses (auto-generated, not yet paid) — for "expected outflow" UI
  const pendingR = await pool.query(
    `SELECT COUNT(*) AS count, COALESCE(SUM(amount_usdt), 0) AS amount
     FROM finanzas_expense
     WHERE deleted_at IS NULL AND status = 'pending_payment'`
  )
  const pendingExpenses = {
    count: Number(pendingR.rows[0].count),
    amount_usdt: Number(pendingR.rows[0].amount),
  }

  // ── Wallet balances from ledger ─────────────────────────────────────────
  const wallets = await fin.listFinanzasWallets({ is_active: true }, {
    order: { sort_order: "ASC" },
  } as never)
  const balances: Array<{ id: string; name: string; currency: string; balance: number }> = []
  for (const w of wallets) {
    let balance = await fin.getWalletBalance(w.id)
    if (balance < 0 && balance > -1) balance = 0
    balance = Math.max(0, balance)
    balances.push({ id: w.id, name: w.name, currency: w.currency, balance })
  }

  const alertsR = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE NOT cogs_complete) AS missing_cost,
       COUNT(*) FILTER (WHERE margin_negative)   AS negative_margin
     FROM finanzas_pago_movil
     WHERE deleted_at IS NULL`
  )
  const alerts = {
    missing_cost: Number(alertsR.rows[0]?.missing_cost || 0),
    negative_margin: Number(alertsR.rows[0]?.negative_margin || 0),
    pending_expenses: pendingExpenses.count,
  }

  res.json({
    month: label,
    range: { from, to },
    totals: {
      orders: Number(totals.orders),
      revenue_eur: Number(totals.rev_eur),
      revenue_bs: Number(totals.rev_bs),
      revenue_usdt_theoretical: Number(totals.rev_usdt),
      cogs_eur: Number(totals.cogs_eur),
      margin_eur: Number(totals.margin_eur),
      bs_pending: Number(totals.bs_pending),
      pending_expenses_usdt: pendingExpenses.amount_usdt,
    },
    splits: {
      restock:      { eur: Number(totals.split_restock_eur), usdt: Number(totals.split_restock_usdt), spent_usdt: expensesByBucket.restock?.spent_usdt || 0 },
      gastos_fijos: { eur: Number(totals.split_gf_eur),     usdt: Number(totals.split_gf_usdt),     spent_usdt: expensesByBucket.gastos_fijos?.spent_usdt || 0 },
      marketing:    { eur: Number(totals.split_mkt_eur),    usdt: Number(totals.split_mkt_usdt),    spent_usdt: expensesByBucket.marketing?.spent_usdt || 0 },
      ganancia:     { eur: Number(totals.split_gan_eur),    usdt: Number(totals.split_gan_usdt),    spent_usdt: 0 },
    },
    expenses_by_bucket: expensesByBucket,
    wallets: balances,
    alerts,
  })
}
