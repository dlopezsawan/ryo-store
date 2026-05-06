/**
 * GET /admin/dev/posthog/heatmap
 *
 * Heatmap data agregado por click target. Dos colecciones:
 *   - clicks: top elementos clickeados (con rage/dead counts)
 *   - pages:  pages con tráfico para que el panel ofrezca un dropdown
 *
 * Query params:
 *   - days:  ventana (default 7)
 *   - limit: top N elementos (default 30, cap 100)
 *   - page:  filtra a una URL exacta (cuando el operador escogió una
 *            del dropdown de pages)
 *
 * Mismo patrón que recordings: si no hay PostHog admin key configurado,
 * devolvemos `configured: false` con listas vacías para que el panel
 * pinte un banner en vez de error.
 */

import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  isAdminConfigured,
  getHeatmapClicks,
  getPosthogProjectUrl,
} from "../../../../../lib/posthog-admin-client"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const days = Number(req.query.days ?? 7)
  const limit = Number(req.query.limit ?? 30)
  const page = typeof req.query.page === "string" && req.query.page.trim()
    ? req.query.page
    : null

  const configured = isAdminConfigured()
  if (!configured) {
    return res.json({
      configured: false,
      days,
      page,
      clicks: [],
      pages: [],
      posthog_url: getPosthogProjectUrl() + "/heatmaps",
    })
  }

  const { clicks, pages } = await getHeatmapClicks({
    page: page ?? undefined,
    days,
    limit,
  })

  return res.json({
    configured: true,
    days,
    page,
    clicks,
    pages,
    posthog_url: getPosthogProjectUrl() + "/heatmaps",
  })
}
