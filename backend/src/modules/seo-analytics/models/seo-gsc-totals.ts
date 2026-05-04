import { model } from "@medusajs/framework/utils"

const SeoGscTotals = model.define("seo_gsc_totals", {
  id: model.id().primaryKey(),
  date: model.dateTime(),
  country: model.text(),
  device: model.text(),
  impressions: model.number().default(0),
  clicks: model.number().default(0),
  ctr: model.number().default(0),
  position: model.number().default(0),
})

export default SeoGscTotals
