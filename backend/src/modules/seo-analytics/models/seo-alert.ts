import { model } from "@medusajs/framework/utils"

const SeoAlert = model.define("seo_alert", {
  id: model.id().primaryKey(),
  type: model.text(),
  severity: model.text(),
  title: model.text(),
  message: model.text().nullable(),
  meta: model.json().nullable(),
  acked_at: model.dateTime().nullable(),
  acked_by: model.text().nullable(),
})

export default SeoAlert
