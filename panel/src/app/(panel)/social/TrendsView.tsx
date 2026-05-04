"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  TrendingUp, RefreshCw, Sparkles, ExternalLink, Hash, Plus, X, Eye, MessageCircle,
  Trash2, Power, AlertCircle, CheckCircle2, Youtube, FileText, Lightbulb,
} from "lucide-react"
import { fmtRelative } from "@/lib/utils"
import {
  refreshTrendsAction,
  importFromTrendsAction,
  addTrendSubscriptionAction,
  toggleTrendSubscriptionAction,
  deleteTrendSubscriptionAction,
  createSuggestionAction,
} from "./actions"
import type { SocialTrendSource, SocialTrendBrief, SocialTrendSubscription } from "@/lib/medusa"

type Toast = { kind: "ok" | "err"; msg: string } | null

const KIND_META: Record<string, { label: string; color: string; icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }> }> = {
  reddit_post:    { label: "Reddit",  color: "#FF4500", icon: MessageCircle },
  youtube_video:  { label: "YouTube", color: "#FF0000", icon: Youtube },
  google_term:    { label: "Google",  color: "#4285F4", icon: TrendingUp },
  instagram_post: { label: "Instagram", color: "#E1306C", icon: Hash },
}

interface Props {
  sources: SocialTrendSource[]
  brief: SocialTrendBrief | null
  subscriptions: SocialTrendSubscription[]
}

