"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  Lightbulb, Plus, X, Edit2, Trash2, ArrowRight, AlertCircle, CheckCircle2,
  Sparkles, FileText, ImageIcon, Calendar,
} from "lucide-react"
import { fmtRelative } from "@/lib/utils"
import {
  createSuggestionAction, updateSuggestionAction, deleteSuggestionAction, promoteSuggestionAction,
} from "./actions"
import type { SocialSuggestion } from "@/lib/medusa"

type Toast = { kind: "ok" | "err"; msg: string } | null

const STATUS_COLS: Array<{
  status: SocialSuggestion["status"]
  label: string
  color: string
  description: string
}> = [
  { status: "idea",      label: "💡 Ideas",       color: "#FF3B27", description: "Recién agregadas, esperando review" },
  { status: "in_design", label: "🎨 En diseño",   color: "#D4A015", description: "El equipo está trabajando en ellas" },
  { status: "promoted",  label: "✓ Promovidas",   color: "#4D5431", description: "Ya son posts reales" },
  { status: "rejected",  label: "✗ Rechazadas",   color: "#9C9285", description: "Descartadas — historia" },
]

const SOURCE_META: Record<string, { label: string; color: string }> = {
  manual:   { label: "Manual",  color: "#9C9285" },
  trend:    { label: "Trend",   color: "#FF3B27" },
  feedback: { label: "Feedback", color: "#4D5431" },
}

interface Props {
  suggestions: SocialSuggestion[]
}

