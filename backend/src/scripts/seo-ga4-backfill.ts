/**
 * Initial 90-day GA4 backfill.
 * Run: npx medusa exec ./src/scripts/seo-ga4-backfill.js
 */
import { ExecArgs } from "@medusajs/framework/types"
import { Pool } from "pg"
import { syncGa4Range, getGa4BackfillRange } from "../lib/seo-ga4-sync"

export default async function backfillGa4({ container }: ExecArgs) {
  const logger: any = container.resolve("logger")

  const propertyId = process.env.GA4_PROPERTY_ID
  if (!propertyId) {
    logger.error("[ga4-backfill] GA4_PROPERTY_ID not set")
    return
  }

  const days = parseInt(process.env.SEO_BACKFILL_DAYS || "90", 10)
  const { startDate, endDate } = getGa4BackfillRange(days)
  logger.info(`[ga4-backfill] Backfilling ${days} days: ${startDate} → ${endDate}`)

  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  try {
    const results = await syncGa4Range({ pool, propertyId, startDate, endDate })
    const totalChannel = results.reduce((s, r) => s + r.rows_channel, 0)
    const totalPage = results.reduce((s, r) => s + r.rows_page, 0)
    logger.info(`[ga4-backfill] ✅ ${totalChannel} channel rows, ${totalPage} page rows across ${results.length} days`)
  } finally {
    await pool.end()
  }
}
