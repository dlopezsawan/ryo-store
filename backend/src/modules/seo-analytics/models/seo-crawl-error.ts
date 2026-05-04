import { model } from "@medusajs/framework/utils"

const SeoCrawlError = model.define("seo_crawl_error", {
  id: model.id().primaryKey(),
  date: model.dateTime(),
  url: model.text(),
  status: model.number(),
  user_agent: model.text(),
  hits: model.number().default(1),
  last_seen: model.dateTime(),
})

export default SeoCrawlError
