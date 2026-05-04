import { model } from "@medusajs/framework/utils"

const SeoCompetitorRanking = model.define("seo_competitor_ranking", {
  id: model.id().primaryKey(),
  date: model.dateTime(),
  competitor_id: model.text(),
  keyword: model.text(),
  country: model.text(),
  position: model.number().nullable(),
  url: model.text().nullable(),
})

export default SeoCompetitorRanking