export function SuggestionsView({ suggestions }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [toast, setToast] = useState<Toast>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dragOverCol, setDragOverCol] = useState<SocialSuggestion["status"] | null>(null)

  function flash(k: "ok" | "err", m: string) {
    setToast({ kind: k, msg: m })
    setTimeout(() => setToast(null), 4500)
  }

  // Group by status
  const byStatus = new Map<SocialSuggestion["status"], SocialSuggestion[]>()
  for (const s of suggestions) {
    const arr = byStatus.get(s.status) ?? []
    arr.push(s)
    byStatus.set(s.status, arr)
  }

  // Drag&drop reorder between columns
  function handleDrop(targetStatus: SocialSuggestion["status"]) {
    if (!draggedId) return
    const sug = suggestions.find((s) => s.id === draggedId)
    if (!sug || sug.status === targetStatus) {
      setDraggedId(null); setDragOverCol(null); return
    }
    startTransition(async () => {
      const res = await updateSuggestionAction(draggedId!, { status: targetStatus })
      if (!res.ok) flash("err", res.error)
      else flash("ok", `Movido a ${STATUS_COLS.find((c) => c.status === targetStatus)?.label}`)
      setDraggedId(null); setDragOverCol(null)
      router.refresh()
    })
  }

  function deleteOne(s: SocialSuggestion) {
    if (!window.confirm(`¿Eliminar "${s.title}"?`)) return
    startTransition(async () => {
      const res = await deleteSuggestionAction(s.id)
      if (!res.ok) return flash("err", res.error)
      flash("ok", "Eliminada")
      router.refresh()
    })
  }

  function promote(s: SocialSuggestion) {
    if (!window.confirm(`¿Promover "${s.title}" a un post real (status=draft)?`)) return
    startTransition(async () => {
      const res = await promoteSuggestionAction(s.id)
      if (!res.ok) return flash("err", res.error)
      flash("ok", `Post creado · revisalo en Calendar/Review`)
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={() => setShowCreate(!showCreate)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-[10px] font-display font-bold uppercase tracking-wider ${
            showCreate ? "bg-cream text-ink" : "bg-orange text-dark hover:translate-x-[1px] hover:translate-y-[1px]"
          }`}
          style={{ border: "2px solid #1A1A1A", boxShadow: showCreate ? "none" : "3px 3px 0 0 var(--shadow-color)" }}>
          {showCreate ? <X size={11} strokeWidth={2.5} /> : <Plus size={11} strokeWidth={3} />}
          {showCreate ? "Cancelar" : "Nueva sugerencia"}
        </button>
        <span className="text-[10px] font-mono text-ink-3 ml-1">
          {suggestions.length} totales · arrastrá las cards entre columnas para cambiar status
        </span>
      </div>

      {showCreate && (
        <SuggestionForm
          mode="create"
          onSubmit={(form) => {
            startTransition(async () => {
              const res = await createSuggestionAction(form)
              if (!res.ok) return flash("err", res.error)
              flash("ok", "Sugerencia creada")
              setShowCreate(false)
              router.refresh()
            })
          }}
          onCancel={() => setShowCreate(false)}
          pending={pending}
        />
      )}

      {/* Kanban */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {STATUS_COLS.map((col) => {
          const items = (byStatus.get(col.status) ?? []).sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
          )
          return (
            <div key={col.status}
              className="stamp-card flex flex-col"
              style={{ borderColor: col.color, minHeight: 400, background: dragOverCol === col.status ? `${col.color}15` : undefined }}
              onDragOver={(e) => { e.preventDefault(); setDragOverCol(col.status) }}
              onDragLeave={() => setDragOverCol(null)}
              onDrop={() => handleDrop(col.status)}>

              <div className="px-3 py-2 text-cream" style={{ background: col.color }}>
                <div className="font-display font-black text-[12px] uppercase tracking-wider">{col.label}</div>
                <div className="text-[10px] font-mono opacity-80 flex items-center justify-between">
                  <span>{items.length}</span>
                </div>
              </div>

              <div className="flex-1 p-2 space-y-2 overflow-y-auto" style={{ maxHeight: 600 }}>
                {items.length === 0 && (
                  <p className="text-[10px] text-ink-3 font-mono text-center py-4">— vacío —</p>
                )}
                {items.map((s) => (
                  <div key={s.id}
                    draggable
                    onDragStart={() => setDraggedId(s.id)}
                    className={`p-2.5 bg-page rounded-md cursor-grab active:cursor-grabbing hover:opacity-95 transition-opacity ${
                      draggedId === s.id ? "opacity-50" : ""
                    }`}
                    style={{ border: "1.5px solid var(--border)", boxShadow: "1.5px 1.5px 0 0 var(--shadow-color)" }}>

                    {editingId === s.id ? (
                      <SuggestionForm
                        mode="edit"
                        suggestion={s}
                        onSubmit={(form) => {
                          startTransition(async () => {
                            const res = await updateSuggestionAction(s.id, form)
                            if (!res.ok) return flash("err", res.error)
                            flash("ok", "Actualizada")
                            setEditingId(null)
                            router.refresh()
                          })
                        }}
                        onCancel={() => setEditingId(null)}
                        pending={pending}
                        compact
                      />
                    ) : (
                      <>
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h4 className="font-display font-bold text-[12px] text-ink leading-tight line-clamp-2">{s.title}</h4>
                          <span className="px-1 py-0 text-[8px] font-display font-bold uppercase tracking-wider rounded-md text-white flex-shrink-0"
                            style={{ background: SOURCE_META[s.source]?.color ?? "#9C9285" }}>
                            {SOURCE_META[s.source]?.label ?? s.source}
                          </span>
                        </div>
                        {s.body && (
                          <p className="text-[10px] text-ink-3 line-clamp-3 font-mono leading-snug">{s.body}</p>
                        )}
                        <div className="flex items-center gap-2 mt-1.5 text-[9px] font-mono text-ink-3">
                          {s.kind === "story" ? (
                            <span className="flex items-center gap-0.5"><ImageIcon size={9} /> Story</span>
                          ) : (
                            <span className="flex items-center gap-0.5"><FileText size={9} /> Post</span>
                          )}
                          {s.format && <span>· {s.format}</span>}
                          {s.pillar && <span>· {s.pillar}</span>}
                          {s.suggested_date && (
                            <span className="ml-auto"><Calendar size={9} className="inline mr-0.5" />{new Date(s.suggested_date).toLocaleDateString("es-VE", { day: "numeric", month: "short" })}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 mt-2 pt-2" style={{ borderTop: "1px dashed var(--border)" }}>
                          {s.status !== "promoted" && (
                            <button onClick={() => promote(s)} disabled={pending}
                              className="flex items-center gap-1 px-1.5 py-0.5 bg-orange text-dark text-[9px] font-display font-bold uppercase tracking-wider rounded-md disabled:opacity-50"
                              style={{ border: "1.5px solid #1A1A1A" }} title="Promover a post draft">
                              <ArrowRight size={9} strokeWidth={2.5} /> Promover
                            </button>
                          )}
                          {s.status === "promoted" && s.promoted_to && (
                            <a href={`/social?focus=${s.promoted_to}`}
                              className="flex items-center gap-1 px-1.5 py-0.5 bg-secondary text-cream text-[9px] font-display font-bold uppercase tracking-wider rounded-md"
                              style={{ border: "1.5px solid #1A1A1A" }} title="Abrir post promovido">
                              <ArrowRight size={9} strokeWidth={2.5} /> Ver post
                            </a>
                          )}
                          <span className="flex-1" />
                          <button onClick={() => setEditingId(s.id)} disabled={pending}
                            className="text-ink-3 hover:text-orange p-0.5 disabled:opacity-50">
                            <Edit2 size={10} strokeWidth={2.5} />
                          </button>
                          <button onClick={() => deleteOne(s)} disabled={pending}
                            className="text-ink-3 hover:text-primary p-0.5 disabled:opacity-50">
                            <Trash2 size={10} strokeWidth={2.5} />
                          </button>
                        </div>
                        <div className="text-[9px] text-ink-3 font-mono mt-1">
                          {fmtRelative(s.created_at)}
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {toast && (
        <div className="fixed bottom-6 right-6 z-[60] px-4 py-3 rounded-md flex items-center gap-2 text-[12px] font-medium animate-in fade-in slide-in-from-bottom-2"
          style={{ background: toast.kind === "ok" ? "#4D5431" : "#BB3B2E", color: "#fff", border: "2px solid #1A1A1A", boxShadow: "4px 4px 0 0 var(--shadow-color)", minWidth: 280, maxWidth: 480 }}>
          {toast.kind === "ok" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{toast.msg}</span>
        </div>
      )}
    </div>
  )
}

interface FormData {
  kind: "post" | "story"
  title: string
  body?: string
  pillar?: string
  format?: string
  suggested_date?: string
  status?: SocialSuggestion["status"]
}

function SuggestionForm({ mode, suggestion, onSubmit, onCancel, pending, compact }: {
  mode: "create" | "edit"
  suggestion?: SocialSuggestion
  onSubmit: (form: FormData) => void
  onCancel: () => void
  pending: boolean
  compact?: boolean
}) {
  const [form, setForm] = useState<FormData>({
    kind: suggestion?.kind ?? "post",
    title: suggestion?.title ?? "",
    body: suggestion?.body ?? undefined,
    pillar: suggestion?.pillar ?? undefined,
    format: suggestion?.format ?? undefined,
    suggested_date: suggestion?.suggested_date ? suggestion.suggested_date.slice(0, 10) : undefined,
    status: suggestion?.status,
  })

  const isValid = form.title.trim().length > 0

  if (compact) {
    return (
      <div className="space-y-1.5">
        <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
          autoFocus
          className="w-full px-2 py-1 bg-cream rounded-md text-[11px] font-display font-bold focus:outline-none"
          style={{ border: "1.5px solid var(--border)" }} />
        <textarea rows={3} value={form.body ?? ""} onChange={(e) => setForm({ ...form, body: e.target.value })}
          placeholder="Notas/referencias…"
          className="w-full px-2 py-1 bg-cream rounded-md text-[10px] font-mono focus:outline-none resize-none"
          style={{ border: "1.5px solid var(--border)" }} />
        <div className="grid grid-cols-2 gap-1">
          <input type="text" value={form.pillar ?? ""} onChange={(e) => setForm({ ...form, pillar: e.target.value })}
            placeholder="Pillar"
            className="px-2 py-1 bg-cream rounded-md text-[10px] focus:outline-none"
            style={{ border: "1.5px solid var(--border)" }} />
          <select value={form.format ?? ""} onChange={(e) => setForm({ ...form, format: e.target.value || undefined })}
            className="px-2 py-1 bg-cream rounded-md text-[10px] focus:outline-none"
            style={{ border: "1.5px solid var(--border)" }}>
            <option value="">Formato</option>
            <option value="Single">Single</option>
            <option value="Carrusel">Carrusel</option>
            <option value="Reel">Reel</option>
            <option value="Story">Story</option>
          </select>
        </div>
        <div className="flex items-center gap-1 justify-end">
          <button onClick={onCancel} disabled={pending}
            className="px-2 py-0.5 bg-cream rounded-md text-[9px] font-display font-bold uppercase tracking-wider hover:bg-cream-2 disabled:opacity-50"
            style={{ border: "1.5px solid var(--border)" }}>
            Cancelar
          </button>
          <button onClick={() => onSubmit(form)} disabled={pending || !isValid}
            className="px-2 py-0.5 bg-orange text-dark rounded-md text-[9px] font-display font-bold uppercase tracking-wider disabled:opacity-50"
            style={{ border: "1.5px solid #1A1A1A" }}>
            Guardar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="stamp-card p-4 bg-orange/5 space-y-3" style={{ borderColor: "#FF3B27" }}>
      <h4 className="font-display font-black text-[12px] uppercase tracking-wider text-orange flex items-center gap-1">
        <Sparkles size={11} strokeWidth={2.5} /> {mode === "create" ? "Nueva sugerencia" : "Editar sugerencia"}
      </h4>

      <div className="grid grid-cols-3 gap-2">
        <Field label="Tipo">
          <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as "post" | "story" })}
            className="w-full px-2 py-1.5 bg-cream rounded-md text-[12px] focus:outline-none"
            style={{ border: "1.5px solid var(--border)" }}>
            <option value="post">Post</option>
            <option value="story">Story</option>
          </select>
        </Field>
        <Field label="Pillar">
          <input type="text" value={form.pillar ?? ""} onChange={(e) => setForm({ ...form, pillar: e.target.value || undefined })}
            placeholder="Educational, BTS, etc."
            className="w-full px-2 py-1.5 bg-cream rounded-md text-[12px] focus:outline-none"
            style={{ border: "1.5px solid var(--border)" }} />
        </Field>
        <Field label="Formato">
          <select value={form.format ?? ""} onChange={(e) => setForm({ ...form, format: e.target.value || undefined })}
            className="w-full px-2 py-1.5 bg-cream rounded-md text-[12px] focus:outline-none"
            style={{ border: "1.5px solid var(--border)" }}>
            <option value="">— elegir —</option>
            <option value="Single">Single</option>
            <option value="Carrusel">Carrusel</option>
            <option value="Reel">Reel</option>
            <option value="Story">Story</option>
          </select>
        </Field>
      </div>

      <Field label="Título *">
        <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
          autoFocus={mode === "create"}
          placeholder="Idea del post (corta y clara)"
          className="w-full px-3 py-2 bg-cream rounded-md text-[13px] font-display font-bold focus:outline-none"
          style={{ border: "1.5px solid var(--border)" }} />
      </Field>

      <Field label="Notas / referencias">
        <textarea rows={4} value={form.body ?? ""} onChange={(e) => setForm({ ...form, body: e.target.value || undefined })}
          placeholder="Referencias, links, contexto, hashtags potenciales..."
          className="w-full px-3 py-2 bg-cream rounded-md text-[12px] font-mono focus:outline-none resize-none"
          style={{ border: "1.5px solid var(--border)" }} />
      </Field>

      <Field label="Fecha sugerida (opcional)">
        <input type="date" value={form.suggested_date ?? ""} onChange={(e) => setForm({ ...form, suggested_date: e.target.value || undefined })}
          className="w-48 px-3 py-2 bg-cream rounded-md text-[12px] font-mono focus:outline-none"
          style={{ border: "1.5px solid var(--border)" }} />
      </Field>

      <div className="flex items-center justify-end gap-2 pt-2" style={{ borderTop: "1.5px dashed var(--border)" }}>
        <button onClick={onCancel} disabled={pending}
          className="px-4 py-2 bg-cream rounded-md text-[11px] font-display font-bold uppercase tracking-wider hover:bg-cream-2 disabled:opacity-50"
          style={{ border: "1.5px solid var(--border)" }}>
          Cancelar
        </button>
        <button onClick={() => onSubmit(form)} disabled={pending || !isValid}
          className="px-4 py-2 bg-orange text-dark rounded-md text-[11px] font-display font-bold uppercase tracking-wider hover:translate-x-[1px] hover:translate-y-[1px] disabled:opacity-50 transition-all"
          style={{ border: "2px solid #1A1A1A", boxShadow: "3px 3px 0 0 var(--shadow-color)" }}>
          {pending ? "Guardando…" : mode === "create" ? "Crear sugerencia" : "Guardar cambios"}
        </button>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] font-display font-bold uppercase tracking-[0.18em] text-ink-2 mb-1">{label}</label>
      {children}
    </div>
  )
}
