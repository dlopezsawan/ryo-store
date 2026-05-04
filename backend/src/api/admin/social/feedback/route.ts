import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { SOCIAL_MODULE } from "../../../../modules/social"
import SocialModuleService from "../../../../modules/social/service"
import {
  actorFromReq,
  recordActivity,
  parseMentions,
  notifyMentions,
} from "../_shared"

/**
 * GET  /admin/social/feedback?entity_type=post&entity_id=... → list (threaded)
 * POST /admin/social/feedback { entity_type, entity_id, text, parent_id?, timestamp_ms? }
 *   - auto-records activity
 *   - parses @handles and emails matched admin users
 */

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const svc: SocialModuleService = req.scope.resolve(SOCIAL_MODULE)
  const { entity_type, entity_id } = req.query as {
    entity_type?: string
    entity_id?: string
  }

  const where: Record<string, unknown> = {}
  if (entity_type) where.entity_type = entity_type
  if (entity_id) where.entity_id = entity_id

  const feedback = await svc.listSocialFeedbacks(
    where,
    { order: { created_at: "ASC" } } as never
  )
  return res.json({ feedback })
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const svc: SocialModuleService = req.scope.resolve(SOCIAL_MODULE)
  const body = req.body as {
    entity_type: "post" | "story"
    entity_id: string
    text: string
    parent_id?: string | null
    timestamp_ms?: number | null
  }

  const actor = actorFromReq(req)

  const feedback = await svc.createSocialFeedbacks({
    entity_type: body.entity_type,
    entity_id: body.entity_id,
    text: body.text,
    parent_id: body.parent_id ?? null,
    timestamp_ms: body.timestamp_ms ?? null,
    author_id: actor.id,
    author_name: actor.name,
    author_email: actor.email,
  })

  // Audit trail
  const fbId = (feedback as unknown as { id: string }).id
  await recordActivity(svc, {
    entity_type: body.entity_type,
    entity_id: body.entity_id,
    actor,
    action: body.parent_id ? "feedback_replied" : "feedback_added",
    payload: {
      feedback_id: fbId,
      parent_id: body.parent_id ?? null,
      text_preview: body.text.slice(0, 200),
    },
  })

  // @mentions — parse, notify, log
  const handles = parseMentions(body.text)
  if (handles.length > 0) {
    // Look up entity title for the email subject
    let title = body.entity_type === "post" ? "un post" : "una story"
    try {
      if (body.entity_type === "post") {
        const p = await svc.retrieveSocialPost(body.entity_id)
        title = `#${p.number} · ${p.title.replace(/^Post\s+\d+\s*·\s*/, "").replace(/^F\d+\s*·\s*/, "")}`
      } else {
        const s = await svc.retrieveSocialStory(body.entity_id)
        title = `Story ${s.date} · slot ${s.slot}`
      }
    } catch {
      /* keep fallback title */
    }

    for (const h of handles) {
      await recordActivity(svc, {
        entity_type: body.entity_type,
        entity_id: body.entity_id,
        actor,
        action: "mention",
        payload: { feedback_id: fbId, mentioned_handle: h },
      })
    }

    // Fire-and-forget email — don't block the response
    void notifyMentions(req, {
      handles,
      entity_type: body.entity_type,
      entity_id: body.entity_id,
      entity_title: title,
      text: body.text,
      actor,
    })
  }

  return res.status(201).json({ feedback })
}
