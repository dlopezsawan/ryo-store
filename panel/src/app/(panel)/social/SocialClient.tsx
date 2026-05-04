"use client"

import { useState, useTransition, useMemo, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Calendar, LayoutGrid, List, ChevronLeft, ChevronRight,
  AlertCircle, CheckCircle2, MoreVertical, Edit, Trash2, Send, Clock, ThumbsUp, ThumbsDown,
  Eye, Heart, MessageCircle, Bookmark, ImageIcon, Sparkles, TrendingUp, Lightbulb,
} from "lucide-react"
import { reschedulePostAction, deletePostAction, approvePostAction, rejectPostAction, publishPostAction } from "./actions"
import { PostEditor } from "./PostEditor"
import { PostAnalytics } from "./PostAnalytics"
import { ApprovalThread } from "./ApprovalThread"
import { PostDetailModal } from "./PostDetailModal"
import { FeedbackInbox } from "./FeedbackInbox"
import { TrendsView } from "./TrendsView"
import { SuggestionsView } from "./SuggestionsView"
import { fmtRelative } from "@/lib/utils"
import type {
  SocialPost, SocialStory,
  SocialTrendSource, SocialTrendBrief, SocialTrendSubscription, SocialSuggestion,
} from "@/lib/medusa"
import { resolveMediaUrl } from "@/lib/media"

type ViewMode = "review" | "stories" | "month" | "week" | "list" | "trends" | "ideas"
type Toast = { kind: "ok" | "err"; msg: string } | null

const CHANNEL_META: Record<string, { label: string; color: string }> = {
  instagram: { label: "IG", color: "#E1306C" },
  tiktok:    { label: "TT", color: "#000000" },
  twitter:   { label: "X",  color: "#1DA1F2" },
  facebook:  { label: "FB", color: "#1877F2" },
  youtube:   { label: "YT", color: "#FF0000" },
  blog:      { label: "BG", color: "#4D5431" },
}

const STATUS_META: Record<string, { label: string; cls: string; bg: string }> = {
  draft:      { label: "Borrador",       cls: "text-ink-3",     bg: "bg-cream-2" },
  in_review:  { label: "En review",      cls: "text-orange",    bg: "bg-orange/10" },
  approved:   { label: "Aprobado",       cls: "text-secondary", bg: "bg-secondary/10" },
  scheduled:  { label: "Programado",     cls: "text-orange",    bg: "bg-orange/10" },
  publishing: { label: "Publicando",     cls: "text-orange",    bg: "bg-orange/15" },
  published:  { label: "Publicado",      cls: "text-secondary", bg: "bg-secondary/10" },
  failed:     { label: "Falló",          cls: "text-primary",   bg: "bg-primary/10" },
  rejected:   { label: "Rechazado",      cls: "text-primary",   bg: "bg-primary/10" },
}

interface Props {
  posts: SocialPost[]
  stories?: SocialStory[]
  trendSources?: SocialTrendSource[]
  trendBrief?: SocialTrendBrief | null
  trendSubs?: SocialTrendSubscription[]
  suggestions?: SocialSuggestion[]
  currentUserEmail: string
}

