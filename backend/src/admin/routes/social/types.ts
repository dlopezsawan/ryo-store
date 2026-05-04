export type SocialStatus =
  | "draft"
  | "in_review"
  | "approved"
  | "scheduled"
  | "publishing"
  | "published"
  | "failed"

export interface SocialPost {
  id: string
  external_id: string
  number: string
  title: string
  pillar: string | null
  format: string // "Single" | "Carrusel" | "Reel"
  date_label: string | null
  date_planned: string | null
  caption: string | null
  cover_url: string | null
  media_urls: string[] | null
  status: SocialStatus
  scheduled_at: string | null
  buffer_post_id: string | null
  ig_post_id: string | null
  published_at: string | null
  failure_reason: string | null
  error_count: number
  created_at: string
  updated_at: string
}

export interface SocialStory {
  id: string
  external_id: string
  date: string
  slot: number
  type: string
  media_url: string | null
  link_url: string | null
  link_x: number | null
  link_y: number | null
  link_width: number | null
  link_height: number | null
  link_rotation: number | null
  status: SocialStatus
  scheduled_at: string | null
  buffer_post_id: string | null
  ig_story_id: string | null
  published_at: string | null
  failure_reason: string | null
  error_count: number
  created_at: string
  updated_at: string
}

export interface SocialFeedbackItem {
  id: string
  entity_type: "post" | "story"
  entity_id: string
  author_id: string | null
  author_name: string | null
  author_email: string | null
  text: string
  parent_id: string | null
  timestamp_ms: number | null
  resolved: boolean
  resolved_at: string | null
  resolved_by: string | null
  created_at: string
  updated_at: string
}

export interface SocialActivityItem {
  id: string
  entity_type: "post" | "story"
  entity_id: string
  actor_id: string | null
  actor_name: string | null
  action:
    | "status_changed"
    | "feedback_added"
    | "feedback_replied"
    | "feedback_resolved"
    | "feedback_deleted"
    | "mention"
    | string
  payload: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export const STATUS_COLORS: Record<SocialStatus, "grey" | "orange" | "blue" | "green" | "red" | "purple"> = {
  draft: "grey",
  in_review: "orange",
  approved: "purple",
  scheduled: "blue",
  publishing: "blue",
  published: "green",
  failed: "red",
}

export type TrendKind =
  | "reddit_post"
  | "youtube_video"
  | "google_term"
  | "instagram_post"
  | "tiktok_video"

export interface SocialTrendSource {
  id: string
  kind: TrendKind
  source_id: string
  source_url: string | null
  title: string
  author: string | null
  summary: string | null
  media_url: string | null
  permalink: string | null
  score: number
  comments: number
  engagement_delta: number | null
  keywords: string[] | null
  region: string | null
  posted_at: string | null
  fetched_at: string
  created_at: string
  updated_at: string
}

export type SuggestionStatus = "idea" | "in_design" | "rejected" | "promoted"
export type SuggestionSource = "manual" | "trend" | "feedback"

export interface SocialSuggestion {
  id: string
  kind: "post" | "story"
  title: string
  body: string | null
  pillar: string | null
  format: string | null
  suggested_date: string | null
  source: SuggestionSource
  source_ref: string | null
  status: SuggestionStatus
  promoted_to: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface SocialTrendBrief {
  id: string
  week_start: string
  generated_at: string
  content: {
    themes: Array<{ title: string; why: string; sources: string[] }>
    content_ideas: string[]
    hashtag_watch: string[]
    model?: string
    input_tokens?: number
    output_tokens?: number
  }
  model_name: string | null
  created_at: string
  updated_at: string
}

export const STATUS_LABELS: Record<SocialStatus, string> = {
  draft: "Borrador",
  in_review: "En revisión",
  approved: "Aprobado",
  scheduled: "Programado",
  publishing: "Publicando…",
  published: "Publicado",
  failed: "Falló",
}
