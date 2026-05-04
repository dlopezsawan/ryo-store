import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { SOCIAL_MODULE } from "../../../../../modules/social"
import SocialModuleService from "../../../../../modules/social/service"
import { actorFromReq, recordActivity } from "../../_shared"

export async function PATCH(req: MedusaRequest, res: MedusaResponse) {
  const svc: SocialModuleService = req.scope.resolve(SOCIAL_MODULE)
  const { id } = req.params as { id: string }
  const body = req.body as { text?: string; resolved?: boolean }

  const prior = await svc.retrieveSocialFeedback(id).catch(() => null)

  const patch: Record<string, unknown> = { id }
  if (typeof body.text === "string") patch.text = body.text
  if (typeof body.resolved === "boolean") {
    patch.resolved = body.resolved
    patch.resolved_at = body.resolved ? new Date() : null
    patch.resolved_by = body.resolved ? actorFromReq(req).id : null
  }

  const feedback = await svc.updateSocialFeedbacks(patch as never)

  if (prior && typeof body.resolved === "boolean" && body.resolved !== prior.resolved) {
    await recordActivity(svc, {
      entity_type: prior.entity_type as "post" | "story",
      entity_id: prior.entity_id,
      actor: actorFromReq(req),
      action: "feedback_resolved",
      payload: { feedback_id: id, resolved: body.resolved },
    })
  }

  return res.json({ feedback })
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const svc: SocialModuleService = req.scope.resolve(SOCIAL_MODULE)
  const { id } = req.params as { id: string }

  const prior = await svc.retrieveSocialFeedback(id).catch(() => null)

  await svc.deleteSocialFeedbacks([id])

  if (prior) {
    await recordActivity(svc, {
      entity_type: prior.entity_type as "post" | "story",
      entity_id: prior.entity_id,
      actor: actorFromReq(req),
      action: "feedback_deleted",
      payload: { feedback_id: id, text_preview: prior.text.slice(0, 200) },
    })
  }

  return res.json({ id, deleted: true })
}
