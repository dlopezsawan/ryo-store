/**
 * GET /admin/finanzas/reports/forecast?month=YYYY-MM
 *
 * Linear projection for the rest of the month based on the daily run-rate
 * so far. If we're 12 days into a 30-day month with €120 in revenue, the
 * naive projection is €300 EOM.
 *
 * Intentionally simple — picks up MoM seasonality only when we have enough
 * history (12+ months). Consumers should display this as "rough estimate",
 * not a commitment.
 */

import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { Pool } from "pg"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

function bounds(monthArg?: string) {
  const now = new Date()
  let y = now.getUTCFullYear()
  let m = now.getUTCMonth() + 1
  if (monthArg && /^\d{4}-\d{2}$/.test(monthArg)) {
    const [yy, mm] = monthArg.split("-").map(Number)
    y = yy
    m = mm
  }
  const from = new Date(Date.UTC(y, m - 1, 1))
  const to = new Date(Date.UTC(y, m, 1))
  const today = new Date()
  const isCurrent =
    today.getUTCFullYear() === y && today.getUTCMonth() + 1 === m
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const daysElapsed = isCurrent ? today.getUTCDate() : daysInMonth
  return { from, to, isCurrent, daysInMonth, daysElapsed, label: `${y}-${String(m).padStart(2, "0")}` }
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const monthArg = typeof req.query.month === "string" ? req.query.month : undefined
  const { from, to, isCurrent, daysInMonth, daysElapsed, label } = bounds(monthArg)

  const cur = await pool.query(
    `SELECT
       COUNT(*) AS orders,
       COALESCE(SUM(amount_eur_total), 0)  AS revenue_eur,
       COALESCE(SUM(amount_eur_margin), 0) AS margin_eur
     FROM finanzas_pago_movil
     WHERE deleted_at IS NULL AND created_at >= $1 AND created_at < $2`,
    [from, to]
  )
  const c = cur.rows[0]
  const current = {
    orders: Number(c.orders),
    revenue_eur: Number(c.revenue_eur),
    margin_eur: Number(c.margin_eur),
  }

  // Projection: linear extrapolation only if month is current and we have
  // any data. Otherwise just echo the actuals.
  let projection = { ...current }
  if (isCurrent && daysElapsed > 0) {
    const factor = daysInMonth / daysElapsed
    projection = {
      orders: Math.round(current.orders * factor),
      revenue_eur: current.revenue_eur * factor,
      margin_eur: current.margin_eur * factor,
    }
  }

  // Compare against last 3 closed months avg as sanity reference.
  const histR = await pool.query(
    `SELECT
       date_trunc('month', created_at) AS m,
       COUNT(*) AS orders,
       SUM(amount_eur_total) AS rev,
       SUM(amount_eur_margin) AS mar
     FROM finanzas_pago_movil
     WHERE deleted_at IS NULL
       AND created_at < $1
       AND created_at >= $1 - INTERVAL '3 months'
     GROUP BY m
     ORDER BY m DESC`,
    [from]
  )
  const hist = histR.rows.map((x) => ({
    month: new Date(x.m).toISOString().slice(0, 7),
    orders: Number(x.orders),
    revenue_eur: Number(x.rev),
    margin_eur: Number(x.mar),
  }))

  res.json({
    month: label,
    is_current: isCurrent,
    days_elapsed: daysElapsed,
    days_in_month: daysInMonth,
    current,
    projection,
    avg_per_day: daysElapsed > 0
      ? {
          orders: current.orders / daysElapsed,
          revenue_eur: current.revenue_eur / daysElapsed,
          margin_eur: current.margin_eur / daysElapsed,
        }
      : { orders: 0, revenue_eur: 0, margin_eur: 0 },
    last_3_months: hist,
  })
}
