import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Button, Text, Textarea, toast } from "@medusajs/ui"
import type { SocialFeedbackItem } from "../types"

const API = "https://api.enrola.shop"
const ASSET_BASE = "https://api.enrola.shop"

/**
 * Frame.io-style feedback player for Reel posts.
 *
 * Features
 *   - <video> player with play/pause and currentTime tracking
 *   - Horizontal timeline with markers at each comment's anchor timestamp
 *   - Click a marker → video seeks to that frame and the matching comment
 *     scrolls into view on the side panel
 *   - Hit "Comentar en este frame" while paused → textarea seeded with the
 *     current timestamp (stored as `timestamp_ms` on the feedback row)
 *   - Threading, resolve, delete all reuse the same /admin/social/feedback API
 *     so Batch 2's @-mention emailing still fires automatically
 *
 * Falls back gracefully: if the post's media is not a video URL, we render
 * nothing and let PostCard use the plain FeedbackPanel instead (the parent
 * decides which to mount based on format).
 */
export function ReelFeedback({
  postId,
  videoUrl,
  posterUrl,
}: {
  postId: string
  videoUrl: string
  posterUrl?: string | null
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [duration, setDuration] = useState(0)
  const [currentMs, setCurrentMs] = useState(0)
  const [paused, setPaused] = useState(true)

  const [items, setItems] = useState<SocialFeedbackItem[]>([])
  const [loading, setLoading] = useState(false)
  const [draft, setDraft] = useState("")
  const [posting, setPosting] = useState(false)
  const [anchor, setAnchor] = useState<number | null>(null)
  const [focused, setFocused] = useState<string | null>(null)

  // ── Load + refresh ────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(
        `${API}/admin/social/feedback?entity_type=post&entity_id=${postId}`,
        { credentials: "include", cache: "no-store" }
      ).then((r) => r.json())
      setItems(res.feedback ?? [])
    } catch {
      /* swallow; the card still shows the player */
    } finally {
      setLoading(false)
    }
  }, [postId])

  useEffect(() => {
    void load()
  }, [load])

  // ── Video events ──────────────────────────────────────────────────
  const onLoadedMetadata = () => {
    const v = videoRef.current
    if (!v || !isFinite(v.duration)) return
    setDuration(v.duration * 1000)
  }
  const onTimeUpdate = () => {
    const v = videoRef.current
    if (!v) return
    setCurrentMs(Math.round(v.currentTime * 1000))
  }
  const onPlay = () => setPaused(false)
  const onPause = () => setPaused(true)

  const seekTo = (ms: number) => {
    const v = videoRef.current
    if (!v) return
    v.currentTime = ms / 1000
    setCurrentMs(ms)
    if (v.paused) {
      // Keep paused so the user can read the comment without the frame moving
    }
  }

  // ── Thread grouping (replies under roots) ─────────────────────────
  const { roots, repliesByParent } = useMemo(() => {
    const rootList: SocialFeedbackItem[] = []
    const byParent: Record<string, SocialFeedbackItem[]> = {}
    for (const it of items) {
      if (it.parent_id) {
        ;(byParent[it.parent_id] = byParent[it.parent_id] ?? []).push(it)
      } else {
        rootList.push(it)
      }
    }
    // Sort roots by timestamp_ms ASC (nulls last), then by created_at
    rootList.sort((a, b) => {
      const ta = a.timestamp_ms ?? Number.MAX_SAFE_INTEGER
      const tb = b.timestamp_ms ?? Number.MAX_SAFE_INTEGER
      if (ta !== tb) return ta - tb
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    })
    for (const k of Object.keys(byParent)) {
      byParent[k].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      )
    }
    return { roots: rootList, repliesByParent: byParent }
  }, [items])

  // Only anchored (has timestamp_ms) comments show on timeline
  const anchoredRoots = useMemo(
    () => roots.filter((r) => typeof r.timestamp_ms === "number"),
    [roots]
  )

  const unanchoredRoots = useMemo(
    () => roots.filter((r) => r.timestamp_ms == null),
    [roots]
  )

  // ── Submit ────────────────────────────────────────────────────────
  const openAnchoredForm = () => {
    const v = videoRef.current
    if (v && !v.paused) v.pause()
    setAnchor(currentMs)
  }

  const submit = async (withAnchor: boolean) => {
    const text = draft.trim()
    if (!text) return
    setPosting(true)
    try {
      const body: Record<string, unknown> = {
        entity_type: "post",
        entity_id: postId,
        text,
      }
      if (withAnchor && anchor != null) body.timestamp_ms = anchor
      const res = await fetch(`${API}/admin/social/feedback`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setDraft("")
      setAnchor(null)
      await load()
    } catch (e) {
      toast.error("No se pudo enviar", { description: (e as Error).message })
    } finally {
      setPosting(false)
    }
  }

  const resolveToggle = async (id: string, resolved: boolean) => {
    await fetch(`${API}/admin/social/feedback/${id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resolved }),
    })
    await load()
  }

  const remove = async (id: string) => {
    if (!confirm("¿Borrar este comentario?")) return
    await fetch(`${API}/admin/social/feedback/${id}`, {
      method: "DELETE",
      credentials: "include",
    })
    await load()
  }

  const jumpToComment = (item: SocialFeedbackItem) => {
    if (item.timestamp_ms != null) seekTo(item.timestamp_ms)
    setFocused(item.id)
    // Scroll the comment into view in the list
    requestAnimationFrame(() => {
      document.getElementById(`reel-cmt-${item.id}`)?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      })
    })
  }

  // ── Render ───────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-3 pt-2 border-t border-ui-border-base">
      {/* Video + timeline */}
      <div className="flex flex-col gap-2">
        <div className="aspect-[9/16] max-h-[520px] w-full rounded-md overflow-hidden bg-black relative">
          <video
            ref={videoRef}
            src={toAbs(videoUrl)}
            poster={posterUrl ? toAbs(posterUrl) : undefined}
            controls
            playsInline
            preload="metadata"
            onLoadedMetadata={onLoadedMetadata}
            onTimeUpdate={onTimeUpdate}
            onPlay={onPlay}
            onPause={onPause}
            className="w-full h-full object-contain bg-black"
          />
        </div>

        {/* Timeline with comment pins */}
        <div className="flex flex-col gap-1">
          <div className="relative h-6 bg-ui-bg-subtle rounded border border-ui-border-base">
            {/* Playhead */}
            {duration > 0 && (
              <div
                className="absolute top-0 bottom-0 w-px bg-ui-fg-base"
                style={{ left: `${(currentMs / duration) * 100}%` }}
                aria-hidden
              />
            )}
            {/* Markers */}
            {duration > 0 &&
              anchoredRoots.map((it) => {
                const pct = Math.max(0, Math.min(100, ((it.timestamp_ms ?? 0) / duration) * 100))
                return (
                  <button
                    key={it.id}
                    onClick={() => jumpToComment(it)}
                    className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-4 w-4 rounded-full text-[9px] font-bold flex items-center justify-center transition-all ${
                      it.resolved
                        ? "bg-ui-bg-base border border-ui-border-base text-ui-fg-muted opacity-60 hover:opacity-100"
                        : "bg-ui-button-inverted text-ui-fg-on-inverted shadow hover:scale-110"
                    } ${focused === it.id ? "ring-2 ring-ui-fg-interactive" : ""}`}
                    style={{ left: `${pct}%` }}
                    title={`${fmt(it.timestamp_ms!)} · ${it.text.slice(0, 80)}`}
                  >
                    {it.resolved ? "✓" : "💬"}
                  </button>
                )
              })}
          </div>
          <div className="flex items-center justify-between text-xs text-ui-fg-muted tabular-nums">
            <span>{fmt(currentMs)}</span>
            <span>{fmt(duration)}</span>
          </div>
        </div>

        {/* Anchor action */}
        <div className="flex items-center gap-2">
          <Button
            size="small"
            variant={anchor != null ? "primary" : "secondary"}
            disabled={duration === 0}
            onClick={openAnchoredForm}
          >
            💬 Comentar en{" "}
            <span className="tabular-nums ml-1">{fmt(paused ? currentMs : currentMs)}</span>
          </Button>
          {anchor != null && (
            <Text size="xsmall" className="text-ui-fg-interactive">
              Anclado a {fmt(anchor)} · escribí abajo y mandá
            </Text>
          )}
        </div>
      </div>

      {/* Comment input */}
      <div className="flex flex-col gap-1.5">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={
            anchor != null
              ? "Comentario para este frame específico…"
              : "Comentario general del Reel (o tocá '💬 Comentar en …' para anclarlo a un frame)"
          }
          rows={2}
          className="text-sm"
        />
        <div className="flex justify-between items-center">
          <Text size="xsmall" className="text-ui-fg-muted">
            Tip: <code className="text-ui-fg-subtle">@nombre</code> envía email
          </Text>
          <div className="flex gap-2">
            {anchor != null && (
              <Button size="small" variant="secondary" onClick={() => setAnchor(null)}>
                Desanclar
              </Button>
            )}
            <Button
              size="small"
              disabled={posting || !draft.trim()}
              onClick={() => submit(anchor != null)}
            >
              {posting ? "…" : anchor != null ? "Comentar frame" : "Comentar general"}
            </Button>
          </div>
        </div>
      </div>

      {/* Threads */}
      <div className="flex flex-col gap-3">
        {anchoredRoots.length > 0 && (
          <section>
            <Text
              size="xsmall"
              weight="plus"
              className="text-ui-fg-subtle uppercase tracking-wide mb-2"
            >
              Frame comments · {anchoredRoots.length}
            </Text>
            <ul className="flex flex-col gap-1.5">
              {anchoredRoots.map((it) => (
                <li key={it.id} id={`reel-cmt-${it.id}`}>
                  <CommentCard
                    item={it}
                    replies={repliesByParent[it.id] ?? []}
                    focused={focused === it.id}
                    onSeek={() => jumpToComment(it)}
                    onResolve={resolveToggle}
                    onRemove={remove}
                  />
                </li>
              ))}
            </ul>
          </section>
        )}

        {unanchoredRoots.length > 0 && (
          <section>
            <Text
              size="xsmall"
              weight="plus"
              className="text-ui-fg-subtle uppercase tracking-wide mb-2"
            >
              General · {unanchoredRoots.length}
            </Text>
            <ul className="flex flex-col gap-1.5">
              {unanchoredRoots.map((it) => (
                <li key={it.id} id={`reel-cmt-${it.id}`}>
                  <CommentCard
                    item={it}
                    replies={repliesByParent[it.id] ?? []}
                    focused={focused === it.id}
                    onSeek={null}
                    onResolve={resolveToggle}
                    onRemove={remove}
                  />
                </li>
              ))}
            </ul>
          </section>
        )}

        {items.length === 0 && !loading && (
          <Text size="xsmall" className="text-ui-fg-muted italic">
            Sin comentarios aún. Pausá el Reel en el frame que quieras comentar y tocá
            el botón 💬 arriba.
          </Text>
        )}
      </div>
    </div>
  )
}

