import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { SOCIAL_MODULE } from "../../../../modules/social"
import SocialModuleService from "../../../../modules/social/service"

/**
 * GET /admin/social/trends
 *   query:
 *     kind?         filter: reddit_post | youtube_video | …
 *     days?         lookback window (default 7)
 *     limit?        default 60, max 200
 *
 * Returns the most engaging signals in the window, sorted by score desc.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const svc: SocialModuleService = req.scope.resolve(SOCIAL_MODULE)
  const q = req.query as { kind?: string; days?: string; limit?: string }

  const days = Math.max(1, Math.min(30, parseInt(q.days || "7", 10) || 7))
  const take = Math.max(1, Math.min(200, parseInt(q.limit || "60", 10) || 60))
  const since = new Date(Date.now() - days * 24 * 3600 * 1000)

  const where: Record<string, unknown> = { fetched_at: { $gte: since } }
  if (q.kind) where.kind = q.kind

  const sources = await svc.listSocialTrendSources(
    where as never,
    { order: { score: "DESC" }, take } as never
  )

  // Latest brief for the sidebar summary
  const briefs = await svc.listSocialTrendBriefs(
    {},
    { order: { generated_at: "DESC" }, take: 1 } as never
  )

  return res.json({
    sources,
    brief: briefs[0] ?? null,
  })
}
