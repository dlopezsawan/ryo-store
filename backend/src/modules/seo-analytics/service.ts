import { MedusaService } from "@medusajs/framework/utils"
import SeoGscDaily from "./models/seo-gsc-daily"
import SeoGscTotals from "./models/seo-gsc-totals"
import SeoGa4Daily from "./models/seo-ga4-daily"
import SeoGa4PageDaily from "./models/seo-ga4-page-daily"
import SeoCwvSnapshot from "./models/seo-cwv-snapshot"
import SeoKwTracked from "./models/seo-kw-tracked"
import SeoKwPositionHistory from "./models/seo-kw-position-history"
import SeoKwResearchCache from "./models/seo-kw-research-cache"
import SeoCompetitor from "./models/seo-competitor"
import SeoCompetitorRanking from "./models/seo-competitor-ranking"
import SeoCrawlError from "./models/seo-crawl-error"
import SeoSitemapSnapshot from "./models/seo-sitemap-snapshot"
import SeoAlert from "./models/seo-alert"
import SeoMonthlySnapshot from "./models/seo-monthly-snapshot"

class SeoAnalyticsModuleService extends MedusaService({
  SeoGscDaily,
  SeoGscTotals,
  SeoGa4Daily,
  SeoGa4PageDaily,
  SeoCwvSnapshot,
  SeoKwTracked,
  SeoKwPositionHistory,
  SeoKwResearchCache,
  SeoCompetitor,
  SeoCompetitorRanking,
  SeoCrawlError,
  SeoSitemapSnapshot,
  SeoAlert,
  SeoMonthlySnapshot,
}) {}

export default SeoAnalyticsModuleService
