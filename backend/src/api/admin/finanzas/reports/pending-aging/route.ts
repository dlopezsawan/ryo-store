/**
 * GET /admin/finanzas/reports/pending-aging
 *
 * Time-to-first-transaction percentiles. For each order in the last 90 days,
 * measures hours between order creation and the first `order_transaction`
 * (i.e. when payment was actually captured / pago_movil reconciled). Returns
 * P50/P90 + count of orders sitting >12h without payment. Used as an alert
 * card on the KPI strip when p90>12h, signalling reconciliation backlog.
 *
 * Migrated from the legacy `/admin/analytics` route (pending_aging block) as
 * part of Batch FA1 — the analytics module is being absorbed into Finanzas.
 *
 * Note: this metric is intentionally NOT scoped by the `month` query param
 * — operational SLAs need a rolling window, not a calendar-month view.
 */

import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { Pool } from "pg"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

export async function GET(_req: MedusaRequest, res: MedusaResponse) {
  try {
    const r = await pool.query(`
      WITH captured AS (
        SELECT
          o.id          AS order_id,
          o.created_at  AS order_created,
          MIN(ot.created_at) AS first_tx
        FROM "order" o
        JOIN order_transaction ot ON ot.order_id = o.id AND ot.deleted_at IS NULL
        WHERE o.is_draft_order = false
          AND o.deleted_at IS NULL
          AND o.created_at >= NOW() - INTERVAL '90 days'
        GROUP BY o.id, o.created_at
      )
      SELECT
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (first_tx - order_created))/3600) AS p50_hours,
        PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (first_tx - order_created))/3600) AS p90_hours,
        COUNT(*) FILTER (WHERE EXTRACT(EPOCH FROM (first_tx - order_created))/3600 > 12) AS over_12h_count,
        COUNT(*) AS total
      FROM captured
    `)
    const row = r.rows[0] || {}
    const p50 = row.p50_hours != null ? Math.round(Number(row.p50_hours) * 10) / 10 : null
    const p90 = row.p90_hours != null ? Math.round(Number(row.p90_hours) * 10) / 10 : null
    const over_12h_count = Number(row.over_12h_count || 0)
    const total = Number(row.total || 0)

    res.json({
      window: "last_90d",
      p50_hours: p50,
      p90_hours: p90,
      over_12h_count,
      total,
      over_12h_pct: total > 0 ? Math.round((over_12h_count / total) * 1000) / 10 : 0,
      // alert threshold for Dashboard banner
      alert: p90 != null && p90 > 12,
    })
  } catch (e: any) {
    console.error("[reports/pending-aging]", e)
    res.status(500).json({ error: e.message })
  }
}
