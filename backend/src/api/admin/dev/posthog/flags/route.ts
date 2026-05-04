/**
 * Feature flags list + update.
 * GET:  list all flags
 * POST { id, active?, rollout? }: toggle or update rollout
 */
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  listFeatureFlags,
  toggleFeatureFlag,
  updateFeatureFlagRollout,
  isAdminConfigured,
  getPosthogProjectUrl,
} from "../../../../../lib/posthog-admin-client"

export async function GET(_req: MedusaRequest, res: MedusaResponse) {
  if (!isAdminConfigured()) {
    res.json({ configured: false, message: "POSTHOG_PERSONAL_API_KEY or POSTHOG_PROJECT_ID not set" })
    return
  }
  const flags = await listFeatureFlags()
  res.json({
    configured: true,
    count: flags.length,
    flags,
    posthog_url: `${getPosthogProjectUrl()}/feature_flags`,
  })
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const body = (req as any).body || {}
  const id = Number(body.id)
  if (!id) {
    res.status(400).json({ error: "id required" })
    return
  }
  const results: Record<string, boolean> = {}
  if (typeof body.active === "boolean") {
    results.toggle = await toggleFeatureFlag(id, body.active)
  }
  if (typeof body.rollout === "number") {
    results.rollout = await updateFeatureFlagRollout(id, Math.max(0, Math.min(100, body.rollout)))
  }
  if (Object.keys(results).length === 0) {
    res.status(400).json({ error: "provide `active` (bool) or `rollout` (0-100)" })
    return
  }
  res.json({ ok: Object.values(results).every((x) => x), results })
}
