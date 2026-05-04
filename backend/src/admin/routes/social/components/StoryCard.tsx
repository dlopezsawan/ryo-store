import { useState } from "react"
import { Badge, Text, toast } from "@medusajs/ui"
import type { SocialStory } from "../types"
import { StatusBadge } from "./StatusBadge"
import { FeedbackPanel } from "./FeedbackPanel"
import { ActivityFeed } from "./ActivityFeed"
import { ScheduleInput } from "./ScheduleInput"
import { PublishControls } from "./PublishControls"
import { StoryLinkInput } from "./StoryLinkInput"

const ASSET_BASE = "https://api.enrola.shop"
const API = "https://api.enrola.shop"

// Cache-bust version — bump whenever we re-render and re-upload story PNGs in
// place (same filename, new bytes). Without this the browser holds onto the
// stale version from disk cache and you swear the new render never shipped.
const MEDIA_VERSION = "20260425c"

const abs = (u: string | null | undefined, updatedAt?: string | null): string | undefined => {
  if (!u) return undefined
  if (u.startsWith("http://") || u.startsWith("https://") || u.startsWith("data:")) return u
  const full = `${ASSET_BASE}${u.startsWith("/") ? "" : "/"}${u}`
  // Append version so the URL changes when we bump MEDIA_VERSION or the row
  // is updated (per-story freshness) — whichever changes first wins.
  const bust = updatedAt ? new Date(updatedAt).getTime() : MEDIA_VERSION
  const sep = full.includes("?") ? "&" : "?"
  return `${full}${sep}v=${bust}`
}

/**
 * Default suggested datetime when the story has no scheduled_at yet:
 *   story.date + (8 + slot):00 local time.
 * Returned as an ISO string so <ScheduleInput> can seed the input.
 */
function defaultScheduledAt(story: SocialStory): string {
  const [y, m, d] = story.date.split("-").map((n) => parseInt(n, 10))
  if (!y || !m || !d) return ""
  const dt = new Date(y, m - 1, d, 8 + (story.slot || 1), 0, 0)
  return dt.toISOString()
}

/**
 * Heuristic link suggestion per story type. Just a placeholder the user sees
 * in the empty input — saves them typing the common stuff.
 */
function suggestLinkForStory(story: SocialStory): string {
  // Storefront uses Spanish slugs — `/productos/` (NOT `/products/`)
  // and `/blog/`. Combos live under arma-tu-combo.
  const t = (story.type || "").toLowerCase()
  const BASE = "https://enrola.shop"
  switch (t) {
    case "product":     return `${BASE}/productos/`
    case "combo":       return `${BASE}/arma-tu-combo`
    case "poll":        return `${BASE}`
    case "repost":      return `${BASE}`
    case "dyk":         return `${BASE}/blog/`
    case "bts":         return `${BASE}`
    default:            return `${BASE}`
  }
}

export function StoryCard({ story, onChange }: { story: SocialStory; onChange: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const [busy, setBusy] = useState(false)

  const isApproved =
    story.status === "approved" || story.status === "scheduled" || story.status === "published"

  const setStatus = async (e: React.MouseEvent, next: "approved" | "draft") => {
    e.stopPropagation()
    setBusy(true)
    try {
      const res = await fetch(`${API}/admin/social/stories/${story.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      toast.success(next === "approved" ? "Story aprobada" : "Story reabierta")
      onChange()
    } catch (err) {
      toast.error("No se pudo actualizar", { description: (err as Error).message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div id={`card-${story.id}`} className="flex flex-col gap-1 scroll-mt-20">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="aspect-[9/16] w-full bg-ui-bg-base overflow-hidden rounded-md border border-ui-border-base hover:border-ui-border-strong transition-colors relative group"
      >
        {story.media_url ? (
          <img src={abs(story.media_url, story.updated_at)} alt="" className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-ui-fg-muted text-xs">
            Sin media
          </div>
        )}
        <div className="absolute top-1 left-1 right-1 flex items-center justify-between">
          <Badge size="2xsmall" color="grey">
            {story.slot}
          </Badge>
          <Badge size="2xsmall" color="grey">
            {story.type}
          </Badge>
        </div>

        {/* Approve / Reopen quick action */}
        <div
          role="button"
          tabIndex={0}
          onClick={(e) => setStatus(e, isApproved ? "draft" : "approved")}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault()
              setStatus(e as unknown as React.MouseEvent, isApproved ? "draft" : "approved")
            }
          }}
          aria-disabled={busy}
          aria-label={isApproved ? "Reabrir story" : "Aprobar story"}
          title={isApproved ? "Reabrir" : "Aprobar"}
          className={`absolute top-1 right-1 h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold transition-all shadow-md cursor-pointer ${
            isApproved
              ? "bg-ui-bg-base text-ui-fg-subtle hover:text-ui-fg-base"
              : "bg-ui-button-inverted text-ui-fg-on-inverted hover:opacity-90"
          } ${busy ? "opacity-50 pointer-events-none" : ""}`}
        >
          {isApproved ? "↺" : "✓"}
        </div>

        {story.link_url && (
          <div className="absolute bottom-1 left-1 right-1 bg-black/80 text-white text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1 truncate">
            🔗 {new URL(story.link_url).hostname.replace(/^www\./, "")}
          </div>
        )}
      </button>

      <div className="flex items-center justify-between">
        <Text size="xsmall" className="text-ui-fg-subtle">
          {story.status === "published" && story.published_at ? (
            <>
              ✓ {new Date(story.published_at).toLocaleString("es-VE", {
                day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
              })} · #{story.slot}
            </>
          ) : (
            <>
              {story.date.slice(5)} · #{story.slot}
              {story.scheduled_at && (
                <> · {new Date(story.scheduled_at).toLocaleTimeString("es-VE", { hour: "2-digit", minute: "2-digit" })}</>
              )}
            </>
          )}
        </Text>
        <StatusBadge status={story.status} />
      </div>

      {expanded && (
        <div className="mt-2 p-2 rounded-md border border-ui-border-base bg-ui-bg-base flex flex-col gap-2">
          <ScheduleInput
            entityType="story"
            entityId={story.id}
            field="scheduled_at"
            value={story.scheduled_at ?? defaultScheduledAt(story)}
            onSaved={onChange}
          />
          <StoryLinkInput
            storyId={story.id}
            value={story.link_url}
            onSaved={onChange}
            suggestion={suggestLinkForStory(story)}
          />
          <PublishControls entity="story" item={story} onChange={onChange} />
          <FeedbackPanel entityType="story" entityId={story.id} />
          <ActivityFeed entityType="story" entityId={story.id} />
        </div>
      )}
    </div>
  )
}