// ─── Single comment with optional seek button ──────────────────────
function CommentCard({
  item,
  replies,
  focused,
  onSeek,
  onResolve,
  onRemove,
}: {
  item: SocialFeedbackItem
  replies: SocialFeedbackItem[]
  focused: boolean
  onSeek: (() => void) | null
  onResolve: (id: string, resolved: boolean) => Promise<void>
  onRemove: (id: string) => Promise<void>
}) {
  return (
    <div
      className={`rounded-md border p-2 text-sm transition ${
        item.resolved
          ? "bg-ui-bg-subtle border-ui-border-base opacity-60"
          : "bg-ui-bg-base border-ui-border-strong"
      } ${focused ? "ring-2 ring-ui-fg-interactive" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className={`flex-1 ${item.resolved ? "line-through" : ""}`}>
          {onSeek && item.timestamp_ms != null && (
            <button
              onClick={onSeek}
              className="inline-flex items-center gap-1 text-xs font-mono px-1.5 py-0.5 mr-2 rounded bg-ui-bg-component text-ui-fg-on-inverted hover:opacity-90"
              title="Ir a este frame"
            >
              ▶ {fmt(item.timestamp_ms)}
            </button>
          )}
          <CommentBody text={item.text} />
        </div>
        <div className="flex gap-1 shrink-0">
          <button
            onClick={() => onResolve(item.id, !item.resolved)}
            className="text-xs text-ui-fg-subtle hover:text-ui-fg-base"
            title={item.resolved ? "Reabrir" : "Resolver"}
          >
            {item.resolved ? "↺" : "✓"}
          </button>
          <button
            onClick={() => onRemove(item.id)}
            className="text-xs text-ui-fg-subtle hover:text-ui-fg-error"
            title="Borrar"
          >
            ×
          </button>
        </div>
      </div>
      <Text size="xsmall" className="text-ui-fg-muted mt-1">
        {new Date(item.created_at).toLocaleString("es-VE", {
          day: "2-digit",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        })}
        {item.author_id ? ` · ${item.author_id.slice(0, 8)}` : ""}
      </Text>

      {replies.length > 0 && (
        <ul className="mt-1.5 pl-3 border-l-2 border-ui-border-base flex flex-col gap-1">
          {replies.map((r) => (
            <li key={r.id} className="text-xs text-ui-fg-subtle">
              <CommentBody text={r.text} />{" "}
              <span className="text-ui-fg-muted">
                · {new Date(r.created_at).toLocaleString("es-VE", { hour: "2-digit", minute: "2-digit" })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ─── @mention highlighter (shared behavior with FeedbackPanel) ────
function CommentBody({ text }: { text: string }) {
  const parts = useMemo(() => {
    const re = /(^|\s)(@[a-zA-Z0-9._-]{2,40})/g
    const nodes: React.ReactNode[] = []
    let last = 0
    let key = 0
    let m: RegExpExecArray | null
    while ((m = re.exec(text)) !== null) {
      const start = m.index + m[1].length
      if (start > last) nodes.push(text.slice(last, start))
      nodes.push(
        <span
          key={key++}
          className="font-medium text-ui-fg-interactive bg-ui-bg-interactive/20 rounded px-1"
        >
          {m[2]}
        </span>
      )
      last = start + m[2].length
    }
    if (last < text.length) nodes.push(text.slice(last))
    return nodes
  }, [text])
  return <span className="whitespace-pre-wrap break-words">{parts}</span>
}

// ─── helpers ───────────────────────────────────────────────────────
function fmt(ms: number): string {
  if (!isFinite(ms) || ms < 0) return "0:00"
  const total = Math.floor(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, "0")}`
}

function toAbs(u: string): string {
  if (!u) return u
  if (u.startsWith("http") || u.startsWith("data:")) return u
  return `${ASSET_BASE}${u.startsWith("/") ? "" : "/"}${u}`
}
