import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { SOCIAL_MODULE } from "../../../../modules/social"
import SocialModuleService from "../../../../modules/social/service"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const svc: SocialModuleService = req.scope.resolve(SOCIAL_MODULE)
  const posts = await svc.listSocialPosts(
    {},
    { order: { date_planned: "ASC" } } as never
  )
  return res.json({ posts })
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const svc: SocialModuleService = req.scope.resolve(SOCIAL_MODULE)
  const body = req.body as {
    external_id: string
    number: string
    title: string
    pillar?: string | null
    format: string
    date_label?: string | null
    date_planned?: string | null
    caption?: string | null
    cover_url?: string | null
    media_urls?: string[] | null
    status?: string
  }

  const payload = {
    external_id: body.external_id,
    number: body.number,
    title: body.title,
    pillar: body.pillar ?? null,
    format: body.format,
    date_label: body.date_label ?? null,
    date_planned: body.date_planned ? new Date(body.date_planned) : null,
    caption: body.caption ?? null,
    cover_url: body.cover_url ?? null,
    media_urls: body.media_urls ?? null,
    status: body.status ?? "draft",
  }

  // Medusa's generated types model .json() as Record<string, unknown>, but
  // arrays (string[]) are also valid JSON. Cast to bypass the type mismatch.
  const post = await svc.createSocialPosts(payload as never)
  return res.status(201).json({ post })
}
