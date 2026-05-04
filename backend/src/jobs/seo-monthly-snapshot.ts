/**
 * Monthly SEO snapshot — captures aggregated KPIs for the previous full month
 * once per day (idempotent — UPSERTs the current month every run, so we always
 * have the latest numbers while the month is in progress).
 *
 * Runs daily at 07:00 UTC. Idempotent: re-computes current + last month.
 */
import { MedusaContainer } from "@medusajs/framework"
import { Pool } from "pg"
import { randomUUID } from "crypto"
import { wrapJob } from "../lib/job-runner"

async function computeMonth(pool: Pool, year: number, month: number): Promise<void> {
  // Normalize date bounds
  const start = new Date(Date.UTC(year, month - 1, 1)).toISOString().slice(0, 10)
  const end = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10) // exclusive

  const totals = await pool.query(
    `
    SELECT
      COALESCE(SUM(impressions), 0)::bigint AS impressions,
      COALESCE(SUM(clicks), 0)::bigint AS clicks,
      CASE WHEN SUM(impressions) > 0 THEN SUM(clicks)::float / SUM(impressions) ELSE 0 END AS ctr,
      CASE WHEN SUM(impressions) > 0 THEN SUM(position * impressions) / SUM(impressions) ELSE NULL END AS avg_pos
    FROM seo_gsc_totals
    WHERE date >= $1 AND date < $2 AND deleted_at IS NULL
    `,
    [start, end]
  )

  const ga4 = await pool.query(
    `
    SELECT
      COALESCE(SUM(sessions), 0)::bigint AS sessions,
      COALESCE(SUM(transactions), 0)::bigint AS transactions,
      COALESCE(SUM(revenue), 0)::numeric AS revenue
    FROM seo_ga4_daily
    WHERE date >= $1 AND date < $2
      AND channel = 'Organic Search'
      AND deleted_at IS NULL
    `,
    [start, end]
  )

  const dailySeries = await pool.query(
    `
    SELECT date::date AS d, SUM(impressions)::bigint AS impr, SUM(clicks)::bigint AS clk
    FROM seo_gsc_totals
    WHERE date >= $1 AND date < $2 AND deleted_at IS NULL
    GROUP BY date::date ORDER BY date::date
    `,
    [start, end]
  )

  const topQueries = await pool.query(
    `
    SELECT query, SUM(impressions)::bigint AS impr, SUM(clicks)::bigint AS clk
    FROM seo_gsc_daily
    WHERE date >= $1 AND date < $2 AND deleted_at IS NULL
    GROUP BY query ORDER BY impr DESC LIMIT 20
    `,
    [start, end]
  )

  const topPages = await pool.query(
    `
    SELECT page, SUM(impressions)::bigint AS impr, SUM(clicks)::bigint AS clk
    FROM seo_gsc_daily
    WHERE date >= $1 AND date < $2 AND deleted_at IS NULL
    GROUP BY page ORDER BY impr DESC LIMIT 20
    `,
    [start, end]
  )

  const t = totals.rows[0] || {}
  const g = ga4.rows[0] || {}

  // Upsert
  await pool.query(
    `INSERT INTO seo_monthly_snapshot
     (id, year, month, impressions, clicks, ctr, avg_position, sessions_organic, transactions_organic, revenue_organic, daily_impressions, daily_clicks, top_queries, top_pages)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12::jsonb, $13::jsonb, $14::jsonb)
     ON CONFLICT (year, month) WHERE deleted_at IS NULL
     DO UPDATE SET
       impressions = EXCLUDED.impressions,
       clicks = EXCLUDED.clicks,
       ctr = EXCLUDED.ctr,
       avg_position = EXCLUDED.avg_position,
       sessions_organic = EXCLUDED.sessions_organic,
       transactions_organic = EXCLUDED.transactions_organic,
       revenue_organic = EXCLUDED.revenue_organic,
       daily_impressions = EXCLUDED.daily_impressions,
       daily_clicks = EXCLUDED.daily_clicks,
       top_queries = EXCLUDED.top_queries,
       top_pages = EXCLUDED.top_pages,
       updated_at = NOW()`,
    [
      randomUUID(),
      year,
      month,
      Number(t.impressions || 0),
      Number(t.clicks || 0),
      Number(t.ctr || 0),
      t.avg_pos != null ? Number(t.avg_pos) : null,
      Number(g.sessions || 0),
      Number(g.transactions || 0),
      Number(g.revenue || 0),
      JSON.stringify(dailySeries.rows.map((r: any) => ({ date: r.d, impressions: Number(r.impr) }))),
      JSON.stringify(dailySeries.rows.map((r: any) => ({ date: r.d, clicks: Number(r.clk) }))),
      JSON.stringify(topQueries.rows.map((r: any) => ({ query: r.query, impressions: Number(r.impr), clicks: Number(r.clk) }))),
      JSON.stringify(topPages.rows.map((r: any) => ({ page: r.page, impressions: Number(r.impr), clicks: Number(r.clk) }))),
    ]
  )
}

async function seoMonthlySnapshotJob(_container: MedusaContainer) {
  if (process.env.SEO_SYNC_ENABLED !== "true") return
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  try {
    const now = new Date()
    const currYear = now.getUTCFullYear()
    const currMonth = now.getUTCMonth() + 1
    // Previous month (for completeness after month boundary)
    const prev = new Date(Date.UTC(currYear, currMonth - 2, 1))
    const prevYear = prev.getUTCFullYear()
    const prevMonth = prev.getUTCMonth() + 1

    await computeMonth(pool, prevYear, prevMonth)
    await computeMonth(pool, currYear, currMonth)
    console.log(`[seo-monthly-snapshot] Updated ${prevYear}-${prevMonth} and ${currYear}-${currMonth}`)
  } catch (err) {
    console.error("[seo-monthly-snapshot] failed:", err)
  } finally {
    await pool.end()
  }
}


export default wrapJob("seo-monthly-snapshot", seoMonthlySnapshotJob)

export const config = {
  name: "seo-monthly-snapshot",
  schedule: "0 7 * * *",
}
