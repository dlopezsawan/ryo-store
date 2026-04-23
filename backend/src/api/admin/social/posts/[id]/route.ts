import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { SOCIAL_MODULE } from "../../../../../modules/social"
import SocialModuleService from "../../../../../modules/social/service"

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

  const patch: Record<string, unknown> = { ...body }
  if (typeof patch.date_planned === "string") patch.date_planned = new Date(patch.date_planned as string)
  if (typeof patch.published_at === "string") patch.published_at = new Date(patch.published_at as string)

  const post = await svc.updateSocialPosts({ id }, patch)
  return res.json({ post })
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const svc: SocialModuleService = req.scope.resolve(SOCIAL_MODULE)
  const { id } = req.params as { id: string }
  await svc.deleteSocialPosts([id])
  return res.json({ id, deleted: true })
}
