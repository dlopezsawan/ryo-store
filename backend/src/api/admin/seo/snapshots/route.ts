/**
 * Monthly snapshots list for month-over-month comparison.
 */
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Pool } from "pg"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const limit = Math.max(1, Math.min(36, parseInt(String(req.query.limit || "12"), 10)))

  const r = await pool.query(
    `SELECT year, month, impressions, clicks, ctr, avg_position,
       sessions_organic, transactions_organic, revenue_organic,
       updated_at
     FROM seo_monthly_snapshot
     WHERE deleted_at IS NULL
     ORDER BY year DESC, month DESC
     LIMIT $1`,
    [limit]
  )

  // Compute MoM delta
  const snapshots = r.rows.map((row: any) => ({
    year: row.year,
    month: row.month,
    label: `${row.year}-${String(row.month).padStart(2, "0")}`,
    impressions: Number(row.impressions),
    clicks: Number(row.clicks),
    ctr: Number(row.ctr),
    avg_position: row.avg_position != null ? Number(row.avg_position) : null,
    sessions_organic: Number(row.sessions_organic),
    transactions_organic: Number(row.transactions_organic),
    revenue_organic: Number(row.revenue_organic),
    updated_at: row.updated_at,
  }))

  // Add deltas (current vs previous)
  for (let i = 0; i < snapshots.length - 1; i++) {
    const curr: any = snapshots[i]
    const prev: any = snapshots[i + 1]
    curr.delta = {
      impressions_pct: prev.impressions > 0 ? ((curr.impressions - prev.impressions) / prev.impressions) * 100 : null,
      clicks_pct: prev.clicks > 0 ? ((curr.clicks - prev.clicks) / prev.clicks) * 100 : null,
      revenue_pct: prev.revenue_organic > 0 ? ((curr.revenue_organic - prev.revenue_organic) / prev.revenue_organic) * 100 : null,
    }
  }

  res.json({ snapshots })
}
