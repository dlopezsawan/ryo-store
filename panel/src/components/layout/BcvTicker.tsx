"use client"

import { useEffect, useState } from "react"

interface BcvData {
  rate_usd_ves: number
  rate_eur_ves: number
  rate_usd_ves_paralelo?: number
  last_update: string
  source: string
  stale?: boolean
}

const REFRESH_MS = 5 * 60 * 1000  // 5 min

/** Reemplaza el ticker estático del sidebar. Polls /api/finanzas/bcv. */
export function BcvTicker({ compact = false }: { compact?: boolean }) {
  const [data, setData] = useState<BcvData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    async function fetchBcv() {
      try {
        const res = await fetch("/api/finanzas/bcv", { cache: "no-store" })
        const json = await res.json() as { ok: boolean } & BcvData & { error?: string }
        if (!mounted) return
        if (json.ok) {
          setData({
            rate_usd_ves: json.rate_usd_ves,
            rate_eur_ves: json.rate_eur_ves,
            rate_usd_ves_paralelo: (json as BcvData).rate_usd_ves_paralelo,
            last_update: json.last_update,
            source: json.source,
            stale: (json as BcvData).stale,
          })
          setError(null)
        } else {
          setError(json.error ?? "error")
        }
      } catch (e) {
        if (mounted) setError(e instanceof Error ? e.message : "error")
      } finally {
        if (mounted) setLoading(false)
      }
    }
    fetchBcv()
    const t = setInterval(fetchBcv, REFRESH_MS)
    return () => { mounted = false; clearInterval(t) }
  }, [])

  if (compact) {
    return (
      <span className="text-[10px] font-mono num">
        {loading ? "…" : data ? `${data.rate_usd_ves.toFixed(2)}` : "—"}
      </span>
    )
  }

  return (
    <div title={data ? `${data.source} · actualizado ${data.last_update}` : (error ?? "cargando")}>
      <div className="flex items-center justify-between text-[10px] font-mono px-2">
        <span className="text-orange font-bold">BCV $</span>
        <span className="num" style={{ color: "rgb(var(--sidebar-text))" }}>
          {loading ? "…" : data ? data.rate_usd_ves.toFixed(2) : "—"}
        </span>
        <span className={error ? "text-primary" : data?.stale ? "text-orange" : "text-secondary"}>
          {error ? "ERR" : data?.stale ? "STALE" : "LIVE"}
        </span>
      </div>
      {data && data.rate_eur_ves > 0 && (
        <div className="flex items-center justify-between text-[9px] font-mono px-2 mt-0.5 opacity-70">
          <span className="text-orange/80 font-bold">€</span>
          <span className="num" style={{ color: "rgb(var(--sidebar-text-soft))" }}>
            {data.rate_eur_ves.toFixed(2)}
          </span>
          <span />
        </div>
      )}
    </div>
  )
}
