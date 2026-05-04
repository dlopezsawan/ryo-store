import { GitBranch } from "lucide-react"
import { PageHeader, PageWatermark } from "@/components/layout/PageHeader"
import { Breadcrumbs } from "@/components/ui/Breadcrumbs"
import { MarketingNav } from "../MarketingNav"
import { listOrders, listCustomers, MedusaError } from "@/lib/medusa"
import { buildFunnel, type FunnelStage } from "../_lib"
import { fmtEur } from "@/lib/utils"

export default async function FunnelsPage() {
  const [ordersR, customersR] = await Promise.allSettled([
    listOrders({ limit: 1000 }),
    listCustomers({ limit: 1000 }),
  ])

  let errorMsg: string | null = null
  const orders = ordersR.status === "fulfilled" ? ordersR.value.orders : []
  const customers = customersR.status === "fulfilled" ? customersR.value.customers : []
  if ([ordersR, customersR].some((r) => r.status === "rejected" && r.reason instanceof MedusaError && r.reason.status === 401)) {
    errorMsg = "Sesión expirada. Recarga la página."
  }

  const funnel = buildFunnel(customers, orders)
  const overallConversion = funnel.length > 0 && funnel[0].count > 0
    ? (funnel[funnel.length - 1].count / funnel[0].count) * 100
    : 0

  // Revenue by funnel stage (paid+)
  const revenuePaid = orders
    .filter((o) => o.payment_status === "captured" || o.payment_status === "authorized")
    .reduce((s, o) => s + (Number(o.total) || 0), 0)
  const revenueLost = orders
    .filter((o) => o.payment_status === "not_paid" || o.payment_status === "awaiting")
    .reduce((s, o) => s + (Number(o.total) || 0), 0)

  // AOV (Average Order Value) por etapa
  const aov = orders.length > 0
    ? orders.reduce((s, o) => s + (Number(o.total) || 0), 0) / orders.length
    : 0

  return (
    <div className="p-7 space-y-5 relative">
      <PageWatermark char="%" />

      <Breadcrumbs items={[{ label: "Marketing", href: "/marketing" }, { label: "Funnels" }]} />

      <PageHeader
        title="FUNNELS"
        stamp={<>{overallConversion.toFixed(1)}% CONVERSIÓN</>}
        stampTone={overallConversion > 5 ? "secondary" : overallConversion > 1 ? "orange" : "primary"}
        description={`${customers.length} customers · ${orders.length} pedidos · AOV ${fmtEur(aov)}`}
      />

      <MarketingNav />

      {errorMsg && (
        <div className="stamp-card p-4 bg-primary/5" style={{ borderColor: "#BB3B2E" }}>
          <p className="text-[13px] font-medium text-primary">{errorMsg}</p>
        </div>
      )}

      {/* KPI strip */}
      <div className="grid grid-cols-4 gap-3">
        <Kpi label="Conversión total"   value={`${overallConversion.toFixed(1)}%`} sub="customer → entregado" tone={overallConversion > 5 ? "secondary" : "orange"} />
        <Kpi label="Revenue capturado"   value={fmtEur(revenuePaid)} sub="pedidos pagados+autorizados" tone="secondary" />
        <Kpi label="Revenue en riesgo"   value={fmtEur(revenueLost)} sub="pendientes de pago" tone="orange" />
        <Kpi label="AOV (ticket promedio)" value={fmtEur(aov)} sub="todos los pedidos" />
      </div>

      {/* Funnel visual (horizontal stepped bars) */}
      <div className="stamp-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 bg-dark text-cream">
          <div className="flex items-center gap-2">
            <GitBranch size={14} strokeWidth={2.5} />
            <h3 className="font-display font-black text-[14px] uppercase tracking-wider">Funnel principal</h3>
          </div>
          <span className="text-[10px] text-cream/60 font-mono">tasa vs etapa anterior</span>
        </div>
        <div className="p-5 space-y-3">
          {funnel.map((stage, i) => (
            <FunnelBar key={stage.key} stage={stage} max={funnel[0].count || 1} index={i} />
          ))}
        </div>
      </div>

      {/* Tabla detalle */}
      <div className="stamp-card overflow-hidden">
        <div className="px-5 py-3 bg-cream-2">
          <h3 className="font-display font-black text-[12px] uppercase tracking-wider text-ink">Detalle por etapa</h3>
        </div>
        <table className="w-full text-[12px]">
          <thead>
            <tr className="bg-cream-2 text-[10px] uppercase tracking-[0.12em]" style={{ borderBottom: "1.5px solid var(--border)" }}>
              <th className="px-3 py-2 text-left font-display font-bold text-ink-2">Etapa</th>
              <th className="px-3 py-2 text-right font-display font-bold text-ink-2">Volumen</th>
              <th className="px-3 py-2 text-right font-display font-bold text-ink-2">% vs anterior</th>
              <th className="px-3 py-2 text-right font-display font-bold text-ink-2">% vs total</th>
              <th className="px-3 py-2 text-right font-display font-bold text-ink-2">Pérdida</th>
            </tr>
          </thead>
          <tbody>
            {funnel.map((stage, i) => {
              const prev = i > 0 ? funnel[i - 1] : null
              const lost = prev ? prev.count - stage.count : 0
              return (
                <tr key={stage.key} className="row-zebra row-hover border-b border-warm-200/50 last:border-b-0">
                  <td className="px-3 py-2 font-display font-bold text-ink">
                    <span className="text-ink-3 font-mono mr-2">#{i + 1}</span>{stage.label}
                  </td>
                  <td className="px-3 py-2 text-right font-display font-black num text-[14px]">{stage.count}</td>
                  <td className={`px-3 py-2 text-right num font-display font-bold ${
                    !stage.rateFromPrev ? "text-ink-3" :
                    stage.rateFromPrev >= 50 ? "text-secondary" :
                    stage.rateFromPrev >= 20 ? "text-orange" : "text-primary"
                  }`}>
                    {stage.rateFromPrev != null ? `${stage.rateFromPrev.toFixed(1)}%` : "—"}
                  </td>
                  <td className="px-3 py-2 text-right num text-ink-2">
                    {stage.rateFromStart != null ? `${stage.rateFromStart.toFixed(1)}%` : "—"}
                  </td>
                  <td className={`px-3 py-2 text-right num text-[11px] ${lost > 0 ? "text-primary" : "text-ink-3"}`}>
                    {lost > 0 ? `−${lost}` : "—"}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Insights automáticos */}
      <FunnelInsights funnel={funnel} />
    </div>
  )
}

function FunnelBar({ stage, max, index }: { stage: FunnelStage; max: number; index: number }) {
  const widthPct = max > 0 ? (stage.count / max) * 100 : 0
  const colors = ["#FF3B27", "#FF6B27", "#D4A015", "#4D5431", "#1A1A1A"]
  const color = colors[Math.min(index, colors.length - 1)]
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <span className="font-display font-bold text-[12px] text-ink">{stage.label}</span>
        <span className="text-[11px] font-mono text-ink-3">
          <span className="font-display font-black text-[14px] num text-ink mr-2">{stage.count}</span>
          {stage.rateFromPrev != null && (
            <span className={`${stage.rateFromPrev >= 50 ? "text-secondary" : stage.rateFromPrev >= 20 ? "text-orange" : "text-primary"} font-display font-bold`}>
              {stage.rateFromPrev.toFixed(1)}% vs prev
            </span>
          )}
          {stage.rateFromStart != null && <span className="ml-2">· {stage.rateFromStart.toFixed(1)}% total</span>}
        </span>
      </div>
      <div className="w-full h-7 bg-cream-2 rounded-md overflow-hidden" style={{ border: "1.5px solid var(--border)" }}>
        <div className="h-full transition-all flex items-center justify-end pr-2"
          style={{ width: `${Math.max(widthPct, 1)}%`, background: color, color: "#fff" }}>
          {widthPct > 15 && (
            <span className="text-[10px] font-display font-black uppercase tracking-wider">{stage.count}</span>
          )}
        </div>
      </div>
    </div>
  )
}

function FunnelInsights({ funnel }: { funnel: FunnelStage[] }) {
  const insights: { tone: "primary" | "orange" | "secondary"; text: string }[] = []

  // Find biggest dropoff
  let biggestDropIdx = -1
  let biggestDropPct = 0
  for (let i = 1; i < funnel.length; i++) {
    const dropPct = 100 - (funnel[i].rateFromPrev ?? 100)
    if (dropPct > biggestDropPct) {
      biggestDropPct = dropPct
      biggestDropIdx = i
    }
  }
  if (biggestDropIdx > 0 && biggestDropPct > 30) {
    insights.push({
      tone: biggestDropPct > 70 ? "primary" : "orange",
      text: `Mayor pérdida: ${biggestDropPct.toFixed(0)}% entre "${funnel[biggestDropIdx - 1].label}" y "${funnel[biggestDropIdx].label}"`,
    })
  }

  // Customer activation rate
  if (funnel[0].count > 0 && funnel[1].count > 0) {
    const activationPct = (funnel[1].count / funnel[0].count) * 100
    if (activationPct < 5) {
      insights.push({ tone: "primary", text: `Solo ${activationPct.toFixed(1)}% de clientes han comprado — onboarding débil` })
    } else if (activationPct > 30) {
      insights.push({ tone: "secondary", text: `${activationPct.toFixed(1)}% de clientes activos — base sólida` })
    }
  }

  // Fulfillment rate
  if (funnel[2] && funnel[3]) {
    const fulfillmentPct = funnel[2].count > 0 ? (funnel[3].count / funnel[2].count) * 100 : 0
    if (fulfillmentPct < 70 && funnel[2].count > 0) {
      insights.push({ tone: "orange", text: `${(100 - fulfillmentPct).toFixed(0)}% de pedidos pagados sin preparar — backlog operativo` })
    }
  }

  if (insights.length === 0) return null

  return (
    <div className="stamp-card p-4">
      <h4 className="text-[10px] font-display font-bold uppercase tracking-wider text-ink-3 mb-2">Insights automáticos</h4>
      <ul className="space-y-1.5 text-[12px]">
        {insights.map((ins, i) => (
          <li key={i} className={`flex items-start gap-2 p-2 rounded-md ${
            ins.tone === "primary" ? "bg-primary/5 text-primary" :
            ins.tone === "orange" ? "bg-orange/5 text-orange" :
            "bg-secondary/5 text-secondary"
          }`}>
            <span className="font-display font-bold text-[14px] leading-none">→</span>
            <span className="font-medium">{ins.text}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: "primary" | "secondary" | "orange" }) {
  const bg = tone === "primary" ? "bg-primary/5" : tone === "secondary" ? "bg-secondary/5" : tone === "orange" ? "bg-orange/5" : ""
  const labelTone = tone === "primary" ? "text-primary" : tone === "secondary" ? "text-secondary" : tone === "orange" ? "text-orange" : "text-ink-3"
  const valueTone = tone === "primary" ? "text-primary" : tone === "secondary" ? "text-secondary" : tone === "orange" ? "text-orange" : ""
  return (
    <div className={`stamp-card p-4 ${bg}`}>
      <div className={`text-[9px] font-display font-bold uppercase tracking-[0.18em] ${labelTone}`}>{label}</div>
      <div className={`stat-display text-[24px] mt-2 num ${valueTone}`}>{value}</div>
      <div className="text-[10px] mt-1 text-ink-3 font-mono">{sub}</div>
    </div>
  )
}
