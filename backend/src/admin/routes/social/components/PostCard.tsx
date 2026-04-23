import { Badge, Container, Text, Heading } from "@medusajs/ui"
import type { SocialPost } from "../types"
import { MediaPreview } from "./MediaPreview"
import { FeedbackPanel } from "./FeedbackPanel"
import { StatusBadge } from "./StatusBadge"

function aspectForFormat(format: string): "4/5" | "9/16" | "1/1" {
  if (format === "Reel") return "9/16"
  return "4/5"
}

export function PostCard({ post, onChange }: { post: SocialPost; onChange: () => void }) {
  const urls = post.media_urls ?? []
  const aspect = aspectForFormat(post.format)

  return (
    <Container className="p-4 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Heading level="h3" className="truncate">
            #{post.number} · {post.title.replace(/^Post\s+\d+\s*·\s*/, "").replace(/^F\d+\s*·\s*/, "")}
          </Heading>
          <Text size="xsmall" className="text-ui-fg-subtle mt-0.5">
            {post.date_label ?? "Sin fecha"} {post.pillar ? `· ${post.pillar}` : ""}
          </Text>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <Badge size="2xsmall" color="blue">{post.format}</Badge>
          <StatusBadge status={post.status} />
        </div>
      </div>

      {/* Media */}
      <MediaPreview cover={post.cover_url} urls={urls} aspect={aspect} />

      {/* Caption */}
      {post.caption && (
        <details className="text-sm">
          <summary className="cursor-pointer text-ui-fg-subtle hover:text-ui-fg-base text-xs uppercase tracking-wide">
            Caption IG
          </summary>
          <Text size="small" className="mt-1 whitespace-pre-wrap text-ui-fg-base">
            {post.caption}
          </Text>
        </details>
      )}

      {/* Feedback */}
      <FeedbackPanel entityType="post" entityId={post.id} />
    </Container>
  )
}
