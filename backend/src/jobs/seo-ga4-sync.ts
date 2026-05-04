/**
 * GA4 daily sync — runs 03:15 UTC.
 * Re-syncs last 3 days (GA4 has ~1 day latency; idempotent).
 */
import { MedusaContainer } from "@medusajs/framework"
import { Pool } from "pg"
import { syncGa4Range, getDailyGa4Range } from "../lib/seo-ga4-sync"
import { wrapJob } from "../lib/job-runner"

async function seoGa4SyncJob(_container: MedusaContainer) {
  if (process.env.SEO_SYNC_ENABLED !== "true") {
    console.log("[seo-ga4-sync] SEO_SYNC_ENABLED != 'true' — skipping")
    return
  }
  const propertyId = process.env.GA4_PROPERTY_ID
  if (!propertyId) {
    console.warn("[seo-ga4-sync] GA4_PROPERTY_ID not set — skipping")
    return
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  try {
    const { startDate, endDate } = getDailyGa4Range()
    console.log(`[seo-ga4-sync] Syncing ${startDate} → ${endDate}`)
    const results = await syncGa4Range({ pool, propertyId, startDate, endDate })
    const tChan = results.reduce((s, r) => s + r.rows_channel, 0)
    const tPage = results.reduce((s, r) => s + r.rows_page, 0)
    console.log(`[seo-ga4-sync] Done: ${tChan} channel, ${tPage} page rows`)
  } finally {
    await pool.end()
  }
}


export default wrapJob("seo-ga4-sync", seoGa4SyncJob)

export const config = {
  name: "seo-ga4-sync",
  schedule: "15 3 * * *",
}
