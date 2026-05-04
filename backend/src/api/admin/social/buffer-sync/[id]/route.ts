import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { SOCIAL_MODULE } from "../../../../../modules/social"
import SocialModuleService from "../../../../../modules/social/service"
import { actorFromReq, recordActivity } from "../../_shared"
import { getPost as bufferGetPost } from "../../../../../lib/buffer-client"

/**
 * POST /admin/social/buffer-sync/:id  body: { entity }
 *
 * Pulls the current state of a post from Buffer and reconciles our local row.
 *
 * Used as a manual "refresh" from the UI (button on a scheduled card) and
 * also as a polling fallback in case the Buffer webhook ever gets lost.
 *
 * Buffer post statuses we care about:
 *   - "scheduled"    → local stays "scheduled"
 *   - "sending"      → local becomes "publishing"
 *   - "sent"         → local becomes "published" + copy serviceLink to ig_*_id
 *   - "failed"       → local becomes "failed" + copy error
 *   - "draft"        → orphaned, keep local state
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const svc: SocialModuleService = req.scope.resolve(SOCIAL_MODULE)
  const { id } = req.params as { id: string }
  const entity: "post" | "story" =
    (req.body as { entity?: string })?.entity === "story" ? "story" : "post"

  const row =
    entity === "post"
      ? await svc.retrieveSocialPost(id).catch(() => null)
      : await svc.retrieveSocialStory(id).catch(() => null)
  if (!row) return res.status(404).json({ message: "Not found" })
  if (!row.buffer_post_id) return res.status(400).json({ message: "No buffer_post_id to sync" })

  const bufferPost = await bufferGetPost(row.buffer_post_id, { caller: "buffer-sync" })
  if (!bufferPost) {
    // The Buffer side no longer knows about this post — treat as "we don't know".
    return res.json({ synced: false, reason: "buffer post not found" })
  }

  const patch: Record<string, unknown> = { id }
  let newStatus: string | null = null

  switch (bufferPost.status) {
    case "sending":
      if (row.status !== "publishing") {
        patch.status = "publishing"
        newStatus = "publishing"
      }
      break
    case "sent":
      if (row.status !== "published") {
        patch.status = "published"
        patch.published_at = new Date()
        patch.failure_reason = null
        if (bufferPost.serviceLink) {
          if (entity === "post") patch.ig_post_id = extractIgCode(bufferPost.serviceLink)
          else patch.ig_story_id = extractIgCode(bufferPost.serviceLink)
        }
        newStatus = "published"
      }
      break
    case "failed":
      if (row.status !== "failed") {
        patch.status = "failed"
        patch.failure_reason = bufferPost.error || "Buffer reported failure without details"
        newStatus = "failed"
      }
      break
    default:
      // scheduled / draft / queued — nothing to change
      break
  }

  if (!newStatus) return res.json({ synced: true, status: row.status, note: "already in sync" })

  if (entity === "post") {
    await svc.updateSocialPosts(patch as never)
  } else {
    await svc.updateSocialStories(patch as never)
  }

  await recordActivity(svc, {
    entity_type: entity,
    entity_id: id,
    actor: actorFromReq(req),
    action: "status_changed",
    payload: { from: row.status, to: newStatus, source: "buffer_sync" },
  })

  return res.json({ synced: true, status: newStatus })
}

/**
 * Buffer's serviceLink is the full IG URL like
 *   https://www.instagram.com/p/C5n7xyz123/
 * We keep just the shortcode because it's what IG uses in its embed URL
 * and what the rest of our UI expects (`ig_post_id` was historically the
 * shortcode, not the numeric media id).
 */
function extractIgCode(serviceLink: string): string {
  const m = serviceLink.match(/instagram\.com\/(?:p|reel|stories)\/([^/?#]+)/)
  return m ? m[1] : serviceLink
}
