import { model } from "@medusajs/framework/utils"

const SeoKwPositionHistory = model.define("seo_kw_position_history", {
  id: model.id().primaryKey(),
  date: model.dateTime(),
  keyword: model.text(),
  country: model.text(),
  device: model.text(),
  position: model.number().nullable(),
  url: model.text().nullable(),
  impressions: model.number().default(0),
  clicks: model.number().default(0),
})

export default SeoKwPositionHistory
