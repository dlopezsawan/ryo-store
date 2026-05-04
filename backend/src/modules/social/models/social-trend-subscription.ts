import { model } from "@medusajs/framework/utils"

/**
 * social_trend_subscription — A specific account/channel/feed we want to
 * monitor for new content, separate from the keyword-based discovery the
 * other collectors do.
 *
 * Why a separate table:
 *   The keyword-search collectors (Reddit hot, YouTube search, TikTok
 *   keyword feed) are great for "what's bubbling up in the niche", but
 *   they miss the inverse case — when a SPECIFIC creator/competitor we
 *   already follow drops something new. RSS-based collectors solve that:
 *   we subscribe to a creator's feed and pick up everything they publish
 *   in real time, no quota cost.
 *
 *   We start with YouTube (kind="youtube_channel") because YouTube
 *   exposes a free, unlimited Atom feed per channel
 *   (`/feeds/videos.xml?channel_id=UCxxx`). Other platforms (TikTok,
 *   Reddit users, IG profiles) can be added with the same shape later.
 *
 * Identity:
 *   `(kind, source_id)` is unique while not soft-deleted. Re-adding a
 *   channel that was previously removed creates a new row (history
 *   preserved via `deleted_at`).
 */
const SocialTrendSubscription = model.define("social_trend_subscription", {
  id: model.id().primaryKey(),

  /**
   * Which platform/feed format. Drives which collector picks it up.
   *   - "youtube_channel"  → /feeds/videos.xml?channel_id=...
   *   - (future) "reddit_user", "rss_generic", etc.
   */
  kind: model.text(),

  /**
   * Platform-native identifier. For YouTube this is the UCxxxx channel id
   * (NOT @handle — handles can change, ids can't).
   */
  source_id: model.text(),

  /** Friendly display name for the admin UI. */
  label: model.text(),

  /** Whether the cron should fetch this subscription. */
  active: model.boolean().default(true),

  /** Bookkeeping for debugging — set after each successful fetch. */
  last_fetched_at: model.dateTime().nullable(),
  last_error: model.text().nullable(),
  fetch_error_count: model.number().default(0),
})

export default SocialTrendSubscription
