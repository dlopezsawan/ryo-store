import { model } from "@medusajs/framework/utils"

/**
 * social_feedback — Threaded comments on posts/stories.
 * entity_type + entity_id identify the target (post or story).
 * parent_id enables threading (reply to a comment).
 * timestamp_ms is for frame-anchored feedback on Reels (Batch 6).
 */
const SocialFeedback = model.define("social_feedback", {
  id: model.id().primaryKey(),

  entity_type: model.text(),            // "post" | "story"
  entity_id: model.text(),              // social_post.id or social_story.id

  // Author — stored as text so we don't cross-module FK; Medusa admin user id or email
  author_id: model.text().nullable(),
  author_name: model.text().nullable(),
  author_email: model.text().nullable(),

  text: model.text(),
  parent_id: model.text().nullable(),   // self-ref for threading
  timestamp_ms: model.number().nullable(),  // for Reel frame-anchored comments

  resolved: model.boolean().default(false),
  resolved_at: model.dateTime().nullable(),
  resolved_by: model.text().nullable(),
})

export default SocialFeedback
