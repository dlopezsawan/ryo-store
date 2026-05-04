import { model } from "@medusajs/framework/utils"

const SeoCwvSnapshot = model.define("seo_cwv_snapshot", {
  id: model.id().primaryKey(),
  date: model.dateTime(),
  url: model.text(),
  device: model.text(),
  lcp_p75: model.number().nullable(),
  inp_p75: model.number().nullable(),
  cls_p75: model.number().nullable(),
  ttfb_p75: model.number().nullable(),
})

export default SeoCwvSnapshot
