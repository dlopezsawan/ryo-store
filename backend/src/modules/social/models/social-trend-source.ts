import { model } from "@medusajs/framework/utils"

/**
 * social_trend_source — Atomic trending signal, one row per scraped post/video/term.
 *
 * We normalize across very different origins (Reddit threads, YouTube videos,
 * Google Trends rising terms, and later Instagram posts) into one shape so
 * the UI can show a unified trend stream.
 *
 * `kind` differentiates:
 *   - "reddit_post"   — hot Reddit post in a paraphernalia sub
 *   - "youtube_video" — trending YT video for a keyword
 *   - "google_term"   — rising Google Trends term in the niche
 *   - "instagram_post" — (future) HikerAPI-scraped IG post
 *
 * We keep raw content snapshots (title/summary/media_url/metric) so the
 * admin UI can render a card without re-fetching the source.
 */
const SocialTrendSource = model.define("social_trend_source", {
  id: model.id().primaryKey(),

  // Identity & origin
  kind: model.text(),                 // reddit_post | youtube_video | google_term | instagram_post
  source_id: model.text(),            // external id from the origin (Reddit post id, YT video id, term slug)
  source_url: model.text().nullable(),

  // Display
  title: model.text(),
  author: model.text().nullable(),
  summary: model.text().nullable(),   // excerpt for Reddit, description for YT
  media_url: model.text().nullable(), // thumbnail
  permalink: model.text().nullable(), // canonical URL to open

  // Engagement snapshot at time of fetch
  score: model.number().default(0),   // upvotes / views / search volume index
  comments: model.number().default(0),
  engagement_delta: model.number().nullable(),   // % change vs previous fetch (if tracked)

  // Categorization
  keywords: model.json().nullable(),  // string[] — matched keywords for filtering in UI
  region: model.text().nullable(),    // "VE" | "LATAM" | "EN" | null (for Reddit, usually null)
  posted_at: model.dateTime().nullable(),  // when the item was originally published

  // Bookkeeping
  fetched_at: model.dateTime(),
})

export default SocialTrendSource
