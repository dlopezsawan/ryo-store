import { model } from "@medusajs/framework/utils"

const SeoGa4PageDaily = model.define("seo_ga4_page_daily", {
  id: model.id().primaryKey(),
  date: model.dateTime(),
  page: model.text(),
  source: model.text(),
  medium: model.text(),
  sessions: model.number().default(0),
  conversions: model.number().default(0),
  revenue: model.number().default(0),
})

export default SeoGa4PageDaily
