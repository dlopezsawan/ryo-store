/**
 * GET /admin/finanzas/reports/campaign-revenue?month=YYYY-MM
 *
 * UTM-based revenue + margin attribution. Groups orders by their
 * `attribution_utm_campaign` / `attribution_utm_source` / `attribution_utm_medium`
 * metadata fields written by the storefront. Supplements the existing
 * `/reports/channels` endpoint (which buckets by predefined channel rules)
 * with a granular per-campaign view useful for marketing ROI.
 *
 * Migrated from the legacy `/admin/analytics` route as part of Batch FA1
 * — the analytics module is being absorbed into Finanzas.
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
  // No month → last 30 days
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
    // Aggregate orders by (campaign, source, medium). Revenue uses original_order_total
    // post-discount (matches the rest of the Finanzas reports). Margin pulled from
    // pago_movil where available so we can show ROI not just gross.
    const r = await pool.query(
      `
      SELECT
        COALESCE(NULLIF(o.metadata->>'attribution_utm_campaign', ''), 'direct/organic') AS campaign,
        COALESCE(NULLIF(o.metadata->>'attribution_utm_source',   ''), 'direct')          AS source,
        COALESCE(NULLIF(o.metadata->>'attribution_utm_medium',   ''), 'none')            AS medium,
        COUNT(*)                                                                          AS orders,
        COALESCE(SUM((os.totals->>'original_order_total')::numeric), 0)                   AS revenue_eur,
        COALESCE(SUM(pm.amount_eur_margin), 0)                                            AS margin_eur,
        COUNT(*) FILTER (WHERE pm.id IS NOT NULL)                                         AS orders_with_margin
      FROM "order" o
      LEFT JOIN LATERAL (
        SELECT totals FROM order_summary WHERE order_id = o.id ORDER BY created_at DESC LIMIT 1
      ) os ON true
      LEFT JOIN finanzas_pago_movil pm ON pm.order_id = o.id AND pm.deleted_at IS NULL
      WHERE o.is_draft_order = false
        AND o.deleted_at IS NULL
        AND o.status != 'canceled'
        AND o.created_at >= $1 AND o.created_at < $2
      GROUP BY campaign, source, medium
      ORDER BY revenue_eur DESC
      LIMIT 20
      `,
      [from.toISOString(), to.toISOString()]
    )

    const totalRev = r.rows.reduce((s, x) => s + Number(x.revenue_eur), 0) || 1
    const rows = r.rows.map((x) => {
      const revenue = Number(x.revenue_eur)
      const margin = Number(x.margin_eur)
      const orders = Number(x.orders)
      return {
        campaign: x.campaign as string,
        source: x.source as string,
        medium: x.medium as string,
        orders,
        revenue_eur: Math.round(revenue * 100) / 100,
        margin_eur: Math.round(margin * 100) / 100,
        margin_pct: revenue > 0 ? Math.round((margin / revenue) * 1000) / 10 : 0,
        avg_ticket_eur: orders > 0 ? Math.round((revenue / orders) * 100) / 100 : 0,
        revenue_share_pct: Math.round((revenue / totalRev) * 1000) / 10,
        orders_with_margin: Number(x.orders_with_margin),
      }
    })

    res.json({ month: label, rows, total_revenue_eur: Math.round(totalRev * 100) / 100 })
  } catch (e: any) {
    console.error("[reports/campaign-revenue]", e)
    res.status(500).json({ error: e.message })
  }
}
