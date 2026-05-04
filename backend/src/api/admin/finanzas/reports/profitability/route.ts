/**
 * GET /admin/finanzas/reports/profitability?month=YYYY-MM&group=product|variant&limit=50
 *
 * Aggregated unit economics across all pago_movil rows in the period:
 *   - units_sold
 *   - revenue_eur (post-discount)
 *   - cogs_eur
 *   - margin_eur, margin_pct
 *
 * Grouped by product_id (default) or variant_id. Sorted by margin_eur DESC.
 * Lines without `unit_cost_eur` (cogs_complete=false) are excluded from
 * margin/COGS sums to keep numbers honest, but counted in revenue + flagged
 * via `lines_missing_cost`.
 */

import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { Pool } from "pg"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

function bounds(month?: string) {
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [y, m] = month.split("-").map(Number)
    return {
      from: new Date(Date.UTC(y, m - 1, 1)),
      to: new Date(Date.UTC(y, m, 1)),
      label: month,
    }
  }
  // No month → all-time
  return { from: new Date(0), to: new Date(Date.now() + 86400000), label: "all" }
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const { from, to, label } = bounds(
    typeof req.query.month === "string" ? req.query.month : undefined
  )
  const group = req.query.group === "variant" ? "variant" : "product"
  const limit = Math.min(Number(req.query.limit) || 50, 200)

  const groupCols =
    group === "variant"
      ? `l.variant_id, l.product_id, l.product_handle,
         MAX(l.title) AS title, MAX(l.title) AS variant_title`
      : `l.product_id, l.product_handle,
         MAX(l.title) AS title, NULL::text AS variant_id, NULL::text AS variant_title`

  const groupBy =
    group === "variant"
      ? `l.variant_id, l.product_id, l.product_handle`
      : `l.product_id, l.product_handle`

  const r = await pool.query(
    `SELECT
       ${groupCols},
       SUM(l.quantity)                              AS units_sold,
       SUM(l.line_revenue_eur)                      AS revenue_eur,
       COALESCE(SUM(l.line_cost_eur), 0)            AS cogs_eur,
       COALESCE(SUM(l.line_margin_eur), 0)          AS margin_eur,
       COUNT(*) FILTER (WHERE l.unit_cost_eur IS NULL) AS lines_missing_cost,
       COUNT(DISTINCT pm.id)                        AS orders
     FROM finanzas_pago_movil_line l
     JOIN finanzas_pago_movil pm ON pm.id = l.pago_movil_id
     WHERE l.deleted_at IS NULL AND pm.deleted_at IS NULL
       AND pm.created_at >= $1 AND pm.created_at < $2
     GROUP BY ${groupBy}
     ORDER BY margin_eur DESC
     LIMIT $3`,
    [from, to, limit]
  )

  const rows = r.rows.map((x) => ({
    product_id: x.product_id,
    product_handle: x.product_handle,
    variant_id: x.variant_id,
    title: x.title,
    variant_title: x.variant_title,
    units_sold: Number(x.units_sold) || 0,
    revenue_eur: Number(x.revenue_eur) || 0,
    cogs_eur: Number(x.cogs_eur) || 0,
    margin_eur: Number(x.margin_eur) || 0,
    margin_pct:
      Number(x.revenue_eur) > 0 ? Number(x.margin_eur) / Number(x.revenue_eur) : 0,
    orders: Number(x.orders) || 0,
    lines_missing_cost: Number(x.lines_missing_cost) || 0,
  }))

  const totals = rows.reduce(
    (acc, r2) => ({
      units_sold: acc.units_sold + r2.units_sold,
      revenue_eur: acc.revenue_eur + r2.revenue_eur,
      cogs_eur: acc.cogs_eur + r2.cogs_eur,
      margin_eur: acc.margin_eur + r2.margin_eur,
    }),
    { units_sold: 0, revenue_eur: 0, cogs_eur: 0, margin_eur: 0 }
  )

  res.json({ period: label, group, rows, totals })
}
