import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { SOCIAL_MODULE } from "../../../../../modules/social"
import SocialModuleService from "../../../../../modules/social/service"
import { actorFromReq, recordActivity } from "../../_shared"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const svc: SocialModuleService = req.scope.resolve(SOCIAL_MODULE)
  const { id } = req.params as { id: string }
  const post = await svc.retrieveSocialPost(id).catch(() => null)
  if (!post) return res.status(404).json({ message: "Post not found" })
  return res.json({ post })
}

export async function PATCH(req: MedusaRequest, res: MedusaResponse) {
  const svc: SocialModuleService = req.scope.resolve(SOCIAL_MODULE)
  const { id } = req.params as { id: string }
  const body = req.body as Record<string, unknown>

  // Snapshot prior state so we can log status transitions.
  const prior = await svc.retrieveSocialPost(id).catch(() => null)

  const patch: Record<string, unknown> = { ...body, id }
  if (typeof patch.date_planned === "string") patch.date_planned = new Date(patch.date_planned as string)
  if (typeof patch.published_at === "string") patch.published_at = new Date(patch.published_at as string)

  // Medusa v2 generated update takes a single payload with id — not (selector, data)
  const post = await svc.updateSocialPosts(patch as never)

  if (prior && typeof body.status === "string" && body.status !== prior.status) {
    await recordActivity(svc, {
      entity_type: "post",
      entity_id: id,
      actor: actorFromReq(req),
      action: "status_changed",
      payload: { from: prior.status, to: body.status },
    })
  }

  return res.json({ post })
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const svc: SocialModuleService = req.scope.resolve(SOCIAL_MODULE)
  const { id } = req.params as { id: string }
  await svc.deleteSocialPosts([id])
  return res.json({ id, deleted: true })
}
