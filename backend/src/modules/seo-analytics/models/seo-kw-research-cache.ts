import { model } from "@medusajs/framework/utils"

const SeoKwResearchCache = model.define("seo_kw_research_cache", {
  id: model.id().primaryKey(),
  keyword: model.text(),
  country: model.text(),
  trends_score: model.number().nullable(),
  trends_90d: model.json().nullable(),
  related: model.json().nullable(),
  intent: model.text().nullable(),
  serp_top10: model.json().nullable(),
  checked_at: model.dateTime(),
  ttl_days: model.number().default(30),
})

export default SeoKwResearchCache
