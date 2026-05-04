import { Tag, Zap } from "lucide-react"
import { PageHeader, PageWatermark } from "@/components/layout/PageHeader"
import { Breadcrumbs } from "@/components/ui/Breadcrumbs"
import { MarketingNav } from "../MarketingNav"
import { listPromotions, MedusaError, type AdminPromotion } from "@/lib/medusa"
import { PromotionsManager } from "../PromotionsManager"

export default async function PromotionsPage() {
  const r = await listPromotions({ limit: 100 }).catch((e) => {
    if (e instanceof MedusaError) return { promotions: [] as AdminPromotion[], count: 0, offset: 0, limit: 100, _error: e.message }
    throw e
  })

  const promotions: AdminPromotion[] = r.promotions
  const error = "_error" in r ? r._error : null

  const active = promotions.filter((p) => p.status === "active").length
  const inactive = promotions.filter((p) => p.status === "inactive").length
  const automatic = promotions.filter((p) => p.is_automatic).length
  const manual = promotions.length - automatic

  return (
    <div className="p-7 space-y-5 relative">
      <PageWatermark char="%" />

      <Breadcrumbs items={[{ label: "Marketing", href: "/marketing" }, { label: "Promos" }]} />

      <PageHeader
        title="PROMOCIONES"
        stamp={<>{active} ACTIVAS</>}
        stampTone="orange"
        description={`${promotions.length} totales · ${manual} manuales · ${automatic} automáticas · ${inactive} pausadas`}
      />

      <MarketingNav />

      {error && (
        <div className="stamp-card p-4 bg-primary/5" style={{ borderColor: "#BB3B2E" }}>
          <p className="text-[13px] font-medium text-primary">{error}</p>
        </div>
      )}

      {/* KPI strip */}
      <div className="grid grid-cols-4 gap-3">
        <Kpi label="Activas"      value={String(active)}    sub="visibles al checkout" tone="secondary" icon={<Zap size={12} className="text-secondary" />} />
        <Kpi label="Manuales"     value={String(manual)}    sub="se aplican con código" />
        <Kpi label="Automáticas"  value={String(automatic)} sub="aplican solas si cumplen reglas" tone="orange" />
        <Kpi label="Pausadas"     value={String(inactive)}  sub="ignoradas por el storefront" tone="primary" />
      </div>

      {/* Manager */}
      <div className="stamp-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 bg-dark text-cream">
          <div className="flex items-center gap-2">
            <Tag size={14} strokeWidth={2.5} />
            <h3 className="font-display font-black text-[14px] uppercase tracking-wider">Códigos & promociones</h3>
          </div>
        </div>
        <div className="p-3">
          <PromotionsManager
            rows={promotions.map((p) => {
              const ruleSummary = p.rules && p.rules.length > 0
                ? p.rules
                    .map((r) => {
                      const vals = (r.values ?? [])
                        .map((v) => (typeof v === "string" ? v : v.value))
                        .join(",")
                      return `${r.attribute} ${r.operator} ${vals}`
                    })
                    .join(" · ")
                : "sin reglas"
              return {
                id: p.id,
                code: p.code,
                status: p.status,
                is_automatic: p.is_automatic,
                type: p.application_method?.type ?? "percentage",
                value: p.application_method?.value ?? 0,
                ruleSummary,
              }
            })}
          />
        </div>
      </div>
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
