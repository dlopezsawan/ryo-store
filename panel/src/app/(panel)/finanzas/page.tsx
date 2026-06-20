import Link from "next/link"
import { AlertTriangle } from "lucide-react"
import { PageHeader, PageWatermark } from "@/components/layout/PageHeader"
import { FinanzasHeaderActions } from "./FinanzasHeaderActions"
import { FinanzasNav } from "./FinanzasNav"
import { WalletsBreakdown } from "./WalletsBreakdown"
import { SplitsBreakdown } from "./SplitsBreakdown"
import { DismissibleAlerts } from "./DismissibleAlerts"
import { MonthSelector } from "./MonthSelector"
import { aggregateByMonth, lastNMonths, detectAnomalies } from "./_lib"
import {
  listPagoMovil,
  listFinanzasExpenses,
  listFinanzasConversions,
  listFinanzasComments,
  getRunwayReport,
  getFinanzasSummary,
  MedusaError,
  type FinanzasPagoMovil,
  type FinanzasExpense,
  type FinanzasConversion,
  type FinanzasComment,
  type FinanzasRunwayReport,
  type FinanzasSummary,
} from "@/lib/medusa"
import { fmtEur, fmtRelative } from "@/lib/utils"

export default async function FinanzasPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const params = await searchParams

  // Determinar el mes a mostrar:
  //  1. Si vino por URL, usarlo
  //  2. Si no, intentar el mes actual; si está vacío, fallback al último con data
  let monthToShow: string | undefined = params.month
  if (!monthToShow) {
    // Fix #7: en lugar de probar de forma secuencial (hasta 13 awaits en cadena),
    // lanzamos mes actual + los 3 meses anteriores en paralelo y elegimos el
    // más reciente con orders > 0. Si ninguno tiene órdenes seguimos con el mes
    // actual como fallback (comportamiento anterior conservado).
    const now = new Date()
    const currentMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`

    // Generar los candidatos: mes actual + 3 meses atrás (4 probes en paralelo)
    const LOOK_BACK = 3
    const candidates = Array.from({ length: LOOK_BACK + 1 }, (_, i) => {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`
    })

    const probeResults = await Promise.all(
      candidates.map((m) => getFinanzasSummary(m).catch(() => null))
    )

    // Elegir el más reciente (menor índice) con orders > 0
    const firstHit = probeResults.findIndex((r) => r && r.totals.orders > 0)
    if (firstHit !== -1) {
      monthToShow = candidates[firstHit]
    } else {
      // Si los 4 primeros no tienen órdenes, intentar meses adicionales
      // de forma secuencial (casos extremos — base de datos nueva o vacía)
      for (let i = LOOK_BACK + 1; i <= 12; i++) {
        const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))
        const candidate = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`
        const probe2 = await getFinanzasSummary(candidate).catch(() => null)
        if (probe2 && probe2.totals.orders > 0) {
          monthToShow = candidate
          break
        }
      }
      if (!monthToShow) monthToShow = currentMonth  // fallback
    }
  }

  // Cargo todo en paralelo. Cualquier endpoint que falle se reporta en su
  // sección — no derrumba la página completa (Promise.allSettled).
  const [pmR, expR, convR, commR, runwayR, summaryR] = await Promise.allSettled([
    listPagoMovil({ limit: 30 }),
    listFinanzasExpenses({ limit: 30 }),
    listFinanzasConversions({ limit: 20 }),
    listFinanzasComments({ limit: 6 }),
    getRunwayReport(),
    getFinanzasSummary(monthToShow),
  ])

  const pagoMovils: FinanzasPagoMovil[] = pmR.status === "fulfilled" ? pmR.value.pago_movils : []
  const expenses: FinanzasExpense[] = expR.status === "fulfilled" ? expR.value.expenses : []
  const conversions: FinanzasConversion[] = convR.status === "fulfilled" ? convR.value.conversions : []
  const comments: FinanzasComment[] = commR.status === "fulfilled" ? commR.value.comments : []
  const runway: FinanzasRunwayReport | null = runwayR.status === "fulfilled" ? runwayR.value : null
  const summary: FinanzasSummary | null = summaryR.status === "fulfilled" ? summaryR.value : null
  const summaryError: string | undefined = summaryR.status === "rejected"
    ? (summaryR.reason instanceof Error ? summaryR.reason.message : "summary endpoint falló")
    : undefined

  const sessionExpired =
    [pmR, expR, convR, commR, runwayR, summaryR].some(
      (r) => r.status === "rejected" && r.reason instanceof MedusaError && r.reason.status === 401
    )

  // Aggregate métricas del mes seleccionado (preferencia: summary endpoint del backend,
  // fallback: filtro local de pago_movils si summary falla).
  let revenueMonth = 0
  let cogsMonth = 0
  let marginMonth = 0
  let monthOrdersCount = 0

  if (summary) {
    revenueMonth = summary.totals.revenue_eur ?? 0
    cogsMonth = summary.totals.cogs_eur ?? 0
    marginMonth = summary.totals.margin_eur ?? 0
    monthOrdersCount = summary.totals.orders ?? 0
  } else {
    // Fallback: agregar localmente del listado de pago_movils para el mes seleccionado
    const [yStr, mStr] = (monthToShow ?? "").split("-")
    if (yStr && mStr) {
      const y = Number(yStr), m = Number(mStr)
      const monthStart = new Date(Date.UTC(y, m - 1, 1)).getTime()
      const monthEnd   = new Date(Date.UTC(y, m, 1)).getTime()
      const monthPMs = pagoMovils.filter((p) => {
        const t = new Date(p.created_at).getTime()
        return t >= monthStart && t < monthEnd
      })
      monthOrdersCount = monthPMs.length
      revenueMonth = monthPMs.reduce((s, p) => s + (Number(p.amount_eur_total) || 0), 0)
      cogsMonth    = monthPMs.reduce((s, p) => s + (Number(p.amount_eur_cogs)  || 0), 0)
      marginMonth  = monthPMs.reduce((s, p) => s + (Number(p.amount_eur_margin) || 0), 0)
    }
  }
  const marginPct = revenueMonth > 0 ? (marginMonth / revenueMonth) * 100 : 0

  // Label legible del mes seleccionado
  const [yLabel, mLabel] = (monthToShow ?? "").split("-")
  const monthLabel = (yLabel && mLabel)
    ? new Date(Number(yLabel), Number(mLabel) - 1, 1).toLocaleDateString("es-VE", { month: "long", year: "numeric" })
    : "mes actual"

  // Build a unified "Movimientos" feed sorted by date desc
  const feed = [
    ...pagoMovils.map((p) => ({
      kind: "income" as const,
      id: p.id,
      title: `Pedido #${p.order_display_id} · ${p.customer_name ?? p.order_email ?? "—"}`,
      sub: p.combo_tier_label
        ? `Revenue capturado · ${p.combo_tier_label} · margen ${fmtEur(Number(p.amount_eur_margin) || 0)}${
            revenueMonth > 0 ? ` (${(((Number(p.amount_eur_margin) || 0) / Math.max(1, Number(p.amount_eur_total) || 1)) * 100).toFixed(1)}%)` : ""
          }`
        : `Revenue capturado · margen ${fmtEur(Number(p.amount_eur_margin) || 0)}`,
      amount: `+${fmtEur(Number(p.amount_eur_total) || 0)}`,
      tone: "secondary" as const,
      icon: "€",
      iconBg: "bg-secondary/15 text-secondary",
      iconBorder: "#4D5431",
      time: fmtRelative(p.created_at),
    })),
    ...conversions.map((c) => ({
      kind: "conversion" as const,
      id: c.id,
      title: `Conversión Bs → USDT${c.reference ? ` · ${c.reference}` : ""}`,
      sub: `${Number(c.amount_bs).toLocaleString("es-VE")} Bs → $${Number(c.amount_usdt).toFixed(2)} USDT · spread ${Number(c.spread_pct).toFixed(1)}%`,
      amount: `$${Number(c.amount_usdt).toFixed(2)}`,
      tone: "orange" as const,
      icon: "⇄",
      iconBg: "bg-orange/15 text-orange",
      iconBorder: "#FF3B27",
      time: fmtRelative(c.converted_at),
    })),
    ...expenses.map((e) => ({
      kind: "expense" as const,
      id: e.id,
      title: `Gasto · ${e.description}`,
      sub: e.status === "pending_payment" ? "pendiente pago" : "pagado",
      amount: `−$${Number(e.amount_usdt).toFixed(2)}`,
      tone: "primary" as const,
      icon: "↓",
      iconBg: "bg-primary/15 text-primary",
      iconBorder: "#BB3B2E",
      time: e.status === "pending_payment"
        ? <span className="text-orange font-display font-bold uppercase">Pendiente</span>
        : fmtRelative(e.expense_date),
    })),
  ]
    .sort((a, b) => {
      // Sort by their original date — easier path: re-derive timestamp from
      // the source record. We ordered each list desc already; since they're
      // mixed we sort by id (ULID-like → time-orderable) as approximation.
      return String(b.id).localeCompare(String(a.id))
    })
    .slice(0, 12)

  // Tesorería: derivar saldos del runway report (USDT) + Bs pendiente del pago móvil
  const usdtTotal = runway?.usdt_balance ?? 0
  const bsPending = pagoMovils.reduce((s, p) => s + (Number(p.bs_pending) || 0), 0)

  // Anomalías para banner top
  const history6m = aggregateByMonth(pagoMovils, expenses, lastNMonths(6))
  const anomalies = detectAnomalies(history6m)
  const criticalAnomalies = anomalies.filter((a) => a.severity === "critical")

  return (
    <div className="p-7 space-y-5 relative">
      <PageWatermark char="€" />

      <PageHeader
        title="FINANZAS"
        stamp={runway && (<>
          {runway.level === "ok" ? "RUNWAY SANO"
           : runway.level === "warning" ? "RUNWAY ATENCIÓN"
           : "RUNWAY CRÍTICO"}
        </>)}
        stampTone={runway?.level === "ok" ? "secondary" : runway?.level === "warning" ? "orange" : "primary"}
        description={
          <>
            <span className="capitalize">{monthLabel}</span> · revenue <span className="text-ink font-bold">{fmtEur(revenueMonth)}</span>
            {revenueMonth > 0 && <> · margen <span className="text-ink font-bold">{marginPct.toFixed(1)}%</span></>}
            {runway?.runway_months != null && <> · runway <span className="text-ink font-bold num">{runway.runway_months.toFixed(1)} meses</span></>}
          </>
        }
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <MonthSelector month={monthToShow ?? new Date().toISOString().slice(0, 7)} />
            <FinanzasHeaderActions wallets={summary?.wallets ?? []} />
          </div>
        }
      />

      <FinanzasNav />

      {sessionExpired && (
        <div className="stamp-card p-4 bg-primary/5" style={{ borderColor: "#BB3B2E" }}>
          <p className="text-[13px] font-medium text-primary">Sesión expirada. Recarga la página.</p>
        </div>
      )}

      {/* Banner anomalías críticas — dismissable */}
      <DismissibleAlerts anomalies={criticalAnomalies} />

      {/* Tesorería + Buckets/KPIs */}
      <div className="grid grid-cols-12 gap-5">
        <div className="col-span-7 stamp-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-display font-black text-[16px] text-ink uppercase tracking-tight">Tesorería</h3>
              <p className="text-[11px] text-ink-3 font-medium mt-0.5">USDT balance + Bs pendientes de conversión</p>
            </div>
            <span className="text-[10px] text-ink-3 font-mono">usa "Conversión" en el header ↑</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <WalletsBreakdown
                balances={summary?.wallets ?? []}
                error={summaryError}
                fallbackUsdt={usdtTotal}
                fallbackBurnLabel={runway ? `burn $${runway.monthly_burn_actual_usdt.toFixed(0)}/mes` : "—"}
              />
            </div>
            <WalletCard
              label="Bs · Pago Móvil pendiente"
              amount={`Bs ${bsPending.toLocaleString("es-VE", { maximumFractionDigits: 0 })}`}
              sub={pagoMovils.length > 0 ? `${pagoMovils.filter(p => Number(p.bs_pending) > 0).length} pedidos sin convertir` : "—"}
              tone={bsPending > 100_000 ? "orange" : undefined}
              extra={bsPending > 100_000 ? (
                <span className="vintage-stamp text-orange" style={{ background: "rgb(var(--surface))" }}>⚠ CONVERTIR</span>
              ) : null}
            />
            <KpiBlock label="Revenue mes"  value={fmtEur(revenueMonth)} sub={`${monthOrdersCount} pedidos`} tone="secondary" />
            <KpiBlock label="Margen mes"   value={fmtEur(marginMonth)}  sub={`${marginPct.toFixed(1)}% · COGS ${fmtEur(cogsMonth)}`} />
          </div>
        </div>

        {/* Runway card */}
        <div className="col-span-5 stamp-card p-5 relative overflow-hidden">
          <div className="watermark-amp text-[140px] -top-2 right-0 select-none italic">€</div>
          <div className="flex items-center justify-between mb-2 relative">
            <h3 className="font-display font-black text-[16px] uppercase tracking-tight">Runway</h3>
            {runway && (
              <span className={`vintage-stamp ${runway.level === "ok" ? "text-secondary" : runway.level === "warning" ? "text-orange" : "text-primary"}`}
                    style={{ background: "rgb(var(--surface))" }}>
                {runway.level === "ok" ? "SANO" : runway.level === "warning" ? "ATENCIÓN" : "CRÍTICO"}
              </span>
            )}
          </div>
          {runway ? (
            <>
              <div className="stat-display text-[42px] num">
                {runway.runway_months != null ? runway.runway_months.toFixed(1) : "∞"}
                <span className="text-[18px] text-ink-3"> meses</span>
              </div>
              <div className="dotted-div my-3" />
              <dl className="text-[12px] space-y-1.5 font-mono">
                <div className="flex justify-between">
                  <dt className="text-ink-3">Wallet USDT</dt>
                  <dd className="font-display font-bold num text-secondary">${runway.usdt_balance.toFixed(2)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ink-3">Burn target</dt>
                  <dd className="num">${runway.monthly_burn_target_usdt.toFixed(0)}/mes</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ink-3">Burn real (3m)</dt>
                  <dd className="num">${runway.monthly_burn_actual_usdt.toFixed(0)}/mes</dd>
                </div>
              </dl>
              {runway.history_3m.length > 0 && (
                <>
                  <div className="dotted-div my-3" />
                  <div className="grid grid-cols-3 gap-2 text-center">
                    {runway.history_3m.map((h) => (
                      <div key={h.month} className="p-2" style={{ border: "1px solid var(--border-soft)", borderRadius: 2 }}>
                        <div className="text-[8px] text-ink-3 font-display font-bold uppercase tracking-wider">{h.month}</div>
                        <div className="font-display font-black text-[14px] num mt-1">${h.spent_usdt.toFixed(0)}</div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          ) : (
            <p className="text-[12px] text-ink-3">No se pudo calcular el runway (revisa wallet USDT y categorías recurrentes).</p>
          )}
        </div>
      </div>

      {/* Desglose de splits (gastos fijos / stock / marketing / ganancia) */}
      {summary && <SplitsBreakdown summary={summary} />}

      {/* Movimientos + Notas */}
      <div className="grid grid-cols-12 gap-5">
        <div className="col-span-8 stamp-card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 bg-dark text-cream">
            <h3 className="font-display font-black text-[14px] uppercase tracking-wider">Movimientos Recientes</h3>
            <span className="text-[10px] text-cream/60 font-mono">{feed.length} de {pagoMovils.length + conversions.length + expenses.length}</span>
          </div>
          {feed.length === 0 ? (
            <div className="p-10 text-center text-ink-3 text-[13px]">
              Sin movimientos registrados todavía.
            </div>
          ) : (
            <div className="divide-y divide-warm-200/50">
              {feed.map((m) => (
                <div key={`${m.kind}-${m.id}`} className="p-4 row-hover flex items-center gap-3">
                  <div className={`w-10 h-10 ${m.iconBg} flex items-center justify-center font-display font-black text-[15px]`}
                       style={{ border: `1.5px solid ${m.iconBorder}` }}>
                    {m.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-display font-bold text-ink text-[13px] truncate">{m.title}</div>
                    <div className="text-[10px] text-ink-3 font-mono truncate">{m.sub}</div>
                  </div>
                  <div className="text-right">
                    <div className={`font-display font-black text-[15px] num ${m.tone === "primary" ? "text-primary" : m.tone === "orange" ? "text-orange" : "text-secondary"}`}>
                      {m.amount}
                    </div>
                    <div className="text-[10px] text-ink-3 font-mono">{m.time}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Notas */}
        <div className="col-span-4 stamp-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <h3 className="font-display font-black text-[14px] uppercase tracking-wider">Notas del mes</h3>
            <span className="ml-auto pill text-orange">{comments.length}</span>
          </div>
          {comments.length === 0 ? (
            <p className="text-[12px] text-ink-3">Sin notas registradas. Agrega la primera para hacer seguimiento de decisiones financieras.</p>
          ) : (
            <div className="space-y-2 text-[11px]">
              {comments.map((c) => (
                <div key={c.id} className="p-2 bg-orange/5" style={{ borderLeft: "3px solid #FF3B27" }}>
                  <div className="font-display font-bold text-ink line-clamp-2">{c.body}</div>
                  <div className="text-[9px] text-ink-3 font-mono mt-1 uppercase">
                    {c.author_name ?? c.author_email ?? "Anon"} · {fmtRelative(c.created_at)}
                  </div>
                </div>
              ))}
            </div>
          )}
          <p className="text-center mt-3 text-[10px] text-ink-3 font-mono uppercase tracking-wider">
            comentarios desde el detalle del pedido
          </p>
        </div>
      </div>
    </div>
  )
}

function WalletCard({
  label, amount, sub, tone, extra,
}: {
  label: string; amount: string; sub: string; tone?: "secondary" | "orange"; extra?: React.ReactNode
}) {
  const bg = tone === "secondary" ? "bg-secondary/5" : tone === "orange" ? "bg-orange/5" : ""
  const border = tone === "secondary" ? "#4D5431" : tone === "orange" ? "#FF3B27" : "var(--border-soft)"
  const labelClass = tone === "secondary" ? "text-secondary" : tone === "orange" ? "text-orange" : "text-ink-3"
  const amountClass = tone === "secondary" ? "text-secondary" : tone === "orange" ? "text-orange" : ""
  return (
    <div className={`p-4 ${bg}`} style={{ border: `1.5px solid ${border}`, borderRadius: 3 }}>
      <div className="flex items-center justify-between mb-2">
        <div className={`text-[9px] font-display font-bold uppercase tracking-[0.18em] ${labelClass}`}>{label}</div>
        {extra}
      </div>
      <div className={`stat-display text-[26px] num ${amountClass}`}>{amount}</div>
      <div className="text-[10px] text-ink-3 font-mono mt-1">{sub}</div>
    </div>
  )
}

function KpiBlock({
  label, value, sub, tone,
}: {
  label: string; value: string; sub: string; tone?: "primary" | "orange" | "secondary"
}) {
  const bg = tone === "primary" ? "bg-primary/5" : tone === "orange" ? "bg-orange/5" : tone === "secondary" ? "bg-secondary/5" : ""
  const labelTone = tone === "primary" ? "text-primary" : tone === "orange" ? "text-orange" : tone === "secondary" ? "text-secondary" : "text-ink-3"
  const valueTone = tone === "primary" ? "text-primary" : tone === "orange" ? "text-orange" : tone === "secondary" ? "text-secondary" : ""
  return (
    <div className={`p-4 ${bg}`} style={{ border: "1.5px solid var(--border-soft)", borderRadius: 3 }}>
      <div className={`text-[9px] font-display font-bold uppercase tracking-[0.18em] ${labelTone}`}>{label}</div>
      <div className={`stat-display text-[24px] mt-2 num ${valueTone}`}>{value}</div>
      <div className="text-[10px] text-ink-3 font-mono mt-1">{sub}</div>
    </div>
  )
}
