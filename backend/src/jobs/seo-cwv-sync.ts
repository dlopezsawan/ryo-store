/**
 * CrUX sync — runs daily 04:00 UTC.
 * Refreshes field Core Web Vitals for key URLs.
 */
import { MedusaContainer } from "@medusajs/framework"
import { Pool } from "pg"
import { syncAllCwv } from "../lib/seo-cwv-sync"
import { wrapJob } from "../lib/job-runner"

async function seoCwvSyncJob(_container: MedusaContainer) {
  if (process.env.SEO_SYNC_ENABLED !== "true") {
    console.log("[seo-cwv-sync] SEO_SYNC_ENABLED != 'true' — skipping")
    return
  }
  if (!process.env.CRUX_API_KEY) {
    console.warn("[seo-cwv-sync] CRUX_API_KEY not set — skipping")
    return
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  try {
    await syncAllCwv(pool)
  } finally {
    await pool.end()
  }
}


export default wrapJob("seo-cwv-sync", seoCwvSyncJob)

export const config = {
  name: "seo-cwv-sync",
  schedule: "0 4 * * *",
}
