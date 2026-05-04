/**
 * PATCH  /admin/social/trend-subscriptions/:id   — toggle active / rename
 * DELETE /admin/social/trend-subscriptions/:id   — soft-delete
 */
import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { SOCIAL_MODULE } from "../../../../../modules/social"
import SocialModuleService from "../../../../../modules/social/service"

export async function PATCH(req: MedusaRequest, res: MedusaResponse) {
  const svc: SocialModuleService = req.scope.resolve(SOCIAL_MODULE)
  const { id } = req.params as { id: string }
  const body = (req.body ?? {}) as { label?: string; active?: boolean }

  const patch: Record<string, unknown> = { id }
  if (typeof body.label === "string") patch.label = body.label
  if (typeof body.active === "boolean") patch.active = body.active

  const subscription = await svc.updateSocialTrendSubscriptions(patch as never)
  return res.json({ subscription })
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const svc: SocialModuleService = req.scope.resolve(SOCIAL_MODULE)
  const { id } = req.params as { id: string }
  await svc.deleteSocialTrendSubscriptions([id])
  return res.json({ id, deleted: true })
}
