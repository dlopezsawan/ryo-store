import { model } from "@medusajs/framework/utils"

/**
 * social_story — Daily Instagram story.
 * Supports optional link sticker with relative [0,1] coordinates (x, y, width, height, rotation).
 */
const SocialStory = model.define("social_story", {
  id: model.id().primaryKey(),

  external_id: model.text().unique(),   // "story-2026-05-14-3-combo"
  date: model.text(),                   // "2026-05-14"
  slot: model.number(),                 // 1..3 (order within day)
  type: model.text(),                   // product | quote | poll | dyk | bts | combo | repost | mood

  // Content
  media_url: model.text().nullable(),   // /static/social-media/<external_id>.png

  // Link sticker (Batch 5 will populate via editor)
  link_url: model.text().nullable(),
  link_x: model.number().nullable(),         // 0..1 center X
  link_y: model.number().nullable(),         // 0..1 center Y
  link_width: model.number().nullable(),     // 0..1 relative
  link_height: model.number().nullable(),    // 0..1 relative
  link_rotation: model.number().nullable(),  // degrees

  // State
  status: model.text().default("draft"),
  scheduled_at: model.dateTime().nullable(),
  buffer_post_id: model.text().nullable(),   // Buffer post id (pre-publish tracking)
  ig_story_id: model.text().nullable(),
  published_at: model.dateTime().nullable(),

  // Diagnostics for the publish pipeline
  failure_reason: model.text().nullable(),
  error_count: model.number().default(0),
})

export default SocialStory
