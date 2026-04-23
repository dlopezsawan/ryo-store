export type SocialStatus =
  | "draft"
  | "in_review"
  | "approved"
  | "scheduled"
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
  ig_post_id: string | null
  published_at: string | null
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
  ig_story_id: string | null
  published_at: string | null
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

export const STATUS_COLORS: Record<SocialStatus, "grey" | "orange" | "blue" | "green" | "red" | "purple"> = {
  draft: "grey",
  in_review: "orange",
  approved: "purple",
  scheduled: "blue",
  published: "green",
  failed: "red",
}

export const STATUS_LABELS: Record<SocialStatus, string> = {
  draft: "Borrador",
  in_review: "En revisión",
  approved: "Aprobado",
  scheduled: "Programado",
  published: "Publicado",
  failed: "Falló",
}
