import { useState } from "react"
import { Badge, Button, Container, Tabs, Text, Heading, toast } from "@medusajs/ui"
import type { SocialPost } from "../types"
import { MediaPreview } from "./MediaPreview"
import { FeedbackPanel } from "./FeedbackPanel"
import { ReelFeedback } from "./ReelFeedback"
import { ReelCoverPreview } from "./ReelCoverPreview"
import { MediaEditor } from "./MediaEditor"
import { CaptionEditor } from "./CaptionEditor"
import { ActivityFeed } from "./ActivityFeed"
import { StatusBadge } from "./StatusBadge"
import { ScheduleInput } from "./ScheduleInput"
import { PublishControls } from "./PublishControls"

const API = "https://api.enrola.shop"

function aspectForFormat(format: string): "4/5" | "9/16" | "1/1" {
  if (format === "Reel") return "9/16"
  return "4/5"
}

export function PostCard({ post, onChange }: { post: SocialPost; onChange: () => void }) {
  const urls = post.media_urls ?? []
  const aspect = aspectForFormat(post.format)
  const [busy, setBusy] = useState(false)

  const isApproved =
    post.status === "approved" || post.status === "scheduled" || post.status === "published"

  const setStatus = async (next: "approved" | "draft") => {
    setBusy(true)
    try {
      const res = await fetch(`${API}/admin/social/posts/${post.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      toast.success(next === "approved" ? "Post aprobado" : "Post reabierto")
      onChange()
    } catch (e) {
      toast.error("No se pudo actualizar", { description: (e as Error).message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Container id={`card-${post.id}`} className="p-4 flex flex-col gap-3 scroll-mt-20">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Heading level="h3" className="truncate">
            #{post.number} · {post.title.replace(/^Post\s+\d+\s*·\s*/, "").replace(/^F\d+\s*·\s*/, "")}
          </Heading>
          <Text size="xsmall" className="text-ui-fg-subtle mt-0.5">
            {post.status === "published" && post.published_at ? (
              <>
                ✓ Publicado{" "}
                {new Date(post.published_at).toLocaleString("es-VE", {
                  day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                })}
              </>
            ) : (
              <>{post.date_label ?? "Sin fecha"}</>
            )}
            {post.pillar ? ` · ${post.pillar}` : ""}
          </Text>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <Badge size="2xsmall" color="blue">{post.format}</Badge>
          <StatusBadge status={post.status} />
        </div>
      </div>

      {/* Suggested posting time — editable inline */}
      <ScheduleInput
        entityType="post"
        entityId={post.id}
        field="date_planned"
        value={post.date_planned}
        onSaved={onChange}
      />

      {/* Media block:
          - Reels → tab switcher between the reel video (with frame-anchored
            comments) and the cover (what IG shows in the feed grid; matters
            for approval on its own, independent of the video content).
            ReelFeedback is the SOLE video player for Reels — having it both
            here and below caused the same .mp4 to be loaded twice and
            Chrome auto-paused one when the other was played.
          - Carousel / single image → just the media preview. */}
      {post.format === "Reel" ? (
        <Tabs defaultValue="reel">
          <Tabs.List>
            <Tabs.Trigger value="reel">Reel</Tabs.Trigger>
            <Tabs.Trigger value="cover">Portada</Tabs.Trigger>
          </Tabs.List>
          <Tabs.Content value="reel" className="pt-3">
            {firstVideoUrl(urls) ? (
              <ReelFeedback
                postId={post.id}
                videoUrl={firstVideoUrl(urls)!}
                posterUrl={post.cover_url}
              />
            ) : (
              <MediaPreview cover={post.cover_url} urls={urls} aspect={aspect} />
            )}
          </Tabs.Content>
          <Tabs.Content value="cover" className="pt-3">
            <ReelCoverPreview post={post} />
          </Tabs.Content>
        </Tabs>
      ) : (
        <MediaPreview cover={post.cover_url} urls={urls} aspect={aspect} />
      )}

      {/* Media editor — surfaced for posts that don't yet have media or are
          still being edited (draft / in_review). Lets the user set cover and
          attach URLs without going through dashboard.html sync, which is
          essential for promoted posts whose external_id doesn't live in the
          dashboard. */}
      {(post.status === "draft" || post.status === "in_review") && (
        <MediaEditor post={post} onChange={onChange} />
      )}

      {/* Caption — editable for drafts/in_review (ESPECIALLY useful for
          promoted posts where the suggestion body landed as caption and
          needs final cleanup). Read-only display once approved/scheduled
          to prevent accidental drift while the post is in flight. */}
      {(post.status === "draft" || post.status === "in_review") ? (
        <CaptionEditor postId={post.id} value={post.caption} onSaved={onChange} />
      ) : (
        post.caption && (
          <details className="text-sm">
            <summary className="cursor-pointer text-ui-fg-subtle hover:text-ui-fg-base text-xs uppercase tracking-wide">
              Caption IG
            </summary>
            <Text size="small" className="mt-1 whitespace-pre-wrap text-ui-fg-base">
              {post.caption}
            </Text>
          </details>
        )
      )}

      {/* Approve / Reopen action — shown only while there's something to decide */}
      {(post.status === "draft" || post.status === "in_review" || post.status === "approved") && (
        <div className="flex justify-end">
          {isApproved ? (
            <Button
              size="small"
              variant="secondary"
              disabled={busy}
              onClick={() => setStatus("draft")}
            >
              ↺ Reabrir
            </Button>
          ) : (
            <Button size="small" disabled={busy} onClick={() => setStatus("approved")}>
              ✓ Aprobar
            </Button>
          )}
        </div>
      )}

      {/* Publish pipeline — approved → scheduled → publishing → published/failed */}
      <PublishControls entity="post" item={post} onChange={onChange} />

      {/* Feedback — for non-Reel formats (Reels handle their own feedback
          via ReelFeedback inside the "Reel" tab above). */}
      {post.format !== "Reel" && (
        <FeedbackPanel entityType="post" entityId={post.id} />
      )}

      {/* Activity timeline (collapsed) */}
      <ActivityFeed entityType="post" entityId={post.id} />
    </Container>
  )
}

/**
 * Pick the first URL in the list that's a video — usually the reel.mp4.
 * Returns null if the post is a Reel but for some reason has no mp4 (edge
 * case — fall back to plain feedback panel in that case).
 */
function firstVideoUrl(urls: string[]): string | null {
  return urls.find((u) => /\.(mp4|mov|m4v)$/i.test(u)) ?? null
}
