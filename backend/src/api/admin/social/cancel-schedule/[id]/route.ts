import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { SOCIAL_MODULE } from "../../../../../modules/social"
import SocialModuleService from "../../../../../modules/social/service"
import { actorFromReq, recordActivity } from "../../_shared"
import { deletePost as bufferDeletePost } from "../../../../../lib/buffer-client"

/**
 * POST /admin/social/cancel-schedule/:id  body: { entity }
 *
 *   - Deletes the scheduled post on Buffer (if we have its buffer_post_id)
 *   - Rolls local status back to "approved"
 *   - Clears scheduled_at, failure_reason, buffer_post_id
 *
 * We don't refuse if Buffer returns "not found" — that just means the
 * schedule already fired or was deleted elsewhere. We still want to clean
 * up local state.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const svc: SocialModuleService = req.scope.resolve(SOCIAL_MODULE)
  const { id } = req.params as { id: string }
  const entity: "post" | "story" =
    (req.body as { entity?: string })?.entity === "story" ? "story" : "post"

  const current =
    entity === "post"
      ? await svc.retrieveSocialPost(id).catch(() => null)
      : await svc.retrieveSocialStory(id).catch(() => null)
  if (!current) return res.status(404).json({ message: "Not found" })
  if (current.status === "publishing") {
    return res
      .status(409)
      .json({ message: "Ya se está publicando. Esperá a que termine." })
  }

  if (current.buffer_post_id) {
    try {
      await bufferDeletePost(current.buffer_post_id, { caller: "cancel-schedule" })
    } catch (e) {
      // Log but proceed to clean up local state — better to have a ghost
      // on Buffer than a stuck "scheduled" on our side the user can't undo.
      console.warn(
        `[social] Buffer delete failed for ${current.buffer_post_id}:`,
        (e as Error).message
      )
    }
  }

  const patch = {
    id,
    status: "approved",
    scheduled_at: null,
    buffer_post_id: null,
    failure_reason: null,
  }
  const priorStatus = current.status

  if (entity === "post") {
    const updated = await svc.updateSocialPosts(patch as never)
    await recordActivity(svc, {
      entity_type: "post",
      entity_id: id,
      actor: actorFromReq(req),
      action: "status_changed",
      payload: { from: priorStatus, to: "approved", cancelled: true },
    })
    return res.json({ post: updated })
  } else {
    const updated = await svc.updateSocialStories(patch as never)
    await recordActivity(svc, {
      entity_type: "story",
      entity_id: id,
      actor: actorFromReq(req),
      action: "status_changed",
      payload: { from: priorStatus, to: "approved", cancelled: true },
    })
    return res.json({ story: updated })
  }
}
