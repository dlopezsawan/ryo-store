"use client"

import { useEffect, useState } from "react"
import {
  Play, ExternalLink, Loader2, RefreshCw, Search, AlertCircle,
  MousePointer, Keyboard, AlertTriangle, Clock,
} from "lucide-react"
import { fmtRelative } from "@/lib/utils"
import type { PosthogRecording, PosthogHeatmapClick } from "@/lib/medusa"

interface RecordingsResponse {
  ok: boolean
  configured: boolean
  recordings: PosthogRecording[]
  count: number
  posthog_url: string
  error?: string
}

interface HeatmapResponse {
  ok: boolean
  configured: boolean
  page: string | null
  clicks: PosthogHeatmapClick[]
  pages: Array<{ page: string; views: number; users: number }>
  posthog_url: string
  error?: string
}

export function PosthogReplays() {
  const [recordings, setRecordings] = useState<PosthogRecording[]>([])
  const [recordingsLoading, setRecordingsLoading] = useState(false)
  const [recordingsErr, setRecordingsErr] = useState<string | null>(null)
  const [recordingsConfigured, setRecordingsConfigured] = useState(true)
  const [posthogReplayUrl, setPosthogReplayUrl] = useState<string>("")

  const [heatmap, setHeatmap] = useState<HeatmapResponse | null>(null)
  const [heatmapLoading, setHeatmapLoading] = useState(false)
  const [heatmapErr, setHeatmapErr] = useState<string | null>(null)

  const [days, setDays] = useState(7)
  const [search, setSearch] = useState("")
  const [pageFilter, setPageFilter] = useState<string>("")

  function loadRecordings() {
    setRecordingsLoading(true)
    setRecordingsErr(null)
    const sp = new URLSearchParams()
    sp.set("days", String(days))
    sp.set("limit", "30")
    if (search.trim()) sp.set("search", search.trim())
    fetch(`/api/marketing/recordings?${sp}`, { cache: "no-store" })
      .then(async (r) => {
        const j = await r.json() as RecordingsResponse
        if (!j.ok && j.error) throw new Error(j.error)
        setRecordingsConfigured(j.configured)
        setRecordings(j.recordings ?? [])
        setPosthogReplayUrl(j.posthog_url ?? "")
      })
      .catch((e) => setRecordingsErr(e instanceof Error ? e.message : "error"))
      .finally(() => setRecordingsLoading(false))
  }

  function loadHeatmap() {
    setHeatmapLoading(true)
    setHeatmapErr(null)
    const sp = new URLSearchParams()
    sp.set("days", String(days))
    sp.set("limit", "30")
    if (pageFilter) sp.set("page", pageFilter)
    fetch(`/api/marketing/heatmap?${sp}`, { cache: "no-store" })
      .then(async (r) => {
        const j = await r.json() as HeatmapResponse
        if (!j.ok && j.error) throw new Error(j.error)
        setHeatmap(j)
      })
      .catch((e) => setHeatmapErr(e instanceof Error ? e.message : "error"))
      .finally(() => setHeatmapLoading(false))
  }

  useEffect(() => {
    loadRecordings()
    loadHeatmap()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days, pageFilter])

  function fmtDuration(seconds: number): string {
    if (!seconds) return "—"
    const m = Math.floor(seconds / 60)
    const s = Math.floor(seconds % 60)
    return `${m}:${String(s).padStart(2, "0")}`
  }

  return (
    <>
      {/* Header con controles globales */}
      <div className="stamp-card overflow-hidden">
        <div className="px-5 py-3 bg-dark text-cream flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Play size={14} strokeWidth={2.5} />
            <h3 className="font-display font-black text-[14px] uppercase tracking-wider">PostHog · Replays + Heatmap</h3>
            <span className="text-[10px] font-mono text-cream/60">native · sin iframe</span>
          </div>
          <div className="flex items-center gap-2">
            <select value={days} onChange={(e) => setDays(Number(e.target.value))}
              className="px-2 py-1 bg-cream-2/20 text-cream rounded-md text-[10px] font-display font-bold uppercase tracking-wider focus:outline-none">
              <option value={1}>24h</option>
              <option value={7}>7 días</option>
              <option value={30}>30 días</option>
              <option value={90}>90 días</option>
            </select>
            <button onClick={() => { loadRecordings(); loadHeatmap() }} disabled={recordingsLoading || heatmapLoading}
              className="text-cream/70 hover:text-cream p-1 disabled:opacity-50">
              <RefreshCw size={13} strokeWidth={2.5} className={recordingsLoading || heatmapLoading ? "animate-spin" : ""} />
            </button>
            {posthogReplayUrl && (
              <a href={posthogReplayUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 px-2 py-1 bg-orange text-dark rounded-md text-[10px] font-display font-bold uppercase tracking-wider"
                style={{ border: "1.5px solid #1A1A1A" }}>
                Player <ExternalLink size={10} />
              </a>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">

        {/* RECORDINGS */}
        <div className="stamp-card overflow-hidden">
          <div className="px-4 py-3 bg-cream-2/40">
            <div className="flex items-center gap-2 mb-2">
              <Play size={12} className="text-orange" strokeWidth={2.5} />
              <h4 className="font-display font-black text-[12px] uppercase tracking-wider text-ink">
                Session recordings · {recordings.length}
              </h4>
            </div>
            <div className="flex items-center gap-2">
              <Search size={12} className="text-ink-3" />
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") loadRecordings() }}
                placeholder="Buscar por email, URL…"
                className="flex-1 px-2 py-1 bg-cream rounded-md text-[11px] font-mono focus:outline-none"
                style={{ border: "1.5px solid var(--border)" }} />
              <button onClick={loadRecordings} disabled={recordingsLoading}
                className="px-2 py-1 bg-cream rounded-md text-[10px] font-display font-bold uppercase tracking-wider hover:bg-cream-2 disabled:opacity-50"
                style={{ border: "1.5px solid var(--border)" }}>
                Buscar
              </button>
            </div>
          </div>

          {recordingsErr ? (
            <div className="p-4 bg-primary/5 text-[12px] text-primary flex items-center gap-2">
              <AlertCircle size={12} /> {recordingsErr}
            </div>
          ) : !recordingsConfigured ? (
            <div className="p-6 text-center text-[12px] text-ink-3">
              PostHog admin no configurado · falta <code className="text-orange">POSTHOG_PERSONAL_API_KEY</code>
            </div>
          ) : recordingsLoading && recordings.length === 0 ? (
            <div className="p-10 text-center">
              <Loader2 size={32} className="text-orange animate-spin mx-auto mb-2" />
              <p className="text-[11px] text-ink-3">Cargando recordings…</p>
            </div>
          ) : recordings.length === 0 ? (
            <div className="p-6 text-center text-[12px] text-ink-3 italic">
              Sin recordings en este período. PostHog necesita que el storefront tenga session recording activado.
            </div>
          ) : (
            <ul className="divide-y divide-warm-200/50 max-h-[500px] overflow-y-auto">
              {recordings.map((r) => (
                <li key={r.id} className="p-3 hover:bg-cream-2/30 transition-colors">
                  <a href={r.url} target="_blank" rel="noopener noreferrer" className="block group">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="font-display font-bold text-[12px] text-ink truncate flex-1 group-hover:text-orange">
                        {r.person_email ?? r.person_name ?? r.distinct_id.slice(0, 12)}
                      </span>
                      <ExternalLink size={11} className="text-ink-3 group-hover:text-orange flex-shrink-0" />
                    </div>
                    {r.start_url && (
                      <div className="text-[10px] font-mono text-ink-3 truncate">
                        {r.start_url.replace(/^https?:\/\/[^/]+/, "")}
                      </div>
                    )}
                    <div className="flex items-center gap-3 text-[10px] font-mono text-ink-3 mt-1">
                      <span><Clock size={9} className="inline mr-0.5" /> {fmtDuration(r.duration)}</span>
                      {r.click_count != null && <span><MousePointer size={9} className="inline mr-0.5" /> {r.click_count}</span>}
                      {r.keypress_count != null && <span><Keyboard size={9} className="inline mr-0.5" /> {r.keypress_count}</span>}
                      {r.console_error_count != null && r.console_error_count > 0 && (
                        <span className="text-primary"><AlertTriangle size={9} className="inline mr-0.5" /> {r.console_error_count} err</span>
                      )}
                      <span className="ml-auto">{fmtRelative(r.start_time)}</span>
                    </div>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* HEATMAP / TOP CLICKS */}
        <div className="stamp-card overflow-hidden">
          <div className="px-4 py-3 bg-cream-2/40">
            <div className="flex items-center gap-2 mb-2">
              <MousePointer size={12} className="text-orange" strokeWidth={2.5} />
              <h4 className="font-display font-black text-[12px] uppercase tracking-wider text-ink">
                Heatmap · top elementos clickeados
              </h4>
            </div>
            <div className="flex items-center gap-2">
              <select value={pageFilter} onChange={(e) => setPageFilter(e.target.value)}
                className="flex-1 px-2 py-1 bg-cream rounded-md text-[11px] font-mono focus:outline-none"
                style={{ border: "1.5px solid var(--border)" }}>
                <option value="">Todas las páginas</option>
                {(heatmap?.pages ?? []).map((p) => (
                  <option key={p.page} value={p.page}>{p.page} ({p.views.toLocaleString()})</option>
                ))}
              </select>
            </div>
          </div>

          {heatmapErr ? (
            <div className="p-4 bg-primary/5 text-[12px] text-primary flex items-center gap-2">
              <AlertCircle size={12} /> {heatmapErr}
            </div>
          ) : heatmapLoading && !heatmap ? (
            <div className="p-10 text-center">
              <Loader2 size={32} className="text-orange animate-spin mx-auto mb-2" />
              <p className="text-[11px] text-ink-3">Calculando heatmap…</p>
            </div>
          ) : !heatmap?.configured ? (
            <div className="p-6 text-center text-[12px] text-ink-3">PostHog admin no configurado</div>
          ) : heatmap.clicks.length === 0 ? (
            <div className="p-6 text-center text-[12px] text-ink-3 italic">
              Sin clicks en este filtro.
            </div>
          ) : (
            <ul className="divide-y divide-warm-200/50 max-h-[500px] overflow-y-auto">
              {heatmap.clicks.map((c, i) => {
                const max = Math.max(...heatmap.clicks.map((x) => x.click_count))
                const pct = max > 0 ? (c.click_count / max) * 100 : 0
                return (
                  <li key={i} className="p-3 relative overflow-hidden">
                    <div className="absolute inset-y-0 left-0 bg-orange/10 transition-all" style={{ width: `${pct}%` }} />
                    <div className="relative flex items-center gap-3">
                      <span className="font-display font-black num text-[14px] text-orange w-8 text-right flex-shrink-0">
                        {c.click_count}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="font-display font-bold text-[12px] text-ink truncate">
                          {c.text || <span className="text-ink-3 italic">sin texto</span>}
                        </div>
                        <div className="text-[10px] font-mono text-ink-3 truncate">
                          {c.page} {c.selector && `· ${c.selector}`}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] font-mono text-ink-3 flex-shrink-0">
                        <span title="Usuarios únicos">{c.unique_users}u</span>
                        {c.rage_count > 0 && (
                          <span className="text-primary" title="Rage clicks">🔥 {c.rage_count}</span>
                        )}
                        {c.dead_count > 0 && (
                          <span className="text-orange" title="Dead clicks">💤 {c.dead_count}</span>
                        )}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Top pages */}
      {heatmap && heatmap.pages.length > 0 && (
        <div className="stamp-card overflow-hidden">
          <div className="px-5 py-3 bg-dark text-cream">
            <h3 className="font-display font-black text-[14px] uppercase tracking-wider">
              Top páginas · click para filtrar el heatmap
            </h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-px bg-warm-200">
            {heatmap.pages.slice(0, 16).map((p) => (
              <button key={p.page} onClick={() => setPageFilter(p.page)}
                className={`p-3 text-left bg-page hover:bg-orange/5 transition-colors ${
                  pageFilter === p.page ? "bg-orange/10 ring-2 ring-orange" : ""
                }`}>
                <div className="font-mono font-bold text-[11px] text-ink truncate">{p.page}</div>
                <div className="flex items-center justify-between mt-1 text-[10px] font-mono text-ink-3">
                  <span>{p.views.toLocaleString()} vistas</span>
                  <span>{p.users} usuarios</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
