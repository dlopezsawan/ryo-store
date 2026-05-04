/**
 * Error tracking — top issues from PostHog `$exception` events.
 */
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { getRecentErrors, isAdminConfigured, getPosthogProjectUrl } from "../../../../../lib/posthog-admin-client"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  if (!isAdminConfigured()) {
    res.json({ configured: false, errors: [] })
    return
  }
  const days = Math.max(1, Math.min(90, parseInt(String(req.query.days || "7"), 10)))
  const issues = await getRecentErrors(days, 30)
  res.json({
    configured: true,
    days,
    count: issues.length,
    errors: issues,
    posthog_url: `${getPosthogProjectUrl()}/error_tracking`,
  })
}
