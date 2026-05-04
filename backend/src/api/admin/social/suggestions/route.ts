import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { SOCIAL_MODULE } from "../../../../modules/social"
import SocialModuleService from "../../../../modules/social/service"
import { actorFromReq } from "../_shared"

/**
 * GET  /admin/social/suggestions            — list all suggestions (newest first)
 *   ?status=idea|in_design|rejected|promoted
 *   ?kind=post|story
 *
 * POST /admin/social/suggestions            — create
 *   body: { kind, title, body?, pillar?, format?, suggested_date?, source?, source_ref? }
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const svc: SocialModuleService = req.scope.resolve(SOCIAL_MODULE)
  const q = req.query as { status?: string; kind?: string }

  const where: Record<string, unknown> = {}
  if (q.status) where.status = q.status
  if (q.kind) where.kind = q.kind

  const suggestions = await svc.listSocialSuggestions(
    where as never,
    { order: { created_at: "DESC" } } as never
  )
  return res.json({ suggestions })
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const svc: SocialModuleService = req.scope.resolve(SOCIAL_MODULE)
  const body = (req.body ?? {}) as {
    kind?: "post" | "story"
    title?: string
    body?: string
    pillar?: string | null
    format?: string | null
    suggested_date?: string | null
    source?: "manual" | "trend" | "feedback"
    source_ref?: string | null
  }

  if (!body.title || !body.title.trim()) {
    return res.status(400).json({ message: "title is required" })
  }
  const kind = body.kind === "story" ? "story" : "post"

  const actor = actorFromReq(req)
  const suggestion = await svc.createSocialSuggestions({
    kind,
    title: body.title.trim(),
    body: body.body ?? null,
    pillar: body.pillar ?? null,
    format: body.format ?? null,
    suggested_date: body.suggested_date ? new Date(body.suggested_date) : null,
    source: body.source ?? "manual",
    source_ref: body.source_ref ?? null,
    created_by: actor.id,
  } as never)

  return res.status(201).json({ suggestion })
}
