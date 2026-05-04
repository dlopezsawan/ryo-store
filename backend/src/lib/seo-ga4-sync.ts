/**
 * GA4 sync core — paginated runReport + bulk upsert.
 *
 * Two granularities synced per day:
 *   1. seo_ga4_daily        → channel × source × medium × country (high-level)
 *   2. seo_ga4_page_daily   → page × source × medium           (per-URL)
 *
 * Run idempotent: deletes existing rows for the date range, then inserts.
 */

import { Pool } from "pg"
import { randomUUID } from "crypto"
import { ga4RunReport } from "./seo-ga4-client"

export type GaSyncDateResult = {
  date: string
  rows_channel: number
  rows_page: number
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export async function syncGa4Date(params: {
  pool: Pool
  propertyId: string
  date: string // YYYY-MM-DD
}): Promise<GaSyncDateResult> {
  const { pool, propertyId, date } = params

  // ── 1. Channel-level daily rows ──────────────────────────────────────────
  await pool.query(`DELETE FROM seo_ga4_daily WHERE date = $1`, [date])
  const channelRows = await ga4RunReport({
    propertyId,
    startDate: date,
    endDate: date,
    dimensions: [
      "sessionDefaultChannelGrouping",
      "sessionSource",
      "sessionMedium",
      "country",
    ],
    metrics: [
      "sessions",
      "engagedSessions",
      "activeUsers",
      "newUsers",
      "transactions",
      "totalRevenue",
    ],
    limit: 10000,
  })

  if (channelRows.length > 0) {
    const values: any[] = []
    const placeholders: string[] = []
    channelRows.forEach((r, idx) => {
      const [channel, source, medium, country] = r.dimensionValues.map((d) => d.value)
      const m = r.metricValues.map((v) => Number(v.value) || 0)
      const [sessions, engagedSessions, users, newUsers, transactions, revenue] = m
      const base = idx * 12
      placeholders.push(
        `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}, $${base + 10}, $${base + 11}, $${base + 12})`
      )
      values.push(
        randomUUID(),
        date,
        channel || "(unknown)",
        country || "(unknown)",
        source || "(direct)",
        medium || "(none)",
        sessions,
        engagedSessions,
        users,
        newUsers,
        transactions,
        revenue
      )
    })
    // Insert in chunks
    const CHUNK = 500
    for (let i = 0; i < channelRows.length; i += CHUNK) {
      const slice = placeholders.slice(i, i + CHUNK)
      const sliceValues = values.slice(i * 12, (i + CHUNK) * 12)
      // Reindex placeholders for the sliced batch
      const reindexed = slice.map((_, j) => {
        const b = j * 12
        return `($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5}, $${b + 6}, $${b + 7}, $${b + 8}, $${b + 9}, $${b + 10}, $${b + 11}, $${b + 12})`
      })
      await pool.query(
        `INSERT INTO seo_ga4_daily (id, date, channel, country, source, medium, sessions, engaged_sessions, users, new_users, transactions, revenue)
         VALUES ${reindexed.join(",")}`,
        sliceValues
      )
    }
  }

  // ── 2. Page-level daily rows ─────────────────────────────────────────────
  await pool.query(`DELETE FROM seo_ga4_page_daily WHERE date = $1`, [date])
  const pageRows = await ga4RunReport({
    propertyId,
    startDate: date,
    endDate: date,
    dimensions: ["landingPagePlusQueryString", "sessionSource", "sessionMedium"],
    metrics: ["sessions", "transactions", "totalRevenue"],
    limit: 10000,
  })

  if (pageRows.length > 0) {
    const CHUNK = 500
    for (let i = 0; i < pageRows.length; i += CHUNK) {
      const slice = pageRows.slice(i, i + CHUNK)
      const placeholders: string[] = []
      const values: any[] = []
      slice.forEach((r, idx) => {
        const [page, source, medium] = r.dimensionValues.map((d) => d.value)
        const m = r.metricValues.map((v) => Number(v.value) || 0)
        const [sessions, conversions, revenue] = m
        const b = idx * 8
        placeholders.push(
          `($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5}, $${b + 6}, $${b + 7}, $${b + 8})`
        )
        values.push(
          randomUUID(),
          date,
          page || "(unknown)",
          source || "(direct)",
          medium || "(none)",
          sessions,
          conversions,
          revenue
        )
      })
      await pool.query(
        `INSERT INTO seo_ga4_page_daily (id, date, page, source, medium, sessions, conversions, revenue)
         VALUES ${placeholders.join(",")}`,
        values
      )
    }
  }

  return { date, rows_channel: channelRows.length, rows_page: pageRows.length }
}

export async function syncGa4Range(params: {
  pool: Pool
  propertyId: string
  startDate: string
  endDate: string
}): Promise<GaSyncDateResult[]> {
  const start = new Date(params.startDate + "T00:00:00Z")
  const end = new Date(params.endDate + "T00:00:00Z")
  const results: GaSyncDateResult[] = []

  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const dateStr = formatDate(d)
    try {
      const r = await syncGa4Date({ pool: params.pool, propertyId: params.propertyId, date: dateStr })
      results.push(r)
      console.log(`[ga4-sync] ${dateStr}: ${r.rows_channel} channel, ${r.rows_page} page rows`)
    } catch (err) {
      console.error(`[ga4-sync] Failed ${dateStr}:`, err)
      results.push({ date: dateStr, rows_channel: 0, rows_page: 0 })
    }
  }
  return results
}

/**
 * GA4 has minor latency (~1 day); re-sync last 3 days daily for safety.
 */
export function getDailyGa4Range(): { startDate: string; endDate: string } {
  const end = new Date()
  const start = new Date(end)
  start.setUTCDate(start.getUTCDate() - 3)
  return { startDate: formatDate(start), endDate: formatDate(end) }
}

export function getGa4BackfillRange(days: number): { startDate: string; endDate: string } {
  const end = new Date()
  const start = new Date(end)
  start.setUTCDate(start.getUTCDate() - (days - 1))
  return { startDate: formatDate(start), endDate: formatDate(end) }
}
