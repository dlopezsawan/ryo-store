import { model } from "@medusajs/framework/utils"

const SeoCompetitor = model.define("seo_competitor", {
  id: model.id().primaryKey(),
  name: model.text(),
  domain: model.text().nullable(),
  instagram: model.text().nullable(),
  notes: model.text().nullable(),
  threat: model.text().default("medium"),
  active: model.boolean().default(true),
})

export default SeoCompetitor
