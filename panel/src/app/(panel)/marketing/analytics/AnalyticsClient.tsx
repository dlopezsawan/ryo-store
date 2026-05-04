"use client"

import { useEffect, useState } from "react"
import {
  AlertCircle, Activity, Flag, AlertTriangle, Cpu, ExternalLink, Eye,
  Loader2, RefreshCw, Maximize2,
} from "lucide-react"
import { fmtRelative } from "@/lib/utils"
import { FlagsClient } from "./FlagsClient"
import { PosthogReplays } from "./PosthogReplays"
import type {
  PosthogOverview, PosthogFlag, PosthogError, PosthogLlmOverview,
} from "@/lib/medusa"

interface ApiResponse {
  ok: boolean
  overview: PosthogOverview | null
  overview_error: string | null
  flags: { configured: boolean; flags: PosthogFlag[]; count: number; posthog_url?: string } | null
  flags_error: string | null
  errors: { configured: boolean; days: number; errors: PosthogError[]; posthog_url?: string } | null
  errors_error: string | null
  llm: PosthogLlmOverview | null
  llm_error: string | null
}

export function AnalyticsClient({ clarityId }: { clarityId: string }) {
  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showHeatmap, setShowHeatmap] = useState(true)

  function load() {
    setLoading(true)
    setError(null)
    fetch("/api/marketing/posthog-overview", { cache: "no-store" })
      .then(async (r) => {
        const j = await r.json() as ApiResponse & { error?: string }
        if (!j.ok) throw new Error(j.error ?? "error")
        setData(j)
      })
      .catch((e) => setError(e instanceof Error ? e.message : "fetch error"))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const overview = data?.overview
  const flags = data?.flags?.flags ?? []
  const flagsConfigured = data?.flags?.configured ?? false
  const errorsList = data?.errors?.errors ?? []
  const llm = data?.llm
  const posthogConfigured = overview?.configured === true
  const posthogUrl = overview?.posthog_url

  const clarityBaseUrl = `https://clarity.microsoft.com/projects/view/${clarityId}`
  const clarityHeatmapUrl = `${clarityBaseUrl}/heatmaps`
  const clarityRecordingsUrl = `${clarityBaseUrl}/recordings`

  return (
    <>
      {/* Refresh + status */}
      <div className="flex items-center gap-2 justify-end">
        {loading && (
          <span className="text-[10px] font-mono text-orange flex items-center gap-1">
            <Loader2 size={10} className="animate-spin" /> Cargando datos…
          </span>
        )}
        <button onClick={load} disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-cream rounded-md text-[10px] font-display font-bold uppercase tracking-wider hover:bg-cream-2 disabled:opacity-50"
          style={{ border: "1.5px solid var(--border)" }}>
          <RefreshCw size={11} strokeWidth={2.5} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="stamp-card p-4 bg-primary/5" style={{ borderColor: "#BB3B2E" }}>
          <div className="flex items-center gap-2">
            <AlertCircle size={14} className="text-primary" strokeWidth={2.5} />
            <p className="text-[13px] font-medium text-primary">{error}</p>
          </div>
        </div>
      )}

      {/* PostHog overview KPIs */}
      {posthogConfigured && overview?.summary ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            <Kpi label="Events 7d" value={overview.summary.total_events_7d.toLocaleString()} icon={<Activity size={12} />} tone="orange" />
            <Kpi label="Users 7d" value={overview.summary.unique_users_7d.toLocaleString()} icon={<Eye size={12} />} />
            <Kpi label="Persons" value={overview.summary.persons_total.toLocaleString()} sub="lifetime" />
            <Kpi label="Flags activos" value={`${overview.summary.flags_active}/${overview.summary.flags_count}`} icon={<Flag size={12} />} />
            <Kpi label="Experiments" value={String(overview.summary.experiments_count)} sub="A/B tests" />
            <Kpi label="Surveys" value={overview.summary.survey_responses.toLocaleString()} sub="responses" />
            <a href={posthogUrl ?? "#"} target="_blank" rel="noopener noreferrer"
              className="stamp-card p-4 hover:bg-orange/5 transition-colors group">
              <div className="flex items-center gap-1.5 mb-1">
                <ExternalLink size={12} className="text-orange" />
                <div className="text-[9px] font-display font-bold uppercase tracking-[0.18em] text-orange">PostHog →</div>
              </div>
              <div className="font-display font-black text-[14px] mt-1 text-ink group-hover:text-orange transition-colors">Abrir dashboard</div>
              <div className="text-[10px] text-ink-3 font-mono mt-1">app.posthog.com</div>
            </a>
          </div>

          {overview.top_events && overview.top_events.length > 0 && (
            <div className="stamp-card overflow-hidden">
              <div className="px-5 py-3 bg-dark text-cream">
                <h3 className="font-display font-black text-[14px] uppercase tracking-wider">Top eventos · 7d</h3>
              </div>
              <ul className="divide-y divide-warm-200/50 max-h-72 overflow-y-auto">
                {overview.top_events.slice(0, 15).map((e) => (
                  <li key={e.event} className="px-5 py-2 flex items-center justify-between text-[12px]">
                    <span className="font-display font-bold text-ink">{e.event}</span>
                    <span className="font-display font-black num text-orange">{e.count.toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      ) : (
        !loading && (
          <div className="stamp-card p-5 bg-orange/5" style={{ borderColor: "#FF3B27" }}>
            <div className="flex items-start gap-3">
              <AlertTriangle size={18} className="text-orange flex-shrink-0 mt-0.5" strokeWidth={2.5} />
              <div>
                <h3 className="font-display font-black text-[14px] uppercase tracking-wider text-orange mb-1">PostHog no configurado</h3>
                <p className="text-[11px] text-ink-2">
                  Para activar la integración admin, agregá en el backend Medusa:
                </p>
                <ul className="text-[11px] font-mono text-ink-3 mt-2 space-y-0.5">
                  <li>· <code className="text-orange">POSTHOG_PERSONAL_API_KEY</code></li>
                  <li>· <code className="text-orange">POSTHOG_PROJECT_ID</code></li>
                </ul>
              </div>
            </div>
          </div>
        )
      )}

      {/* PostHog Replays + Heatmap — native (reemplaza el Clarity iframe roto) */}
      <PosthogReplays />

      {/* Clarity link compacto — opcional, sólo si está configurado */}
      {clarityId && (
        <div className="stamp-card p-3 flex items-center gap-3 bg-cream-2/30">
          <Eye size={14} className="text-ink-3" strokeWidth={2.5} />
          <span className="text-[11px] text-ink-3 font-mono flex-1">
            Microsoft Clarity (legacy) · project <code className="text-orange">{clarityId}</code> ·
            como fallback abre directo en su dashboard (su iframe está bloqueado por X-Frame-Options)
          </span>
          <a href={clarityBaseUrl} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 px-2 py-1 bg-cream rounded-md text-[10px] font-display font-bold uppercase tracking-wider hover:bg-cream-2"
            style={{ border: "1.5px solid var(--border)" }}>
            Abrir <ExternalLink size={10} />
          </a>
        </div>
      )}

      {/* Feature Flags */}
      {flagsConfigured && (
        <div className="stamp-card overflow-hidden">
          <div className="px-5 py-3 bg-dark text-cream flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Flag size={14} strokeWidth={2.5} />
              <h3 className="font-display font-black text-[14px] uppercase tracking-wider">Feature flags · {flags.length}</h3>
            </div>
            {posthogUrl && (
              <a href={`${posthogUrl}/feature_flags`} target="_blank" rel="noopener noreferrer"
                className="text-[10px] text-cream/60 hover:text-cream font-display font-bold uppercase flex items-center gap-1">
                PostHog <ExternalLink size={10} />
              </a>
            )}
          </div>
          <FlagsClient flags={flags} />
        </div>
      )}

      {/* LLM Observability */}
      {llm?.configured && llm.summary && (
        <div className="stamp-card overflow-hidden">
          <div className="px-5 py-3 bg-dark text-cream">
            <div className="flex items-center gap-2">
              <Cpu size={14} strokeWidth={2.5} />
              <h3 className="font-display font-black text-[14px] uppercase tracking-wider">LLM Observability · 7d</h3>
            </div>
          </div>
          <div className="p-5 grid grid-cols-2 md:grid-cols-5 gap-3">
            <Kpi label="Calls" value={llm.summary.calls.toLocaleString()} />
            <Kpi label="Tokens" value={llm.summary.total_tokens.toLocaleString()} />
            <Kpi label="Costo USD" value={`$${llm.summary.total_cost_usd.toFixed(2)}`} tone="orange" />
            <Kpi label="Latencia avg" value={`${llm.summary.avg_latency_s.toFixed(2)}s`} />
            <Kpi label="Errores" value={llm.summary.errors.toLocaleString()} tone={llm.summary.errors > 0 ? "primary" : "secondary"} />
          </div>
          {llm.by_model && llm.by_model.length > 0 && (
            <table className="w-full text-[11px]">
              <thead>
                <tr className="bg-cream-2 text-[10px] uppercase tracking-[0.12em]" style={{ borderTop: "1.5px solid var(--border)" }}>
                  <th className="px-3 py-2 text-left font-display font-bold text-ink-2">Modelo</th>
                  <th className="px-3 py-2 text-right font-display font-bold text-ink-2">Calls</th>
                  <th className="px-3 py-2 text-right font-display font-bold text-ink-2">Input tokens</th>
                  <th className="px-3 py-2 text-right font-display font-bold text-ink-2">Output tokens</th>
                  <th className="px-3 py-2 text-right font-display font-bold text-ink-2">Costo USD</th>
                </tr>
              </thead>
              <tbody>
                {llm.by_model.map((m) => (
                  <tr key={m.model} className="row-zebra border-b border-warm-200/50 last:border-b-0">
                    <td className="px-3 py-2 font-mono text-ink">{m.model}</td>
                    <td className="px-3 py-2 text-right num">{m.calls.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right num text-ink-3">{m.input_tokens.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right num text-ink-3">{m.output_tokens.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right font-display font-bold num text-orange">${m.cost_usd.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Errors */}
      {errorsList.length > 0 && (
        <div className="stamp-card overflow-hidden">
          <div className="px-5 py-3 bg-primary/10">
            <div className="flex items-center gap-2">
              <AlertTriangle size={14} className="text-primary" strokeWidth={2.5} />
              <h3 className="font-display font-black text-[14px] uppercase tracking-wider text-primary">Errores recientes · 7d</h3>
              <span className="text-[10px] font-mono text-primary">· {errorsList.length}</span>
            </div>
          </div>
          <ul className="divide-y divide-warm-200/50 max-h-96 overflow-y-auto">
            {errorsList.slice(0, 20).map((err) => (
              <li key={err.fingerprint} className="p-3 hover:bg-primary/5">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-[10px] font-mono text-primary uppercase">{err.type}</span>
                  <span className="font-display font-bold text-[12px] text-ink truncate flex-1">{err.message}</span>
                  <span className="text-[10px] font-mono num text-ink-3">{err.count}× / {err.affected_users} usuarios</span>
                </div>
                <div className="text-[10px] font-mono text-ink-3 mt-0.5">
                  Primera: {fmtRelative(err.first_seen)} · última: {fmtRelative(err.last_seen)}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {data && data.llm_error && !llm?.configured && (
        <div className="stamp-card p-3 bg-orange/5 text-[11px] font-mono text-ink-3" style={{ borderColor: "#FF3B27" }}>
          ⚠ LLM observability falló: {data.llm_error}
        </div>
      )}
    </>
  )
}

function ClarityCard({ label, icon, href, description, tone }: {
  label: string
  icon: React.ReactNode
  href: string
  description: string
  tone?: "orange" | "secondary"
}) {
  const bg = tone === "orange" ? "bg-orange" : tone === "secondary" ? "bg-secondary" : "bg-dark"
  const fg = tone === "orange" ? "text-dark" : "text-cream"
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
      className="stamp-card p-4 hover:bg-orange/5 transition-colors flex items-start gap-3 group">
      <div className={`w-10 h-10 ${bg} ${fg} flex items-center justify-center flex-shrink-0`}
        style={{ border: "1.5px solid #1A1A1A" }}>
        {icon}
      </div>
      <div className="flex-1">
        <div className="font-display font-bold text-[13px] text-ink group-hover:text-orange flex items-center gap-1">
          {label} <ExternalLink size={11} />
        </div>
        <p className="text-[11px] text-ink-3 mt-1">{description}</p>
      </div>
    </a>
  )
}

function Kpi({ label, value, sub, icon, tone }: { label: string; value: string; sub?: string; icon?: React.ReactNode; tone?: "primary" | "secondary" | "orange" }) {
  const bg = tone === "primary" ? "bg-primary/5" : tone === "secondary" ? "bg-secondary/5" : tone === "orange" ? "bg-orange/5" : ""
  const labelTone = tone === "primary" ? "text-primary" : tone === "secondary" ? "text-secondary" : tone === "orange" ? "text-orange" : "text-ink-3"
  const valueTone = tone === "primary" ? "text-primary" : tone === "secondary" ? "text-secondary" : tone === "orange" ? "text-orange" : ""
  return (
    <div className={`stamp-card p-3 ${bg}`}>
      <div className="flex items-center gap-1.5 mb-1">{icon}<div className={`text-[9px] font-display font-bold uppercase tracking-[0.18em] ${labelTone}`}>{label}</div></div>
      <div className={`stat-display text-[18px] mt-0.5 num ${valueTone}`}>{value}</div>
      {sub && <div className="text-[9px] mt-0.5 text-ink-3 font-mono">{sub}</div>}
    </div>
  )
}
