"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Radio } from "lucide-react"
import { fmtEur } from "@/lib/utils"

interface Kpis {
  today: { revenue: number; count: number; aov: number; currency: string }
  last_hour: { count: number }
  pending: { count: number }
  to_fulfill: { count: number }
}

const POLL_MS = 30_000  // 30s

/**
 * Mini KPIs en vivo en el topbar:
 *  - Revenue de hoy
 *  - # pedidos hoy
 *  - Última hora (badge si hay nuevos)
 *
 * Click en el bloque → /orders/live
 */
export function TopBarLiveKpis() {
  const [kpis, setKpis] = useState<Kpis | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let mounted = true
    async function tick() {
      try {
        const res = await fetch("/api/orders/live", { cache: "no-store" })
        const data = await res.json() as { ok: boolean; kpis?: Kpis }
        if (!mounted) return
        if (data.ok && data.kpis) {
          setKpis(data.kpis)
          setError(false)
        } else {
          setError(true)
        }
      } catch {
        if (mounted) setError(true)
      }
    }
    tick()
    const t = setInterval(tick, POLL_MS)
    return () => { mounted = false; clearInterval(t) }
  }, [])

  if (error || !kpis) {
    return null
  }

  const hasNew = kpis.last_hour.count > 0

  return (
    <Link href="/orders/live"
      className="hidden lg:flex items-center gap-3 px-3 py-1 rounded-md hover:bg-cream-2 transition-colors group"
      title="Ver feed live de pedidos"
      style={{ border: "1.5px solid var(--border-soft)" }}>
      <span className="flex items-center gap-1 text-[9px] font-display font-bold uppercase tracking-wider text-secondary">
        <Radio size={9} strokeWidth={2.5} className={hasNew ? "animate-pulse" : ""} /> HOY
      </span>
      <div className="flex items-baseline gap-2 text-[12px] font-mono">
        <span className="font-display font-black text-ink num">{fmtEur(kpis.today.revenue)}</span>
        <span className="text-ink-3 num">·</span>
        <span className="text-ink-3 num">{kpis.today.count} ped.</span>
      </div>
      {hasNew && (
        <span className="px-1.5 py-0.5 text-[9px] font-display font-bold uppercase tracking-wider bg-orange text-dark rounded-md animate-pulse">
          +{kpis.last_hour.count} 1h
        </span>
      )}
      {kpis.to_fulfill.count > 0 && (
        <span className="px-1.5 py-0.5 text-[9px] font-display font-bold uppercase tracking-wider bg-primary/10 text-primary rounded-md">
          {kpis.to_fulfill.count} prep.
        </span>
      )}
    </Link>
  )
}
