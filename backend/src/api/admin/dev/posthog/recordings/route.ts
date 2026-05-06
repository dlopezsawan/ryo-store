/**
 * GET /admin/dev/posthog/recordings
 *
 * Lista session recordings desde PostHog. Lo consume el módulo
 * /marketing/analytics del panel (PostHog Replays + Heatmap) y el
 * detalle de User 360 cuando filtra por distinct_id.
 *
 * Query params:
 *   - days:        ventana de búsqueda (default 7)
 *   - limit:       max recordings (default 30, cap 100)
 *   - search:      free-text — PostHog matchea contra distinct_ids/URLs
 *   - distinct_id: filtra a un único usuario
 *
 * Si no hay key admin configurada, devolvemos `configured: false` con
 * lista vacía y no fallamos la request — el panel pinta el banner
 * "POSTHOG NO CONFIGURADO" en vez de un error rojo.
 */

import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  isAdminConfigured,
  listSessionRecordings,
  getPosthogProjectUrl,
} from "../../../../../lib/posthog-admin-client"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const days = Number(req.query.days ?? 7)
  const limit = Number(req.query.limit ?? 30)
  const search = typeof req.query.search === "string" ? req.query.search : undefined
  const distinctId = typeof req.query.distinct_id === "string" ? req.query.distinct_id : undefined

  const configured = isAdminConfigured()
  if (!configured) {
    return res.json({
      configured: false,
      days,
      count: 0,
      recordings: [],
      posthog_url: getPosthogProjectUrl() + "/replay",
    })
  }

  const recordings = await listSessionRecordings({
    days,
    limit,
    search,
    distinctId,
  })

  return res.json({
    configured: true,
    days,
    count: recordings.length,
    recordings,
    posthog_url: getPosthogProjectUrl() + "/replay",
  })
}