export function SocialClient({
  posts, stories = [],
  trendSources = [], trendBrief = null, trendSubs = [], suggestions = [],
  currentUserEmail,
}: Props) {
  const router = useRouter()
  const [view, setView] = useState<ViewMode>("review")
  const [channelFilter, setChannelFilter] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [formatFilter, setFormatFilter] = useState<string | null>(null)
  const [anchorDate, setAnchorDate] = useState(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  })
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingPost, setEditingPost] = useState<SocialPost | null>(null)
  const [editorInitialDate, setEditorInitialDate] = useState<string | null>(null)
  const [detailPost, setDetailPost] = useState<SocialPost | null>(null)
  const [toast, setToast] = useState<Toast>(null)

  function flash(k: "ok" | "err", m: string) {
    setToast({ kind: k, msg: m })
    setTimeout(() => setToast(null), 4000)
  }

  // Restaurar view del localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("panel_social_view")
      const valid: ViewMode[] = ["review", "stories", "month", "week", "list", "trends", "ideas"]
      if (valid.includes(saved as ViewMode)) setView(saved as ViewMode)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    try { localStorage.setItem("panel_social_view", view) } catch { /* ignore */ }
  }, [view])

  // Filtered list
  const filtered = useMemo(() => {
    return posts.filter((p) => {
      if (channelFilter && p.channel !== channelFilter) return false
      if (statusFilter && p.status !== statusFilter) return false
      if (formatFilter && (p.format ?? "post").toLowerCase() !== formatFilter) return false
      return true
    })
  }, [posts, channelFilter, statusFilter, formatFilter])

  // Counts por format para mostrar badges en filter
  const formatCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const p of posts) {
      const f = (p.format ?? "post").toLowerCase()
      counts.set(f, (counts.get(f) ?? 0) + 1)
    }
    return counts
  }, [posts])

  function openCreate(date?: string) {
    setEditingPost(null)
    setEditorInitialDate(date ?? null)
    setEditorOpen(true)
  }

  function openEdit(post: SocialPost) {
    setEditingPost(post)
    setEditorInitialDate(null)
    setEditorOpen(true)
  }

  function openDetail(post: SocialPost) {
    setDetailPost(post)
  }

  // Drag&drop reschedule
  function handleDrop(postId: string, newDateLocalStr: string) {
    const iso = new Date(newDateLocalStr).toISOString()
    void reschedulePostAction(postId, iso).then((res) => {
      if (!res.ok) return flash("err", res.error)
      flash("ok", "Post reagendado")
      router.refresh()
    })
  }

  return (
    <>
      {/* Toolbar: view switcher + channel filter + status filter + nav */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* View switcher */}
        <div className="flex items-center bg-cream rounded-md overflow-hidden" style={{ border: "1.5px solid var(--border)" }}>
          {(["review", "stories", "month", "week", "list", "trends", "ideas"] as ViewMode[]).map((v) => (
            <button key={v} onClick={() => setView(v)}
              className={`flex items-center gap-1 px-3 py-2 text-[10px] font-display font-bold uppercase tracking-wider ${
                view === v ? "bg-dark text-cream" : "text-ink-3 hover:bg-cream-2"
              }`}>
              {v === "review"  && <Sparkles size={11} strokeWidth={2.5} />}
              {v === "stories" && <ImageIcon size={11} strokeWidth={2.5} />}
              {v === "month"   && <Calendar size={11} strokeWidth={2.5} />}
              {v === "week"    && <LayoutGrid size={11} strokeWidth={2.5} />}
              {v === "list"    && <List size={11} strokeWidth={2.5} />}
              {v === "trends"  && <TrendingUp size={11} strokeWidth={2.5} />}
              {v === "ideas"   && <Lightbulb size={11} strokeWidth={2.5} />}
              {v === "review" ? "Review"
                : v === "stories" ? `Stories (${stories.length})`
                : v === "month" ? "Mes"
                : v === "week" ? "Semana"
                : v === "list" ? "Lista"
                : v === "trends" ? `Trends (${trendSources.length})`
                : `Ideas (${suggestions.length})`}
            </button>
          ))}
        </div>

        {/* Channel chips */}
        <div className="flex items-center gap-1 flex-wrap">
          <FilterChip label="Todos canales" active={channelFilter === null} onClick={() => setChannelFilter(null)} />
          {Object.entries(CHANNEL_META).map(([id, m]) => (
            <FilterChip key={id} label={m.label} color={m.color}
              active={channelFilter === id} onClick={() => setChannelFilter((c) => c === id ? null : id)} />
          ))}
        </div>

        {/* Status quick filter */}
        <select value={statusFilter ?? "all"} onChange={(e) => setStatusFilter(e.target.value === "all" ? null : e.target.value)}
          className="px-2 py-2 bg-cream rounded-md text-[10px] font-display font-bold uppercase tracking-wider focus:outline-none"
          style={{ border: "1.5px solid var(--border)" }}>
          <option value="all">Todos estados</option>
          {Object.keys(STATUS_META).map((s) => (
            <option key={s} value={s}>{STATUS_META[s].label}</option>
          ))}
        </select>

        {/* Format filter (post/story/reel/etc.) */}
        <select value={formatFilter ?? "all"} onChange={(e) => setFormatFilter(e.target.value === "all" ? null : e.target.value)}
          className="px-2 py-2 bg-cream rounded-md text-[10px] font-display font-bold uppercase tracking-wider focus:outline-none"
          style={{ border: "1.5px solid var(--border)" }}>
          <option value="all">Todos formatos ({posts.length})</option>
          {Array.from(formatCounts.entries()).sort().map(([f, count]) => (
            <option key={f} value={f}>{f.toUpperCase()} ({count})</option>
          ))}
        </select>

        <div className="flex-1 min-w-0" />

        {/* Feedback inbox button (drawer) */}
        <FeedbackInbox
          posts={posts}
          stories={stories}
          currentUserEmail={currentUserEmail}
          onOpenPost={(postId) => {
            const p = posts.find((x) => x.id === postId)
            if (p) setDetailPost(p)
          }}
        />

        {/* Period nav */}
        {(view === "month" || view === "week") && (
          <PeriodNav view={view} anchorDate={anchorDate} setAnchorDate={setAnchorDate} />
        )}
      </div>

      {/* Render view */}
      {view === "trends" && (
        <TrendsView sources={trendSources} brief={trendBrief} subscriptions={trendSubs} />
      )}
      {view === "ideas" && (
        <SuggestionsView suggestions={suggestions} />
      )}
      {view === "stories" && (
        <StoriesView stories={stories} flash={flash} />
      )}
      {view === "review" && (
        <ReviewView posts={filtered} onEdit={openEdit} onView={openDetail} flash={flash} />
      )}
      {view === "month" && (
        <MonthView posts={filtered} anchorDate={anchorDate}
          onCreate={openCreate} onEdit={openEdit} onDrop={handleDrop} flash={flash} />
      )}
      {view === "week" && (
        <WeekView posts={filtered} anchorDate={anchorDate}
          onCreate={openCreate} onEdit={openEdit} onDrop={handleDrop} flash={flash} />
      )}
      {view === "list" && (
        <ListView posts={filtered} onEdit={openEdit} flash={flash} currentUserEmail={currentUserEmail} />
      )}

      {/* Editor (controlled) */}
      {editorOpen && (
        <PostEditor existing={editingPost} initialDate={editorInitialDate} open={true} onClose={() => setEditorOpen(false)} />
      )}

      {/* Detail modal (preview + feedback + schedule) */}
      {detailPost && (
        <PostDetailModal
          post={detailPost}
          currentUserEmail={currentUserEmail}
          onClose={() => setDetailPost(null)}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 z-[60] px-4 py-3 rounded-md flex items-center gap-2 text-[12px] font-medium animate-in fade-in slide-in-from-bottom-2"
          style={{ background: toast.kind === "ok" ? "#4D5431" : "#BB3B2E", color: "#fff", border: "2px solid #1A1A1A", boxShadow: "4px 4px 0 0 var(--shadow-color)", minWidth: 280, maxWidth: 480 }}>
          {toast.kind === "ok" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{toast.msg}</span>
        </div>
      )}
    </>
  )
}

function FilterChip({ label, active, color, onClick }: { label: string; active: boolean; color?: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className={`px-2.5 py-1.5 rounded-md text-[10px] font-display font-bold uppercase tracking-wider transition-all ${
        active ? "text-white" : "text-ink-3 hover:bg-cream-2"
      }`}
      style={active && color
        ? { background: color, border: `1.5px solid ${color}` }
        : active
          ? { background: "var(--ink)", color: "var(--cream)", border: "1.5px solid var(--ink)" }
          : { border: "1.5px solid var(--border)", background: "transparent" }}>
      {label}
    </button>
  )
}

