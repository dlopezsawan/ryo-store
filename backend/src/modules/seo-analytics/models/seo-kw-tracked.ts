import { model } from "@medusajs/framework/utils"

const SeoKwTracked = model.define("seo_kw_tracked", {
  id: model.id().primaryKey(),
  keyword: model.text(),
  country: model.text().default("ve"),
  device: model.text().default("mobile"),
  added_by: model.text().nullable(),
  notes: model.text().nullable(),
  active: model.boolean().default(true),
  source: model.text().default("manual"),
})

export default SeoKwTracked
