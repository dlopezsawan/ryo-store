import { model } from "@medusajs/framework/utils"

const SeoMonthlySnapshot = model.define("seo_monthly_snapshot", {
  id: model.id().primaryKey(),
  year: model.number(),
  month: model.number(),
  // aggregates
  impressions: model.number().default(0),
  clicks: model.number().default(0),
  ctr: model.number().default(0),
  avg_position: model.number().nullable(),
  sessions_organic: model.number().default(0),
  transactions_organic: model.number().default(0),
  revenue_organic: model.number().default(0),
  // series for mini sparkline comparisons (JSON arrays)
  daily_impressions: model.json().nullable(),
  daily_clicks: model.json().nullable(),
  top_queries: model.json().nullable(),
  top_pages: model.json().nullable(),
})

export default SeoMonthlySnapshot
