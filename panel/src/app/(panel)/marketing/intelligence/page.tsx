import { AlertCircle, RefreshCw, Link2 } from "lucide-react"
import { PageHeader, PageWatermark } from "@/components/layout/PageHeader"
import { Breadcrumbs } from "@/components/ui/Breadcrumbs"
import { MarketingNav } from "../MarketingNav"
import { getRemarketingIntelligence, MedusaError, type RemarketingIntelligence } from "@/lib/medusa"

export default async function IntelligencePage() {
  let data: RemarketingIntelligence | null = null
  let errorMsg: string | null = null
  try {
    data = await getRemarketingIntelligence()
  } catch (e) {
    errorMsg = e instanceof MedusaError ? `Backend ${e.status}: ${e.message}` : (e instanceof Error ? e.message : "error")
  }

  const replenishment = data?.replenishment_cycles ?? []
  const attach = data?.attach_matrix ?? []

  return (
    <div className="p-7 space-y-5 relative">
      <PageWatermark char="◈" />

      <Breadcrumbs items={[{ label: "Marketing", href: "/marketing" }, { label: "Intel" }]} />

      <PageHeader
        title="INTELLIGENCE"
        stamp={`${replenishment.length} CICLOS · ${attach.length} PAIRS`}
        stampTone="orange"
        description={`Replenishment cycles + cross-sell attach matrix · datos para configurar reglas restock y sugerir bundles`}
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Replenishment cycles */}
        <div className="stamp-card overflow-hidden">
          <div className="px-5 py-3 bg-dark text-cream">
            <div className="flex items-center gap-2">
              <RefreshCw size={14} strokeWidth={2.5} />
              <h3 className="font-display font-black text-[14px] uppercase tracking-wider">Ciclos de reposición</h3>
              <span className="text-[10px] font-mono text-cream/60">· {replenishment.length} productos</span>
            </div>
          </div>
          <p className="text-[11px] text-ink-3 px-5 py-2 bg-cream-2/30">
            Mediana de días entre re-compras del mismo producto. Usá estos números para setear reglas <code className="text-orange">restock_*</code>
          </p>
          {replenishment.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-[12px] text-ink-3">Sin datos suficientes — necesitás clientes que hayan comprado el mismo producto al menos 2 veces</p>
            </div>
          ) : (
            <table className="w-full text-[12px]">
              <thead>
                <tr className="bg-cream-2 text-[10px] uppercase tracking-[0.12em]" style={{ borderBottom: "1.5px solid var(--border)" }}>
                  <th className="px-3 py-2 text-left font-display font-bold text-ink-2">Producto</th>
                  <th className="px-3 py-2 text-right font-display font-bold text-ink-2">Mediana</th>
                  <th className="px-3 py-2 text-right font-display font-bold text-ink-2">Sample</th>
                </tr>
              </thead>
              <tbody>
                {replenishment.slice(0, 30).map((r) => (
                  <tr key={r.product_id} className="row-zebra border-b border-warm-200/50 last:border-b-0">
                    <td className="px-3 py-2 font-display font-bold text-ink truncate max-w-[260px]">{r.product_title}</td>
                    <td className="px-3 py-2 text-right font-display font-bold num text-orange">{r.median_days} días</td>
                    <td className="px-3 py-2 text-right num text-ink-3 text-[10px]">{r.sample_size}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Attach matrix */}
        <div className="stamp-card overflow-hidden">
          <div className="px-5 py-3 bg-dark text-cream">
            <div className="flex items-center gap-2">
              <Link2 size={14} strokeWidth={2.5} />
              <h3 className="font-display font-black text-[14px] uppercase tracking-wider">Cross-sell matrix</h3>
              <span className="text-[10px] font-mono text-cream/60">· top {attach.length} pares</span>
            </div>
          </div>
          <p className="text-[11px] text-ink-3 px-5 py-2 bg-cream-2/30">
            Productos comprados juntos en últimos 90d · attach % = co-orders / anchor-orders
          </p>
          {attach.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-[12px] text-ink-3">Sin pares con co-purchase suficiente todavía</p>
            </div>
          ) : (
            <table className="w-full text-[11px]">
              <thead>
                <tr className="bg-cream-2 text-[10px] uppercase tracking-[0.12em]" style={{ borderBottom: "1.5px solid var(--border)" }}>
                  <th className="px-3 py-2 text-left font-display font-bold text-ink-2">Anchor</th>
                  <th className="px-3 py-2 text-left font-display font-bold text-ink-2">Partner</th>
                  <th className="px-3 py-2 text-right font-display font-bold text-ink-2">Co</th>
                  <th className="px-3 py-2 text-right font-display font-bold text-ink-2">Attach</th>
                </tr>
              </thead>
              <tbody>
                {attach.slice(0, 30).map((a, i) => (
                  <tr key={i} className="row-zebra border-b border-warm-200/50 last:border-b-0">
                    <td className="px-3 py-2 font-display font-bold text-ink truncate max-w-[180px]">{a.anchor_title}</td>
                    <td className="px-3 py-2 text-ink-2 truncate max-w-[180px]">{a.partner_title}</td>
                    <td className="px-3 py-2 text-right num text-ink-3">{a.co_count}/{a.anchor_orders}</td>
                    <td className="px-3 py-2 text-right font-display font-bold num text-orange">{a.attach_pct.toFixed(0)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
