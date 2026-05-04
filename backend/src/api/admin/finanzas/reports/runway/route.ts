/**
 * GET /admin/finanzas/reports/runway
 *
 * How many months of fixed-cost coverage we have at the current USDT balance.
 *
 *   monthly_burn_target  = sum of recurring expense_category amounts (planned)
 *   monthly_burn_actual  = avg of last 3 months actual paid expenses
 *   usdt_balance         = sum of USDT wallet balances (via ledger)
 *   runway_months        = balance / burn
 *
 * Color code (UI consumes):
 *   < 1.0   → "critical" (rojo)
 *   < 3.0   → "warning"  (ámbar)
 *   ≥ 3.0   → "ok"       (verde)
 */

import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { Pool } from "pg"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

export async function GET(_req: MedusaRequest, res: MedusaResponse) {
  // Sum USDT wallet balances from ledger
  const walletR = await pool.query(
    `SELECT w.id, w.name, COALESCE(
       (SELECT SUM(amount) FROM finanzas_wallet_entry e WHERE e.wallet_id = w.id AND e.deleted_at IS NULL),
       0
     ) AS balance
     FROM finanzas_wallet w
     WHERE w.deleted_at IS NULL AND w.is_active = true AND w.currency = 'usdt'`
  )
  let usdtBalance = walletR.rows.reduce(
    (s, r) => s + Math.max(0, Number(r.balance)),
    0
  )
  usdtBalance = Math.round(usdtBalance * 100) / 100

  // Target burn = sum of recurring categories
  const targetR = await pool.query(
    `SELECT COALESCE(SUM(recurring_amount_usdt), 0) AS target
     FROM finanzas_expense_category
     WHERE deleted_at IS NULL AND is_active = true AND is_recurring = true`
  )
  const monthlyBurnTarget = Number(targetR.rows[0].target) || 0

  // Actual burn = avg of paid expenses last 3 closed months
  const actualR = await pool.query(
    `SELECT date_trunc('month', expense_date) AS m, SUM(amount_usdt) AS spent
     FROM finanzas_expense e
     WHERE e.deleted_at IS NULL
       AND e.status = 'paid'
       AND e.expense_date >= NOW() - INTERVAL '3 months'
       AND e.expense_date < date_trunc('month', NOW())
     GROUP BY m
     ORDER BY m`
  )
  const actualMonths = actualR.rows
  const monthlyBurnActual =
    actualMonths.length > 0
      ? actualMonths.reduce((s, x) => s + Number(x.spent), 0) / actualMonths.length
      : 0

  // Use whichever burn is larger as the conservative figure
  const burn = Math.max(monthlyBurnTarget, monthlyBurnActual, 0.01)
  const runwayMonths = burn > 0 ? usdtBalance / burn : null

  let level: "critical" | "warning" | "ok" = "ok"
  if (runwayMonths != null) {
    if (runwayMonths < 1) level = "critical"
    else if (runwayMonths < 3) level = "warning"
  }

  res.json({
    usdt_balance: usdtBalance,
    monthly_burn_target_usdt: Math.round(monthlyBurnTarget * 100) / 100,
    monthly_burn_actual_usdt: Math.round(monthlyBurnActual * 100) / 100,
    monthly_burn_used_usdt: Math.round(burn * 100) / 100,
    runway_months: runwayMonths != null ? Math.round(runwayMonths * 10) / 10 : null,
    level,
    history_3m: actualMonths.map((x) => ({
      month: new Date(x.m).toISOString().slice(0, 7),
      spent_usdt: Number(x.spent),
    })),
  })
}