function PeriodNav({ view, anchorDate, setAnchorDate }: {
  view: ViewMode
  anchorDate: Date
  setAnchorDate: (d: Date) => void
}) {
  function step(dir: -1 | 1) {
    const d = new Date(anchorDate)
    if (view === "month") d.setMonth(d.getMonth() + dir)
    else d.setDate(d.getDate() + dir * 7)
    d.setHours(0, 0, 0, 0)
    setAnchorDate(d)
  }
  function goToday() {
    const d = new Date(); d.setHours(0, 0, 0, 0); setAnchorDate(d)
  }
  const label = view === "month"
    ? anchorDate.toLocaleDateString("es-VE", { month: "long", year: "numeric" }).toUpperCase()
    : (() => {
        const monday = new Date(anchorDate)
        const dow = (monday.getDay() + 6) % 7
        monday.setDate(monday.getDate() - dow)
        const sunday = new Date(monday); sunday.setDate(sunday.getDate() + 6)
        return `${monday.getDate()}—${sunday.getDate()} ${sunday.toLocaleDateString("es-VE", { month: "short" })}`.toUpperCase()
      })()

  return (
    <div className="flex items-center gap-1">
      <button onClick={() => step(-1)} className="p-1.5 hover:bg-cream-2 rounded-md" style={{ border: "1.5px solid var(--border)" }}>
        <ChevronLeft size={12} strokeWidth={2.5} />
      </button>
      <button onClick={goToday} className="px-3 py-1.5 text-[10px] font-display font-bold uppercase tracking-wider bg-cream hover:bg-cream-2 rounded-md min-w-[160px] text-center"
        style={{ border: "1.5px solid var(--border)" }}>
        {label}
      </button>
      <button onClick={() => step(1)} className="p-1.5 hover:bg-cream-2 rounded-md" style={{ border: "1.5px solid var(--border)" }}>
        <ChevronRight size={12} strokeWidth={2.5} />
      </button>
    </div>
  )
}

// ─── STORIES VIEW (Instagram stories vertical 9:16) ─────────────────

const STORY_TYPE_META: Record<string, { label: string; color: string }> = {
  product: { label: "PRODUCT", color: "#E1306C" },
  quote:   { label: "QUOTE",   color: "#4D5431" },
  poll:    { label: "POLL",    color: "#FF3B27" },
  dyk:     { label: "DYK",     color: "#1DA1F2" },
  bts:     { label: "BTS",     color: "#9C9285" },
  combo:   { label: "COMBO",   color: "#FF6B27" },
  repost:  { label: "REPOST",  color: "#000000" },
  mood:    { label: "MOOD",    color: "#D4A015" },
}

