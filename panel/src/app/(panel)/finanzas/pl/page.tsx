import Link from "next/link"
import { ArrowLeft, TrendingUp, TrendingDown, AlertTriangle } from "lucide-react"
import { PageHeader, PageWatermark } from "@/components/layout/PageHeader"
import { FinanzasNav } from "../FinanzasNav"
import { listPagoMovil, listFinanzasExpenses, MedusaError } from "@/lib/medusa"
import { aggregateByMonth, lastNMonths, type MonthlyAgg } from "../_lib"
import { fmtEur } from "@/lib/utils"

export default async function PLPage({ searchParams }: { searchParams: Promise<{ months?: string; m?: string }> }) {
  const params = await searchParams
  const monthsBack = Math.min(24, Math.max(3, Number(params.months) || 6))
  const drilldownMonth = params.m  // YYYY-MM

  const [pmR, expR] = await Promise.allSettled([
    // Cargo más historial — necesario para el P&L
    listPagoMovil({ limit: 1000 }),
    listFinanzasExpenses({ limit: 500 }),
  ])

  let errorMsg: string | null = null
  const pagoMovils = pmR.status === "fulfilled" ? pmR.value.pago_movils : []
  const pagoMovilCount = pmR.status === "fulfilled" ? pmR.value.count : 0
  const expenses = expR.status === "fulfilled" ? expR.value.expenses : []

  // Fix #4: detectar truncación — si el backend tiene más registros que los devueltos
  // los totales del P&L estarán incompletos.
  const pagoMovilTruncated = pagoMovilCount > pagoMovils.length

  if ([pmR, expR].some((r) => r.status === "rejected" && r.reason instanceof MedusaError && r.reason.status === 401)) {
    errorMsg = "Sesión expirada. Recarga la página."
  }

  const months = lastNMonths(monthsBack)
  const agg = aggregateByMonth(pagoMovils, expenses, months)

  // Totales del período
  const totalRevenue = agg.reduce((s, m) => s + m.revenue, 0)
  const totalCogs    = agg.reduce((s, m) => s + m.cogs, 0)
  const totalMargin  = agg.reduce((s, m) => s + m.margin, 0)
  const totalExp     = agg.reduce((s, m) => s + m.expenses, 0)
  const totalNet     = agg.reduce((s, m) => s + m.net, 0)
  const marginPct    = totalRevenue > 0 ? (totalMargin / totalRevenue) * 100 : 0
  const netMarginPct = totalRevenue > 0 ? (totalNet / totalRevenue) * 100 : 0

  // Drill-down detail si está seleccionado
  const drilldownData = drilldownMonth ? agg.find((m) => m.month === drilldownMonth) : null
  const drilldownPM = drilldownMonth
    ? pagoMovils.filter((p) => {
        const d = new Date(p.created_at)
        const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
        return k === drilldownMonth
      })
    : []
  const drilldownExp = drilldownMonth
    ? expenses.filter((e) => {
        const d = new Date(e.expense_date)
        const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
        return k === drilldownMonth
      })
    : []

  return (
    <div className="p-7 space-y-5 relative">
      <PageWatermark char="€" />

      <Link href="/finanzas" className="inline-flex items-center gap-1 text-[11px] font-display font-bold uppercase tracking-wider text-ink-3 hover:text-orange">
        <ArrowLeft size={12} strokeWidth={2.5} /> Finanzas
      </Link>

      <PageHeader
        title="P&L"
        stamp={<>{monthsBack} MESES · {totalRevenue > 0 ? `${marginPct.toFixed(1)}% MARGEN` : "—"}</>}
        stampTone={netMarginPct < 0 ? "primary" : netMarginPct < 10 ? "orange" : "secondary"}
        description={
          <>
            <span>Período de {monthsBack} meses · Revenue {fmtEur(totalRevenue)} · Margen {fmtEur(totalMargin)} · Net {fmtEur(totalNet)}</span>
            <span className="ml-3 text-ink-3">
              {[3, 6, 12, 24].map((n) => (
                <Link key={n} href={`/finanzas/pl?months=${n}`}
                  className={`ml-1 px-1.5 py-0.5 rounded-md ${monthsBack === n ? "bg-dark text-cream" : "hover:bg-cream-2"}`}>
                  {n}m
                </Link>
              ))}
            </span>
          </>
        }
      />

      <FinanzasNav />

      {errorMsg && (
        <div className="stamp-card p-4 bg-primary/5" style={{ borderColor: "#BB3B2E" }}>
          <p className="text-[13px] font-medium text-primary">{errorMsg}</p>
        </div>
      )}

      {/* Fix #4: Aviso de truncación — los totales pueden estar incompletos */}
      {pagoMovilTruncated && (
        <div className="stamp-card p-4 bg-orange/5 flex items-start gap-3" style={{ borderColor: "#FF3B27" }}>
          <AlertTriangle size={16} className="text-orange flex-shrink-0 mt-0.5" strokeWidth={2.5} />
          <div>
            <p className="font-display font-bold text-[12px] uppercase tracking-wider text-orange">
              Datos parciales — P&amp;L puede estar subestimado
            </p>
            <p className="text-[11px] text-ink-2 mt-1 font-mono">
              La consulta devolvió {pagoMovils.length} de {pagoMovilCount} pedidos totales (límite alcanzado).
              Los totales de revenue y margen reflejan solo ese subconjunto. Para ver el P&amp;L completo usa el filtro por mes o aumenta el límite del endpoint.
            </p>
          </div>
        </div>
      )}

      {/* Summary KPIs */}
      <div className="grid grid-cols-5 gap-3">
        <Kpi label="Revenue total"  value={fmtEur(totalRevenue)} sub={`${pagoMovils.length} pedidos`} />
        <Kpi label="COGS total"     value={fmtEur(totalCogs)}     sub={totalRevenue > 0 ? `${((totalCogs / totalRevenue) * 100).toFixed(1)}% del revenue` : "—"} tone="primary" />
        <Kpi label="Margen bruto"   value={fmtEur(totalMargin)}   sub={`${marginPct.toFixed(1)}% margen`} tone="secondary" />
        <Kpi label="Gastos totales" value={fmtEur(totalExp)}      sub={`${expenses.length} entries`} tone="primary" />
        <Kpi label="Net (neto)"     value={fmtEur(totalNet)}      sub={`${netMarginPct.toFixed(1)}% net margin`} tone={totalNet < 0 ? "primary" : "secondary"} />
      </div>

      {/* Bar chart */}
      <div className="stamp-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 bg-dark text-cream">
          <h3 className="font-display font-black text-[14px] uppercase tracking-wider">P&L mensual</h3>
          <div className="flex items-center gap-2 text-[10px] font-mono">
            <Legend color="#FF3B27" label="Revenue" />
            <Legend color="#4D5431" label="Margen" />
            <Legend color="#BB3B2E" label="Gastos" />
          </div>
        </div>
        <div className="p-5">
          <PlBarChart data={agg} drilldownMonth={drilldownMonth} />
        </div>
      </div>

      {/* Monthly table */}
      <div className="stamp-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 bg-cream-2">
          <h3 className="font-display font-black text-[12px] uppercase tracking-wider text-ink">Tabla mensual</h3>
          <span className="text-[10px] font-mono text-ink-3">click una fila para drill-down</span>
        </div>
        <table className="w-full text-[12px]">
          <thead>
            <tr className="bg-cream-2 text-[10px] uppercase tracking-[0.12em]" style={{ borderBottom: "2px solid var(--border)" }}>
              <th className="px-3 py-2 text-left font-display font-bold text-ink-2">Mes</th>
              <th className="px-3 py-2 text-right font-display font-bold text-ink-2">Pedidos</th>
              <th className="px-3 py-2 text-right font-display font-bold text-ink-2">Revenue</th>
              <th className="px-3 py-2 text-right font-display font-bold text-ink-2">COGS</th>
              <th className="px-3 py-2 text-right font-display font-bold text-ink-2">Margen</th>
              <th className="px-3 py-2 text-right font-display font-bold text-ink-2">Margen %</th>
              <th className="px-3 py-2 text-right font-display font-bold text-ink-2">Gastos</th>
              <th className="px-3 py-2 text-right font-display font-bold text-ink-2">Net</th>
            </tr>
          </thead>
          <tbody>
            {agg.slice().reverse().map((m) => {
              const mPct = m.revenue > 0 ? (m.margin / m.revenue) * 100 : 0
              const isActive = drilldownMonth === m.month
              return (
                <tr key={m.month} className={`row-hover row-zebra border-b border-warm-200/50 last:border-b-0 ${isActive ? "bg-orange/10" : ""}`}>
                  <td className="px-3 py-2 font-display font-bold text-ink">
                    <Link href={`/finanzas/pl?months=${monthsBack}&m=${m.month}`} className="block">
                      {m.label} <span className="text-ink-3 font-mono text-[10px]">{m.month}</span>
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-right num text-ink-2">{m.ordersCount}</td>
                  <td className="px-3 py-2 text-right font-display font-bold num">{fmtEur(m.revenue)}</td>
                  <td className="px-3 py-2 text-right num text-primary">{fmtEur(m.cogs)}</td>
                  <td className="px-3 py-2 text-right font-display font-bold num text-secondary">{fmtEur(m.margin)}</td>
                  <td className="px-3 py-2 text-right num">{mPct.toFixed(1)}%</td>
                  <td className="px-3 py-2 text-right num text-primary">{fmtEur(m.expenses)}</td>
                  <td className={`px-3 py-2 text-right font-display font-bold num ${m.net < 0 ? "text-primary" : "text-secondary"}`}>
                    {m.net < 0 && <TrendingDown size={10} className="inline mr-0.5" />}
                    {m.net >= 0 && <TrendingUp size={10} className="inline mr-0.5" />}
                    {fmtEur(m.net)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Drill-down detail */}
      {drilldownData && (
        <div className="stamp-card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 bg-orange text-dark">
            <h3 className="font-display font-black text-[14px] uppercase tracking-wider">
              Drill-down · {drilldownData.label} {drilldownData.month}
            </h3>
            <Link href={`/finanzas/pl?months=${monthsBack}`} className="text-[10px] font-display font-bold uppercase tracking-wider hover:underline">
              cerrar
            </Link>
          </div>
          <div className="grid grid-cols-2 divide-x divide-warm-200/50">
            <div className="p-5">
              <h4 className="text-[11px] font-display font-bold uppercase tracking-wider text-ink-3 mb-3">
                Ingresos · {drilldownPM.length} pedidos
              </h4>
              {drilldownPM.length === 0 ? (
                <p className="text-[12px] text-ink-3">Sin pedidos en este mes.</p>
              ) : (
                <ul className="space-y-1 max-h-72 overflow-y-auto text-[11px]">
                  {drilldownPM.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-2 p-1.5 bg-cream-2/30 rounded-md">
                      <Link href={`/orders/${p.order_id}`} className="font-mono text-ink hover:text-orange truncate">
                        #{p.order_display_id} · {p.customer_name ?? p.order_email ?? "—"}
                      </Link>
                      <span className="font-display font-bold num text-secondary flex-shrink-0">
                        {fmtEur(Number(p.amount_eur_total) || 0)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="p-5">
              <h4 className="text-[11px] font-display font-bold uppercase tracking-wider text-ink-3 mb-3">
                Gastos · {drilldownExp.length} entries
              </h4>
              {drilldownExp.length === 0 ? (
                <p className="text-[12px] text-ink-3">Sin gastos en este mes.</p>
              ) : (
                <ul className="space-y-1 max-h-72 overflow-y-auto text-[11px]">
                  {drilldownExp.map((e) => (
                    <li key={e.id} className="flex items-center justify-between gap-2 p-1.5 bg-cream-2/30 rounded-md">
                      <span className="text-ink truncate">{e.description}</span>
                      <span className="font-display font-bold num text-primary flex-shrink-0">
                        −${Number(e.amount_usdt).toFixed(2)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: "primary" | "secondary" }) {
  const bg = tone === "primary" ? "bg-primary/5" : tone === "secondary" ? "bg-secondary/5" : ""
  const labelTone = tone === "primary" ? "text-primary" : tone === "secondary" ? "text-secondary" : "text-ink-3"
  const valueTone = tone === "primary" ? "text-primary" : tone === "secondary" ? "text-secondary" : ""
  return (
    <div className={`stamp-card p-4 ${bg}`}>
      <div className={`text-[9px] font-display font-bold uppercase tracking-[0.18em] ${labelTone}`}>{label}</div>
      <div className={`stat-display text-[24px] mt-2 num ${valueTone}`}>{value}</div>
      <div className="text-[10px] mt-1 text-ink-3 font-mono">{sub}</div>
    </div>
  )
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className="w-2 h-2 inline-block" style={{ background: color }} />
      <span className="text-cream/60">{label}</span>
    </span>
  )
}

/** SVG bar chart: tres barras por mes (revenue, margen, gastos). */
function PlBarChart({ data, drilldownMonth }: { data: MonthlyAgg[]; drilldownMonth?: string }) {
  if (data.length === 0) {
    return <p className="text-center text-[12px] text-ink-3 py-10">Sin datos suficientes</p>
  }
  const W = 900, H = 240
  const padX = 40, padY = 30
  const innerW = W - padX * 2
  const innerH = H - padY * 2
  const maxVal = Math.max(...data.flatMap((m) => [m.revenue, m.margin, m.expenses])) || 1
  const groupW = innerW / data.length
  const barW = Math.min(20, groupW / 4)

  // Y axis ticks (4 niveles)
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => maxVal * t)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
      {/* Y axis grid lines */}
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
      {data.map((m, i) => {
        const x0 = padX + i * groupW + groupW / 2
        const isActive = drilldownMonth === m.month
        const bars = [
          { val: m.revenue, color: "#FF3B27", offset: -barW * 1.2 },
          { val: m.margin,  color: "#4D5431", offset: 0 },
          { val: m.expenses, color: "#BB3B2E", offset: barW * 1.2 },
        ]
        return (
          <g key={m.month} opacity={isActive || !drilldownMonth ? 1 : 0.4}>
            {bars.map((b, j) => {
              const h = (Math.abs(b.val) / maxVal) * innerH
              const y = padY + innerH - h
              const x = x0 - barW / 2 + b.offset
              return (
                <rect key={j} x={x} y={y} width={barW} height={h} fill={b.color} rx="1.5">
                  <title>{`${m.label}: €${b.val.toFixed(2)}`}</title>
                </rect>
              )
            })}
            {/* Net line indicator */}
            {m.net !== 0 && (() => {
              const netY = padY + innerH - (Math.abs(m.net) / maxVal) * innerH
              return (
                <circle cx={x0} cy={m.net < 0 ? padY + innerH + 8 : netY} r="2.5"
                  fill={m.net < 0 ? "#BB3B2E" : "#4D5431"} stroke="white" strokeWidth="1">
                  <title>{`Net: €${m.net.toFixed(2)}`}</title>
                </circle>
              )
            })()}
            {/* Label */}
            <text x={x0} y={H - 8} fontSize="10" fontFamily="ui-monospace, monospace" fill={isActive ? "#FF3B27" : "rgba(0,0,0,0.6)"}
              textAnchor="middle" fontWeight={isActive ? "bold" : "normal"}>
              {m.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
