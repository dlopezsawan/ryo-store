"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { AlertTriangle, X, RotateCcw } from "lucide-react"
import type { Anomaly } from "./_lib"

const STORAGE_KEY = "panel_finanzas_dismissed_alerts"

/**
 * Genera una clave estable para cada anomalía. Como las anomalías se
 * recalculan en cada render server-side, necesitamos un id determinístico
 * basado en el contenido (kind + month + delta_pct redondeado).
 */
function alertKey(a: Anomaly): string {
  return `${a.kind}|${a.current_month ?? "current"}|${a.severity}|${Math.round(a.delta_pct ?? 0)}`
}

export function DismissibleAlerts({ anomalies }: { anomalies: Anomaly[] }) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) setDismissed(new Set(JSON.parse(raw)))
    } catch { /* ignore */ }
    setHydrated(true)
  }, [])

  function persist(next: Set<string>) {
    setDismissed(next)
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(next))) } catch { /* ignore */ }
  }

  function dismiss(key: string) {
    const next = new Set(dismissed)
    next.add(key)
    persist(next)
  }

  function dismissAll() {
    const next = new Set(dismissed)
    for (const a of anomalies) next.add(alertKey(a))
    persist(next)
  }

  function resetDismissed() {
    persist(new Set())
  }

  if (!hydrated) return null  // evitar flash en SSR

  // Filtrar dismissed
  const visible = anomalies.filter((a) => !dismissed.has(alertKey(a)))

  // Si todo dismissado pero hay alertas, mostrar pequeño hint para resetearlos
  if (visible.length === 0 && anomalies.length > 0) {
    return (
      <div className="flex items-center justify-end gap-2 text-[10px] font-mono text-ink-3">
        <span>{anomalies.length} alerta{anomalies.length === 1 ? "" : "s"} ocultada{anomalies.length === 1 ? "" : "s"}</span>
        <button onClick={resetDismissed}
          className="flex items-center gap-1 text-orange hover:underline">
          <RotateCcw size={10} strokeWidth={2.5} /> Mostrar de nuevo
        </button>
      </div>
    )
  }

  if (visible.length === 0) return null

  return (
    <div className="space-y-2">
      {visible.map((a) => {
        const key = alertKey(a)
        return (
          <div key={key}
            className="stamp-card p-3 bg-primary/5 flex items-center gap-2 group"
            style={{ borderColor: "#BB3B2E" }}>
            <AlertTriangle size={14} className="text-primary flex-shrink-0" strokeWidth={2.5} />
            <Link href="/finanzas/anomalies" className="flex-1 min-w-0 hover:opacity-80">
              <span className="text-[12px] font-display font-bold uppercase tracking-wider text-primary">
                {a.title}
              </span>
              <span className="text-[11px] text-ink-3 ml-2">— {a.detail}</span>
            </Link>
            <Link href="/finanzas/anomalies" className="text-[10px] text-primary font-display font-bold uppercase whitespace-nowrap">
              Ver todas →
            </Link>
            <button onClick={() => dismiss(key)}
              className="text-ink-3 hover:text-primary p-1 flex-shrink-0"
              title="Marcar como leída">
              <X size={12} strokeWidth={2.5} />
            </button>
          </div>
        )
      })}
      {visible.length > 1 && (
        <button onClick={dismissAll}
          className="text-[10px] font-mono text-ink-3 hover:text-orange flex items-center gap-1 ml-auto">
          <X size={10} strokeWidth={2.5} /> Marcar todas como leídas
        </button>
      )}
    </div>
  )
}
