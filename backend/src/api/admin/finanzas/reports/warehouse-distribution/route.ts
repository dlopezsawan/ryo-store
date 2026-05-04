/**
 * GET /admin/finanzas/reports/warehouse-distribution?month=YYYY-MM
 *
 * Order distribution across fulfillment warehouses (read from
 * `order.metadata.warehouse`, which the storefront writes when staff or
 * automation pick a location). Returns:
 *
 *   rows            — { warehouse, orders, revenue_eur, share_pct }
 *   imbalance_pct   — biggest minus smallest share — quick visual signal
 *   gini            — proper Gini coefficient (0=balanced, 1=monopoly).
 *                     More robust than a min-max spread when there are
 *                     3+ warehouses.
 *
 * Helps spot stock arbitrage opportunities (move inventory toward where
 * demand actually is). Built for Batch FA2 — replaces the analytics
 * module's `warehouse_distribution` block.
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

// Gini coefficient on a non-negative array. Returns 0 when n<2 or sum=0.
function gini(values: number[]): number {
  const n = values.length
  if (n < 2) return 0
  const sum = values.reduce((s, v) => s + v, 0)
  if (sum <= 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  let cumWeighted = 0
  for (let i = 0; i < n; i++) {
    cumWeighted += (i + 1) * sorted[i]
  }
  // Standard formula: G = (2·Σ i·x_i)/(n·Σx_i)  − (n+1)/n
  return (2 * cumWeighted) / (n * sum) - (n + 1) / n
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const { from, to, label } = bounds(
    typeof req.query.month === "string" ? req.query.month : undefined
  )

  try {
    const r = await pool.query(
      `
      SELECT
        COALESCE(NULLIF(o.metadata->>'warehouse', ''), 'desconocido') AS warehouse,
        COUNT(*)                                                      AS orders,
        COALESCE(SUM((os.totals->>'original_order_total')::numeric), 0) AS revenue_eur
      FROM "order" o
      LEFT JOIN LATERAL (
        SELECT totals FROM order_summary WHERE order_id = o.id ORDER BY created_at DESC LIMIT 1
      ) os ON true
      WHERE o.is_draft_order = false
        AND o.deleted_at IS NULL
        AND o.status != 'canceled'
        AND o.created_at >= $1 AND o.created_at < $2
      GROUP BY warehouse
      ORDER BY orders DESC
      `,
      [from.toISOString(), to.toISOString()]
    )

    const totalOrders = r.rows.reduce((s, x) => s + Number(x.orders), 0) || 1
    const rows = r.rows.map((x) => {
      const orders = Number(x.orders)
      const revenue = Number(x.revenue_eur)
      return {
        warehouse: x.warehouse as string,
        orders,
        revenue_eur: Math.round(revenue * 100) / 100,
        share_pct: Math.round((orders / totalOrders) * 1000) / 10,
      }
    })

    const imbalance_pct =
      rows.length > 1
        ? Math.round((rows[0].share_pct - rows[rows.length - 1].share_pct) * 10) / 10
        : 0
    const giniValue = Math.round(gini(rows.map((x) => x.orders)) * 1000) / 1000

    res.json({
      month: label,
      total_orders: r.rows.reduce((s, x) => s + Number(x.orders), 0),
      rows,
      imbalance_pct,
      gini: giniValue,
    })
  } catch (e: any) {
    console.error("[reports/warehouse-distribution]", e)
    res.status(500).json({ error: e.message })
  }
}
