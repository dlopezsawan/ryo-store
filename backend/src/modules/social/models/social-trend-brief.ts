import { model } from "@medusajs/framework/utils"

/**
 * social_trend_brief — AI-generated weekly summary of what's trending.
 *
 * Generated once a week by the collector cron. Summarizes the last 7 days of
 * trend_source rows into human-readable buckets:
 *
 *   {
 *     "themes": [
 *       { "title": "Grinders eléctricos", "why": "..." , "sources": [ids] },
 *       ...
 *     ],
 *     "content_ideas": [
 *       "Post comparativo grinder manual vs eléctrico",
 *       "Reel de unboxing del Puff Man"
 *     ],
 *     "hashtag_watch": ["#rollingpapers", "#grinderlife"],
 *     "model": "claude-sonnet-4-5",
 *     "input_tokens": 12400,
 *     "output_tokens": 380
 *   }
 */
const SocialTrendBrief = model.define("social_trend_brief", {
  id: model.id().primaryKey(),
  week_start: model.text(),           // "2026-W17" (ISO week) for idempotent upsert
  generated_at: model.dateTime(),
  content: model.json(),              // the structure above
  model_name: model.text().nullable(),
})

export default SocialTrendBrief
