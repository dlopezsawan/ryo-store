import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { SOCIAL_MODULE } from "../../../../../modules/social"
import SocialModuleService from "../../../../../modules/social/service"
import { actorFromReq, recordActivity } from "../../_shared"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const svc: SocialModuleService = req.scope.resolve(SOCIAL_MODULE)
  const { id } = req.params as { id: string }
  const story = await svc.retrieveSocialStory(id).catch(() => null)
  if (!story) return res.status(404).json({ message: "Story not found" })
  return res.json({ story })
}

export async function PATCH(req: MedusaRequest, res: MedusaResponse) {
  const svc: SocialModuleService = req.scope.resolve(SOCIAL_MODULE)
  const { id } = req.params as { id: string }
  const body = req.body as Record<string, unknown>

  const prior = await svc.retrieveSocialStory(id).catch(() => null)

  const patch: Record<string, unknown> = { ...body, id }
  if (typeof patch.scheduled_at === "string") patch.scheduled_at = new Date(patch.scheduled_at as string)
  if (typeof patch.published_at === "string") patch.published_at = new Date(patch.published_at as string)

  // Medusa v2 generated update takes a single payload with id
  const story = await svc.updateSocialStories(patch as never)

  if (prior && typeof body.status === "string" && body.status !== prior.status) {
    await recordActivity(svc, {
      entity_type: "story",
      entity_id: id,
      actor: actorFromReq(req),
      action: "status_changed",
      payload: { from: prior.status, to: body.status },
    })
  }

  return res.json({ story })
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const svc: SocialModuleService = req.scope.resolve(SOCIAL_MODULE)
  const { id } = req.params as { id: string }
  await svc.deleteSocialStories([id])
  return res.json({ id, deleted: true })
}
