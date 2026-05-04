import Link from "next/link"
import { ArrowLeft, TrendingUp, AlertTriangle, CheckCircle2 } from "lucide-react"
import { PageHeader, PageWatermark } from "@/components/layout/PageHeader"
import { FinanzasNav } from "../FinanzasNav"
import { listPagoMovil, listFinanzasExpenses, getRunwayReport, MedusaError, type FinanzasRunwayReport } from "@/lib/medusa"
import { aggregateByMonth, lastNMonths, forecast, type Forecast, type MonthlyAgg } from "../_lib"
import { fmtEur } from "@/lib/utils"

const HORIZONS = [30, 60, 90] as const

export default async function ForecastPage() {
  const [pmR, expR, runwayR] = await Promise.allSettled([
    listPagoMovil({ limit: 1000 }),
    listFinanzasExpenses({ limit: 500 }),
    getRunwayReport(),
  ])

  let errorMsg: string | null = null
  const pagoMovils = pmR.status === "fulfilled" ? pmR.value.pago_movils : []
  const expenses = expR.status === "fulfilled" ? expR.value.expenses : []
  const runway: FinanzasRunwayReport | null = runwayR.status === "fulfilled" ? runwayR.value : null
  if ([pmR, expR, runwayR].some((r) => r.status === "rejected" && r.reason instanceof MedusaError && r.reason.status === 401)) {
    errorMsg = "Sesión expirada. Recarga la página."
  }

  // Histórico — usamos 6 meses para más estabilidad estadística
  const history = aggregateByMonth(pagoMovils, expenses, lastNMonths(6))
  // Excluir mes en curso (incompleto) para no sesgar el promedio bajo
  const completedHistory = history.slice(0, -1)
  const histToUse = completedHistory.length >= 2 ? completedHistory : history

  const forecasts = HORIZONS.map((h) => ({ horizon: h, ...forecast(histToUse, h) }))

  // Proyección de runway: cuándo se acaba el USDT con el burn proyectado
  const dailyBurn = forecast(histToUse, 30).expenses / 30
  const projectedRunwayDays = runway && dailyBurn > 0 ? Math.floor(runway.usdt_balance / dailyBurn) : null

  return (
    <div className="p-7 space-y-5 relative">
      <PageWatermark char="€" />

      <Link href="/finanzas" className="inline-flex items-center gap-1 text-[11px] font-display font-bold uppercase tracking-wider text-ink-3 hover:text-orange">
        <ArrowLeft size={12} strokeWidth={2.5} /> Finanzas
      </Link>

      <PageHeader
        title="FORECAST"
        stamp={<>30 / 60 / 90 DÍAS</>}
        stampTone="orange"
        description={`Proyecciones lineales basadas en ${histToUse.length} meses de histórico${histToUse !== completedHistory ? " (incluye mes en curso)" : ""}`}
      />

      <FinanzasNav />

      {errorMsg && (
        <div className="stamp-card p-4 bg-primary/5" style={{ borderColor: "#BB3B2E" }}>
          <p className="text-[13px] font-medium text-primary">{errorMsg}</p>
        </div>
      )}

      {histToUse.length < 2 && (
        <div className="stamp-card p-4 bg-orange/5" style={{ borderColor: "#FF3B27" }}>
          <div className="flex items-start gap-2">
            <AlertTriangle size={16} className="text-orange flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-display font-bold text-[12px] uppercase tracking-wider text-orange">Histórico insuficiente</p>
              <p className="text-[11px] text-ink-3 mt-1">
                Necesitamos al menos 2 meses cerrados para hacer un forecast confiable. Mostramos las proyecciones igual,
                pero la confianza es <span className="font-bold">baja</span>.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Forecast cards (3 horizontes) */}
      <div className="grid grid-cols-3 gap-5">
        {forecasts.map(({ horizon, ...f }) => (
          <ForecastCard key={horizon} horizon={horizon} forecast={f} />
        ))}
      </div>

      {/* Runway projection */}
      {runway && (
        <div className="stamp-card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 bg-dark text-cream">
            <h3 className="font-display font-black text-[14px] uppercase tracking-wider">Proyección de runway</h3>
            <span className="text-[10px] text-cream/60 font-mono">basado en burn proyectado</span>
          </div>
          <div className="p-5 grid grid-cols-3 gap-5">
            <div>
              <div className="text-[10px] font-display font-bold uppercase tracking-[0.18em] text-ink-3 mb-1">Wallet USDT actual</div>
              <div className="stat-display text-[28px] num text-secondary">${runway.usdt_balance.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-[10px] font-display font-bold uppercase tracking-[0.18em] text-ink-3 mb-1">Burn diario proyectado</div>
              <div className="stat-display text-[28px] num text-primary">${dailyBurn.toFixed(2)}</div>
              <div className="text-[10px] text-ink-3 font-mono mt-1">${(dailyBurn * 30).toFixed(0)}/mes</div>
            </div>
            <div>
              <div className="text-[10px] font-display font-bold uppercase tracking-[0.18em] text-ink-3 mb-1">Runway días</div>
              <div className={`stat-display text-[28px] num ${
                projectedRunwayDays === null ? "text-ink-3" :
                projectedRunwayDays < 30 ? "text-primary" :
                projectedRunwayDays < 90 ? "text-orange" : "text-secondary"
              }`}>
                {projectedRunwayDays === null ? "∞" : projectedRunwayDays}
                <span className="text-[14px] text-ink-3"> días</span>
              </div>
              <div className="text-[10px] text-ink-3 font-mono mt-1">
                {projectedRunwayDays === null ? "burn rate cero" : `≈ ${(projectedRunwayDays / 30).toFixed(1)} meses`}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Comparativa: forecast vs histórico promedio */}
      <div className="stamp-card overflow-hidden">
        <div className="px-5 py-3 bg-cream-2">
          <h3 className="font-display font-black text-[12px] uppercase tracking-wider text-ink">Histórico vs forecast 30 días</h3>
        </div>
        <div className="p-5">
          <ForecastCompareChart history={histToUse} forecast30={forecasts[0]} />
        </div>
      </div>

      {/* Metodología */}
      <div className="stamp-card p-4 bg-cream-2/30">
        <h4 className="text-[10px] font-display font-bold uppercase tracking-wider text-ink-3 mb-2">Metodología</h4>
        <ul className="text-[11px] text-ink-2 space-y-1 font-mono">
          <li>· Promedio diario derivado del revenue / margen / gastos de los últimos {histToUse.length} meses cerrados</li>
          <li>· Proyección lineal: <code>diario × días</code>. No considera estacionalidad ni eventos puntuales</li>
          <li>· <span className="text-secondary">Confianza alta</span> = ≥4 meses · <span className="text-orange">media</span> = 2-3 meses · <span className="text-primary">baja</span> = &lt; 2</li>
          <li>· Para proyecciones más sofisticadas considerar: Holt-Winters, Prophet, modelos seasonal ARIMA</li>
        </ul>
      </div>
    </div>
  )
}

function ForecastCard({ horizon, forecast: f }: { horizon: number; forecast: Forecast }) {
  const tone = f.net < 0 ? "primary" : "secondary"
  const bg = tone === "primary" ? "bg-primary/5" : "bg-secondary/5"
  return (
    <div className={`stamp-card p-5 ${bg}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display font-black text-[16px] uppercase tracking-tight text-ink">+{horizon} días</h3>
        <ConfidencePill confidence={f.confidence} />
      </div>
      <dl className="space-y-2 text-[13px] font-mono">
        <Row label="Revenue"  value={`+${fmtEur(f.revenue)}`}  color="text-secondary" />
        <Row label="Margen"   value={`+${fmtEur(f.margin)}`}   color="text-secondary" />
        <Row label="Gastos"   value={`−${fmtEur(f.expenses)}`} color="text-primary" />
        <div className="dotted-div my-2" />
        <Row label="NET" value={`${f.net >= 0 ? "+" : ""}${fmtEur(f.net)}`}
          color={f.net < 0 ? "text-primary" : "text-secondary"} bold />
      </dl>
      <div className="mt-3 pt-3 text-[10px] text-ink-3 font-mono" style={{ borderTop: "1px dashed var(--border)" }}>
        Promedio diario: <span className="font-bold text-ink">{fmtEur(f.dailyAvgRevenue)}/día</span>
      </div>
    </div>
  )
}

function ConfidencePill({ confidence }: { confidence: Forecast["confidence"] }) {
  const map = {
    low:    { label: "BAJA",  cls: "text-primary"   },
    medium: { label: "MEDIA", cls: "text-orange"    },
    high:   { label: "ALTA",  cls: "text-secondary" },
  }
  const m = map[confidence]
  return (
    <span className={`vintage-stamp ${m.cls}`} style={{ background: "rgb(var(--surface))" }}>
      Confianza {m.label}
    </span>
  )
}

function Row({ label, value, color, bold }: { label: string; value: string; color?: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-ink-3">{label}</dt>
      <dd className={`num ${color ?? ""} ${bold ? "font-display font-black text-[16px]" : "font-bold"}`}>{value}</dd>
    </div>
  )
}

function ForecastCompareChart({ history, forecast30 }: { history: MonthlyAgg[]; forecast30: Forecast & { horizon: number } }) {
  if (history.length === 0) return <p className="text-center text-[12px] text-ink-3 py-10">Sin datos históricos</p>

  const W = 900, H = 220, padX = 40, padY = 30
  const innerW = W - padX * 2
  const innerH = H - padY * 2

  const points = [
    ...history.map((h) => ({ label: h.label, value: h.revenue, kind: "history" as const })),
    { label: "+30d", value: forecast30.revenue, kind: "forecast" as const },
  ]
  const maxVal = Math.max(...points.map((p) => p.value)) || 1
  const groupW = innerW / points.length
  const barW = Math.min(40, groupW * 0.6)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
      {[0, 0.5, 1].map((t, i) => {
        const v = maxVal * t
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
      {points.map((p, i) => {
        const x0 = padX + i * groupW + groupW / 2
        const h = (p.value / maxVal) * innerH
        const y = padY + innerH - h
        const isForecast = p.kind === "forecast"
        return (
          <g key={i}>
            <rect x={x0 - barW / 2} y={y} width={barW} height={h}
              fill={isForecast ? "#FF3B27" : "#4D5431"}
              fillOpacity={isForecast ? 0.5 : 1}
              stroke={isForecast ? "#FF3B27" : "transparent"}
              strokeDasharray={isForecast ? "4,2" : "0"}
              strokeWidth={isForecast ? 2 : 0}
              rx="1.5">
              <title>{`${p.label}: €${p.value.toFixed(0)}`}</title>
            </rect>
            <text x={x0} y={H - 8} fontSize="10" fontFamily="ui-monospace, monospace"
              fill={isForecast ? "#FF3B27" : "rgba(0,0,0,0.6)"}
              textAnchor="middle"
              fontWeight={isForecast ? "bold" : "normal"}>
              {p.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
