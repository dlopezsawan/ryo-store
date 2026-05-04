/**
 * Alerts compute — runs hourly at minute 0.
 */
import { MedusaContainer } from "@medusajs/framework"
import { Pool } from "pg"
import { computeAllAlerts } from "../lib/seo-alerts"
import { wrapJob } from "../lib/job-runner"

async function seoAlertsComputeJob(_container: MedusaContainer) {
  if (process.env.SEO_SYNC_ENABLED !== "true") return
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  try {
    await computeAllAlerts(pool)
  } finally {
    await pool.end()
  }
}


export default wrapJob("seo-alerts-compute", seoAlertsComputeJob)

export const config = {
  name: "seo-alerts-compute",
  schedule: "0 * * * *",
}
