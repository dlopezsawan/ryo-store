/**
 * SEO GSC sync — runs daily at 03:00 UTC.
 * Re-syncs last 3 days (GSC has ~2 day latency; idempotent via delete+insert).
 */
import { MedusaContainer } from "@medusajs/framework"
import { Pool } from "pg"
import { syncGscRange, getDailySyncRange } from "../lib/seo-gsc-sync"
import { wrapJob } from "../lib/job-runner"

async function seoGscSyncJob(_container: MedusaContainer) {
  if (process.env.SEO_SYNC_ENABLED !== "true") {
    console.log("[seo-gsc-sync] SEO_SYNC_ENABLED != 'true' — skipping")
    return
  }

  const siteUrl = process.env.GSC_PROPERTY
  if (!siteUrl) {
    console.warn("[seo-gsc-sync] GSC_PROPERTY not set — skipping")
    return
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  try {
    const { startDate, endDate } = getDailySyncRange()
    console.log(`[seo-gsc-sync] Syncing ${startDate} → ${endDate}`)
    const results = await syncGscRange({ pool, siteUrl, startDate, endDate })
    const total = results.reduce((sum, r) => sum + r.rows, 0)
    console.log(`[seo-gsc-sync] Done: ${total} rows across ${results.length} days`)
  } finally {
    await pool.end()
  }
}

export default wrapJob("seo-gsc-sync", seoGscSyncJob)

export const config = {
  name: "seo-gsc-sync",
  schedule: "0 3 * * *",
}
