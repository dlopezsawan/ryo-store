/**
 * GSC sync core — paginated fetch + bulk upsert.
 *
 * Stores one row per (date, query, page, country, device) — those are the
 * 5 dimensions GSC exposes. Deletes + re-inserts per date (idempotent) so
 * running backfill twice is safe.
 */

import { Pool } from "pg"
import { randomUUID } from "crypto"
import { gscSearchAnalytics } from "./seo-gsc-client"

const PAGE_SIZE = 25000

export type SyncDateResult = {
  date: string
  rows: number
  pages: number
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/**
 * Sync GSC data for a single date. Deletes existing rows for that date,
 * then fetches + inserts everything with pagination.
 */
export async function syncGscDate(params: {
  pool: Pool
  siteUrl: string
  date: string // YYYY-MM-DD
}): Promise<SyncDateResult> {
  const { pool, siteUrl, date } = params

  // ── Sync daily totals (country+device only, no query/page) ───────────────
  // GSC anonymizes low-volume data when query/page dims are added. Totals
  // reveal aggregate activity for small/new sites.
  await pool.query(`DELETE FROM seo_gsc_totals WHERE date = $1`, [date])
  const totals = await gscSearchAnalytics({
    siteUrl,
    startDate: date,
    endDate: date,
    dimensions: ["country", "device"],
    rowLimit: PAGE_SIZE,
  })
  if (totals.length > 0) {
    const values: any[] = []
    const placeholders: string[] = []
    totals.forEach((r, idx) => {
      const base = idx * 8
      placeholders.push(
        `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8})`
      )
      const [country, device] = r.keys
      values.push(randomUUID(), date, country, device, r.impressions, r.clicks, r.ctr, r.position)
    })
    await pool.query(
      `INSERT INTO seo_gsc_totals (id, date, country, device, impressions, clicks, ctr, position) VALUES ${placeholders.join(",")}`,
      values
    )
  }

  // ── Sync high-cardinality data (query+page+country+device) ───────────────
  // Delete existing rows for this date (idempotent)
  await pool.query(`DELETE FROM seo_gsc_daily WHERE date = $1`, [date])

  let allRows: any[] = []
  let startRow = 0
  let pages = 0

  while (true) {
    const rows = await gscSearchAnalytics({
      siteUrl,
      startDate: date,
      endDate: date,
      dimensions: ["query", "page", "country", "device"],
      rowLimit: PAGE_SIZE,
      startRow,
    })
    pages++
    if (rows.length === 0) break
    allRows = allRows.concat(rows)
    if (rows.length < PAGE_SIZE) break
    startRow += PAGE_SIZE
    if (pages > 40) {
      console.warn(`[gsc-sync] Reached 40 pages for ${date}, stopping pagination`)
      break
    }
  }

  if (allRows.length === 0) {
    return { date, rows: 0, pages }
  }

  // Bulk insert in chunks of 1000
  const CHUNK = 1000
  for (let i = 0; i < allRows.length; i += CHUNK) {
    const chunk = allRows.slice(i, i + CHUNK)
    const values: any[] = []
    const placeholders: string[] = []
    chunk.forEach((r, idx) => {
      const base = idx * 10
      placeholders.push(
        `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}, $${base + 10})`
      )
      const [query, page, country, device] = r.keys
      values.push(
        randomUUID(),
        date,
        query,
        page,
        country,
        device,
        r.impressions,
        r.clicks,
        r.ctr,
        r.position
      )
    })
    await pool.query(
      `INSERT INTO seo_gsc_daily (id, date, query, page, country, device, impressions, clicks, ctr, position)
       VALUES ${placeholders.join(",")}`,
      values
    )
  }

  return { date, rows: allRows.length, pages }
}

/**
 * Sync a range of dates (inclusive). GSC has ~2 day latency so default
 * lookback of 3 days is safe to re-run daily.
 */
export async function syncGscRange(params: {
  pool: Pool
  siteUrl: string
  startDate: string // YYYY-MM-DD
  endDate: string
}): Promise<SyncDateResult[]> {
  const start = new Date(params.startDate + "T00:00:00Z")
  const end = new Date(params.endDate + "T00:00:00Z")
  const results: SyncDateResult[] = []

  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const dateStr = formatDate(d)
    try {
      const r = await syncGscDate({ pool: params.pool, siteUrl: params.siteUrl, date: dateStr })
      results.push(r)
      console.log(`[gsc-sync] ${dateStr}: ${r.rows} rows (${r.pages} pages)`)
    } catch (err) {
      console.error(`[gsc-sync] Failed ${dateStr}:`, err)
      results.push({ date: dateStr, rows: 0, pages: 0 })
    }
  }

  return results
}

/**
 * Compute date range for daily sync: today - 3d → today - 1d (GSC latency).
 */
export function getDailySyncRange(): { startDate: string; endDate: string } {
  const end = new Date()
  end.setUTCDate(end.getUTCDate() - 1)
  const start = new Date(end)
  start.setUTCDate(start.getUTCDate() - 2)
  return { startDate: formatDate(start), endDate: formatDate(end) }
}

/**
 * Compute date range for backfill: N days back → today - 1d.
 */
export function getBackfillRange(days: number): { startDate: string; endDate: string } {
  const end = new Date()
  end.setUTCDate(end.getUTCDate() - 1)
  const start = new Date(end)
  start.setUTCDate(start.getUTCDate() - (days - 1))
  return { startDate: formatDate(start), endDate: formatDate(end) }
}
