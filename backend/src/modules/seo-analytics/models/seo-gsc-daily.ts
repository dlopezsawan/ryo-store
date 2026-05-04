import { model } from "@medusajs/framework/utils"

const SeoGscDaily = model.define("seo_gsc_daily", {
  id: model.id().primaryKey(),
  date: model.dateTime(),
  query: model.text(),
  page: model.text(),
  country: model.text(),
  device: model.text(),
  impressions: model.number().default(0),
  clicks: model.number().default(0),
  ctr: model.number().default(0),
  position: model.number().default(0),
})

export default SeoGscDaily
