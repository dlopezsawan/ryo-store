import { model } from "@medusajs/framework/utils"

/**
 * social_post — A scheduled Instagram feed post (single / carousel / reel).
 * Synced from storefront/scripts/social/dashboard.html via `social:sync`.
 */
const SocialPost = model.define("social_post", {
  id: model.id().primaryKey(),

  // External identifier from the content pipeline (e.g. "post-05-carbon-activo", "post-F01-tres-flores")
  external_id: model.text().unique(),

  // Display
  number: model.text(),                 // "05", "F01"
  title: model.text(),
  pillar: model.text().nullable(),      // "Educational", "Flores · Lifestyle"
  format: model.text(),                 // "Single" | "Carrusel" | "Reel"

  // Planning
  date_label: model.text().nullable(),  // "Jueves 30 Abr · 20:00 VE" (human-readable from pipeline)
  date_planned: model.dateTime().nullable(),

  // Content
  caption: model.text().nullable(),
  cover_url: model.text().nullable(),   // relative path under /static/social-media/<external_id>/
  media_urls: model.json().nullable(),  // string[] — all previews (carrusel slides or reel mp4)

  // State
  status: model.text().default("draft"),
                                        // draft | in_review | approved | scheduled | published | failed
  ig_post_id: model.text().nullable(),  // populated after publish
  published_at: model.dateTime().nullable(),
})

export default SocialPost