export function TrendsView({ sources, brief, subscriptions }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [toast, setToast] = useState<Toast>(null)
  const [kindFilter, setKindFilter] = useState<string | null>(null)
  const [showSubs, setShowSubs] = useState(false)
  const [showAddSub, setShowAddSub] = useState(false)
  const [subForm, setSubForm] = useState({ kind: "youtube_channel", source_id: "", label: "" })
  const [creatingSugFromSource, setCreatingSugFromSource] = useState<string | null>(null)

  function flash(k: "ok" | "err", m: string) {
    setToast({ kind: k, msg: m })
    setTimeout(() => setToast(null), 4500)
  }

  // Filter sources
  const filtered = kindFilter ? sources.filter((s) => s.kind === kindFilter) : sources
  const sorted = filtered.slice().sort((a, b) => b.score - a.score)

  // Counts por kind
  const counts = new Map<string, number>()
  for (const s of sources) counts.set(s.kind, (counts.get(s.kind) ?? 0) + 1)

  // Brief content
  const themes = brief?.content?.themes ?? []
  const ideas = brief?.content?.content_ideas ?? []
  const hashtags = brief?.content?.hashtag_watch ?? []

  function refresh() {
    startTransition(async () => {
      const res = await refreshTrendsAction(true)
      if (!res.ok) return flash("err", res.error)
      flash("ok", `Trends actualizados · ${res.upserted} signals${res.brief ? " + brief AI" : ""}`)
      router.refresh()
    })
  }

  function importFromBrief() {
    startTransition(async () => {
      const res = await importFromTrendsAction()
      if (!res.ok) return flash("err", res.error)
      flash("ok", `${res.imported} sugerencias importadas (${res.skipped} ya existían) — fuente: ${res.source}`)
      router.refresh()
    })
  }

  function addSub() {
    if (!subForm.source_id.trim() || !subForm.label.trim()) {
      return flash("err", "Source ID y label son requeridos")
    }
    startTransition(async () => {
      const res = await addTrendSubscriptionAction({
        kind: subForm.kind,
        source_id: subForm.source_id,
        label: subForm.label,
      })
      if (!res.ok) return flash("err", res.error)
      flash("ok", `${subForm.label} suscrito`)
      setSubForm({ kind: "youtube_channel", source_id: "", label: "" })
      setShowAddSub(false)
      router.refresh()
    })
  }

  function toggleSub(s: SocialTrendSubscription) {
    startTransition(async () => {
      const res = await toggleTrendSubscriptionAction(s.id, !s.active)
      if (!res.ok) return flash("err", res.error)
      flash("ok", `${s.label} ${!s.active ? "activado" : "pausado"}`)
      router.refresh()
    })
  }

  function delSub(s: SocialTrendSubscription) {
    if (!window.confirm(`¿Eliminar suscripción "${s.label}"?`)) return
    startTransition(async () => {
      const res = await deleteTrendSubscriptionAction(s.id)
      if (!res.ok) return flash("err", res.error)
      flash("ok", "Suscripción eliminada")
      router.refresh()
    })
  }

  function createSugFromSource(s: SocialTrendSource) {
    setCreatingSugFromSource(s.id)
    startTransition(async () => {
      const res = await createSuggestionAction({
        kind: "post",
        title: s.title.slice(0, 200),
        body: `Inspirado en ${KIND_META[s.kind]?.label ?? s.kind}: ${s.summary?.slice(0, 500) ?? ""}\n\nLink: ${s.permalink ?? s.source_url ?? ""}`,
        source: "trend",
        source_ref: s.id,
      })
      if (!res.ok) {
        flash("err", res.error)
      } else {
        flash("ok", "Sugerencia creada · revisala en Ideas")
      }
      setCreatingSugFromSource(null)
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={refresh} disabled={pending}
          className="flex items-center gap-1.5 px-3 py-2 bg-orange text-dark rounded-md text-[10px] font-display font-bold uppercase tracking-wider disabled:opacity-50 hover:translate-x-[1px] hover:translate-y-[1px] transition-all"
          style={{ border: "2px solid #1A1A1A", boxShadow: "3px 3px 0 0 var(--shadow-color)" }}>
          <RefreshCw size={11} strokeWidth={2.5} className={pending ? "animate-spin" : ""} />
          Refresh trends + brief
        </button>
        <button onClick={importFromBrief} disabled={pending}
          className="flex items-center gap-1.5 px-3 py-2 bg-cream rounded-md text-[10px] font-display font-bold uppercase tracking-wider hover:bg-cream-2 disabled:opacity-50"
          style={{ border: "1.5px solid var(--border)", boxShadow: "3px 3px 0 0 var(--shadow-color)" }}>
          <Lightbulb size={11} strokeWidth={2.5} />
          Importar a sugerencias
        </button>
        <button onClick={() => setShowSubs(!showSubs)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-[10px] font-display font-bold uppercase tracking-wider ${
            showSubs ? "bg-dark text-cream" : "bg-cream text-ink hover:bg-cream-2"
          }`}
          style={{ border: "1.5px solid var(--border)" }}>
          <Youtube size={11} strokeWidth={2.5} />
          Suscripciones ({subscriptions.filter(s => s.active).length}/{subscriptions.length})
        </button>

        <div className="flex-1" />

        {/* Kind filter */}
        <div className="flex items-center gap-1">
          <FilterChip label="Todos" active={!kindFilter} onClick={() => setKindFilter(null)} count={sources.length} />
          {Array.from(counts.entries()).map(([k, n]) => {
            const meta = KIND_META[k]
            if (!meta) return null
            return (
              <FilterChip key={k} label={meta.label} active={kindFilter === k}
                onClick={() => setKindFilter(kindFilter === k ? null : k)} count={n} color={meta.color} />
            )
          })}
        </div>
      </div>

      {/* Subscriptions panel (expandible) */}
      {showSubs && (
        <div className="stamp-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display font-black text-[12px] uppercase tracking-wider text-ink">
              Suscripciones de fuentes
            </h3>
            <button onClick={() => setShowAddSub(!showAddSub)}
              className="flex items-center gap-1 px-2 py-1 bg-orange text-dark rounded-md text-[10px] font-display font-bold uppercase tracking-wider"
              style={{ border: "1.5px solid #1A1A1A" }}>
              <Plus size={11} strokeWidth={2.5} /> Añadir
            </button>
          </div>

          {showAddSub && (
            <div className="mb-3 p-3 bg-orange/5 rounded-md space-y-2" style={{ border: "1.5px dashed #FF3B27" }}>
              <div className="grid grid-cols-3 gap-2">
                <select value={subForm.kind} onChange={(e) => setSubForm({ ...subForm, kind: e.target.value })}
                  className="px-2 py-1.5 bg-cream rounded-md text-[11px]" style={{ border: "1.5px solid var(--border)" }}>
                  <option value="youtube_channel">YouTube channel</option>
                  <option value="reddit_subreddit">Reddit subreddit</option>
                </select>
                <input type="text" value={subForm.source_id}
                  onChange={(e) => setSubForm({ ...subForm, source_id: e.target.value })}
                  placeholder={subForm.kind === "youtube_channel" ? "UCxxx..." : "r/cannabis"}
                  className="px-2 py-1.5 bg-cream rounded-md text-[11px] font-mono" style={{ border: "1.5px solid var(--border)" }} />
                <input type="text" value={subForm.label}
                  onChange={(e) => setSubForm({ ...subForm, label: e.target.value })}
                  placeholder="Label friendly"
                  className="px-2 py-1.5 bg-cream rounded-md text-[11px]" style={{ border: "1.5px solid var(--border)" }} />
              </div>
              <div className="flex items-center gap-2 justify-end">
                <button onClick={() => { setShowAddSub(false); setSubForm({ kind: "youtube_channel", source_id: "", label: "" }) }}
                  className="px-3 py-1 bg-cream rounded-md text-[10px] font-display font-bold uppercase tracking-wider hover:bg-cream-2"
                  style={{ border: "1.5px solid var(--border)" }}>
                  Cancelar
                </button>
                <button onClick={addSub} disabled={pending || !subForm.source_id.trim() || !subForm.label.trim()}
                  className="px-3 py-1 bg-orange text-dark rounded-md text-[10px] font-display font-bold uppercase tracking-wider disabled:opacity-50"
                  style={{ border: "1.5px solid #1A1A1A" }}>
                  Suscribir
                </button>
              </div>
              <p className="text-[10px] text-ink-3 font-mono">
                💡 YT channel id: en la página del canal, View Source → buscá <code>channelId</code> (formato UC + 22 chars)
              </p>
            </div>
          )}

          {subscriptions.length === 0 ? (
            <p className="text-[12px] text-ink-3 italic">Sin suscripciones todavía. Añadí canales de YouTube o subreddits para que el cron los scrape.</p>
          ) : (
            <ul className="grid grid-cols-2 lg:grid-cols-3 gap-2">
              {subscriptions.map((s) => (
                <li key={s.id} className="flex items-center gap-2 px-3 py-2 bg-cream-2/40 rounded-md"
                  style={{ border: "1.5px solid var(--border-soft)" }}>
                  <Youtube size={12} className={s.active ? "text-primary" : "text-ink-3"} />
                  <div className="flex-1 min-w-0">
                    <div className={`font-display font-bold text-[11px] truncate ${s.active ? "text-ink" : "text-ink-3 line-through"}`}>
                      {s.label}
                    </div>
                    <div className="text-[9px] font-mono text-ink-3 truncate">{s.source_id}</div>
                  </div>
                  <button onClick={() => toggleSub(s)} disabled={pending}
                    className={`p-1 rounded-md ${s.active ? "text-secondary" : "text-ink-3"} hover:opacity-80 disabled:opacity-50`}
                    title={s.active ? "Pausar" : "Activar"}>
                    <Power size={11} strokeWidth={2.5} />
                  </button>
                  <button onClick={() => delSub(s)} disabled={pending}
                    className="p-1 text-ink-3 hover:text-primary disabled:opacity-50">
                    <Trash2 size={11} strokeWidth={2.5} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* AI Brief */}
      {brief && (
        <div className="stamp-card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 bg-orange text-dark">
            <div className="flex items-center gap-2">
              <Sparkles size={14} strokeWidth={2.5} />
              <h3 className="font-display font-black text-[14px] uppercase tracking-wider">AI Brief semanal</h3>
              <span className="text-[10px] font-mono opacity-70">· {brief.week_start}</span>
            </div>
            <span className="text-[10px] font-mono opacity-70">
              {brief.model_name ?? brief.content.model ?? "—"} · {fmtRelative(brief.generated_at)}
            </span>
          </div>
          <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Themes */}
            <div>
              <h4 className="text-[10px] font-display font-bold uppercase tracking-wider text-orange mb-2 flex items-center gap-1">
                <FileText size={11} strokeWidth={2.5} /> Temas estratégicos ({themes.length})
              </h4>
              {themes.length === 0 ? (
                <p className="text-[11px] text-ink-3 italic">Sin temas todavía</p>
              ) : (
                <ul className="space-y-2">
                  {themes.map((t, i) => (
                    <li key={i} className="p-2 bg-cream-2/40 rounded-md" style={{ border: "1px solid var(--border-soft)" }}>
                      <div className="font-display font-bold text-[12px] text-ink mb-0.5">{t.title}</div>
                      <p className="text-[10px] text-ink-3 font-mono leading-relaxed">{t.why}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Content ideas */}
            <div>
              <h4 className="text-[10px] font-display font-bold uppercase tracking-wider text-orange mb-2 flex items-center gap-1">
                <Lightbulb size={11} strokeWidth={2.5} /> Ideas de contenido ({ideas.length})
              </h4>
              {ideas.length === 0 ? (
                <p className="text-[11px] text-ink-3 italic">Sin ideas todavía</p>
              ) : (
                <ul className="space-y-1.5">
                  {ideas.map((idea, i) => (
                    <li key={i} className="text-[11px] p-2 bg-cream-2/40 rounded-md" style={{ border: "1px solid var(--border-soft)" }}>
                      <span className="font-display font-bold text-orange mr-1">{i + 1}.</span>
                      {idea}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Hashtag watch */}
            <div>
              <h4 className="text-[10px] font-display font-bold uppercase tracking-wider text-orange mb-2 flex items-center gap-1">
                <Hash size={11} strokeWidth={2.5} /> Hashtags a monitorear ({hashtags.length})
              </h4>
              {hashtags.length === 0 ? (
                <p className="text-[11px] text-ink-3 italic">Sin hashtags</p>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {hashtags.map((h) => (
                    <span key={h} className="text-[11px] font-mono text-orange bg-orange/10 px-2 py-0.5 rounded-md">
                      #{h.replace(/^#/, "")}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {!brief && (
        <div className="stamp-card p-4 bg-orange/5" style={{ borderColor: "#FF3B27" }}>
          <div className="flex items-start gap-2">
            <Sparkles size={14} className="text-orange flex-shrink-0 mt-0.5" strokeWidth={2.5} />
            <div className="flex-1">
              <p className="font-display font-bold text-[12px] uppercase tracking-wider text-orange">Sin brief AI todavía</p>
              <p className="text-[11px] text-ink-3 mt-1">
                Click en <strong>Refresh trends + brief</strong> arriba para correr los collectors y generar la primera versión.
                El cron lo regenera automáticamente cada lunes.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Trend signals */}
      <div className="stamp-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 bg-dark text-cream">
          <div className="flex items-center gap-2">
            <TrendingUp size={14} strokeWidth={2.5} />
            <h3 className="font-display font-black text-[14px] uppercase tracking-wider">Señales detectadas</h3>
          </div>
          <span className="text-[10px] font-mono text-cream/60">{sorted.length} de {sources.length}</span>
        </div>

        {sorted.length === 0 ? (
          <div className="p-10 text-center">
            <TrendingUp size={48} className="text-ink-3 mx-auto mb-3" strokeWidth={1.5} />
            <p className="font-display font-bold text-[14px] uppercase tracking-wider text-ink-3">
              Sin trends en este filtro
            </p>
            <p className="text-[12px] text-ink-3 mt-1">Hacé refresh o ajustá el filtro de kind</p>
          </div>
        ) : (
          <ul className="divide-y divide-warm-200/50 max-h-[600px] overflow-y-auto">
            {sorted.map((s) => {
              const meta = KIND_META[s.kind] ?? KIND_META.reddit_post
              const Icon = meta.icon
              const isCreating = creatingSugFromSource === s.id
              return (
                <li key={s.id} className="p-3 hover:bg-cream-2/30 transition-colors flex items-start gap-3">
                  {s.media_url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={s.media_url} alt="" className="w-16 h-16 object-cover bg-cream-2 flex-shrink-0"
                      style={{ border: "1.5px solid var(--border)" }} />
                  ) : (
                    <div className="w-16 h-16 bg-cream-2 flex items-center justify-center flex-shrink-0"
                      style={{ border: "1.5px solid var(--border)" }}>
                      <Icon size={20} strokeWidth={2} className="text-ink-3" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-[8px] font-display font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md text-white"
                        style={{ background: meta.color }}>
                        {meta.label}
                      </span>
                      <a href={s.permalink ?? s.source_url ?? "#"} target="_blank" rel="noopener noreferrer"
                        className="text-[12px] font-display font-bold text-ink hover:text-orange truncate flex items-center gap-1">
                        {s.title}
                        <ExternalLink size={10} strokeWidth={2.5} className="flex-shrink-0" />
                      </a>
                    </div>
                    {s.summary && (
                      <p className="text-[11px] text-ink-3 line-clamp-2 mb-1">{s.summary}</p>
                    )}
                    <div className="flex items-center gap-3 text-[10px] font-mono text-ink-3">
                      <span><Eye size={9} className="inline mr-0.5" /> {s.score.toLocaleString()}</span>
                      {s.comments > 0 && <span><MessageCircle size={9} className="inline mr-0.5" /> {s.comments}</span>}
                      {s.engagement_delta != null && (
                        <span className={s.engagement_delta > 0 ? "text-secondary" : "text-primary"}>
                          {s.engagement_delta > 0 ? "+" : ""}{s.engagement_delta.toFixed(0)}%
                        </span>
                      )}
                      {s.author && <span>· {s.author}</span>}
                      <span className="ml-auto">{fmtRelative(s.fetched_at)}</span>
                    </div>
                  </div>
                  <button onClick={() => createSugFromSource(s)} disabled={pending}
                    className="flex items-center gap-1 px-2 py-1.5 bg-orange text-dark rounded-md text-[10px] font-display font-bold uppercase tracking-wider disabled:opacity-50 flex-shrink-0"
                    style={{ border: "1.5px solid #1A1A1A" }} title="Crear sugerencia desde esta señal">
                    {isCreating ? <RefreshCw size={11} className="animate-spin" /> : <Lightbulb size={11} strokeWidth={2.5} />}
                    Sugerir
                  </button>
                </li>
              )
            })}
          </ul>
        )}
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

function FilterChip({ label, active, onClick, count, color }: {
  label: string
  active: boolean
  onClick: () => void
  count?: number
  color?: string
}) {
  return (
    <button onClick={onClick}
      className={`px-2.5 py-1 text-[10px] font-display font-bold uppercase tracking-wider rounded-md whitespace-nowrap ${
        active ? "text-white" : "text-ink-3 hover:bg-cream-2"
      }`}
      style={active && color
        ? { background: color, border: `1.5px solid ${color}` }
        : active
          ? { background: "var(--ink)", color: "var(--cream)" }
          : { border: "1.5px solid var(--border)" }}>
      {label}{count != null && ` (${count})`}
    </button>
  )
}
