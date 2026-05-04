import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { SOCIAL_MODULE } from "../../../../modules/social"
import SocialModuleService from "../../../../modules/social/service"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const svc: SocialModuleService = req.scope.resolve(SOCIAL_MODULE)
  const stories = await svc.listSocialStories(
    {},
    { order: { date: "ASC", slot: "ASC" } } as never
  )
  return res.json({ stories })
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const svc: SocialModuleService = req.scope.resolve(SOCIAL_MODULE)
  const body = req.body as {
    external_id: string
    date: string
    slot: number
    type: string
    media_url?: string | null
    status?: string
  }
  const story = await svc.createSocialStories({
    external_id: body.external_id,
    date: body.date,
    slot: body.slot,
    type: body.type,
    media_url: body.media_url ?? null,
    status: body.status ?? "draft",
  })
  return res.status(201).json({ story })
}
