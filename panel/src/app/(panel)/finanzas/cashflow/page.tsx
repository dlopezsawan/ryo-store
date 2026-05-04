import Link from "next/link"
import { ArrowLeft, ArrowDown, ArrowUp, AlertTriangle } from "lucide-react"
import { PageHeader, PageWatermark } from "@/components/layout/PageHeader"
import { FinanzasNav } from "../FinanzasNav"
import { listPagoMovil, listFinanzasExpenses, listFinanzasConversions, MedusaError } from "@/lib/medusa"
import { weeklyFlow, gatewayBreakdown, type WeeklyFlow } from "../_lib"
import { fmtEur } from "@/lib/utils"

export default async function CashflowPage() {
  const [pmR, expR, convR] = await Promise.allSettled([
    listPagoMovil({ limit: 1000 }),
    listFinanzasExpenses({ limit: 500 }),
    listFinanzasConversions({ limit: 200 }),
  ])

  let errorMsg: string | null = null
  const pagoMovils = pmR.status === "fulfilled" ? pmR.value.pago_movils : []
  const expenses = expR.status === "fulfilled" ? expR.value.expenses : []
  const conversions = convR.status === "fulfilled" ? convR.value.conversions : []
  if ([pmR, expR, convR].some((r) => r.status === "rejected" && r.reason instanceof MedusaError && r.reason.status === 401)) {
    errorMsg = "Sesión expirada. Recarga la página."
  }

  const weeks = weeklyFlow(pagoMovils, expenses, 12)
  const totalIn = weeks.reduce((s, w) => s + w.in_eur, 0)
  const totalOut = weeks.reduce((s, w) => s + w.out_eur, 0)
  const totalNet = totalIn - totalOut

  // Gateway breakdown
  const gateways = gatewayBreakdown(pagoMovils, conversions)

  // Reconciliación de Bs
  const totalBs = pagoMovils.reduce((s, p) => s + (Number(p.amount_bs_total) || 0), 0)
  const totalBsConverted = pagoMovils.reduce((s, p) => s + (Number(p.bs_converted_total) || 0), 0)
  const totalBsPending = pagoMovils.reduce((s, p) => s + (Number(p.bs_pending) || 0), 0)
  const conversionPct = totalBs > 0 ? (totalBsConverted / totalBs) * 100 : 0

  // Pendientes de reconciliar (>30 días sin convertir)
  const now = Date.now()
  const oldPending = pagoMovils.filter((p) => {
    return Number(p.bs_pending) > 0 && (now - new Date(p.created_at).getTime()) > 30 * 86400 * 1000
  })

  return (
    <div className="p-7 space-y-5 relative">
      <PageWatermark char="€" />

      <Link href="/finanzas" className="inline-flex items-center gap-1 text-[11px] font-display font-bold uppercase tracking-wider text-ink-3 hover:text-orange">
        <ArrowLeft size={12} strokeWidth={2.5} /> Finanzas
      </Link>

      <PageHeader
        title="CASHFLOW"
        stamp={<>{conversionPct.toFixed(0)}% RECONCILIADO</>}
        stampTone={conversionPct > 80 ? "secondary" : conversionPct > 50 ? "orange" : "primary"}
        description={`12 semanas · entradas ${fmtEur(totalIn)} · salidas ${fmtEur(totalOut)} · neto ${fmtEur(totalNet)}`}
      />

      <FinanzasNav />

      {errorMsg && (
        <div className="stamp-card p-4 bg-primary/5" style={{ borderColor: "#BB3B2E" }}>
          <p className="text-[13px] font-medium text-primary">{errorMsg}</p>
        </div>
      )}

      {/* KPI strip */}
      <div className="grid grid-cols-4 gap-3">
        <Kpi label="Entradas 12sem"  value={fmtEur(totalIn)}  sub={`${pagoMovils.length} pedidos`} tone="secondary" icon={<ArrowDown size={14} className="text-secondary" />} />
        <Kpi label="Salidas 12sem"   value={fmtEur(totalOut)} sub={`${expenses.length} gastos`}  tone="primary"   icon={<ArrowUp   size={14} className="text-primary" />} />
        <Kpi label="Net 12sem"       value={fmtEur(totalNet)} sub={totalNet < 0 ? "deficit" : "superavit"} tone={totalNet < 0 ? "primary" : "secondary"} />
        <Kpi label="Bs por convertir" value={`Bs ${totalBsPending.toLocaleString("es-VE", { maximumFractionDigits: 0 })}`}
          sub={oldPending.length > 0 ? `${oldPending.length} > 30 días` : "todos al día"}
          tone={oldPending.length > 0 ? "orange" : "secondary"} />
      </div>

      {/* Weekly flow chart */}
      <div className="stamp-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 bg-dark text-cream">
          <h3 className="font-display font-black text-[14px] uppercase tracking-wider">Flujo semanal · últimas 12 semanas</h3>
          <div className="flex items-center gap-2 text-[10px] font-mono">
            <span className="flex items-center gap-1"><span className="w-2 h-2 inline-block bg-secondary" /><span className="text-cream/60">Entradas</span></span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 inline-block bg-primary" /><span className="text-cream/60">Salidas</span></span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 inline-block bg-orange" /><span className="text-cream/60">Net</span></span>
          </div>
        </div>
        <div className="p-5">
          <CashflowChart weeks={weeks} />
        </div>
      </div>

      {/* Gateway breakdown + reconciliación */}
      <div className="grid grid-cols-12 gap-5">
        <div className="col-span-7 stamp-card overflow-hidden">
          <div className="px-5 py-3 bg-cream-2">
            <h3 className="font-display font-black text-[12px] uppercase tracking-wider text-ink">Por gateway de pago</h3>
          </div>
          {gateways.length === 0 ? (
            <p className="p-10 text-center text-[12px] text-ink-3">Sin datos de pagos</p>
          ) : (
            <ul className="divide-y divide-warm-200/50">
              {gateways.map((g) => (
                <li key={g.gateway} className="p-4 flex items-center gap-3">
                  <div className="w-9 h-9 flex items-center justify-center font-display font-black text-[12px] text-white"
                    style={{ background: g.color, border: "1.5px solid #1A1A1A" }}>
                    {g.label.slice(0, 2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-display font-bold text-ink text-[13px]">{g.label}</div>
                    <div className="text-[10px] text-ink-3 font-mono">{g.count} {g.count === 1 ? "transacción" : "transacciones"}</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="font-display font-black num text-[15px]">{g.amount_eur > 0 ? fmtEur(g.amount_eur) : "—"}</div>
                    <div className="text-[10px] text-ink-3 font-mono">{g.pct.toFixed(0)}%</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="col-span-5 stamp-card p-5">
          <h3 className="font-display font-black text-[12px] uppercase tracking-wider text-ink mb-3">Reconciliación Bs ↔ USDT</h3>
          <div className="space-y-3">
            <ReconciliationBar
              label="Bs total recibido"
              value={totalBs}
              max={totalBs}
              color="#FF3B27"
              format={(v) => `Bs ${v.toLocaleString("es-VE", { maximumFractionDigits: 0 })}`}
            />
            <ReconciliationBar
              label="Convertido a USDT"
              value={totalBsConverted}
              max={totalBs}
              color="#4D5431"
              format={(v) => `Bs ${v.toLocaleString("es-VE", { maximumFractionDigits: 0 })}`}
            />
            <ReconciliationBar
              label="Pendiente convertir"
              value={totalBsPending}
              max={totalBs}
              color="#BB3B2E"
              format={(v) => `Bs ${v.toLocaleString("es-VE", { maximumFractionDigits: 0 })}`}
            />
          </div>
          <div className="mt-4 pt-3" style={{ borderTop: "1.5px dashed var(--border)" }}>
            <div className="flex items-baseline justify-between mb-1">
              <span className="text-[10px] font-display font-bold uppercase tracking-wider text-ink-3">% Reconciliado</span>
              <span className="font-display font-black text-[24px] num text-orange">{conversionPct.toFixed(1)}%</span>
            </div>
            <p className="text-[10px] text-ink-3 font-mono">
              {conversions.length} conversiones registradas · usá "Conversión" en /finanzas
            </p>
          </div>
        </div>
      </div>

      {/* Pendientes de reconciliar (>30 días) */}
      {oldPending.length > 0 && (
        <div className="stamp-card overflow-hidden" style={{ borderColor: "#FF3B27" }}>
          <div className="flex items-center justify-between px-5 py-3 bg-orange/10">
            <div className="flex items-center gap-2">
              <AlertTriangle size={14} className="text-orange" strokeWidth={2.5} />
              <h3 className="font-display font-black text-[12px] uppercase tracking-wider text-orange">
                Pendientes &gt;30 días sin convertir
              </h3>
            </div>
            <span className="text-[10px] font-mono text-orange">{oldPending.length} pedidos</span>
          </div>
          <table className="w-full text-[11px]">
            <thead>
              <tr className="bg-cream-2 text-[10px] uppercase tracking-[0.12em]" style={{ borderBottom: "1.5px solid var(--border)" }}>
                <th className="px-3 py-2 text-left font-display font-bold text-ink-2">Pedido</th>
                <th className="px-3 py-2 text-left font-display font-bold text-ink-2">Cliente</th>
                <th className="px-3 py-2 text-right font-display font-bold text-ink-2">Bs pendiente</th>
                <th className="px-3 py-2 text-right font-display font-bold text-ink-2">Días</th>
              </tr>
            </thead>
            <tbody>
              {oldPending.slice(0, 20).map((p) => {
                const days = Math.floor((now - new Date(p.created_at).getTime()) / (86400 * 1000))
                return (
                  <tr key={p.id} className="row-zebra row-hover border-b border-warm-200/50 last:border-b-0">
                    <td className="px-3 py-2">
                      <Link href={`/orders/${p.order_id}`} className="font-mono font-bold text-ink hover:text-orange">
                        #{p.order_display_id}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-ink-2">{p.customer_name ?? p.order_email ?? "—"}</td>
                    <td className="px-3 py-2 text-right num font-display font-bold">
                      {Number(p.bs_pending).toLocaleString("es-VE", { maximumFractionDigits: 0 })}
                    </td>
                    <td className="px-3 py-2 text-right num text-orange font-display font-bold">{days}d</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function Kpi({ label, value, sub, tone, icon }: { label: string; value: string; sub: string; tone?: "primary" | "secondary" | "orange"; icon?: React.ReactNode }) {
  const bg = tone === "primary" ? "bg-primary/5" : tone === "secondary" ? "bg-secondary/5" : tone === "orange" ? "bg-orange/5" : ""
  const labelTone = tone === "primary" ? "text-primary" : tone === "secondary" ? "text-secondary" : tone === "orange" ? "text-orange" : "text-ink-3"
  const valueTone = tone === "primary" ? "text-primary" : tone === "secondary" ? "text-secondary" : tone === "orange" ? "text-orange" : ""
  return (
    <div className={`stamp-card p-4 ${bg}`}>
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <div className={`text-[9px] font-display font-bold uppercase tracking-[0.18em] ${labelTone}`}>{label}</div>
      </div>
      <div className={`stat-display text-[22px] mt-1 num ${valueTone}`}>{value}</div>
      <div className="text-[10px] mt-1 text-ink-3 font-mono">{sub}</div>
    </div>
  )
}

function ReconciliationBar({ label, value, max, color, format }: { label: string; value: number; max: number; color: string; format: (v: number) => string }) {
  const pct = max > 0 ? (value / max) * 100 : 0
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-[10px] font-display font-bold uppercase tracking-wider" style={{ color }}>{label}</span>
        <span className="text-[11px] font-mono num">{format(value)}</span>
      </div>
      <div className="w-full h-2 bg-cream-2 rounded-md overflow-hidden" style={{ border: "1px solid var(--border-soft)" }}>
        <div className="h-full transition-all" style={{ width: `${Math.min(100, pct)}%`, background: color }} />
      </div>
    </div>
  )
}

function CashflowChart({ weeks }: { weeks: WeeklyFlow[] }) {
  if (weeks.length === 0) {
    return <p className="text-center text-[12px] text-ink-3 py-10">Sin datos</p>
  }
  const W = 900, H = 220
  const padX = 40, padY = 30
  const innerW = W - padX * 2
  const innerH = H - padY * 2
  const maxVal = Math.max(...weeks.flatMap((w) => [w.in_eur, w.out_eur, Math.abs(w.net_eur)])) || 1
  const groupW = innerW / weeks.length
  const barW = Math.min(14, groupW / 3.5)
  const ticks = [0, 0.5, 1].map((t) => maxVal * t)

  // Net line points
  const netPoints = weeks.map((w, i) => {
    const x = padX + i * groupW + groupW / 2
    const y = padY + innerH / 2 - (w.net_eur / maxVal) * (innerH / 2)
    return `${x},${y.toFixed(1)}`
  }).join(" ")

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
      {/* Grid */}
      {ticks.map((v, i) => {
        const y = padY + innerH - (v / maxVal) * innerH
        return (
          <g key={i}>
            <line x1={padX} y1={y} x2={W - padX} y2={y} stroke="rgba(0,0,0,0.06)" strokeDasharray={i === 0 ? "" : "2,3"} />
            <text x={padX - 6} y={y + 3} fontSize="9" fontFamily="ui-monospace, monospace" fill="rgba(0,0,0,0.4)" textAnchor="end">
              €{(v / 1000).toFixed(0)}k
            </text>
          </g>
        )
      })}
      {/* Bars */}
      {weeks.map((w, i) => {
        const x0 = padX + i * groupW + groupW / 2
        const inH = (w.in_eur / maxVal) * innerH
        const outH = (w.out_eur / maxVal) * innerH
        return (
          <g key={i}>
            <rect x={x0 - barW - 1} y={padY + innerH - inH} width={barW} height={inH} fill="#4D5431" rx="1.5">
              <title>{`Sem ${w.week}: +€${w.in_eur.toFixed(0)}`}</title>
            </rect>
            <rect x={x0 + 1} y={padY + innerH - outH} width={barW} height={outH} fill="#BB3B2E" rx="1.5">
              <title>{`Sem ${w.week}: -€${w.out_eur.toFixed(0)}`}</title>
            </rect>
            <text x={x0} y={H - 8} fontSize="9" fontFamily="ui-monospace, monospace" fill="rgba(0,0,0,0.5)" textAnchor="middle">
              {w.week}
            </text>
          </g>
        )
      })}
      {/* Net line */}
      <polyline points={netPoints} fill="none" stroke="#FF3B27" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
