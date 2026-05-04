import { Package, TrendingUp, Megaphone, Coins } from "lucide-react"
import { fmtEur } from "@/lib/utils"
import type { FinanzasSummary } from "@/lib/medusa"

const BUCKETS: Array<{
  key: keyof FinanzasSummary["splits"]
  label: string
  description: string
  color: string
  bg: string
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string; style?: React.CSSProperties }>
}> = [
  { key: "restock",      label: "Stock / Restock",   description: "Reposición de inventario", color: "#FF3B27", bg: "bg-orange/10",    icon: Package },
  { key: "gastos_fijos", label: "Gastos fijos",      description: "Operativo, SaaS, sueldos", color: "#BB3B2E", bg: "bg-primary/10",   icon: Coins },
  { key: "marketing",    label: "Marketing / Ads",   description: "Ads, campañas, creators",  color: "#D4A015", bg: "bg-orange/5",     icon: Megaphone },
  { key: "ganancia",     label: "Ganancia (utilidad)", description: "Después de todos los splits", color: "#4D5431", bg: "bg-secondary/10", icon: TrendingUp },
]

/**
 * Renderiza el desglose de hacia dónde va cada parte del dinero acumulado en
 * el mes según los splits del backend (revenue ya distribuido por bucket).
 *
 * Cada split tiene:
 *  - eur:        cantidad asignada en EUR (revenue × % bucket)
 *  - usdt:       cantidad equivalente en USDT al momento del split
 *  - spent_usdt: cantidad ya GASTADA de ese bucket (lo que salió de la caja)
 *
 * Restante = usdt - spent_usdt → es lo que aún queda en la wallet asignada
 * a ese bucket.
 */
export function SplitsBreakdown({ summary }: { summary: FinanzasSummary }) {
  const totalUsdt = BUCKETS.reduce((s, b) => s + (summary.splits[b.key]?.usdt ?? 0), 0)
  const totalEur = BUCKETS.reduce((s, b) => s + (summary.splits[b.key]?.eur ?? 0), 0)
  const totalSpent = BUCKETS.reduce((s, b) => s + (summary.splits[b.key]?.spent_usdt ?? 0), 0)
  const totalRemaining = totalUsdt - totalSpent

  // Format the month being shown (summary.month is "YYYY-MM")
  const monthLabel = (() => {
    const [y, m] = summary.month.split("-").map(Number)
    if (!y || !m) return summary.month
    return new Date(y, m - 1, 1).toLocaleDateString("es-VE", { month: "long", year: "numeric" }).toUpperCase()
  })()

  // Si el mes está vacío, mostrar mensaje claro
  if (totalUsdt === 0 && summary.totals.orders === 0) {
    return (
      <div className="stamp-card p-6 text-center bg-cream-2/30">
        <h3 className="font-display font-black text-[14px] uppercase tracking-tight text-ink-3 mb-1">
          Desglose · {monthLabel}
        </h3>
        <p className="text-[12px] text-ink-3">
          Sin pedidos en este mes. Cambia el mes en el selector arriba para ver datos de períodos con ventas.
        </p>
      </div>
    )
  }

  return (
    <div className="stamp-card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 bg-dark text-cream">
        <div className="flex items-center gap-2">
          <Coins size={14} strokeWidth={2.5} />
          <h3 className="font-display font-black text-[14px] uppercase tracking-wider">Desglose · {monthLabel}</h3>
        </div>
        <div className="text-[10px] font-mono text-cream/60">
          €{totalEur.toFixed(2)} · ${totalUsdt.toFixed(2)} repartidos · {summary.totals.orders} ped.
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-px bg-warm-200">
        {BUCKETS.map((b) => {
          const split = summary.splits[b.key] ?? { eur: 0, usdt: 0, spent_usdt: 0 }
          const eur = split.eur ?? 0
          const usdt = split.usdt ?? 0
          const spent = split.spent_usdt ?? 0
          const remaining = usdt - spent
          const pctSpent = usdt > 0 ? Math.min(100, (spent / usdt) * 100) : 0
          const pctOfTotal = totalUsdt > 0 ? (usdt / totalUsdt) * 100 : 0
          const Icon = b.icon
          return (
            <div key={b.key} className={`p-4 ${b.bg} bg-page`}>
              <div className="flex items-center gap-2 mb-2">
                <Icon size={14} className="flex-shrink-0" style={{ color: b.color }} strokeWidth={2.5} />
                <h4 className="font-display font-black text-[12px] uppercase tracking-tight" style={{ color: b.color }}>
                  {b.label}
                </h4>
                <span className="ml-auto text-[10px] font-mono text-ink-3">{pctOfTotal.toFixed(0)}%</span>
              </div>
              <p className="text-[10px] font-mono text-ink-3 mb-3 line-clamp-1">{b.description}</p>

              <div className="space-y-1.5">
                <div className="flex items-baseline justify-between text-[11px]">
                  <span className="text-ink-3 font-mono">Asignado</span>
                  <span className="font-display font-black num text-[14px]" style={{ color: b.color }}>
                    {fmtEur(eur)}
                  </span>
                </div>
                <div className="flex items-baseline justify-between text-[11px]">
                  <span className="text-ink-3 font-mono">≈ USDT</span>
                  <span className="font-display font-bold num">${usdt.toFixed(2)}</span>
                </div>
                {b.key !== "ganancia" && (
                  <>
                    <div className="flex items-baseline justify-between text-[11px]">
                      <span className="text-ink-3 font-mono">Gastado</span>
                      <span className="font-display font-bold num text-primary">−${spent.toFixed(2)}</span>
                    </div>
                    <div className="flex items-baseline justify-between text-[11px] pt-1" style={{ borderTop: "1px dashed var(--border)" }}>
                      <span className="text-ink-3 font-mono font-bold">Restante</span>
                      <span className={`font-display font-black num ${remaining < 0 ? "text-primary" : "text-secondary"}`}>
                        ${remaining.toFixed(2)}
                      </span>
                    </div>
                    {/* Progress bar de gasto */}
                    <div className="mt-2">
                      <div className="w-full h-1.5 bg-cream-2 rounded-md overflow-hidden">
                        <div className="h-full transition-all"
                          style={{
                            width: `${pctSpent}%`,
                            background: pctSpent > 90 ? "#BB3B2E" : pctSpent > 70 ? "#FF3B27" : b.color,
                          }} />
                      </div>
                      <div className="text-[9px] font-mono text-ink-3 mt-0.5 text-right">
                        {pctSpent.toFixed(0)}% gastado del bucket
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Bottom summary */}
      <div className="px-5 py-3 bg-cream-2/40 grid grid-cols-3 gap-4 text-[11px]" style={{ borderTop: "1.5px solid var(--border)" }}>
        <div className="flex items-baseline justify-between">
          <span className="text-ink-3 font-mono">Total revenue mes</span>
          <span className="font-display font-bold num">${totalUsdt.toFixed(2)}</span>
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-ink-3 font-mono">Gastado del mes</span>
          <span className="font-display font-bold num text-primary">−${totalSpent.toFixed(2)}</span>
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-ink-3 font-mono font-bold">Disponible aún</span>
          <span className={`font-display font-black num text-[13px] ${totalRemaining < 0 ? "text-primary" : "text-secondary"}`}>
            ${totalRemaining.toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  )
}
