import { model } from "@medusajs/framework/utils"

const SeoGa4Daily = model.define("seo_ga4_daily", {
  id: model.id().primaryKey(),
  date: model.dateTime(),
  channel: model.text(),
  country: model.text(),
  source: model.text(),
  medium: model.text(),
  sessions: model.number().default(0),
  engaged_sessions: model.number().default(0),
  users: model.number().default(0),
  new_users: model.number().default(0),
  transactions: model.number().default(0),
  revenue: model.number().default(0),
})

export default SeoGa4Daily
