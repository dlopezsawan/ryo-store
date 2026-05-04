/**
 * GET /admin/finanzas/reports/top-cities?month=YYYY-MM
 *
 * Top 5 cities by revenue. Joins `order_address` (shipping address) with the
 * latest `order_summary` row per order to get post-discount revenue. Used in
 * the BI section of the Finanzas Dashboard to show geographic concentration
 * — useful for deciding where to push paid traffic and where the warehouse
 * footprint is justified.
 *
 * Migrated from the legacy `/admin/analytics` route (top_cities block) as
 * part of Batch FA1 — the analytics module is being absorbed into Finanzas.
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
  return {
    from: new Date(Date.now() - 30 * 86400_000),
    to: new Date(Date.now() + 86400_000),
    label: "last_30d",
  }
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const { from, to, label } = bounds(
    typeof req.query.month === "string" ? req.query.month : undefined
  )

  try {
    const r = await pool.query(
      `
      SELECT
        COALESCE(NULLIF(TRIM(oa.city), ''), 'sin ciudad') AS city,
        COUNT(DISTINCT o.id)                              AS orders,
        COALESCE(SUM((os.totals->>'original_order_total')::numeric), 0) AS revenue_eur
      FROM "order" o
      JOIN order_address oa ON oa.id = o.shipping_address_id
      LEFT JOIN LATERAL (
        SELECT totals FROM order_summary WHERE order_id = o.id ORDER BY created_at DESC LIMIT 1
      ) os ON true
      WHERE o.is_draft_order = false
        AND o.deleted_at IS NULL
        AND o.status != 'canceled'
        AND o.created_at >= $1 AND o.created_at < $2
      GROUP BY city
      ORDER BY revenue_eur DESC
      LIMIT 5
      `,
      [from.toISOString(), to.toISOString()]
    )

    const totalRev = r.rows.reduce((s, x) => s + Number(x.revenue_eur), 0) || 1
    const rows = r.rows.map((x) => {
      const revenue = Number(x.revenue_eur)
      const orders = Number(x.orders)
      return {
        city: x.city as string,
        orders,
        revenue_eur: Math.round(revenue * 100) / 100,
        avg_ticket_eur: orders > 0 ? Math.round((revenue / orders) * 100) / 100 : 0,
        revenue_share_pct: Math.round((revenue / totalRev) * 1000) / 10,
      }
    })

    res.json({ month: label, rows, total_revenue_eur: Math.round(totalRev * 100) / 100 })
  } catch (e: any) {
    console.error("[reports/top-cities]", e)
    res.status(500).json({ error: e.message })
  }
}
