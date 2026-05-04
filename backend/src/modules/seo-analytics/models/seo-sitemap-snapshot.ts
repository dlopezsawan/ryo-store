import { model } from "@medusajs/framework/utils"

const SeoSitemapSnapshot = model.define("seo_sitemap_snapshot", {
  id: model.id().primaryKey(),
  date: model.dateTime(),
  sitemap_url: model.text(),
  urls_total: model.number().default(0),
  urls_with_lastmod: model.number().default(0),
  oldest_lastmod: model.dateTime().nullable(),
  checksum: model.text().nullable(),
})

export default SeoSitemapSnapshot
