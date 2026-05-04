/**
 * GET /admin/finanzas/reports/customer-ltv?limit=20&from=&to=
 *
 * Top customers by lifetime value. Identity is `cedula` when present
 * (sticky across emails), otherwise `email`, otherwise `customer_id`. Pulls
 * loyalty points where available so the report can double as a "VIP" view.
 */

import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { Pool } from "pg"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

function bounds(month?: string) {
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [y, m] = month.split("-").map(Number)
    return { from: new Date(Date.UTC(y, m - 1, 1)), to: new Date(Date.UTC(y, m, 1)), label: month }
  }
  return { from: new Date(0), to: new Date(Date.now() + 86400000), label: "all" }
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const { from, to, label } = bounds(
    typeof req.query.month === "string" ? req.query.month : undefined
  )
  const limit = Math.min(Number(req.query.limit) || 20, 200)

  const r = await pool.query(
    `SELECT
       COALESCE(NULLIF(pm.cedula, ''), pm.order_email, pm.order_id) AS identity,
       MAX(pm.customer_name)              AS name,
       MAX(pm.cedula)                     AS cedula,
       MAX(pm.order_email)                AS email,
       MAX(pm.customer_phone)             AS phone,
       COUNT(*)                           AS orders,
       SUM(pm.amount_eur_total)           AS revenue_eur,
       SUM(pm.amount_eur_margin)          AS margin_eur,
       MIN(pm.created_at)                 AS first_order_at,
       MAX(pm.created_at)                 AS last_order_at
     FROM finanzas_pago_movil pm
     WHERE pm.deleted_at IS NULL
       AND pm.created_at >= $1 AND pm.created_at < $2
     GROUP BY identity
     ORDER BY revenue_eur DESC
     LIMIT $3`,
    [from, to, limit]
  )

  // Best-effort: enrich with loyalty points where the identity matches a
  // customer that still has a transaction trail.
  const customerEmails = r.rows.map((row) => row.email).filter(Boolean) as string[]
  let pointsByEmail = new Map<string, number>()
  if (customerEmails.length > 0) {
    const lpR = await pool.query(
      `SELECT c.email, COALESCE(SUM(lt.points), 0) AS points
       FROM customer c
       LEFT JOIN loyalty_transaction lt ON lt.customer_id = c.id AND lt.deleted_at IS NULL
       WHERE c.email = ANY($1::text[])
       GROUP BY c.email`,
      [customerEmails]
    )
    pointsByEmail = new Map(lpR.rows.map((x) => [x.email, Number(x.points) || 0]))
  }

  const rows = r.rows.map((x) => ({
    identity: x.identity,
    name: x.name,
    cedula: x.cedula,
    email: x.email,
    phone: x.phone,
    orders: Number(x.orders),
    revenue_eur: Number(x.revenue_eur) || 0,
    margin_eur: Number(x.margin_eur) || 0,
    aov_eur: Number(x.orders) > 0 ? Number(x.revenue_eur) / Number(x.orders) : 0,
    first_order_at: x.first_order_at,
    last_order_at: x.last_order_at,
    days_since_last:
      Math.floor((Date.now() - new Date(x.last_order_at).getTime()) / 86400000),
    loyalty_points: pointsByEmail.get(x.email) ?? null,
  }))

  res.json({ period: label, rows })
}
