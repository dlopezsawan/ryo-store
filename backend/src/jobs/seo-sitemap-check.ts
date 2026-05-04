/**
 * Sitemap freshness check — daily 04:30 UTC.
 */
import { MedusaContainer } from "@medusajs/framework"
import { Pool } from "pg"
import { checkSitemap } from "../lib/seo-sitemap-check"
import { wrapJob } from "../lib/job-runner"

async function seoSitemapCheckJob(_container: MedusaContainer) {
  if (process.env.SEO_SYNC_ENABLED !== "true") return
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  try {
    const snap = await checkSitemap({ pool })
    if (snap) {
      console.log(
        `[seo-sitemap-check] ${snap.urls_total} URLs, ${snap.urls_with_lastmod} with lastmod, oldest: ${snap.oldest_lastmod?.toISOString() || "n/a"}`
      )
    }
  } finally {
    await pool.end()
  }
}


export default wrapJob("seo-sitemap-check", seoSitemapCheckJob)

export const config = {
  name: "seo-sitemap-check",
  schedule: "30 4 * * *",
}
