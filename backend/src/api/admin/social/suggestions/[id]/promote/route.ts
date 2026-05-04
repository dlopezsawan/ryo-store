/**
 * POST /admin/social/suggestions/:id/promote
 *
 * Convert a suggestion into a real `social_post` row in `status=draft`. The
 * post starts empty (no media, no caption beyond the suggestion's notes)
 * — the user fills in the rest from the post card. This closes the loop
 * trend → brief → suggestion → post → schedule → publish, all in-app.
 *
 * Side effects on the source suggestion:
 *   - status      → "promoted"
 *   - promoted_to → the new post's id
 *
 * The suggestion stays in the table (soft-history). Calling promote on an
 * already-promoted suggestion returns 409 — we don't double-create.
 *
 * Body (all optional):
 *   {
 *     title?:         string                            // overrides suggestion.title
 *     caption?:       string                            // overrides suggestion.body (becomes initial caption)
 *     pillar?:        string                            // overrides suggestion.pillar
 *     format?:        "Single" | "Carrusel" | "Reel"   // overrides suggestion.format
 *     date_planned?:  ISO date                          // overrides suggestion.suggested_date
 *   }
 *
 * Numbering: promoted posts use a "Pxx" prefix (e.g. P01, P02) to keep them
 * separate from the dashboard.html-numbered batch ("01"–"12", "F01"–"F03").
 * The next P-number is the highest existing P-number + 1.
 */
import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { SOCIAL_MODULE } from "../../../../../../modules/social"
import SocialModuleService from "../../../../../../modules/social/service"
import { actorFromReq, recordActivity } from "../../../_shared"

async function nextPromotedNumber(svc: SocialModuleService): Promise<string> {
  // Cheap scan — there will never be thousands of promoted posts. Looks for
  // numbers like "P01", "P12", "P101" and picks max+1.
  const all = (await svc.listSocialPosts({} as never)) as unknown as Array<{
    number: string
  }>
  let maxN = 0
  for (const p of all) {
    const m = /^P(\d+)$/.exec(p.number ?? "")
    if (m) {
      const n = parseInt(m[1], 10)
      if (n > maxN) maxN = n
    }
  }
  const next = maxN + 1
  return `P${String(next).padStart(2, "0")}`
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const svc: SocialModuleService = req.scope.resolve(SOCIAL_MODULE)
  const { id } = req.params as { id: string }
  const body = (req.body ?? {}) as {
    title?: string
    caption?: string
    pillar?: string
    format?: string
    date_planned?: string
  }

  const sug = (await svc.retrieveSocialSuggestion(id).catch(() => null)) as
    | {
        id: string
        kind: string
        title: string
        body: string | null
        pillar: string | null
        format: string | null
        suggested_date: Date | null
        status: string
        promoted_to: string | null
      }
    | null

  if (!sug) {
    return res.status(404).json({ message: "Suggestion not found" })
  }
  if (sug.status === "promoted" && sug.promoted_to) {
    return res.status(409).json({
      message: "Already promoted",
      post_id: sug.promoted_to,
    })
  }
  if (sug.kind !== "post") {
    // Story promotion would need a separate route + table — out of scope.
    return res.status(400).json({
      message: "Only post-kind suggestions can be promoted (stories not supported yet)",
    })
  }

  const number = await nextPromotedNumber(svc)
  const format = body.format ?? sug.format ?? "Single"
  const datePlannedIso = body.date_planned ?? (sug.suggested_date
    ? new Date(sug.suggested_date).toISOString()
    : null)
  const datePlanned = datePlannedIso ? new Date(datePlannedIso) : null
  const dateLabel = datePlanned
    ? datePlanned.toLocaleString("es-VE", {
        weekday: "long",
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }) + " VE"
    : null

  const titleRaw = body.title?.trim() || sug.title
  const captionRaw = body.caption ?? sug.body
  const pillarRaw = body.pillar ?? sug.pillar

  // Create the post in draft state. external_id encodes the source so we
  // can trace post → suggestion later if we want to.
  const post = (await svc.createSocialPosts({
    external_id: `promoted-${sug.id}`,
    number,
    title: titleRaw.length > 120 ? titleRaw.slice(0, 117) + "…" : titleRaw,
    pillar: pillarRaw,
    format,
    date_label: dateLabel,
    date_planned: datePlanned,
    caption: captionRaw,                  // suggestion notes (or override) become first-draft caption
    cover_url: null,
    media_urls: [],
    status: "draft",
  } as never)) as unknown as { id: string; number: string }

  // Mark suggestion promoted + link to post.
  await svc.updateSocialSuggestions({
    id: sug.id,
    status: "promoted",
    promoted_to: post.id,
  } as never)

  const actor = actorFromReq(req)
  await recordActivity(svc, {
    entity_type: "post",
    entity_id: post.id,
    actor,
    action: "promoted_from_suggestion",
    payload: { suggestion_id: sug.id, suggestion_title: sug.title },
  })

  return res.status(201).json({ post, suggestion_id: sug.id })
}
