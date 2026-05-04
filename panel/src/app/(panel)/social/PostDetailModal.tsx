"use client"

import { useState, useEffect, useRef, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  X, Play, Pause, Clock, Send, ThumbsUp, ThumbsDown, MessageSquare,
  Calendar, AlertCircle, CheckCircle2, Trash2, ChevronLeft, ChevronRight,
  Loader2, Activity as ActivityIcon, ImageIcon,
} from "lucide-react"
import { resolveMediaUrl } from "@/lib/media"
import { fmtRelative } from "@/lib/utils"
import {
  approvePostAction, rejectPostAction,
  publishPostAction, schedulePostAction, cancelSchedulePostAction,
  createFeedbackAction, resolveFeedbackAction, deleteFeedbackAction,
} from "./actions"
import type { SocialPost, SocialFeedback } from "@/lib/medusa"

type Toast = { kind: "ok" | "err"; msg: string } | null

interface Props {
  post: SocialPost | null
  currentUserEmail: string
  onClose: () => void
}

export function PostDetailModal({ post, currentUserEmail, onClose }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [toast, setToast] = useState<Toast>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  // Carousel state for media navigation
  const [mediaIdx, setMediaIdx] = useState(0)
  // Video playback state
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTimeMs, setCurrentTimeMs] = useState(0)

  // Feedback state
  const [feedback, setFeedback] = useState<SocialFeedback[]>([])
  const [feedbackLoading, setFeedbackLoading] = useState(false)
  const [newComment, setNewComment] = useState("")
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyText, setReplyText] = useState("")
  const [anchorTimestamp, setAnchorTimestamp] = useState<number | null>(null)

  // Schedule state
  const [showSchedule, setShowSchedule] = useState(false)
  const [scheduleAt, setScheduleAt] = useState("")

  // Reset state when post changes
  useEffect(() => {
    setMediaIdx(0)
    setCurrentTimeMs(0)
    setIsPlaying(false)
    setNewComment("")
    setReplyingTo(null)
    setReplyText("")
    setShowSchedule(false)
    setAnchorTimestamp(null)
    if (post?.date_planned) {
      const d = new Date(post.date_planned)
      const off = d.getTimezoneOffset()
      const local = new Date(d.getTime() - off * 60_000)
      setScheduleAt(local.toISOString().slice(0, 16))
    } else {
      // Default: 1h en el futuro
      const d = new Date(Date.now() + 60 * 60_000)
      const off = d.getTimezoneOffset()
      const local = new Date(d.getTime() - off * 60_000)
      setScheduleAt(local.toISOString().slice(0, 16))
    }
  }, [post?.id])

  // Load feedback when post opens
  useEffect(() => {
    if (!post) { setFeedback([]); return }
    setFeedbackLoading(true)
    fetch(`/api/social/feedback?entity_type=post&entity_id=${post.id}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { ok?: boolean; feedback?: SocialFeedback[] }) => {
        if (d.feedback) setFeedback(d.feedback)
      })
      .finally(() => setFeedbackLoading(false))
  }, [post?.id])

  function flash(k: "ok" | "err", m: string) {
    setToast({ kind: k, msg: m })
    setTimeout(() => setToast(null), 4000)
  }

  if (!post) return null

  // ─── Media handling ──
  const allMedia: string[] = []
  if (post.cover_url) allMedia.push(post.cover_url)
  for (const u of post.media_urls ?? []) {
    if (!allMedia.includes(u)) allMedia.push(u)
  }

  const currentMedia = allMedia[mediaIdx] ?? null
  const currentMediaResolved = resolveMediaUrl(currentMedia)
  const isVideo = currentMedia?.match(/\.(mp4|mov|webm|m4v)$/i) != null

  function nextMedia() { setMediaIdx((i) => Math.min(allMedia.length - 1, i + 1)) }
  function prevMedia() { setMediaIdx((i) => Math.max(0, i - 1)) }

  // Video controls
  function togglePlay() {
    if (!videoRef.current) return
    if (videoRef.current.paused) {
      videoRef.current.play()
      setIsPlaying(true)
    } else {
      videoRef.current.pause()
      setIsPlaying(false)
    }
  }

  function handleTimeUpdate() {
    if (!videoRef.current) return
    setCurrentTimeMs(Math.floor(videoRef.current.currentTime * 1000))
  }

  function captureTimestamp() {
    setAnchorTimestamp(currentTimeMs)
  }

  function fmtMs(ms: number): string {
    const totalSec = Math.floor(ms / 1000)
    const m = Math.floor(totalSec / 60)
    const s = totalSec % 60
    return `${m}:${String(s).padStart(2, "0")}`
  }

  // ─── Status / action helpers ──
  const isApproved = post.status === "approved"
  const isScheduled = post.status === "scheduled" || !!post.scheduled_at
  const isDraftOrReview = post.status === "draft" || post.status === "in_review"
  const isPublished = post.status === "published"

  function refreshFeedback() {
    fetch(`/api/social/feedback?entity_type=post&entity_id=${post!.id}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { feedback?: SocialFeedback[] }) => {
        if (d.feedback) setFeedback(d.feedback)
      })
  }

  function submitComment() {
    if (!newComment.trim()) return
    startTransition(async () => {
      const res = await createFeedbackAction({
        entity_type: "post",
        entity_id: post!.id,
        text: newComment,
        timestamp_ms: anchorTimestamp ?? undefined,
      })
      if (!res.ok) return flash("err", res.error)
      flash("ok", "Comentario añadido")
      setNewComment("")
      setAnchorTimestamp(null)
      refreshFeedback()
      router.refresh()
    })
  }

  function submitReply(parentId: string) {
    if (!replyText.trim()) return
    startTransition(async () => {
      const res = await createFeedbackAction({
        entity_type: "post",
        entity_id: post!.id,
        text: replyText,
        parent_id: parentId,
      })
      if (!res.ok) return flash("err", res.error)
      flash("ok", "Respuesta enviada")
      setReplyText("")
      setReplyingTo(null)
      refreshFeedback()
      router.refresh()
    })
  }

  function toggleResolve(fb: SocialFeedback) {
    startTransition(async () => {
      const res = await resolveFeedbackAction(fb.id, !fb.resolved)
      if (!res.ok) return flash("err", res.error)
      refreshFeedback()
      router.refresh()
    })
  }

  function deleteFb(id: string) {
    if (!window.confirm("¿Eliminar este comentario?")) return
    startTransition(async () => {
      const res = await deleteFeedbackAction(id)
      if (!res.ok) return flash("err", res.error)
      refreshFeedback()
      router.refresh()
    })
  }

  function approve() {
    startTransition(async () => {
      const res = await approvePostAction(post!.id)
      if (!res.ok) return flash("err", res.error)
      flash("ok", "Post aprobado · listo para programar")
      router.refresh()
    })
  }

  function reject() {
    startTransition(async () => {
      const res = await rejectPostAction(post!.id)
      if (!res.ok) return flash("err", res.error)
      flash("ok", "Post rechazado")
      router.refresh()
    })
  }

  function publishNow() {
    if (!window.confirm("¿Publicar ahora? El post saldrá inmediatamente via Buffer.")) return
    startTransition(async () => {
      const res = await publishPostAction(post!.id)
      if (!res.ok) return flash("err", res.error)
      flash("ok", "Enviado a Buffer · publicará en breve")
      router.refresh()
    })
  }

  function schedule() {
    if (!scheduleAt) return flash("err", "Selecciona fecha y hora")
    const iso = new Date(scheduleAt).toISOString()
    startTransition(async () => {
      const res = await schedulePostAction(post!.id, iso)
      if (!res.ok) return flash("err", res.error)
      flash("ok", `Programado para ${new Date(iso).toLocaleString("es-VE")}`)
      setShowSchedule(false)
      router.refresh()
    })
  }

  function cancelSchedule() {
    if (!window.confirm("¿Cancelar el envío programado?")) return
    startTransition(async () => {
      const res = await cancelSchedulePostAction(post!.id)
      if (!res.ok) return flash("err", res.error)
      flash("ok", "Programación cancelada")
      router.refresh()
    })
  }

  // Build feedback tree (top-level only, with replies nested)
  const topLevel = feedback.filter((f) => !f.parent_id)
  const repliesByParent = new Map<string, SocialFeedback[]>()
  for (const f of feedback) {
    if (f.parent_id) {
      const arr = repliesByParent.get(f.parent_id) ?? []
      arr.push(f)
      repliesByParent.set(f.parent_id, arr)
    }
  }

  const formatLabel = (post.format ?? "POST").toUpperCase()
  const isVerticalFormat = formatLabel === "STORY" || formatLabel === "REEL" || formatLabel === "SHORT"

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }} onClick={() => !pending && onClose()}>
      <div className="bg-page rounded-md w-full max-w-6xl max-h-[92vh] overflow-hidden flex flex-col"
        style={{ border: "2.5px solid var(--border)", boxShadow: "5px 5px 0 0 var(--shadow-color)" }}
        onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 bg-dark text-cream gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-display font-black text-[14px] uppercase tracking-wider truncate">
              {post.number} · {post.title}
            </span>
            <StatusBadge status={post.status} />
            <span className="text-[10px] font-display font-bold uppercase tracking-wider px-1.5 py-0.5 bg-cream/10 rounded-md">
              {formatLabel}
            </span>
          </div>
          <button onClick={onClose} className="text-cream/70 hover:text-cream p-1">
            <X size={16} strokeWidth={2.5} />
          </button>
        </div>

        {/* Body: 2 cols — media on left, panel on right */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 overflow-hidden">

          {/* LEFT — Media player */}
          <div className="bg-dark flex flex-col">
            <div className={`flex-1 flex items-center justify-center relative ${isVerticalFormat ? "py-3" : ""}`}
              style={{ minHeight: 360 }}>
              {currentMediaResolved ? (
                isVideo ? (
                  <div className={`relative ${isVerticalFormat ? "h-full" : "w-full"} flex items-center justify-center`}>
                    <video
                      ref={videoRef}
                      src={currentMediaResolved}
                      onPlay={() => setIsPlaying(true)}
                      onPause={() => setIsPlaying(false)}
                      onTimeUpdate={handleTimeUpdate}
                      onEnded={() => setIsPlaying(false)}
                      className={`max-w-full max-h-[480px] ${isVerticalFormat ? "h-full" : ""}`}
                      style={isVerticalFormat ? { aspectRatio: "9/16" } : undefined}
                      controls
                      playsInline
                    />
                  </div>
                ) : (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={currentMediaResolved}
                    alt={post.title}
                    className={`max-w-full max-h-[480px] object-contain ${isVerticalFormat ? "h-full" : ""}`}
                    style={isVerticalFormat ? { aspectRatio: "9/16" } : undefined}
                  />
                )
              ) : (
                <div className="text-cream/60 flex flex-col items-center gap-2">
                  <ImageIcon size={48} strokeWidth={1.5} />
                  <span className="text-[11px] font-mono uppercase tracking-widest">Sin media</span>
                </div>
              )}

              {/* Carousel arrows */}
              {allMedia.length > 1 && (
                <>
                  <button onClick={prevMedia} disabled={mediaIdx === 0}
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-dark/80 hover:bg-dark text-cream rounded-full flex items-center justify-center disabled:opacity-30 backdrop-blur-sm">
                    <ChevronLeft size={16} strokeWidth={2.5} />
                  </button>
                  <button onClick={nextMedia} disabled={mediaIdx === allMedia.length - 1}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-dark/80 hover:bg-dark text-cream rounded-full flex items-center justify-center disabled:opacity-30 backdrop-blur-sm">
                    <ChevronRight size={16} strokeWidth={2.5} />
                  </button>
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-2 py-0.5 text-[10px] font-mono bg-dark/80 text-cream rounded-md backdrop-blur-sm">
                    {mediaIdx + 1} / {allMedia.length}
                  </div>
                </>
              )}
            </div>

            {/* Media thumbnails */}
            {allMedia.length > 1 && (
              <div className="px-3 py-2 bg-dark border-t border-cream/10 flex items-center gap-1 overflow-x-auto">
                {allMedia.map((url, i) => {
                  const resolved = resolveMediaUrl(url)
                  const itemIsVideo = url.match(/\.(mp4|mov|webm|m4v)$/i) != null
                  return (
                    <button key={i} onClick={() => setMediaIdx(i)}
                      className={`w-12 h-12 flex-shrink-0 bg-cream-2 overflow-hidden relative ${
                        i === mediaIdx ? "ring-2 ring-orange" : "opacity-60 hover:opacity-100"
                      }`}>
                      {resolved && !itemIsVideo && (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={resolved} alt="" className="w-full h-full object-cover" />
                      )}
                      {itemIsVideo && (
                        <div className="w-full h-full flex items-center justify-center text-cream bg-dark">
                          <Play size={14} fill="currentColor" />
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            )}

            {/* Video timestamp + add note button */}
            {isVideo && (
              <div className="px-3 py-2 bg-dark border-t border-cream/10 flex items-center gap-2 text-[10px] font-mono text-cream/70">
                <Clock size={11} strokeWidth={2.5} />
                <span>Tiempo: {fmtMs(currentTimeMs)}</span>
                <span className="flex-1" />
                <button onClick={captureTimestamp}
                  className="px-2 py-1 bg-orange text-dark rounded-md font-display font-bold uppercase tracking-wider text-[9px] hover:opacity-90"
                  style={{ border: "1.5px solid #1A1A1A" }}>
                  Anotar en {fmtMs(currentTimeMs)}
                </button>
              </div>
            )}
          </div>

          {/* RIGHT — Caption + Feedback + Actions */}
          <div className="flex flex-col bg-page overflow-hidden">

            {/* Caption */}
            <div className="px-5 py-3 border-b border-warm-200/50 max-h-32 overflow-y-auto">
              <h4 className="text-[10px] font-display font-bold uppercase tracking-wider text-ink-3 mb-1">CAPTION</h4>
              <p className="text-[12px] text-ink whitespace-pre-wrap font-mono leading-relaxed">
                {post.caption || <span className="text-ink-3 italic">Sin caption</span>}
              </p>
              {post.pillar && (
                <div className="text-[10px] font-mono text-orange mt-2">{post.pillar}</div>
              )}
            </div>

            {/* Feedback thread */}
            <div className="flex-1 overflow-y-auto px-5 py-3">
              <h4 className="text-[10px] font-display font-bold uppercase tracking-wider text-ink-3 mb-2 flex items-center gap-1.5">
                <MessageSquare size={11} strokeWidth={2.5} />
                Feedback ({feedback.length})
                {feedbackLoading && <Loader2 size={10} className="animate-spin" />}
              </h4>

              {feedback.length === 0 && !feedbackLoading && (
                <p className="text-[11px] text-ink-3 italic mb-2">Sin comentarios todavía. Sé el primero.</p>
              )}

              <ul className="space-y-2">
                {topLevel.map((fb) => (
                  <FeedbackItem
                    key={fb.id}
                    fb={fb}
                    replies={repliesByParent.get(fb.id) ?? []}
                    currentUserEmail={currentUserEmail}
                    replyingTo={replyingTo}
                    replyText={replyText}
                    setReplyingTo={setReplyingTo}
                    setReplyText={setReplyText}
                    submitReply={submitReply}
                    toggleResolve={toggleResolve}
                    deleteFb={deleteFb}
                    pending={pending}
                    onSeekVideo={(ms) => {
                      if (videoRef.current) {
                        videoRef.current.currentTime = ms / 1000
                        setCurrentTimeMs(ms)
                      }
                    }}
                  />
                ))}
              </ul>
            </div>

            {/* New comment box */}
            <div className="px-5 py-3 border-t border-warm-200/50 bg-cream-2/30">
              {anchorTimestamp != null && (
                <div className="flex items-center gap-1.5 mb-1.5 text-[10px] font-mono text-orange">
                  <Clock size={10} strokeWidth={2.5} />
                  <span>Anclado a {fmtMs(anchorTimestamp)}</span>
                  <button onClick={() => setAnchorTimestamp(null)} className="ml-1 text-ink-3 hover:text-ink">
                    <X size={10} strokeWidth={2.5} />
                  </button>
                </div>
              )}
              <div className="flex items-end gap-2">
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  rows={2}
                  placeholder="Comentario o feedback…"
                  className="flex-1 px-2 py-1.5 bg-cream rounded-md text-[12px] focus:outline-none resize-none"
                  style={{ border: "1.5px solid var(--border)" }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault()
                      submitComment()
                    }
                  }}
                />
                <button onClick={submitComment} disabled={pending || !newComment.trim()}
                  className="px-3 py-2 bg-orange text-dark rounded-md text-[10px] font-display font-bold uppercase tracking-wider disabled:opacity-50 flex items-center gap-1"
                  style={{ border: "1.5px solid #1A1A1A" }}
                  title="⌘+Enter">
                  <Send size={11} strokeWidth={2.5} /> {pending ? "…" : "Enviar"}
                </button>
              </div>
            </div>

            {/* Actions footer */}
            <div className="px-5 py-3 border-t-2 border-warm-200 bg-cream-2/50">
              {showSchedule ? (
                <div className="space-y-2">
                  <label className="text-[10px] font-display font-bold uppercase tracking-wider text-ink-3 flex items-center gap-1">
                    <Calendar size={10} strokeWidth={2.5} /> Programar para
                  </label>
                  <div className="flex items-center gap-2">
                    <input type="datetime-local" value={scheduleAt} onChange={(e) => setScheduleAt(e.target.value)}
                      className="flex-1 px-3 py-2 bg-cream rounded-md text-[12px] font-mono focus:outline-none"
                      style={{ border: "1.5px solid var(--border)" }} />
                    <button onClick={schedule} disabled={pending || !scheduleAt}
                      className="px-3 py-2 bg-orange text-dark rounded-md text-[10px] font-display font-bold uppercase tracking-wider disabled:opacity-50 flex items-center gap-1"
                      style={{ border: "1.5px solid #1A1A1A" }}>
                      <Calendar size={11} strokeWidth={2.5} /> Programar
                    </button>
                    <button onClick={() => setShowSchedule(false)} disabled={pending}
                      className="px-2 py-2 text-ink-3 hover:text-ink">
                      <X size={14} strokeWidth={2.5} />
                    </button>
                  </div>
                  <p className="text-[10px] text-ink-3 font-mono">
                    Buffer manejará el envío real a IG/TT. Podés cancelar después si querés.
                  </p>
                </div>
              ) : (
                <div className="flex items-center gap-2 flex-wrap">
                  {isDraftOrReview && (
                    <>
                      <button onClick={approve} disabled={pending}
                        className="flex items-center gap-1.5 px-3 py-2 bg-secondary text-cream rounded-md text-[11px] font-display font-bold uppercase tracking-wider disabled:opacity-50"
                        style={{ border: "1.5px solid #1A1A1A" }}>
                        <ThumbsUp size={11} strokeWidth={2.5} /> Aprobar
                      </button>
                      <button onClick={reject} disabled={pending}
                        className="flex items-center gap-1.5 px-3 py-2 bg-cream text-primary rounded-md text-[11px] font-display font-bold uppercase tracking-wider disabled:opacity-50 hover:bg-primary/5"
                        style={{ border: "1.5px solid #BB3B2E" }}>
                        <ThumbsDown size={11} strokeWidth={2.5} /> Rechazar
                      </button>
                    </>
                  )}
                  {isApproved && (
                    <>
                      <button onClick={() => setShowSchedule(true)} disabled={pending}
                        className="flex items-center gap-1.5 px-3 py-2 bg-cream rounded-md text-[11px] font-display font-bold uppercase tracking-wider hover:bg-cream-2 disabled:opacity-50"
                        style={{ border: "1.5px solid var(--border)" }}>
                        <Calendar size={11} strokeWidth={2.5} /> Programar
                      </button>
                      <button onClick={publishNow} disabled={pending}
                        className="flex items-center gap-1.5 px-3 py-2 bg-orange text-dark rounded-md text-[11px] font-display font-bold uppercase tracking-wider hover:translate-x-[1px] hover:translate-y-[1px] transition-all disabled:opacity-50"
                        style={{ border: "2px solid #1A1A1A", boxShadow: "3px 3px 0 0 var(--shadow-color)" }}>
                        <Send size={11} strokeWidth={2.5} /> Publicar ya
                      </button>
                    </>
                  )}
                  {isScheduled && !isPublished && (
                    <>
                      <span className="flex-1 text-[11px] font-mono text-orange">
                        <Calendar size={11} strokeWidth={2.5} className="inline mr-1" />
                        Programado · {post.scheduled_at ? new Date(post.scheduled_at).toLocaleString("es-VE") : "—"}
                      </span>
                      <button onClick={cancelSchedule} disabled={pending}
                        className="flex items-center gap-1.5 px-3 py-2 bg-cream text-primary rounded-md text-[11px] font-display font-bold uppercase tracking-wider disabled:opacity-50 hover:bg-primary/5"
                        style={{ border: "1.5px solid #BB3B2E" }}>
                        <X size={11} strokeWidth={2.5} /> Cancelar envío
                      </button>
                    </>
                  )}
                  {isPublished && (
                    <span className="text-[11px] font-mono text-secondary">
                      <CheckCircle2 size={11} strokeWidth={2.5} className="inline mr-1" />
                      Publicado · {post.published_at ? new Date(post.published_at).toLocaleString("es-VE") : "—"}
                    </span>
                  )}
                  {post.status === "rejected" && (
                    <button onClick={approve} disabled={pending}
                      className="flex items-center gap-1.5 px-3 py-2 bg-cream rounded-md text-[11px] font-display font-bold uppercase tracking-wider hover:bg-cream-2 disabled:opacity-50"
                      style={{ border: "1.5px solid var(--border)" }}>
                      <ThumbsUp size={11} strokeWidth={2.5} /> Reabrir (aprobar)
                    </button>
                  )}
                  {post.status === "failed" && (
                    <span className="flex items-center gap-1 text-[11px] font-mono text-primary flex-1">
                      <AlertCircle size={11} strokeWidth={2.5} />
                      Falló: {post.failure_reason ?? "error en publicación"}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {toast && (
          <div className="fixed bottom-6 right-6 z-[70] px-4 py-3 rounded-md flex items-center gap-2 text-[12px] font-medium animate-in fade-in slide-in-from-bottom-2"
            style={{ background: toast.kind === "ok" ? "#4D5431" : "#BB3B2E", color: "#fff", border: "2px solid #1A1A1A", boxShadow: "4px 4px 0 0 var(--shadow-color)", minWidth: 280, maxWidth: 480 }}>
            {toast.kind === "ok" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{toast.msg}</span>
          </div>
        )}
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const meta: Record<string, { label: string; cls: string }> = {
    draft:      { label: "Borrador",       cls: "bg-cream-2 text-ink-3" },
    in_review:  { label: "En review",      cls: "bg-orange/20 text-orange" },
    approved:   { label: "Aprobado",       cls: "bg-secondary/20 text-secondary" },
    scheduled:  { label: "Programado",     cls: "bg-orange/20 text-orange" },
    publishing: { label: "Publicando",     cls: "bg-orange/30 text-orange" },
    published:  { label: "Publicado",      cls: "bg-secondary/20 text-secondary" },
    failed:     { label: "Falló",          cls: "bg-primary/20 text-primary" },
    rejected:   { label: "Rechazado",      cls: "bg-primary/20 text-primary" },
  }
  const m = meta[status] ?? { label: status, cls: "bg-cream-2 text-ink-3" }
  return (
    <span className={`text-[9px] font-display font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md ${m.cls}`}>
      {m.label}
    </span>
  )
}

function FeedbackItem({
  fb, replies, currentUserEmail,
  replyingTo, replyText, setReplyingTo, setReplyText, submitReply,
  toggleResolve, deleteFb, pending, onSeekVideo,
}: {
  fb: SocialFeedback
  replies: SocialFeedback[]
  currentUserEmail: string
  replyingTo: string | null
  replyText: string
  setReplyingTo: (v: string | null) => void
  setReplyText: (v: string) => void
  submitReply: (parentId: string) => void
  toggleResolve: (fb: SocialFeedback) => void
  deleteFb: (id: string) => void
  pending: boolean
  onSeekVideo: (ms: number) => void
}) {
  const isOwn = fb.author_email === currentUserEmail
  const fmtMs = (ms: number) => {
    const totalSec = Math.floor(ms / 1000)
    const m = Math.floor(totalSec / 60)
    const s = totalSec % 60
    return `${m}:${String(s).padStart(2, "0")}`
  }

  return (
    <li className={`p-2.5 rounded-md ${fb.resolved ? "bg-secondary/5 opacity-60" : "bg-cream-2/30"}`}
      style={{ border: `1px solid ${fb.resolved ? "#4D5431" : "var(--border-soft)"}` }}>
      <div className="flex items-start gap-2">
        {fb.timestamp_ms != null && (
          <button onClick={() => onSeekVideo(fb.timestamp_ms!)}
            title="Ir a este punto del video"
            className="flex-shrink-0 px-1.5 py-0.5 text-[9px] font-mono font-bold bg-orange/20 text-orange hover:bg-orange/30 rounded-md flex items-center gap-0.5">
            <Clock size={9} strokeWidth={2.5} />
            {fmtMs(fb.timestamp_ms)}
          </button>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-[10px] font-display font-bold text-ink truncate">{fb.author_name ?? fb.author_email ?? "anon"}</span>
            <span className="text-[9px] text-ink-3 font-mono">{fmtRelative(fb.created_at)}</span>
            {fb.resolved && (
              <span className="text-[9px] font-display font-bold uppercase tracking-wider text-secondary">✓ resuelto</span>
            )}
          </div>
          <p className="text-[12px] text-ink-2 whitespace-pre-wrap break-words mt-0.5">{fb.text}</p>

          <div className="flex items-center gap-2 mt-1.5 text-[9px] font-display font-bold uppercase tracking-wider">
            <button onClick={() => { setReplyingTo(fb.id); setReplyText("") }}
              className="text-ink-3 hover:text-orange">
              Responder
            </button>
            <button onClick={() => toggleResolve(fb)} disabled={pending}
              className={`${fb.resolved ? "text-ink-3" : "text-secondary"} hover:opacity-80`}>
              {fb.resolved ? "Reabrir" : "Marcar resuelto"}
            </button>
            {isOwn && (
              <button onClick={() => deleteFb(fb.id)} disabled={pending}
                className="text-ink-3 hover:text-primary">
                Eliminar
              </button>
            )}
          </div>

          {replyingTo === fb.id && (
            <div className="flex items-end gap-1 mt-2">
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                rows={1}
                autoFocus
                placeholder="Tu respuesta…"
                className="flex-1 px-2 py-1 bg-cream rounded-md text-[11px] focus:outline-none resize-none"
                style={{ border: "1.5px solid var(--border)" }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submitReply(fb.id)
                  if (e.key === "Escape") { setReplyingTo(null); setReplyText("") }
                }}
              />
              <button onClick={() => submitReply(fb.id)} disabled={pending || !replyText.trim()}
                className="px-2 py-1 bg-orange text-dark rounded-md text-[9px] font-display font-bold uppercase tracking-wider disabled:opacity-50">
                <Send size={10} strokeWidth={2.5} />
              </button>
              <button onClick={() => { setReplyingTo(null); setReplyText("") }}
                className="text-ink-3 px-1">
                <X size={11} />
              </button>
            </div>
          )}

          {/* Replies (nested) */}
          {replies.length > 0 && (
            <ul className="mt-2 space-y-1.5 pl-3 border-l-2 border-warm-200">
              {replies.map((r) => (
                <li key={r.id} className="text-[11px]">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="font-display font-bold text-ink text-[10px]">{r.author_name ?? r.author_email ?? "anon"}</span>
                    <span className="text-[9px] text-ink-3 font-mono">{fmtRelative(r.created_at)}</span>
                  </div>
                  <p className="text-ink-2 whitespace-pre-wrap break-words">{r.text}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </li>
  )
}
