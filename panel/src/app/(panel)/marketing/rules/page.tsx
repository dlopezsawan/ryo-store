import { AlertCircle, Activity, Send, MessageCircle } from "lucide-react"
import { PageHeader, PageWatermark } from "@/components/layout/PageHeader"
import { Breadcrumbs } from "@/components/ui/Breadcrumbs"
import { MarketingNav } from "../MarketingNav"
import { listRemarketingRulesFull, MedusaError, type RemarketingRuleFull } from "@/lib/medusa"
import { RulesClient } from "./RulesClient"

export default async function RulesPage() {
  let rules: RemarketingRuleFull[] = []
  let errorMsg: string | null = null
  try {
    const r = await listRemarketingRulesFull()
    rules = r.rules
  } catch (e) {
    errorMsg = e instanceof MedusaError
      ? `Backend ${e.status}: ${e.message}`
      : (e instanceof Error ? e.message : "error")
  }

  const enabled = rules.filter((r) => r.enabled).length
  const totalFires = rules.reduce((s, r) => s + (r.stats?.fires_total ?? 0), 0)
  const totalConverted = rules.reduce((s, r) => s + (r.stats?.converted ?? 0), 0)
  const convRate = totalFires > 0 ? (totalConverted / totalFires) * 100 : 0

  return (
    <div className="p-7 space-y-5 relative">
      <PageWatermark char="%" />

      <Breadcrumbs items={[{ label: "Marketing", href: "/marketing" }, { label: "Reglas" }]} />

      <PageHeader
        title="REGLAS DE REMARKETING"
        stamp={<>{enabled} ACTIVAS · {convRate.toFixed(1)}% CONV</>}
        stampTone={enabled > 0 ? "secondary" : "primary"}
        description={`${rules.length} reglas configuradas · ${totalFires.toLocaleString()} envíos · ${totalConverted.toLocaleString()} conversiones`}
      />

      <MarketingNav />

      {errorMsg && (
        <div className="stamp-card p-4 bg-primary/5" style={{ borderColor: "#BB3B2E" }}>
          <div className="flex items-center gap-2">
            <AlertCircle size={14} className="text-primary" strokeWidth={2.5} />
            <p className="text-[13px] font-medium text-primary">{errorMsg}</p>
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-3">
        <Kpi label="Reglas activas" value={`${enabled}/${rules.length}`} sub="enabled" tone="secondary" icon={<Activity size={12} className="text-secondary" />} />
        <Kpi label="Envíos totales" value={totalFires.toLocaleString()} sub="acumulado" />
        <Kpi label="Conversiones" value={totalConverted.toLocaleString()} sub="post-fire orders" tone="orange" icon={<Send size={12} className="text-orange" />} />
        <Kpi label="Tasa conversión" value={`${convRate.toFixed(1)}%`} sub={convRate > 5 ? "muy bien" : convRate > 1 ? "moderada" : "baja"}
          tone={convRate > 5 ? "secondary" : convRate > 1 ? "orange" : "primary"} icon={<MessageCircle size={12} />} />
      </div>

      <RulesClient rules={rules} />
    </div>
  )
}

function Kpi({ label, value, sub, tone, icon }: { label: string; value: string; sub: string; tone?: "primary" | "secondary" | "orange"; icon?: React.ReactNode }) {
  const bg = tone === "primary" ? "bg-primary/5" : tone === "secondary" ? "bg-secondary/5" : tone === "orange" ? "bg-orange/5" : ""
  const labelTone = tone === "primary" ? "text-primary" : tone === "secondary" ? "text-secondary" : tone === "orange" ? "text-orange" : "text-ink-3"
  const valueTone = tone === "primary" ? "text-primary" : tone === "secondary" ? "text-secondary" : tone === "orange" ? "text-orange" : ""
  return (
    <div className={`stamp-card p-4 ${bg}`}>
      <div className="flex items-center gap-1.5 mb-1">{icon}<div className={`text-[9px] font-display font-bold uppercase tracking-[0.18em] ${labelTone}`}>{label}</div></div>
      <div className={`stat-display text-[24px] mt-1 num ${valueTone}`}>{value}</div>
      <div className="text-[10px] mt-1 text-ink-3 font-mono">{sub}</div>
    </div>
  )
}
