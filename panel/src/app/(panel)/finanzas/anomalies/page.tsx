import Link from "next/link"
import { ArrowLeft, AlertTriangle, AlertCircle, CheckCircle2, Info } from "lucide-react"
import { PageHeader, PageWatermark } from "@/components/layout/PageHeader"
import { FinanzasNav } from "../FinanzasNav"
import { listPagoMovil, listFinanzasExpenses, MedusaError } from "@/lib/medusa"
import { aggregateByMonth, lastNMonths, detectAnomalies, type Anomaly } from "../_lib"
import { fmtEur } from "@/lib/utils"

export default async function AnomaliesPage() {
  const [pmR, expR] = await Promise.allSettled([
    listPagoMovil({ limit: 1000 }),
    listFinanzasExpenses({ limit: 500 }),
  ])

  let errorMsg: string | null = null
  const pagoMovils = pmR.status === "fulfilled" ? pmR.value.pago_movils : []
  const pagoMovilCount = pmR.status === "fulfilled" ? pmR.value.count : 0
  const expenses = expR.status === "fulfilled" ? expR.value.expenses : []

  // Fix #4: detectar truncación — las anomalías se detectan sobre el histórico
  // filtrado localmente; si hay más pedidos que los devueltos, algunas tendencias
  // pueden no detectarse correctamente.
  const pagoMovilTruncated = pagoMovilCount > pagoMovils.length

  if ([pmR, expR].some((r) => r.status === "rejected" && r.reason instanceof MedusaError && r.reason.status === 401)) {
    errorMsg = "Sesión expirada. Recarga la página."
  }

  const history = aggregateByMonth(pagoMovils, expenses, lastNMonths(6))
  const anomalies = detectAnomalies(history)

  // Inventario de pago_movils sospechosos
  const negativeMargin = pagoMovils.filter((p) => Number(p.amount_eur_margin) < 0)
  const incompleteCogs = pagoMovils.filter((p) => !p.cogs_complete)
  const stalePending = pagoMovils.filter((p) => {
    return Number(p.bs_pending) > 0 && (Date.now() - new Date(p.created_at).getTime()) > 60 * 86400 * 1000
  })

  const critical = anomalies.filter((a) => a.severity === "critical").length
  const warning = anomalies.filter((a) => a.severity === "warning").length
  const info = anomalies.filter((a) => a.severity === "info").length
  const allClear = critical === 0 && warning === 0 && negativeMargin.length === 0 && incompleteCogs.length === 0 && stalePending.length === 0

  return (
    <div className="p-7 space-y-5 relative">
      <PageWatermark char="!" />

      <Link href="/finanzas" className="inline-flex items-center gap-1 text-[11px] font-display font-bold uppercase tracking-wider text-ink-3 hover:text-orange">
        <ArrowLeft size={12} strokeWidth={2.5} /> Finanzas
      </Link>

      <PageHeader
        title="ALERTAS"
        stamp={
          allClear ? "TODO OK" :
          critical > 0 ? `${critical} CRÍTICAS` :
          `${warning} ATENCIÓN`
        }
        stampTone={allClear ? "secondary" : critical > 0 ? "primary" : "orange"}
        description={`${critical} críticas · ${warning} warnings · ${info} info · ${negativeMargin.length} pedidos con margen negativo · ${incompleteCogs.length} sin COGS · ${stalePending.length} stale > 60d`}
      />

      <FinanzasNav />

      {errorMsg && (
        <div className="stamp-card p-4 bg-primary/5" style={{ borderColor: "#BB3B2E" }}>
          <p className="text-[13px] font-medium text-primary">{errorMsg}</p>
        </div>
      )}

      {/* Fix #4: aviso de truncación — detección de anomalías puede estar incompleta */}
      {pagoMovilTruncated && (
        <div className="stamp-card p-4 bg-orange/5 flex items-start gap-3" style={{ borderColor: "#FF3B27" }}>
          <AlertTriangle size={16} className="text-orange flex-shrink-0 mt-0.5" strokeWidth={2.5} />
          <div>
            <p className="font-display font-bold text-[12px] uppercase tracking-wider text-orange">
              Análisis de anomalías basado en datos parciales
            </p>
            <p className="text-[11px] text-ink-2 mt-1 font-mono">
              Se cargaron {pagoMovils.length} de {pagoMovilCount} pedidos totales. Tendencias y revenue
              histórico pueden estar incompletos — algunas anomalías pueden no detectarse.
            </p>
          </div>
        </div>
      )}

      {/* Estado general */}
      {allClear && !errorMsg ? (
        <div className="stamp-card p-10 text-center bg-secondary/5" style={{ borderColor: "#4D5431" }}>
          <CheckCircle2 size={48} className="text-secondary mx-auto mb-3" strokeWidth={2} />
          <p className="font-display font-black text-[20px] uppercase tracking-tight text-secondary">Todo en orden</p>
          <p className="text-[12px] text-ink-3 mt-1">No detectamos anomalías en revenue, gastos ni reconciliación.</p>
        </div>
      ) : (
        <>
          {/* Anomalías derivadas del histórico */}
          {anomalies.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-[10px] font-display font-bold uppercase tracking-[0.18em] text-ink-3">Tendencias mensuales</h3>
              {anomalies.map((a, i) => <AnomalyCard key={i} anomaly={a} />)}
            </div>
          )}

          {/* Pedidos con margen negativo */}
          {negativeMargin.length > 0 && (
            <div className="stamp-card overflow-hidden" style={{ borderColor: "#BB3B2E" }}>
              <div className="flex items-center justify-between px-5 py-3 bg-primary/10">
                <div className="flex items-center gap-2">
                  <AlertCircle size={14} className="text-primary" strokeWidth={2.5} />
                  <h3 className="font-display font-black text-[12px] uppercase tracking-wider text-primary">
                    Pedidos con margen NEGATIVO
                  </h3>
                </div>
                <span className="text-[10px] font-mono text-primary">{negativeMargin.length} pedidos</span>
              </div>
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="bg-cream-2 text-[10px] uppercase tracking-[0.12em]" style={{ borderBottom: "1.5px solid var(--border)" }}>
                    <th className="px-3 py-2 text-left font-display font-bold text-ink-2">Pedido</th>
                    <th className="px-3 py-2 text-left font-display font-bold text-ink-2">Cliente</th>
                    <th className="px-3 py-2 text-right font-display font-bold text-ink-2">Revenue</th>
                    <th className="px-3 py-2 text-right font-display font-bold text-ink-2">COGS</th>
                    <th className="px-3 py-2 text-right font-display font-bold text-ink-2">Margen</th>
                  </tr>
                </thead>
                <tbody>
                  {negativeMargin.slice(0, 20).map((p) => (
                    <tr key={p.id} className="row-zebra row-hover border-b border-warm-200/50 last:border-b-0">
                      <td className="px-3 py-2">
                        <Link href={`/orders/${p.order_id}`} className="font-mono font-bold text-ink hover:text-orange">
                          #{p.order_display_id}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-ink-2">{p.customer_name ?? p.order_email ?? "—"}</td>
                      <td className="px-3 py-2 text-right num">{fmtEur(Number(p.amount_eur_total) || 0)}</td>
                      <td className="px-3 py-2 text-right num text-primary">{fmtEur(Number(p.amount_eur_cogs) || 0)}</td>
                      <td className="px-3 py-2 text-right num text-primary font-display font-bold">
                        {fmtEur(Number(p.amount_eur_margin) || 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pedidos sin COGS completo */}
          {incompleteCogs.length > 0 && (
            <div className="stamp-card overflow-hidden" style={{ borderColor: "#FF3B27" }}>
              <div className="flex items-center justify-between px-5 py-3 bg-orange/10">
                <div className="flex items-center gap-2">
                  <Info size={14} className="text-orange" strokeWidth={2.5} />
                  <h3 className="font-display font-black text-[12px] uppercase tracking-wider text-orange">
                    Pedidos sin COGS completo
                  </h3>
                </div>
                <span className="text-[10px] font-mono text-orange">{incompleteCogs.length} pedidos</span>
              </div>
              <p className="px-5 py-2 text-[11px] text-ink-3">
                Estos pedidos tienen variants sin <code>cogs_eur</code> registrado. El margen mostrado puede estar inflado.
              </p>
              <ul className="divide-y divide-warm-200/50 max-h-60 overflow-y-auto">
                {incompleteCogs.slice(0, 30).map((p) => (
                  <li key={p.id} className="px-5 py-2 text-[11px] flex items-center justify-between">
                    <Link href={`/orders/${p.order_id}`} className="font-mono font-bold text-ink hover:text-orange">
                      #{p.order_display_id} · {p.customer_name ?? p.order_email ?? "—"}
                    </Link>
                    <span className="num text-ink-3">{fmtEur(Number(p.amount_eur_total) || 0)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Stale Bs pendientes */}
          {stalePending.length > 0 && (
            <div className="stamp-card overflow-hidden" style={{ borderColor: "#BB3B2E" }}>
              <div className="flex items-center justify-between px-5 py-3 bg-primary/10">
                <div className="flex items-center gap-2">
                  <AlertCircle size={14} className="text-primary" strokeWidth={2.5} />
                  <h3 className="font-display font-black text-[12px] uppercase tracking-wider text-primary">
                    Bs pendientes &gt;60 días sin convertir
                  </h3>
                </div>
                <span className="text-[10px] font-mono text-primary">{stalePending.length} pedidos</span>
              </div>
              <p className="px-5 py-2 text-[11px] text-ink-3">
                El BCV puede haber subido significativamente — revisar si hay impacto cambiario.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function AnomalyCard({ anomaly }: { anomaly: Anomaly }) {
  const severityMeta = {
    critical: { color: "#BB3B2E", bg: "bg-primary/5", icon: <AlertCircle size={16} className="text-primary" strokeWidth={2.5} /> },
    warning:  { color: "#FF3B27", bg: "bg-orange/5",  icon: <AlertTriangle size={16} className="text-orange" strokeWidth={2.5} /> },
    info:     { color: "#4D5431", bg: "bg-secondary/5", icon: <Info size={16} className="text-secondary" strokeWidth={2.5} /> },
  }[anomaly.severity]

  return (
    <div className={`stamp-card p-4 ${severityMeta.bg}`} style={{ borderColor: severityMeta.color }}>
      <div className="flex items-start gap-3">
        {severityMeta.icon}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="font-display font-black text-[14px] uppercase tracking-tight" style={{ color: severityMeta.color }}>
              {anomaly.title}
            </span>
            <span className="text-[9px] font-display font-bold uppercase tracking-wider text-ink-3">
              · {anomaly.kind}
            </span>
          </div>
          <p className="text-[11px] text-ink-2 mt-1 font-mono">{anomaly.detail}</p>
        </div>
      </div>
    </div>
  )
}
