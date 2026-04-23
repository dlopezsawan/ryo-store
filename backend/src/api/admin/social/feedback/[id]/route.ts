import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { SOCIAL_MODULE } from "../../../../../modules/social"
import SocialModuleService from "../../../../../modules/social/service"

export async function PATCH(req: MedusaRequest, res: MedusaResponse) {
  const svc: SocialModuleService = req.scope.resolve(SOCIAL_MODULE)
  const { id } = req.params as { id: string }
  const body = req.body as { text?: string; resolved?: boolean }

  const patch: Record<string, unknown> = {}
  if (typeof body.text === "string") patch.text = body.text
  if (typeof body.resolved === "boolean") {
    patch.resolved = body.resolved
    patch.resolved_at = body.resolved ? new Date() : null
  }

  const feedback = await svc.updateSocialFeedbacks({ id }, patch)
  return res.json({ feedback })
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const svc: SocialModuleService = req.scope.resolve(SOCIAL_MODULE)
  const { id } = req.params as { id: string }
  await svc.deleteSocialFeedbacks([id])
  return res.json({ id, deleted: true })
}