function StoriesView({ stories, flash }: {
  stories: SocialStory[]
  flash: (k: "ok" | "err", m: string) => void
}) {
  // Group by date
  const byDate = new Map<string, SocialStory[]>()
  for (const s of stories) {
    const arr = byDate.get(s.date) ?? []
    arr.push(s)
    byDate.set(s.date, arr)
  }
  // Sort dates desc + sort stories within day by slot
  const sortedDates = Array.from(byDate.keys()).sort((a, b) => b.localeCompare(a))
  for (const arr of byDate.values()) {
    arr.sort((a, b) => a.slot - b.slot)
  }

  if (stories.length === 0) {
    return (
      <div className="stamp-card p-10 text-center">
        <ImageIcon size={48} className="text-ink-3 mx-auto mb-3" strokeWidth={1.5} />
        <p className="font-display font-bold text-[14px] uppercase tracking-wider text-ink-3">Sin stories programadas</p>
        <p className="text-[12px] text-ink-3 mt-1">Las stories se sincronizan desde el pipeline · 3 stories por día</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {sortedDates.map((date) => {
        const dayStories = byDate.get(date)!
        const d = new Date(date + "T00:00:00")
        const today = new Date(); today.setHours(0, 0, 0, 0)
        const isToday = d.getTime() === today.getTime()
        return (
          <div key={date} className="stamp-card overflow-hidden">
            <div className={`flex items-center justify-between px-5 py-3 ${isToday ? "bg-orange text-dark" : "bg-dark text-cream"}`}>
              <h3 className="font-display font-black text-[14px] uppercase tracking-wider">
                {d.toLocaleDateString("es-VE", { weekday: "long", day: "numeric", month: "short" })}
                {isToday && " · HOY"}
              </h3>
              <span className="text-[10px] font-mono opacity-80">{dayStories.length} stories</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 p-3">
              {dayStories.map((s) => <StoryCard key={s.id} story={s} />)}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function StoryCard({ story: s }: { story: SocialStory }) {
  const tm = STORY_TYPE_META[s.type] ?? { label: s.type.toUpperCase(), color: "#9C9285" }
  const sm = STATUS_META[s.status] ?? STATUS_META.draft
  const cover = resolveMediaUrl(s.media_url ?? null)
  const time = s.scheduled_at
    ? new Date(s.scheduled_at).toLocaleTimeString("es-VE", { hour: "2-digit", minute: "2-digit" })
    : null

  return (
    <Link href={`/social?focus=${s.id}`} className="block group">
      <div className="aspect-[9/16] bg-cream-2 relative overflow-hidden" style={{ border: `2px solid ${tm.color}` }}>
        {cover ? (
          <ImageWithFallback src={cover} alt={s.external_id} format={tm.label} />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-ink-3 gap-1.5">
            <ImageIcon size={20} strokeWidth={1.5} />
            <span className="text-[8px] font-mono uppercase tracking-widest">{tm.label}</span>
          </div>
        )}
        {/* Type badge */}
        <span className="absolute top-1 left-1 px-1.5 py-0.5 text-[8px] font-display font-black uppercase tracking-wider text-white rounded-md"
          style={{ background: tm.color }}>
          {tm.label}
        </span>
        {/* Slot indicator */}
        <span className="absolute top-1 right-1 px-1 py-0.5 text-[8px] font-mono bg-dark/80 text-cream rounded-md">
          {s.slot}/3
        </span>
        {/* Link sticker indicator */}
        {s.link_url && (
          <span className="absolute bottom-7 left-1 right-1 px-1 py-0.5 text-[8px] font-mono bg-orange/90 text-dark rounded-md text-center truncate">
            🔗 {s.link_url.replace(/^https?:\/\//, "").slice(0, 18)}
          </span>
        )}
        {/* Status + time bottom */}
        <div className="absolute bottom-1 left-1 right-1 flex items-center justify-between gap-1">
          <span className={`text-[8px] font-display font-bold uppercase tracking-wider px-1 py-0.5 rounded-md ${sm.bg} ${sm.cls}`}>
            {sm.label}
          </span>
          {time && (
            <span className="text-[8px] font-mono bg-dark/80 text-cream rounded-md px-1 py-0.5">
              {time}
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}

// ─── REVIEW VIEW (content review tipo Medusa/Notion gallery) ────────

function ReviewView({ posts, onEdit, onView, flash }: {
  posts: SocialPost[]
  onEdit: (p: SocialPost) => void
  onView: (p: SocialPost) => void
  flash: (k: "ok" | "err", m: string) => void
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function run(id: string, fn: () => Promise<{ ok: true } | { ok: false; error: string }>, okMsg: string) {
    startTransition(async () => {
      const res = await fn()
      if (!res.ok) return flash("err", res.error)
      flash("ok", okMsg)
      router.refresh()
    })
  }

  // Sort by status priority + date (review queue prioriza in_review/draft)
  const STATUS_PRIORITY: Record<string, number> = {
    in_review: 0,
    draft: 1,
    approved: 2,
    scheduled: 3,
    publishing: 4,
    published: 5,
    failed: 0,  // failed alto para visibilidad
    rejected: 6,
  }
  const sorted = posts.slice().sort((a, b) => {
    const aP = STATUS_PRIORITY[a.status] ?? 9
    const bP = STATUS_PRIORITY[b.status] ?? 9
    if (aP !== bP) return aP - bP
    const aT = a.date_planned ? new Date(a.date_planned).getTime() : new Date(a.created_at).getTime()
    const bT = b.date_planned ? new Date(b.date_planned).getTime() : new Date(b.created_at).getTime()
    return aT - bT
  })

  // Counts por status para quick header
  const inReviewCount = posts.filter((p) => p.status === "in_review" || p.status === "draft").length
  const failedCount = posts.filter((p) => p.status === "failed").length

  if (sorted.length === 0) {
    return (
      <div className="stamp-card p-10 text-center">
        <Sparkles size={48} className="text-ink-3 mx-auto mb-3" strokeWidth={1.5} />
        <p className="font-display font-bold text-[14px] uppercase tracking-wider text-ink-3">Sin posts en este filtro</p>
      </div>
    )
  }

  return (
    <>
      {(inReviewCount > 0 || failedCount > 0) && (
        <div className="stamp-card p-3 bg-orange/5 mb-3" style={{ borderColor: "#FF3B27" }}>
          <div className="flex items-center gap-2 text-[11px]">
            <Sparkles size={12} className="text-orange" strokeWidth={2.5} />
            {inReviewCount > 0 && (
              <span className="font-display font-bold uppercase tracking-wider text-orange">
                {inReviewCount} pendiente{inReviewCount === 1 ? "" : "s"} de review
              </span>
            )}
            {failedCount > 0 && (
              <span className="font-display font-bold uppercase tracking-wider text-primary">
                · {failedCount} fallaron
              </span>
            )}
            <span className="text-ink-3 font-mono ml-auto">apretá ✓ para aprobar · ✗ para rechazar</span>
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {sorted.map((p) => <ReviewCard key={p.id} post={p} onEdit={onEdit} onView={onView} run={run} pending={pending} />)}
      </div>
    </>
  )
}

function ReviewCard({ post: p, onEdit, onView, run, pending }: {
  post: SocialPost
  onEdit: (p: SocialPost) => void
  onView: (p: SocialPost) => void
  run: (id: string, fn: () => Promise<{ ok: true } | { ok: false; error: string }>, okMsg: string) => void
  pending: boolean
}) {
  const channel = p.channel ?? "instagram"
  const cm = CHANNEL_META[channel] ?? CHANNEL_META.instagram
  const sm = STATUS_META[p.status] ?? STATUS_META.draft

  const meta = (p as { metadata?: Record<string, unknown> }).metadata
  const hashtags = (meta?.hashtags as string[]) ?? []
  const metrics = (meta?.metrics as { reach?: number; likes?: number; comments?: number; saves?: number } | undefined) ?? p.metrics ?? null
  const comments = (meta?.comments as Array<unknown>) ?? []

  const planned = p.date_planned
    ? new Date(p.date_planned).toLocaleString("es-VE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
    : "sin fecha"

  const mediaUrls = p.media_urls ?? []
  const coverRaw = p.cover_url ?? mediaUrls[0] ?? null
  const cover = resolveMediaUrl(coverRaw)
  const extraMedia = mediaUrls.length > 1 ? mediaUrls.length - 1 : 0

  // Format detection: stories/reels son 9:16, posts feed son 1:1
  const format = (p.format ?? "post").toLowerCase()
  const isVertical = format === "story" || format === "reel" || format === "short"
  const formatLabel = format === "story" ? "STORY"
                    : format === "reel" ? "REEL"
                    : format === "short" ? "SHORT"
                    : format === "carousel" ? "CARROUSEL"
                    : "POST"

  const canApprove = p.status === "in_review" || p.status === "draft"
  const canReject = p.status === "in_review" || p.status === "draft" || p.status === "scheduled"
  const canPublish = p.status === "approved" || p.status === "scheduled"

  // Caption sin hashtags inline (los mostramos separados)
  const captionRaw = p.caption ?? ""
  const captionWithoutHashtags = captionRaw
    .split("\n\n")
    .filter((block) => !block.trim().startsWith("#") || block.includes(" "))
    .join("\n\n")
    .trim() || captionRaw

  return (
    <div className="stamp-card overflow-hidden flex flex-col" style={{ borderColor: cm.color, minHeight: 480 }}>
      {/* Channel + format + status header */}
      <div className="flex items-center justify-between p-2 text-cream gap-2" style={{ background: cm.color }}>
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="font-display font-black text-[11px] uppercase tracking-wider">{cm.label}</span>
          <span className="text-[8px] font-display font-bold uppercase tracking-wider px-1.5 py-0.5 bg-dark/30 rounded-md flex-shrink-0">
            {formatLabel}
          </span>
        </div>
        <span className={`text-[9px] font-display font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md ${sm.bg} ${sm.cls} flex-shrink-0`}>
          {sm.label}
        </span>
      </div>

      {/* Media — aspect ratio según format. Click abre detalle con player */}
      <button onClick={() => onView(p)}
        className={`${isVertical ? "aspect-[9/16]" : "aspect-square"} bg-cream-2 relative overflow-hidden flex-shrink-0 group block w-full hover:opacity-90 transition-opacity`}>
        {cover ? (
          <ImageWithFallback src={cover} alt={p.title} format={formatLabel} />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-ink-3 gap-2">
            <ImageIcon size={32} strokeWidth={1.5} />
            <span className="text-[10px] font-mono uppercase tracking-widest">{formatLabel} · sin media</span>
          </div>
        )}
        {/* Play overlay if video format */}
        {(formatLabel === "REEL" || formatLabel === "SHORT") && cover && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-12 h-12 rounded-full bg-dark/70 flex items-center justify-center group-hover:bg-orange transition-colors">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z" /></svg>
            </div>
          </div>
        )}
        {extraMedia > 0 && (
          <span className="absolute top-2 right-2 px-2 py-0.5 text-[10px] font-display font-bold uppercase tracking-wider bg-dark text-cream rounded-md"
            style={{ border: "1.5px solid #1A1A1A" }}>
            +{extraMedia} más
          </span>
        )}
        {/* Title overlay para identificar visualmente cuando no hay imagen */}
        {!cover && (
          <span className="absolute top-2 left-2 right-12 text-[10px] font-display font-bold uppercase tracking-wide text-ink-2 line-clamp-2 px-1.5 py-0.5 bg-page/90 rounded-md">
            {p.title}
          </span>
        )}
        {/* Time overlay */}
        <span className="absolute bottom-2 left-2 px-2 py-0.5 text-[9px] font-mono bg-dark/80 text-cream rounded-md backdrop-blur-sm">
          <Clock size={9} strokeWidth={2.5} className="inline mr-0.5" /> {planned}
        </span>
      </button>

      {/* Content */}
      <div className="flex-1 p-3 space-y-2 overflow-y-auto" style={{ maxHeight: 240 }}>
        <h4 className="font-display font-bold text-[13px] text-ink leading-tight line-clamp-2">{p.title}</h4>
        {captionWithoutHashtags && (
          <p className="text-[11px] text-ink-2 leading-relaxed whitespace-pre-wrap line-clamp-6 font-mono">
            {captionWithoutHashtags}
          </p>
        )}
        {hashtags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {hashtags.slice(0, 8).map((h) => (
              <span key={h} className="text-[10px] font-mono text-orange">#{h}</span>
            ))}
            {hashtags.length > 8 && (
              <span className="text-[10px] font-mono text-ink-3">+{hashtags.length - 8}</span>
            )}
          </div>
        )}

        {/* Metrics inline si están */}
        {metrics && (metrics.reach || metrics.likes || metrics.comments) && (
          <div className="flex items-center gap-2 pt-2 mt-auto text-[10px] font-mono text-ink-3" style={{ borderTop: "1px dashed var(--border-soft)" }}>
            <span><Eye size={9} className="inline mr-0.5" /> {fmtCount(metrics.reach ?? 0)}</span>
            <span><Heart size={9} className="inline mr-0.5 text-primary" /> {fmtCount(metrics.likes ?? 0)}</span>
            <span><MessageCircle size={9} className="inline mr-0.5" /> {fmtCount(metrics.comments ?? 0)}</span>
            <span><Bookmark size={9} className="inline mr-0.5 text-secondary" /> {fmtCount(metrics.saves ?? 0)}</span>
            {comments.length > 0 && (
              <span className="ml-auto text-orange">💬 {comments.length}</span>
            )}
          </div>
        )}
      </div>

      {/* Action bar */}
      <div className="p-2 bg-cream-2/40 border-t border-warm-200/50 flex items-center gap-1">
        <button onClick={() => onEdit(p)}
          className="flex items-center gap-1 px-2 py-1 bg-cream text-ink rounded-md text-[10px] font-display font-bold uppercase tracking-wider hover:bg-cream-2"
          style={{ border: "1.5px solid var(--border)" }} title="Editar">
          <Edit size={11} strokeWidth={2.5} /> Editar
        </button>
        <span className="flex-1" />
        {canApprove && (
          <button onClick={() => run(p.id, () => approvePostAction(p.id), "Post aprobado")} disabled={pending}
            className="flex items-center gap-1 px-2 py-1 bg-secondary text-cream rounded-md text-[10px] font-display font-bold uppercase tracking-wider disabled:opacity-50"
            style={{ border: "1.5px solid #1A1A1A" }} title="Aprobar (✓)">
            <ThumbsUp size={11} strokeWidth={2.5} /> ✓
          </button>
        )}
        {canReject && (
          <button onClick={() => run(p.id, () => rejectPostAction(p.id), "Post rechazado")} disabled={pending}
            className="flex items-center gap-1 px-2 py-1 bg-cream text-primary rounded-md text-[10px] font-display font-bold uppercase tracking-wider disabled:opacity-50 hover:bg-primary/5"
            style={{ border: "1.5px solid #BB3B2E" }} title="Rechazar (✗)">
            <ThumbsDown size={11} strokeWidth={2.5} /> ✗
          </button>
        )}
        {canPublish && (
          <button onClick={() => onView(p)} disabled={pending}
            className="flex items-center gap-1 px-2 py-1 bg-orange text-dark rounded-md text-[10px] font-display font-bold uppercase tracking-wider disabled:opacity-50"
            style={{ border: "1.5px solid #1A1A1A" }} title="Revisar y publicar / programar">
            <Send size={11} strokeWidth={2.5} /> →
          </button>
        )}
      </div>
    </div>
  )
}

function fmtCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

/** Img con fallback gracioso si la URL falla (CORS, 404, host caído).
 *  Muestra un placeholder con el formato + icon en vez del alt-text feo. */
function ImageWithFallback({ src, alt, format }: { src: string; alt: string; format: string }) {
  const [errored, setErrored] = useState(false)
  if (errored) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center text-ink-3 gap-2 bg-cream-2">
        <ImageIcon size={32} strokeWidth={1.5} />
        <span className="text-[10px] font-mono uppercase tracking-widest text-center px-2">
          {format} · imagen no carga
        </span>
        <span className="text-[8px] font-mono text-ink-3/60 truncate max-w-full px-2">{alt}</span>
      </div>
    )
  }
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={src}
      alt=""  /* sin alt para evitar que se muestre el texto feo */
      className="w-full h-full object-cover"
      onError={() => setErrored(true)}
      loading="lazy"
    />
  )
}

// ─── MONTH VIEW ──────────────────────────────────────────────────────

function MonthView({ posts, anchorDate, onCreate, onEdit, onDrop, flash }: {
  posts: SocialPost[]
  anchorDate: Date
  onCreate: (date?: string) => void
  onEdit: (p: SocialPost) => void
  onDrop: (postId: string, newDateLocalStr: string) => void
  flash: (k: "ok" | "err", m: string) => void
}) {
  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d }, [])

  // Build calendar cells: from Monday before/on the 1st of month, 6 weeks
  const cells = useMemo(() => {
    const first = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1)
    const dow = (first.getDay() + 6) % 7  // 0=Mon
    const start = new Date(first); start.setDate(first.getDate() - dow)
    const out: Date[] = []
    for (let i = 0; i < 42; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i)
      out.push(d)
    }
    return out
  }, [anchorDate])

  const postsByDay = useMemo(() => {
    const map: Record<string, SocialPost[]> = {}
    for (const p of posts) {
      if (!p.date_planned) continue
      const d = new Date(p.date_planned); d.setHours(0, 0, 0, 0)
      const key = d.toISOString()
      ;(map[key] ??= []).push(p)
    }
    return map
  }, [posts])

  return (
    <div className="stamp-card overflow-hidden">
      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 bg-dark text-cream text-[10px] font-display font-bold uppercase tracking-[0.18em]">
        {["LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB", "DOM"].map((d) => (
          <div key={d} className="px-2 py-2 text-center border-r border-cream/10 last:border-r-0">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7" style={{ borderTop: "1.5px solid var(--border)" }}>
        {cells.map((d, i) => {
          const inMonth = d.getMonth() === anchorDate.getMonth()
          const isToday = d.getTime() === today.getTime()
          const key = d.toISOString()
          const dayPosts = postsByDay[key] ?? []
          const hour = "10:00"  // default time when creating from cell click
          const dateLocalStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${hour}`
          const colIdx = i % 7
          const rowIdx = Math.floor(i / 7)
          return (
            <div key={i}
              className={`min-h-[110px] p-1.5 ${colIdx < 6 ? "border-r" : ""} ${rowIdx < 5 ? "border-b" : ""} border-warm-200/50 ${
                inMonth ? "" : "bg-cream-2/30"
              } ${isToday ? "bg-orange/5" : ""} relative group`}
              onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.background = "rgba(255,59,39,0.1)" }}
              onDragLeave={(e) => { e.currentTarget.style.background = isToday ? "rgba(255,59,39,0.05)" : "" }}
              onDrop={(e) => {
                e.preventDefault()
                e.currentTarget.style.background = isToday ? "rgba(255,59,39,0.05)" : ""
                const id = e.dataTransfer.getData("text/post-id")
                if (id) onDrop(id, dateLocalStr)
              }}
            >
              <div className="flex items-center justify-between mb-1">
                <span className={`text-[10px] font-display font-bold ${isToday ? "text-orange" : inMonth ? "text-ink" : "text-ink-3/60"}`}>
                  {d.getDate()}{isToday && " · HOY"}
                </span>
                <button onClick={() => onCreate(dateLocalStr)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-ink-3 hover:text-orange font-bold leading-none">
                  +
                </button>
              </div>
              <div className="space-y-0.5">
                {dayPosts.slice(0, 3).map((p) => (
                  <CalendarChip key={p.id} post={p} onClick={() => onEdit(p)} />
                ))}
                {dayPosts.length > 3 && (
                  <div className="text-[9px] text-ink-3 font-mono text-center">+ {dayPosts.length - 3} más</div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── WEEK VIEW ──────────────────────────────────────────────────────

function WeekView({ posts, anchorDate, onCreate, onEdit, onDrop, flash }: {
  posts: SocialPost[]
  anchorDate: Date
  onCreate: (date?: string) => void
  onEdit: (p: SocialPost) => void
  onDrop: (postId: string, newDateLocalStr: string) => void
  flash: (k: "ok" | "err", m: string) => void
}) {
  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d }, [])

  const days = useMemo(() => {
    const monday = new Date(anchorDate)
    const dow = (monday.getDay() + 6) % 7
    monday.setDate(monday.getDate() - dow); monday.setHours(0, 0, 0, 0)
    const out: Date[] = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday); d.setDate(monday.getDate() + i); out.push(d)
    }
    return out
  }, [anchorDate])

  const postsByDay = useMemo(() => {
    const map: Record<string, SocialPost[]> = {}
    for (const p of posts) {
      if (!p.date_planned) continue
      const d = new Date(p.date_planned); d.setHours(0, 0, 0, 0)
      const key = d.toISOString()
      ;(map[key] ??= []).push(p)
    }
    return map
  }, [posts])

  return (
    <div className="stamp-card overflow-hidden">
      <div className="grid grid-cols-7 bg-dark text-cream text-[10px]">
        {days.map((d, i) => {
          const isToday = d.getTime() === today.getTime()
          return (
            <div key={i} className="p-2.5 text-center border-r border-cream/10 last:border-r-0">
              <div className={`font-display font-bold uppercase tracking-widest ${isToday ? "text-orange" : ""}`}>
                {["LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB", "DOM"][i]}
              </div>
              <div className={`font-display font-black text-[18px] num ${isToday ? "text-orange" : ""}`}>{d.getDate()}</div>
            </div>
          )
        })}
      </div>
      <div className="grid grid-cols-7 min-h-[400px]" style={{ borderTop: "1.5px solid var(--border)" }}>
        {days.map((d, i) => {
          const isToday = d.getTime() === today.getTime()
          const key = d.toISOString()
          const dayPosts = postsByDay[key] ?? []
          const dateLocalStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T10:00`
          return (
            <div key={i}
              className={`p-2 space-y-1.5 ${i < 6 ? "border-r border-warm-200/50" : ""} ${isToday ? "bg-orange/5" : ""} group relative`}
              onDragOver={(e) => { e.preventDefault() }}
              onDrop={(e) => {
                e.preventDefault()
                const id = e.dataTransfer.getData("text/post-id")
                if (id) onDrop(id, dateLocalStr)
              }}
            >
              <button onClick={() => onCreate(dateLocalStr)}
                className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 text-[12px] text-ink-3 hover:text-orange font-bold leading-none">+</button>
              {dayPosts.length === 0 && (
                <div className="text-center text-[9px] text-ink-3 mt-4 font-mono uppercase">· vacío ·</div>
              )}
              {dayPosts.map((p) => <FullCalendarCard key={p.id} post={p} onClick={() => onEdit(p)} />)}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── LIST VIEW ──────────────────────────────────────────────────────

function ListView({ posts, onEdit, flash, currentUserEmail }: {
  posts: SocialPost[]
  onEdit: (p: SocialPost) => void
  flash: (k: "ok" | "err", m: string) => void
  currentUserEmail: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [expanded, setExpanded] = useState<string | null>(null)

  function run(id: string, fn: () => Promise<{ ok: true } | { ok: false; error: string }>, okMsg: string) {
    startTransition(async () => {
      const res = await fn()
      if (!res.ok) return flash("err", res.error)
      flash("ok", okMsg)
      router.refresh()
    })
  }

  if (posts.length === 0) {
    return (
      <div className="stamp-card p-10 text-center">
        <p className="font-display font-bold text-[14px] uppercase tracking-wider text-ink-3">
          Sin posts en este filtro
        </p>
      </div>
    )
  }

  // Sorted: most recent date_planned first, then by created_at
  const sorted = [...posts].sort((a, b) => {
    const aT = a.date_planned ? new Date(a.date_planned).getTime() : new Date(a.created_at).getTime()
    const bT = b.date_planned ? new Date(b.date_planned).getTime() : new Date(b.created_at).getTime()
    return bT - aT
  })

  return (
    <div className="stamp-card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 bg-dark text-cream">
        <h3 className="font-display font-black text-[14px] uppercase tracking-wider">Lista de posts</h3>
        <span className="text-[10px] font-mono text-cream/60">{sorted.length} resultado(s)</span>
      </div>
      <ul className="divide-y divide-warm-200/50">
        {sorted.map((p) => {
          const channel = p.channel ?? "instagram"
          const cm = CHANNEL_META[channel] ?? CHANNEL_META.instagram
          const sm = STATUS_META[p.status] ?? STATUS_META.draft
          const planned = p.date_planned
            ? new Date(p.date_planned).toLocaleString("es-VE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
            : "—"
          const meta = (p as { metadata?: Record<string, unknown> }).metadata
          const metrics = (meta?.metrics as { reach?: number; likes?: number; comments?: number; saves?: number; shares?: number } | undefined) ?? p.metrics ?? undefined
          const comments = (meta?.comments as Array<{ id: string; text: string; author: string; at: string }>) ?? []
          const isExpanded = expanded === p.id
          return (
            <li key={p.id} className="p-3 hover:bg-cream-2/40 transition-colors">
              <div className="flex items-center gap-3">
                {/* Channel badge */}
                <span className="px-2 py-1 text-[10px] font-display font-bold uppercase tracking-wider rounded-md text-white flex-shrink-0"
                  style={{ background: cm.color }}>{cm.label}</span>
                {/* Cover */}
                {p.cover_url || (p.media_urls?.[0]) ? (
                  <div className="w-12 h-12 bg-cream-2 overflow-hidden flex-shrink-0" style={{ border: "1.5px solid var(--border)" }}>
                    <ImageWithFallback src={resolveMediaUrl((p.cover_url ?? p.media_urls![0]) as string)!} alt={p.title} format={(p.format ?? "post").toUpperCase()} />
                  </div>
                ) : (
                  <div className="w-12 h-12 bg-cream-2 flex-shrink-0" style={{ border: "1.5px dashed var(--border)" }} />
                )}
                {/* Title + caption */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="font-display font-bold text-[13px] text-ink truncate">{p.title}</span>
                    <span className={`text-[9px] font-display font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md ${sm.bg} ${sm.cls} flex-shrink-0`}>{sm.label}</span>
                  </div>
                  {p.caption && (
                    <p className="text-[11px] text-ink-3 truncate mt-0.5">{p.caption.slice(0, 120)}{p.caption.length > 120 && "…"}</p>
                  )}
                  <div className="flex items-center gap-3 mt-1 text-[10px] font-mono text-ink-3">
                    <span><Clock size={9} className="inline mr-0.5" /> {planned}</span>
                    {metrics && (metrics.reach || metrics.likes) && (
                      <>
                        <span><Eye size={9} className="inline mr-0.5" /> {metrics.reach ?? 0}</span>
                        <span><Heart size={9} className="inline mr-0.5" /> {metrics.likes ?? 0}</span>
                        <span><MessageCircle size={9} className="inline mr-0.5" /> {metrics.comments ?? 0}</span>
                        <span><Bookmark size={9} className="inline mr-0.5" /> {metrics.saves ?? 0}</span>
                      </>
                    )}
                    {comments.length > 0 && <span>· {comments.length} coment.</span>}
                  </div>
                </div>
                {/* Quick actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <IconBtn title="Editar" onClick={() => onEdit(p)}><Edit size={12} strokeWidth={2.5} /></IconBtn>
                  {(p.status === "in_review" || p.status === "draft") && (
                    <IconBtn title="Aprobar" tone="secondary" disabled={pending}
                      onClick={() => run(p.id, () => approvePostAction(p.id), "Aprobado")}>
                      <ThumbsUp size={12} strokeWidth={2.5} />
                    </IconBtn>
                  )}
                  {(p.status === "in_review" || p.status === "scheduled" || p.status === "draft") && (
                    <IconBtn title="Rechazar" tone="primary" disabled={pending}
                      onClick={() => run(p.id, () => rejectPostAction(p.id), "Rechazado")}>
                      <ThumbsDown size={12} strokeWidth={2.5} />
                    </IconBtn>
                  )}
                  {(p.status === "approved" || p.status === "scheduled") && (
                    <IconBtn title="Publicar ya" tone="secondary" disabled={pending}
                      onClick={() => run(p.id, () => publishPostAction(p.id), "Publicado")}>
                      <Send size={12} strokeWidth={2.5} />
                    </IconBtn>
                  )}
                  <IconBtn title={isExpanded ? "Cerrar" : "Detalles"} onClick={() => setExpanded(isExpanded ? null : p.id)}>
                    <MoreVertical size={12} strokeWidth={2.5} />
                  </IconBtn>
                  <IconBtn title="Eliminar" tone="primary" disabled={pending}
                    onClick={() => {
                      if (!window.confirm(`¿Eliminar "${p.title}"?`)) return
                      run(p.id, () => deletePostAction(p.id), "Eliminado")
                    }}>
                    <Trash2 size={12} strokeWidth={2.5} />
                  </IconBtn>
                </div>
              </div>
              {isExpanded && (
                <div className="mt-3 pt-3 grid grid-cols-2 gap-4" style={{ borderTop: "1.5px dashed var(--border)" }}>
                  <div>
                    <h4 className="text-[10px] font-display font-bold uppercase tracking-wider text-ink-3 mb-2">MÉTRICAS</h4>
                    <PostAnalytics postId={p.id} metrics={metrics} editable={p.status === "published" || p.status === "scheduled"} />
                  </div>
                  <div>
                    <h4 className="text-[10px] font-display font-bold uppercase tracking-wider text-ink-3 mb-2">APROBACIÓN</h4>
                    <ApprovalThread postId={p.id} currentUserEmail={currentUserEmail} comments={comments} metadata={meta} />
                  </div>
                  {p.caption && (
                    <div className="col-span-2">
                      <h4 className="text-[10px] font-display font-bold uppercase tracking-wider text-ink-3 mb-1">CAPTION COMPLETO</h4>
                      <p className="text-[12px] text-ink-2 whitespace-pre-wrap p-2 bg-cream-2/40 rounded-md font-mono" style={{ border: "1px solid var(--border-soft)" }}>
                        {p.caption}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────

function CalendarChip({ post, onClick }: { post: SocialPost; onClick: () => void }) {
  const cm = CHANNEL_META[post.channel ?? "instagram"] ?? CHANNEL_META.instagram
  const sm = STATUS_META[post.status] ?? STATUS_META.draft
  const time = post.date_planned
    ? new Date(post.date_planned).toLocaleTimeString("es-VE", { hour: "2-digit", minute: "2-digit", hour12: false })
    : ""
  return (
    <div
      draggable
      onDragStart={(e) => e.dataTransfer.setData("text/post-id", post.id)}
      onClick={onClick}
      title={`${cm.label} · ${time} · ${post.title}`}
      className={`px-1.5 py-0.5 ${sm.bg} ${sm.cls} text-[9px] font-display font-bold uppercase truncate cursor-grab active:cursor-grabbing hover:opacity-80`}
      style={{ borderLeft: `3px solid ${cm.color}` }}
    >
      {time && <span className="font-mono mr-1">{time}</span>}
      {post.title}
    </div>
  )
}

function FullCalendarCard({ post, onClick }: { post: SocialPost; onClick: () => void }) {
  const cm = CHANNEL_META[post.channel ?? "instagram"] ?? CHANNEL_META.instagram
  const sm = STATUS_META[post.status] ?? STATUS_META.draft
  const time = post.date_planned
    ? new Date(post.date_planned).toLocaleTimeString("es-VE", { hour: "2-digit", minute: "2-digit", hour12: false })
    : "—"
  return (
    <div
      draggable
      onDragStart={(e) => e.dataTransfer.setData("text/post-id", post.id)}
      onClick={onClick}
      className={`p-2 ${sm.bg} cursor-grab active:cursor-grabbing hover:opacity-90 transition-opacity`}
      style={{ border: "1.5px solid var(--border)", borderLeftWidth: 4, borderLeftColor: cm.color }}
    >
      <div className={`text-[8px] font-display font-bold uppercase tracking-wider ${sm.cls}`}>
        {time} · {cm.label} · {sm.label}
      </div>
      <div className="text-[10px] font-medium text-ink truncate mt-0.5">{post.title}</div>
      {(post.cover_url || post.media_urls?.[0]) && (
        <div className="mt-1 w-full h-12 bg-cream-2 overflow-hidden">
          <ImageWithFallback src={resolveMediaUrl((post.cover_url ?? post.media_urls![0]) as string)!} alt={post.title} format={(post.format ?? "post").toUpperCase()} />
        </div>
      )}
    </div>
  )
}

function IconBtn({ children, onClick, title, tone, disabled }: {
  children: React.ReactNode
  onClick: () => void
  title: string
  tone?: "primary" | "secondary"
  disabled?: boolean
}) {
  const cls = tone === "primary" ? "hover:bg-primary/10 text-primary"
            : tone === "secondary" ? "hover:bg-secondary/10 text-secondary"
            : "hover:bg-cream-2 text-ink-3"
  return (
    <button type="button" onClick={onClick} title={title} disabled={disabled}
      className={`p-1.5 rounded-md transition-colors disabled:opacity-50 ${cls}`}
      style={{ border: "1.5px solid var(--border-soft)" }}>
      {children}
    </button>
  )
}
