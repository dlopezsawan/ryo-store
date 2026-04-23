import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { SOCIAL_MODULE } from "../../../../modules/social"
import SocialModuleService from "../../../../modules/social/service"

/**
 * GET  /admin/social/feedback?entity_type=post&entity_id=... → list
 * POST /admin/social/feedback { entity_type, entity_id, text, parent_id?, timestamp_ms? }
 */

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const svc: SocialModuleService = req.scope.resolve(SOCIAL_MODULE)
  const { entity_type, entity_id } = req.query as { entity_type?: string; entity_id?: string }

  const where: Record<string, unknown> = {}
  if (entity_type) where.entity_type = entity_type
  if (entity_id) where.entity_id = entity_id

  const feedback = await svc.listSocialFeedbacks(
    where,
    { order: { created_at: "ASC" } } as never
  )
  return res.json({ feedback })
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const svc: SocialModuleService = req.scope.resolve(SOCIAL_MODULE)
  const body = req.body as {
    entity_type: "post" | "story"
    entity_id: string
    text: string
    parent_id?: string | null
    timestamp_ms?: number | null
  }

  // Try to pull author from auth context (Medusa admin user)
  const authCtx = (req as unknown as { auth_context?: { actor_id?: string; actor_type?: string } }).auth_context
  const authorId = authCtx?.actor_id ?? null

  const feedback = await svc.createSocialFeedbacks({
    entity_type: body.entity_type,
    entity_id: body.entity_id,
    text: body.text,
    parent_id: body.parent_id ?? null,
    timestamp_ms: body.timestamp_ms ?? null,
    author_id: authorId,
    author_name: null,
    author_email: null,
  })
  return res.status(201).json({ feedback })
}
