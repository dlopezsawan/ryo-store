"use client"

import { useEffect, useState } from "react"
import {
  AlertCircle, Users, TrendingUp, ShoppingCart, RefreshCw, Loader2,
} from "lucide-react"
import { fmtEur } from "@/lib/utils"
import type { RemarketingPatternsSummary } from "@/lib/medusa"

export function PatternsClient() {
  const [data, setData] = useState<RemarketingPatternsSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [loadingForce, setLoadingForce] = useState(false)
  const [startedAt, setStartedAt] = useState<Date | null>(null)
  const [elapsed, setElapsed] = useState(0)

  // Live elapsed timer mientras carga
  useEffect(() => {
    if (!startedAt || (!loading && !loadingForce)) return
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt.getTime()) / 1000)), 250)
    return () => clearInterval(t)
  }, [startedAt, loading, loadingForce])

  function load(force = false) {
    setStartedAt(new Date())
    setElapsed(0)
    if (force) setLoadingForce(true)
    else setLoading(true)
    setError(null)

    fetch(`/api/marketing/patterns${force ? "?force=1" : ""}`, { cache: "no-store" })
      .then(async (r) => {
        const j = await r.json()
        if (!j.ok) throw new Error(j.error ?? "error")
        setData(j.data)
      })
      .catch((e) => setError(e instanceof Error ? e.message : "fetch error"))
      .finally(() => {
        setLoading(false)
        setLoadingForce(false)
      })
  }

  useEffect(() => {
    load(false)
  }, [])

  if (loading) {
    return (
      <div className="stamp-card p-10 text-center">
        <Loader2 size={48} className="text-orange mx-auto mb-3 animate-spin" strokeWidth={1.5} />
        <p className="font-display font-bold text-[14px] uppercase tracking-wider text-orange">Computando patrones…</p>
        <p className="text-[12px] text-ink-3 mt-1 font-mono">
          El backend agrega datos de toda la base · esperá hasta 1 min · transcurridos: <span className="text-orange font-bold">{elapsed}s</span>
        </p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="stamp-card p-4 bg-primary/5" style={{ borderColor: "#BB3B2E" }}>
        <div className="flex items-start gap-2">
          <AlertCircle size={14} className="text-primary flex-shrink-0 mt-0.5" strokeWidth={2.5} />
          <div className="flex-1">
            <p className="text-[13px] font-medium text-primary">{error}</p>
            <button onClick={() => load(false)}
              className="mt-2 px-3 py-1.5 bg-orange text-dark rounded-md text-[10px] font-display font-bold uppercase tracking-wider hover:opacity-90"
              style={{ border: "1.5px solid #1A1A1A" }}>
              <RefreshCw size={10} strokeWidth={2.5} className="inline mr-1" /> Reintentar
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="stamp-card p-10 text-center">
        <Users size={48} className="text-ink-3 mx-auto mb-3" strokeWidth={1.5} />
        <p className="font-display font-bold text-[14px] uppercase tracking-wider text-ink-3">Sin datos de patrones</p>
      </div>
    )
  }

  return (
    <>
      {/* Refresh button */}
      <div className="flex items-center gap-2 justify-end">
        <span className="text-[10px] font-mono text-ink-3">
          {data.total_users != null && `${data.total_users.toLocaleString()} usuarios analizados`}
        </span>
        <button onClick={() => load(true)} disabled={loadingForce}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-cream rounded-md text-[10px] font-display font-bold uppercase tracking-wider hover:bg-cream-2 disabled:opacity-50"
          style={{ border: "1.5px solid var(--border)" }}>
          <RefreshCw size={11} strokeWidth={2.5} className={loadingForce ? "animate-spin" : ""} />
          {loadingForce ? `Recomputando… ${elapsed}s` : "Recomputar (force)"}
        </button>
      </div>

      {/* Funnel global */}
      {data.funnel_global && (
        <div className="stamp-card overflow-hidden">
          <div className="px-5 py-3 bg-dark text-cream">
            <div className="flex items-center gap-2">
              <TrendingUp size={14} strokeWidth={2.5} />
              <h3 className="font-display font-black text-[14px] uppercase tracking-wider">Funnel global</h3>
            </div>
          </div>
          <div className="p-5 grid grid-cols-1 md:grid-cols-4 gap-3">
            <FunnelStep label="Sessions" value={data.funnel_global.sessions} />
            <FunnelStep label="Carritos creados" value={data.funnel_global.carts}
              rate={data.funnel_global.sessions > 0 ? (data.funnel_global.carts / data.funnel_global.sessions) * 100 : 0} />
            <FunnelStep label="Checkouts iniciados" value={data.funnel_global.checkouts}
              rate={data.funnel_global.carts > 0 ? (data.funnel_global.checkouts / data.funnel_global.carts) * 100 : 0} />
            <FunnelStep label="Pedidos completados" value={data.funnel_global.orders}
              rate={data.funnel_global.checkouts > 0 ? (data.funnel_global.orders / data.funnel_global.checkouts) * 100 : 0} tone="secondary" />
          </div>
        </div>
      )}

      {/* Buying segments */}
      {data.buying_segments && data.buying_segments.length > 0 && (
        <div className="stamp-card overflow-hidden">
          <div className="px-5 py-3 bg-dark text-cream">
            <h3 className="font-display font-black text-[14px] uppercase tracking-wider">Segmentos por comportamiento</h3>
          </div>
          <ul className="divide-y divide-warm-200/50">
            {data.buying_segments.map((seg) => (
              <li key={seg.segment} className="p-3 flex items-center gap-3">
                <div className="flex-1">
                  <div className="font-display font-bold text-[13px] text-ink uppercase">{seg.segment}</div>
                  <div className="text-[10px] text-ink-3 font-mono">{seg.count.toLocaleString()} usuarios · {seg.pct.toFixed(1)}%</div>
                </div>
                {seg.ltv_avg != null && (
                  <div className="text-right">
                    <div className="text-[10px] font-display font-bold uppercase tracking-wider text-ink-3">LTV avg</div>
                    <div className="font-display font-black num text-[14px]">{fmtEur(seg.ltv_avg)}</div>
                  </div>
                )}
                <div className="w-32">
                  <div className="w-full h-2 bg-cream-2 rounded-md overflow-hidden">
                    <div className="h-full bg-orange transition-all" style={{ width: `${Math.min(100, seg.pct)}%` }} />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Top repeat products */}
      {data.top_repeat_products && data.top_repeat_products.length > 0 && (
        <div className="stamp-card overflow-hidden">
          <div className="px-5 py-3 bg-dark text-cream">
            <div className="flex items-center gap-2">
              <ShoppingCart size={14} strokeWidth={2.5} />
              <h3 className="font-display font-black text-[14px] uppercase tracking-wider">Productos con más repetición</h3>
            </div>
          </div>
          <table className="w-full text-[12px]">
            <thead>
              <tr className="bg-cream-2 text-[10px] uppercase tracking-[0.12em]" style={{ borderBottom: "1.5px solid var(--border)" }}>
                <th className="px-3 py-2 text-left font-display font-bold text-ink-2">Producto</th>
                <th className="px-3 py-2 text-right font-display font-bold text-ink-2">Tasa repetición</th>
                <th className="px-3 py-2 text-right font-display font-bold text-ink-2">Días entre compras</th>
              </tr>
            </thead>
            <tbody>
              {data.top_repeat_products.map((p) => (
                <tr key={p.product_id} className="row-zebra border-b border-warm-200/50 last:border-b-0">
                  <td className="px-3 py-2 font-display font-bold text-ink truncate">{p.title}</td>
                  <td className="px-3 py-2 text-right num font-display font-bold text-orange">{(p.repeat_rate * 100).toFixed(1)}%</td>
                  <td className="px-3 py-2 text-right num text-ink-2">{p.median_days_between} días</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Cross-sell strength */}
      {data.cross_sell_strength && data.cross_sell_strength.length > 0 && (
        <div className="stamp-card overflow-hidden">
          <div className="px-5 py-3 bg-dark text-cream">
            <h3 className="font-display font-black text-[14px] uppercase tracking-wider">Cross-sell · pares más fuertes</h3>
          </div>
          <table className="w-full text-[12px]">
            <thead>
              <tr className="bg-cream-2 text-[10px] uppercase tracking-[0.12em]" style={{ borderBottom: "1.5px solid var(--border)" }}>
                <th className="px-3 py-2 text-left font-display font-bold text-ink-2">Anchor</th>
                <th className="px-3 py-2 text-left font-display font-bold text-ink-2">Partner</th>
                <th className="px-3 py-2 text-right font-display font-bold text-ink-2">Attach %</th>
              </tr>
            </thead>
            <tbody>
              {data.cross_sell_strength.map((c, i) => (
                <tr key={i} className="row-zebra border-b border-warm-200/50 last:border-b-0">
                  <td className="px-3 py-2 font-display font-bold text-ink truncate">{c.anchor}</td>
                  <td className="px-3 py-2 text-ink-2 truncate">{c.partner}</td>
                  <td className="px-3 py-2 text-right font-display font-black num text-orange">{c.attach_pct.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

function FunnelStep({ label, value, rate, tone }: { label: string; value: number; rate?: number; tone?: "secondary" }) {
  return (
    <div className={`p-3 rounded-md ${tone === "secondary" ? "bg-secondary/10" : "bg-cream-2/40"}`}
      style={{ border: `1.5px solid ${tone === "secondary" ? "#4D5431" : "var(--border-soft)"}` }}>
      <div className="text-[9px] font-display font-bold uppercase tracking-wider text-ink-3">{label}</div>
      <div className="font-display font-black num text-[18px] mt-1">{value.toLocaleString()}</div>
      {rate != null && (
        <div className={`text-[10px] font-mono mt-1 ${rate >= 50 ? "text-secondary" : rate >= 20 ? "text-orange" : "text-primary"}`}>
          {rate.toFixed(1)}% del paso anterior
        </div>
      )}
    </div>
  )
}
