import { model } from "@medusajs/framework/utils"

/**
 * social_suggestion — An IDEA for a future post/story that doesn't yet exist
 * in the content calendar.
 *
 * The flow is:
 *   1. User (or cron from trend brief) creates a suggestion
 *   2. Team reviews, refines, adds notes/references
 *   3. Either: exported to Claude for design, promoted to a real
 *      social_post / social_story, or rejected
 *
 * We keep this separate from social_post so the kanban/calendar stays focused
 * on "committed" content. Suggestions live in their own section at the top of
 * the Lista tab.
 */
const SocialSuggestion = model.define("social_suggestion", {
  id: model.id().primaryKey(),

  kind: model.text(),                       // "post" | "story"
  title: model.text(),
  body: model.text().nullable(),            // long-form notes/references

  // Optional hints for the designer
  pillar: model.text().nullable(),          // Educational · Flores · BTS · etc.
  format: model.text().nullable(),          // Single | Carrusel | Reel | Story
  suggested_date: model.dateTime().nullable(),

  // Where did this idea come from?
  source: model.text().default("manual"),   // manual | trend | feedback
  source_ref: model.text().nullable(),      // trend_source.id | feedback.id

  // Lifecycle
  status: model.text().default("idea"),     // idea | in_design | rejected | promoted
  promoted_to: model.text().nullable(),     // social_post.id if promoted

  created_by: model.text().nullable(),
})

export default SocialSuggestion
