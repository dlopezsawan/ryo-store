import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { SOCIAL_MODULE } from "../../../../../modules/social"
import SocialModuleService from "../../../../../modules/social/service"

export async function PATCH(req: MedusaRequest, res: MedusaResponse) {
  const svc: SocialModuleService = req.scope.resolve(SOCIAL_MODULE)
  const { id } = req.params as { id: string }
  const body = (req.body ?? {}) as Record<string, unknown>

  const patch: Record<string, unknown> = { id }
  for (const k of [
    "kind", "title", "body", "pillar", "format",
    "source", "source_ref", "status", "promoted_to",
  ] as const) {
    if (k in body) patch[k] = body[k]
  }
  if ("suggested_date" in body) {
    patch.suggested_date = body.suggested_date
      ? new Date(body.suggested_date as string)
      : null
  }

  const suggestion = await svc.updateSocialSuggestions(patch as never)
  return res.json({ suggestion })
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const svc: SocialModuleService = req.scope.resolve(SOCIAL_MODULE)
  const { id } = req.params as { id: string }
  await svc.deleteSocialSuggestions([id])
  return res.json({ id, deleted: true })
}
