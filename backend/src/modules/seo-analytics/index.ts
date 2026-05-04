import { Module } from "@medusajs/framework/utils"
import SeoAnalyticsModuleService from "./service"

export const SEO_ANALYTICS_MODULE = "seoAnalyticsModuleService"

export default Module(SEO_ANALYTICS_MODULE, {
  service: SeoAnalyticsModuleService,
})
