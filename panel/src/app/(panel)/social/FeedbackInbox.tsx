"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  MessageSquare, X, Clock, Check, Trash2, RefreshCw,
  AlertCircle, CheckCircle2, Filter, Download,
} from "lucide-react"
import { fmtRelative } from "@/lib/utils"
import { resolveFeedbackAction, deleteFeedbackAction } from "./actions"
import type { SocialFeedback, SocialPost, SocialStory } from "@/lib/medusa"

type Toast = { kind: "ok" | "err"; msg: string } | null
type FilterMode = "open" | "resolved" | "all"

interface Props {
  posts: SocialPost[]
  stories: SocialStory[]
  currentUserEmail: string
  onOpenPost: (postId: string) => void  // abre el detail del post asociado al feedback
}

/**
 * Botón flotante + drawer lateral con todos los comentarios pendientes
 * agrupados por entidad (post/story). Click en un thread → abre el detail
 * modal del post con foco en ese feedback.
 */
export function FeedbackInbox({ posts, stories, currentUserEmail, onOpenPost }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [feedback, setFeedback] = useState<SocialFeedback[]>([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState<FilterMode>("open")
  const [pending, startTransition] = useTransition()
  const [toast, setToast] = useState<Toast>(null)

  function flash(k: "ok" | "err", m: string) {
    setToast({ kind: k, msg: m })
    setTimeout(() => setToast(null), 4000)
  }

  function load() {
    setLoading(true)
    fetch("/api/social/feedback", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { ok: boolean; feedback?: SocialFeedback[] }) => {
        if (d.feedback) setFeedback(d.feedback)
      })
      .catch(() => { /* ignore */ })
      .finally(() => setLoading(false))
  }

  // Inicial: cargar count para badge
  useEffect(() => {
    load()
    const t = setInterval(load, 60_000)  // refresh cada 60s
    return () => clearInterval(t)
  }, [])

  // Filter
  const filtered = feedback.filter((f) => {
    if (filter === "open") return !f.resolved
    if (filter === "resolved") return f.resolved
    return true
  })

  // Group by entity
  const byEntity = new Map<string, SocialFeedback[]>()
  for (const f of filtered) {
    const key = `${f.entity_type}|${f.entity_id}`
    const arr = byEntity.get(key) ?? []
    arr.push(f)
    byEntity.set(key, arr)
  }

  // Lookup helpers
  const postById = new Map(posts.map((p) => [p.id, p]))
  const storyById = new Map(stories.map((s) => [s.id, s]))

  const openCount = feedback.filter((f) => !f.resolved).length

  function toggleResolve(fb: SocialFeedback) {
    startTransition(async () => {
      const res = await resolveFeedbackAction(fb.id, !fb.resolved)
      if (!res.ok) return flash("err", res.error)
      flash("ok", fb.resolved ? "Reabierto" : "Marcado resuelto")
      load()
      router.refresh()
    })
  }

  async function downloadBrief() {
    try {
      const res = await fetch("/api/social/export-brief", { cache: "no-store" })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        return flash("err", j.error ?? `Error ${res.status}`)
      }
      const blob = await res.blob()
      const filename = `enrola-social-brief-${new Date().toISOString().slice(0, 10)}.md`
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
      flash("ok", `Brief descargado · ${filename}`)
    } catch (e) {
      flash("err", e instanceof Error ? e.message : "Error de red")
    }
  }

  function deleteFb(id: string) {
    if (!window.confirm("¿Eliminar este comentario?")) return
    startTransition(async () => {
      const res = await deleteFeedbackAction(id)
      if (!res.ok) return flash("err", res.error)
      flash("ok", "Eliminado")
      load()
      router.refresh()
    })
  }

  function openPostFromFeedback(fb: SocialFeedback) {
    if (fb.entity_type === "post") {
      onOpenPost(fb.entity_id)
      setOpen(false)
    } else {
      // Stories: just close the inbox; the user can find the story in the Stories view
      flash("ok", "Las stories se gestionan en el tab Stories")
    }
  }

  return (
    <>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => { setOpen(true); load() }}
        className="relative flex items-center gap-1.5 px-3 py-2 bg-cream rounded-md text-[10px] font-display font-bold uppercase tracking-wider text-ink hover:bg-cream-2"
        style={{ border: "1.5px solid var(--border)", boxShadow: "3px 3px 0 0 var(--shadow-color)" }}
        title="Inbox de feedback"
      >
        <MessageSquare size={11} strokeWidth={2.5} />
        Feedback
        {openCount > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-orange text-dark text-[9px] font-display font-black flex items-center justify-center rounded-full"
            style={{ border: "1.5px solid #1A1A1A" }}>
            {openCount > 9 ? "9+" : openCount}
          </span>
        )}
      </button>

      {/* Drawer */}
      {open && (
        <div className="fixed inset-0 z-50 flex" onClick={() => setOpen(false)}>
          <div className="flex-1 bg-dark/50 backdrop-blur-sm" />
          <div className="w-full max-w-md bg-page flex flex-col"
            style={{ borderLeft: "2.5px solid var(--border)", boxShadow: "-5px 0 20px rgba(0,0,0,0.15)" }}
            onClick={(e) => e.stopPropagation()}>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 bg-dark text-cream">
              <div className="flex items-center gap-2">
                <MessageSquare size={14} strokeWidth={2.5} />
                <h3 className="font-display font-black text-[14px] uppercase tracking-wider">Feedback inbox</h3>
                <span className="text-[10px] font-mono text-cream/60">
                  {feedback.length} totales · {openCount} abiertos
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={downloadBrief} title="Descargar brief markdown con todo el feedback abierto · ideal para Claude/ChatGPT"
                  className="flex items-center gap-1 px-2 py-1 bg-orange text-dark rounded-md text-[10px] font-display font-bold uppercase tracking-wider hover:opacity-90"
                  style={{ border: "1.5px solid #1A1A1A" }}>
                  <Download size={11} strokeWidth={2.5} /> Brief
                </button>
                <button onClick={load} disabled={loading} title="Refrescar"
                  className="text-cream/70 hover:text-cream p-1 disabled:opacity-50">
                  <RefreshCw size={13} strokeWidth={2.5} className={loading ? "animate-spin" : ""} />
                </button>
                <button onClick={() => setOpen(false)} className="text-cream/70 hover:text-cream p-1">
                  <X size={14} strokeWidth={2.5} />
                </button>
              </div>
            </div>

            {/* Filter tabs */}
            <div className="flex items-center gap-1 px-3 py-2 border-b border-warm-200/50 bg-cream-2/30">
              <Filter size={11} className="text-ink-3" strokeWidth={2.5} />
              {(["open", "resolved", "all"] as FilterMode[]).map((m) => (
                <button key={m} onClick={() => setFilter(m)}
                  className={`px-2.5 py-1 text-[10px] font-display font-bold uppercase tracking-wider rounded-md ${
                    filter === m ? "bg-dark text-cream" : "text-ink-3 hover:bg-cream-2"
                  }`}>
                  {m === "open" ? `Abiertos (${feedback.filter(f => !f.resolved).length})` :
                   m === "resolved" ? `Resueltos (${feedback.filter(f => f.resolved).length})` :
                   `Todos (${feedback.length})`}
                </button>
              ))}
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="p-10 text-center">
                  <MessageSquare size={32} className="text-ink-3 mx-auto mb-2" strokeWidth={1.5} />
                  <p className="text-[12px] text-ink-3">
                    {filter === "open" ? "Nada pendiente · todo resuelto 🎉" :
                     filter === "resolved" ? "Sin feedback resuelto todavía" :
                     "Sin feedback aún"}
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-warm-200/50">
                  {Array.from(byEntity.entries()).map(([key, items]) => {
                    const [type, entityId] = key.split("|")
                    const post = type === "post" ? postById.get(entityId) : null
                    const story = type === "story" ? storyById.get(entityId) : null
                    const entityLabel = post?.title ?? story?.external_id ?? `${type} ${entityId.slice(-6)}`
                    const entityNumber = post?.number ?? (story ? `${story.date} slot ${story.slot}` : "")

                    // Sort items: top-level first (no parent), then by date
                    const sorted = items.slice().sort((a, b) =>
                      new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

                    return (
                      <li key={key} className="p-4 hover:bg-cream-2/30">
                        <button onClick={() => post ? openPostFromFeedback(items[0]) : undefined}
                          className="block text-left w-full mb-2">
                          <div className="flex items-baseline gap-2">
                            <span className={`text-[8px] font-display font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md ${
                              type === "post" ? "bg-orange/15 text-orange" : "bg-secondary/15 text-secondary"
                            }`}>
                              {type === "post" ? "POST" : "STORY"}
                            </span>
                            <span className="font-display font-bold text-[12px] text-ink truncate">{entityLabel}</span>
                          </div>
                          {entityNumber && (
                            <div className="text-[9px] font-mono text-ink-3 mt-0.5">{entityNumber}</div>
                          )}
                        </button>

                        <ul className="space-y-1.5 mt-2 pl-2 border-l-2 border-warm-200">
                          {sorted.map((fb) => (
                            <li key={fb.id} className={`p-2 rounded-md text-[11px] ${fb.resolved ? "bg-secondary/5 opacity-60" : "bg-cream-2/40"}`}
                              style={{ border: `1px solid ${fb.resolved ? "#4D5431" : "var(--border-soft)"}` }}>
                              <div className="flex items-baseline gap-2 flex-wrap mb-0.5">
                                {fb.timestamp_ms != null && (
                                  <span className="px-1.5 py-0 text-[9px] font-mono font-bold bg-orange/20 text-orange rounded-md flex items-center gap-0.5">
                                    <Clock size={9} strokeWidth={2.5} />
                                    {fmtMs(fb.timestamp_ms)}
                                  </span>
                                )}
                                <span className="font-display font-bold text-[10px] text-ink truncate">
                                  {fb.author_name ?? fb.author_email ?? "anon"}
                                </span>
                                <span className="text-[9px] text-ink-3 font-mono">{fmtRelative(fb.created_at)}</span>
                                {fb.parent_id && <span className="text-[8px] text-ink-3 italic">↳ respuesta</span>}
                              </div>
                              <p className="text-ink-2 whitespace-pre-wrap break-words">{fb.text}</p>
                              <div className="flex items-center gap-2 mt-1.5 text-[9px] font-display font-bold uppercase tracking-wider">
                                <button onClick={() => toggleResolve(fb)} disabled={pending}
                                  className={`${fb.resolved ? "text-ink-3" : "text-secondary"} hover:opacity-80 flex items-center gap-0.5`}>
                                  <Check size={10} strokeWidth={2.5} /> {fb.resolved ? "Reabrir" : "Resolver"}
                                </button>
                                {fb.author_email === currentUserEmail && (
                                  <button onClick={() => deleteFb(fb.id)} disabled={pending}
                                    className="text-ink-3 hover:text-primary flex items-center gap-0.5">
                                    <Trash2 size={10} strokeWidth={2.5} />
                                  </button>
                                )}
                                {post && (
                                  <button onClick={() => openPostFromFeedback(fb)}
                                    className="ml-auto text-orange hover:underline">
                                    Ver post →
                                  </button>
                                )}
                              </div>
                            </li>
                          ))}
                        </ul>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 z-[70] px-4 py-3 rounded-md flex items-center gap-2 text-[12px] font-medium animate-in fade-in slide-in-from-bottom-2"
          style={{ background: toast.kind === "ok" ? "#4D5431" : "#BB3B2E", color: "#fff", border: "2px solid #1A1A1A", boxShadow: "4px 4px 0 0 var(--shadow-color)", minWidth: 280, maxWidth: 480 }}>
          {toast.kind === "ok" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{toast.msg}</span>
        </div>
      )}
    </>
  )
}

function fmtMs(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}:${String(s).padStart(2, "0")}`
}
