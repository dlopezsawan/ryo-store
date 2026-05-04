import Link from "next/link"
import { Star, Wallet, Settings, AlertTriangle } from "lucide-react"
import type { FinanzasWalletBalance } from "@/lib/medusa"

const TYPE_META: Record<string, { label: string; color: string; bg: string }> = {
  usdt: { label: "USDT", color: "#4D5431", bg: "bg-secondary/10" },
  bs:   { label: "Bs",   color: "#FF3B27", bg: "bg-orange/10" },
  usd:  { label: "USD",  color: "#9C9285", bg: "bg-cream-2" },
  eur:  { label: "EUR",  color: "#1A1A1A", bg: "bg-cream-2" },
}

/** Server-side rendering: recibe balances reales del backend.  */
export function WalletsBreakdown({ balances, error, fallbackUsdt, fallbackBurnLabel }: {
  balances: FinanzasWalletBalance[]
  error?: string
  fallbackUsdt: number
  fallbackBurnLabel: string
}) {
  if (error) {
    return (
      <div className="p-4 bg-primary/5" style={{ border: "1.5px solid #BB3B2E", borderRadius: 3 }}>
        <div className="flex items-center gap-1.5 mb-2">
          <AlertTriangle size={12} className="text-primary" strokeWidth={2.5} />
          <div className="text-[9px] font-display font-bold uppercase tracking-[0.18em] text-primary">Error wallets</div>
        </div>
        <p className="text-[11px] font-mono text-ink-3">{error}</p>
        <div className="mt-2 stat-display text-[20px] num text-secondary">${fallbackUsdt.toFixed(2)}</div>
        <div className="text-[10px] text-ink-3 font-mono">{fallbackBurnLabel} · runway endpoint fallback</div>
      </div>
    )
  }

  if (!balances || balances.length === 0) {
    return (
      <div className="p-4 bg-secondary/5" style={{ border: "1.5px solid #4D5431", borderRadius: 3 }}>
        <div className="flex items-center justify-between mb-2">
          <div className="text-[9px] font-display font-bold uppercase tracking-[0.18em] text-secondary">Sin wallets configurados</div>
          <Link href="/finanzas/settings"
            className="text-[9px] font-display font-bold uppercase tracking-wider text-orange hover:underline flex items-center gap-1">
            <Settings size={9} strokeWidth={2.5} /> Configurar
          </Link>
        </div>
        <div className="stat-display text-[26px] num text-secondary">${fallbackUsdt.toFixed(2)}</div>
        <div className="text-[10px] text-ink-3 font-mono mt-1">{fallbackBurnLabel}</div>
      </div>
    )
  }

  // Sumar USD-equivalente (USDT + USD), Bs aparte
  const usdEquiv = balances
    .filter((w) => w.currency === "usdt" || w.currency === "usd")
    .reduce((s, w) => s + w.balance, 0)
  const bsTotal = balances
    .filter((w) => w.currency === "bs")
    .reduce((s, w) => s + w.balance, 0)
  const eurTotal = balances
    .filter((w) => w.currency === "eur")
    .reduce((s, w) => s + w.balance, 0)

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wallet size={12} className="text-secondary" strokeWidth={2.5} />
          <span className="text-[10px] font-display font-bold uppercase tracking-[0.18em] text-secondary">
            Tesorería · {balances.length} wallet{balances.length === 1 ? "" : "s"}
          </span>
        </div>
        <Link href="/finanzas/settings"
          className="text-[9px] font-display font-bold uppercase tracking-wider text-ink-3 hover:text-orange flex items-center gap-1">
          <Settings size={9} strokeWidth={2.5} /> Editar
        </Link>
      </div>

      {/* Total combinado */}
      <div className="p-3 bg-secondary/5" style={{ border: "1.5px solid #4D5431", borderRadius: 3 }}>
        <div className="flex items-baseline justify-between">
          <span className="text-[10px] font-mono text-ink-3">USD-equivalente</span>
          <span className="stat-display text-[22px] num text-secondary">${usdEquiv.toFixed(2)}</span>
        </div>
        {bsTotal > 0 && (
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-[10px] font-mono text-orange">Bolívares</span>
            <span className="font-display font-bold num text-orange">Bs {bsTotal.toLocaleString("es-VE", { maximumFractionDigits: 0 })}</span>
          </div>
        )}
        {eurTotal > 0 && (
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-[10px] font-mono text-ink-3">Euros</span>
            <span className="font-display font-bold num text-ink">€ {eurTotal.toFixed(2)}</span>
          </div>
        )}
        <div className="text-[10px] text-ink-3 font-mono mt-1">{fallbackBurnLabel}</div>
      </div>

      {/* Lista compacta de wallets */}
      <ul className="space-y-1">
        {balances.map((w) => {
          const tm = TYPE_META[w.currency] ?? { label: w.currency.toUpperCase(), color: "#9C9285", bg: "bg-cream-2" }
          return (
            <li key={w.id} className={`flex items-center gap-2 px-2 py-1.5 ${tm.bg} rounded-md`} style={{ border: `1px solid ${tm.color}33` }}>
              <span className="px-1.5 py-0.5 text-[8px] font-display font-bold uppercase tracking-wider text-white rounded-md flex-shrink-0"
                style={{ background: tm.color }}>
                {tm.label}
              </span>
              <span className="flex-1 min-w-0 text-[11px] font-display font-bold text-ink truncate">
                {w.name}
              </span>
              <span className="font-display font-black num text-[12px] flex-shrink-0">
                {w.currency === "bs"
                  ? `Bs ${w.balance.toLocaleString("es-VE", { maximumFractionDigits: 0 })}`
                  : w.currency === "eur"
                  ? `€ ${w.balance.toFixed(2)}`
                  : `$${w.balance.toFixed(2)}`}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
