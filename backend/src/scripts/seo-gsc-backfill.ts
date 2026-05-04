/**
 * Initial 90-day backfill of GSC data.
 * Run once after Batch 2 deploy:
 *   npx medusa exec ./src/scripts/seo-gsc-backfill.js
 *
 * Or custom days:
 *   SEO_BACKFILL_DAYS=30 npx medusa exec ./src/scripts/seo-gsc-backfill.js
 */

import { ExecArgs } from "@medusajs/framework/types"
import { Pool } from "pg"
import { syncGscRange, getBackfillRange } from "../lib/seo-gsc-sync"

export default async function backfillGsc({ container }: ExecArgs) {
  const logger: any = container.resolve("logger")

  const siteUrl = process.env.GSC_PROPERTY
  if (!siteUrl) {
    logger.error("[gsc-backfill] GSC_PROPERTY not set")
    return
  }

  const days = parseInt(process.env.SEO_BACKFILL_DAYS || "90", 10)
  const { startDate, endDate } = getBackfillRange(days)
  logger.info(`[gsc-backfill] Backfilling ${days} days: ${startDate} → ${endDate}`)

  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  try {
    const results = await syncGscRange({ pool, siteUrl, startDate, endDate })
    const total = results.reduce((s, r) => s + r.rows, 0)
    const successDays = results.filter((r) => r.rows > 0).length
    logger.info(
      `[gsc-backfill] ✅ ${total} rows across ${successDays}/${results.length} days`
    )
  } finally {
    await pool.end()
  }
}
