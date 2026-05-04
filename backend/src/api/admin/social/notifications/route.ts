/**
 * GET /admin/social/notifications
 *
 * Returns @mention activity targeted at the current logged-in user, plus
 * the entity (post/story) and the original feedback comment text so the
 * frontend can render a useful list ("Daniel te mencionó en #07 · …")
 * without a second round-trip per row.
 *
 * The current user is identified via Medusa's auth_context, then we
 * enrich with their email + first_name from the user module to compute
 * "handles I respond to" (`daniel@enrola.shop` → handles `["daniel"]`,
 * etc; see `handlesForUser` in `../_shared.ts`).
 *
 * Mentions are stored as `social_activity` rows with action='mention'
 * and `payload.mentioned_handle` set. We filter in JS — `payload` is
 * a JSONB field and Medusa's auto-generated `list*` doesn't expose
 * jsonb path filters in a portable way.
 *
 * Query params:
 *   ?days=30   — window (default 30, max 90)
 *   ?limit=50  — max rows returned (default 50, max 200)
 *
 * Response:
 *   {
 *     mentions: Array<{
 *       activity_id: string
 *       created_at: string
 *       actor_name: string | null
 *       handle: string                      // the @handle that matched
 *       entity_type: "post" | "story"
 *       entity_id: string
 *       entity_title: string                // "#07 · Pedido BTS" or "Story 04-25 #1"
 *       feedback_text: string | null
 *       feedback_id: string | null
 *     }>
 *     handles: string[]                     // which handles the user responds to
 *   }
 */
import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { SOCIAL_MODULE } from "../../../../modules/social"
import SocialModuleService from "../../../../modules/social/service"
import { actorFromReq, handlesForUser } from "../_shared"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const svc: SocialModuleService = req.scope.resolve(SOCIAL_MODULE)
  const q = req.query as { days?: string; limit?: string }
  const days = Math.max(1, Math.min(90, parseInt(q.days ?? "30", 10) || 30))
  const limit = Math.max(1, Math.min(200, parseInt(q.limit ?? "50", 10) || 50))

  const actor = actorFromReq(req)
  // Enrich actor with email + first_name from the Medusa user module so
  // we can derive their handles. Without this we'd miss mentions of
  // first-name-only tags like @daniel.
  let userEmail: string | null = null
  let userFirstName: string | null = null
  if (actor.id) {
    try {
      const userService = req.scope.resolve("user") as unknown as {
        retrieveUser: (id: string) => Promise<{
          email: string
          first_name?: string | null
        }>
      }
      const u = await userService.retrieveUser(actor.id)
      userEmail = u.email ?? null
      userFirstName = u.first_name ?? null
    } catch {
      /* ignore — fall back to actor.email if present */
    }
  }
  const myHandles = handlesForUser({
    email: userEmail ?? actor.email,
    first_name: userFirstName,
    id: actor.id,
  })

  if (myHandles.length === 0) {
    return res.json({ mentions: [], handles: [] })
  }

  // Pull recent mention activity. Medusa list returns up to 1000 by default;
  // with limit + day filter applied client-side we stay well under.
  type ActivityRow = {
    id: string
    created_at: string
    actor_name: string | null
    action: string
    entity_type: string
    entity_id: string
    payload: { mentioned_handle?: string; feedback_id?: string } | null
  }
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  const allActivity = (await svc.listSocialActivities(
    { action: "mention" } as never,
    { order: { created_at: "DESC" }, take: 500 } as never,
  )) as unknown as ActivityRow[]

  const handleSet = new Set(myHandles)
  const filtered = allActivity
    .filter((a) => new Date(a.created_at) >= since)
    .filter((a) => {
      const h = (a.payload?.mentioned_handle ?? "").toLowerCase()
      return h && handleSet.has(h)
    })
    .slice(0, limit)

  // Enrich each mention with entity title + the original feedback text.
  // Cache lookups to avoid hammering the DB if the same post has many
  // mentions in the window.
  const postCache = new Map<string, { number: string; title: string }>()
  const storyCache = new Map<string, { date: string; slot: number }>()
  const feedbackCache = new Map<string, string>()

  const mentions = await Promise.all(
    filtered.map(async (a) => {
      let entityTitle = a.entity_type === "post" ? "Post" : "Story"
      try {
        if (a.entity_type === "post") {
          let p = postCache.get(a.entity_id)
          if (!p) {
            const fetched = (await svc.retrieveSocialPost(a.entity_id)) as unknown as {
              number: string
              title: string
            }
            p = { number: fetched.number, title: fetched.title }
            postCache.set(a.entity_id, p)
          }
          entityTitle = `#${p.number} · ${p.title
            .replace(/^Post\s+\d+\s*·\s*/, "")
            .replace(/^F\d+\s*·\s*/, "")}`
        } else {
          let s = storyCache.get(a.entity_id)
          if (!s) {
            const fetched = (await svc.retrieveSocialStory(a.entity_id)) as unknown as {
              date: string
              slot: number
            }
            s = { date: fetched.date, slot: fetched.slot }
            storyCache.set(a.entity_id, s)
          }
          entityTitle = `Story ${s.date} · slot ${s.slot}`
        }
      } catch {
        /* leave fallback title */
      }

      let feedbackText: string | null = null
      const fbId = a.payload?.feedback_id ?? null
      if (fbId) {
        if (feedbackCache.has(fbId)) {
          feedbackText = feedbackCache.get(fbId) ?? null
        } else {
          try {
            const fb = (await svc.retrieveSocialFeedback(fbId)) as unknown as {
              text: string
            }
            feedbackText = fb.text
            feedbackCache.set(fbId, fb.text)
          } catch {
            /* feedback may have been deleted */
          }
        }
      }

      return {
        activity_id: a.id,
        created_at: a.created_at,
        actor_name: a.actor_name,
        handle: a.payload?.mentioned_handle ?? "",
        entity_type: a.entity_type,
        entity_id: a.entity_id,
        entity_title: entityTitle,
        feedback_id: fbId,
        feedback_text: feedbackText,
      }
    }),
  )

  return res.json({ mentions, handles: myHandles })
}
