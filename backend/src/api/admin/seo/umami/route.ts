/**
 * Umami aggregated endpoint for the Medusa admin SEO dashboard.
 *
 * GET ?days=7|28|90 — default 28
 * Returns stats, time series, top pages, top referrers, devices, countries.
 */
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  getStats,
  getPageviewsSeries,
  getMetric,
  getActive,
  isConfigured,
} from "../../../../lib/seo-umami-client"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  if (!isConfigured()) {
    res.json({ configured: false, message: "Umami not configured. Set UMAMI_URL and UMAMI_WEBSITE_ID." })
    return
  }
  const days = Math.max(1, Math.min(365, parseInt(String(req.query.days || "28"), 10)))

  try {
    const [stats, series, topPages, topReferrers, topCountries, topDevices, topBrowsers, active] =
      await Promise.all([
        getStats(days),
        getPageviewsSeries(days),
        getMetric(days, "path", 15),
        getMetric(days, "referrer", 15),
        getMetric(days, "country", 10),
        getMetric(days, "device", 10),
        getMetric(days, "browser", 10),
        getActive(),
      ])

    res.json({
      configured: true,
      filters: { days },
      active_visitors: active?.visitors ?? 0,
      stats,
      series,
      top_pages: topPages || [],
      top_referrers: topReferrers || [],
      top_countries: topCountries || [],
      top_devices: topDevices || [],
      top_browsers: topBrowsers || [],
      umami_url: process.env.UMAMI_URL,
    })
  } catch (err: any) {
    console.error("[seo/umami]", err)
    res.status(500).json({ error: err?.message || "umami fetch failed" })
  }
}
