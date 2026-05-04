import { model } from "@medusajs/framework/utils"

/**
 * social_activity — Audit trail / activity feed.
 *
 * Records every meaningful change on a post or story so collaborators see
 * a timeline of what happened: status transitions, comments, approvals.
 *
 * Written automatically from route handlers — never directly from the UI.
 */
const SocialActivity = model.define("social_activity", {
  id: model.id().primaryKey(),

  entity_type: model.text(),          // "post" | "story"
  entity_id: model.text(),

  actor_id: model.text().nullable(),
  actor_name: model.text().nullable(),

  // "status_changed" | "feedback_added" | "feedback_resolved"
  // | "feedback_deleted" | "mention"
  action: model.text(),

  // Shape depends on action:
  //   status_changed  → { from: string, to: string }
  //   feedback_added  → { feedback_id, text_preview, parent_id? }
  //   feedback_resolved → { feedback_id, resolved: boolean }
  //   feedback_deleted  → { feedback_id }
  //   mention         → { feedback_id, mentioned_handle }
  payload: model.json().nullable(),
})

export default SocialActivity
