/**
 * GET  /admin/social/trend-subscriptions
 *   List every subscription (active + inactive). Newest first.
 *   ?kind=youtube_channel to filter.
 *
 * POST /admin/social/trend-subscriptions
 *   body: { kind, source_id, label, active? }
 *
 *   Idempotent: if a (kind, source_id) row already exists (not soft-deleted),
 *   we update its label/active flag instead of creating a duplicate. Re-adding
 *   a previously soft-deleted entry creates a new row (history preserved).
 */
import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { SOCIAL_MODULE } from "../../../../modules/social"
import SocialModuleService from "../../../../modules/social/service"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const svc: SocialModuleService = req.scope.resolve(SOCIAL_MODULE)
  const q = req.query as { kind?: string }
  const where: Record<string, unknown> = {}
  if (q.kind) where.kind = q.kind
  const subscriptions = await svc.listSocialTrendSubscriptions(
    where as never,
    { order: { created_at: "DESC" } } as never,
  )
  return res.json({ subscriptions })
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const svc: SocialModuleService = req.scope.resolve(SOCIAL_MODULE)
  const body = (req.body ?? {}) as {
    kind?: string
    source_id?: string
    label?: string
    active?: boolean
  }

  if (!body.kind || !body.source_id || !body.label) {
    return res.status(400).json({ message: "kind, source_id and label are required" })
  }

  // Validate the source_id format for known kinds — fail loud here so the
  // user doesn't realize at cron time that the channel id was wrong.
  if (body.kind === "youtube_channel" && !/^UC[0-9A-Za-z_-]{20,30}$/.test(body.source_id)) {
    return res.status(400).json({
      message:
        "YouTube channel id must start with 'UC' followed by 22 chars. " +
        "If you only have a @handle, find the UCxxx via View Source on the channel page (search for `channelId`).",
    })
  }

  const existing = await svc.listSocialTrendSubscriptions(
    { kind: body.kind, source_id: body.source_id } as never,
  )

  if (existing.length > 0) {
    const target = (existing[0] as { id: string }).id
    const updated = await svc.updateSocialTrendSubscriptions({
      id: target,
      label: body.label,
      active: body.active ?? true,
    } as never)
    return res.json({ subscription: updated, reused: true })
  }

  const created = await svc.createSocialTrendSubscriptions({
    kind: body.kind,
    source_id: body.source_id,
    label: body.label,
    active: body.active ?? true,
  } as never)
  return res.status(201).json({ subscription: created })
}
