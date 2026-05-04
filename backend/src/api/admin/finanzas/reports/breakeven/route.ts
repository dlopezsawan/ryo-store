/**
 * GET /admin/finanzas/reports/breakeven
 *
 * "Cuántas órdenes/mes necesitás para cubrir gastos fijos."
 *
 *   monthly_fixed_usdt = recurring categories budget (target)
 *   avg_margin_per_order_eur = mean of last 3 months margin / orders
 *   breakeven_orders = monthly_fixed_usdt × eur_per_usdt / avg_margin_per_order
 *
 * Returns also current-month progress for the dashboard progress bar.
 */

import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { Pool } from "pg"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const EUR_PER_USDT = 1.08

export async function GET(_req: MedusaRequest, res: MedusaResponse) {
  // Monthly target burn
  const burnR = await pool.query(
    `SELECT COALESCE(SUM(recurring_amount_usdt), 0) AS target
     FROM finanzas_expense_category
     WHERE deleted_at IS NULL AND is_active = true AND is_recurring = true`
  )
  const monthlyFixedUsdt = Number(burnR.rows[0].target) || 0

  // Avg margin per order — last 3 closed months
  const histR = await pool.query(
    `SELECT
       COALESCE(SUM(amount_eur_margin), 0) AS margin,
       COUNT(*) AS orders
     FROM finanzas_pago_movil
     WHERE deleted_at IS NULL
       AND created_at >= date_trunc('month', NOW()) - INTERVAL '3 months'
       AND created_at < date_trunc('month', NOW())`
  )
  const histMargin = Number(histR.rows[0].margin)
  const histOrders = Number(histR.rows[0].orders)
  const avgMarginPerOrderEur = histOrders > 0 ? histMargin / histOrders : 0

  // Fallback: include all-time data if no history yet
  let avgMarginAll = avgMarginPerOrderEur
  if (avgMarginAll === 0) {
    const allR = await pool.query(
      `SELECT COALESCE(SUM(amount_eur_margin), 0) AS margin, COUNT(*) AS orders
       FROM finanzas_pago_movil WHERE deleted_at IS NULL`
    )
    const allMargin = Number(allR.rows[0].margin)
    const allOrders = Number(allR.rows[0].orders)
    avgMarginAll = allOrders > 0 ? allMargin / allOrders : 0
  }

  const breakevenOrders =
    avgMarginAll > 0
      ? Math.ceil((monthlyFixedUsdt * EUR_PER_USDT) / avgMarginAll)
      : null

  // Current month progress
  const curR = await pool.query(
    `SELECT
       COUNT(*) AS orders,
       COALESCE(SUM(amount_eur_margin), 0) AS margin
     FROM finanzas_pago_movil
     WHERE deleted_at IS NULL AND created_at >= date_trunc('month', NOW())`
  )
  const currentOrders = Number(curR.rows[0].orders)
  const currentMargin = Number(curR.rows[0].margin)
  const currentMarginUsdt = currentMargin / EUR_PER_USDT

  const progressPct =
    breakevenOrders && breakevenOrders > 0
      ? Math.min(100, (currentOrders / breakevenOrders) * 100)
      : 0
  const marginCoveragePct =
    monthlyFixedUsdt > 0 ? (currentMarginUsdt / monthlyFixedUsdt) * 100 : 0

  res.json({
    monthly_fixed_usdt: monthlyFixedUsdt,
    monthly_fixed_eur: Math.round(monthlyFixedUsdt * EUR_PER_USDT * 100) / 100,
    avg_margin_per_order_eur: Math.round(avgMarginAll * 100) / 100,
    breakeven_orders: breakevenOrders,
    current_month: {
      orders: currentOrders,
      margin_eur: Math.round(currentMargin * 100) / 100,
      margin_usdt: Math.round(currentMarginUsdt * 100) / 100,
      orders_progress_pct: Math.round(progressPct),
      margin_coverage_pct: Math.round(marginCoveragePct),
    },
  })
}
