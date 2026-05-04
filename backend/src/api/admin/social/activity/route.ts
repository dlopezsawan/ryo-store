import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { SOCIAL_MODULE } from "../../../../modules/social"
import SocialModuleService from "../../../../modules/social/service"

/**
 * GET /admin/social/activity?entity_type=post&entity_id=ID
 *   → returns the activity timeline for a single post/story, newest last
 *
 * GET /admin/social/activity   (no filters)
 *   → returns the 50 most recent activities across everything
 *     (for the "what's happening" sidebar we may add later)
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const svc: SocialModuleService = req.scope.resolve(SOCIAL_MODULE)
  const { entity_type, entity_id, limit } = req.query as {
    entity_type?: string
    entity_id?: string
    limit?: string
  }

  if (entity_type && entity_id) {
    const activity = await svc.listSocialActivities(
      { entity_type, entity_id } as never,
      { order: { created_at: "ASC" } } as never
    )
    return res.json({ activity })
  }

  const take = Math.min(parseInt(limit || "50", 10) || 50, 200)
  const activity = await svc.listSocialActivities(
    {},
    { order: { created_at: "DESC" }, take } as never
  )
  return res.json({ activity })
}
