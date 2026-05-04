import { Target, Info } from "lucide-react"
import { PageHeader, PageWatermark } from "@/components/layout/PageHeader"
import { MarketingNav } from "../MarketingNav"
import { listOrders, MedusaError } from "@/lib/medusa"
import { attributionBreakdown, type AttributionSource } from "../_lib"
import { fmtEur } from "@/lib/utils"
import { Breadcrumbs } from "@/components/ui/Breadcrumbs"
import { EmptyState } from "@/components/ui/EmptyState"

export default async function AttributionPage() {
  const r = await listOrders({ limit: 1000 }).catch((e) => {
    if (e instanceof MedusaError) return { orders: [], count: 0, _error: e.message }
    throw e
  })
  const orders = r.orders
  const error = "_error" in r ? r._error : null

  const sources = attributionBreakdown(orders)

  // Group by source (sin medium/campaign) para vista resumida
  const bySource = new Map<string, { source: string; orders: number; revenue: number; color: string }>()
  for (const s of sources) {
    const cur = bySource.get(s.source) ?? { source: s.source, orders: 0, revenue: 0, color: s.color }
    cur.orders += s.orders
    cur.revenue += s.revenue
    bySource.set(s.source, cur)
  }
  const sourceAgg = Array.from(bySource.values()).sort((a, b) => b.revenue - a.revenue)
  const totalRevenue = sourceAgg.reduce((s, x) => s + x.revenue, 0)
  for (const s of sourceAgg) {
    (s as AttributionSource).pct = totalRevenue > 0 ? (s.revenue / totalRevenue) * 100 : 0
  }

  // Flag: ¿hay attribution data?
  const totalOrders = orders.length
  const attributedOrders = orders.filter((o) => {
    const meta = (o as { metadata?: Record<string, unknown> }).metadata ?? {}
    return (
      meta.attribution_utm_source ||
      meta.utm_source ||
      meta.source ||
      meta.source_channel
    )
  }).length
  const attributionRate = totalOrders > 0 ? (attributedOrders / totalOrders) * 100 : 0

  return (
    <div className="p-7 space-y-5 relative">
      <PageWatermark char="%" />

      <Breadcrumbs items={[{ label: "Marketing", href: "/marketing" }, { label: "Attribution" }]} />

      <PageHeader
        title="ATTRIBUTION"
        stamp={<>{attributionRate.toFixed(0)}% TRACKEADO</>}
        stampTone={attributionRate > 60 ? "secondary" : attributionRate > 20 ? "orange" : "primary"}
        description={`${attributedOrders}/${totalOrders} pedidos con UTM o source · revenue total ${fmtEur(totalRevenue)}`}
      />

      <MarketingNav />

      {error && (
        <div className="stamp-card p-4 bg-primary/5" style={{ borderColor: "#BB3B2E" }}>
          <p className="text-[13px] font-medium text-primary">{error}</p>
        </div>
      )}

      {/* Hint si no hay attribution data */}
      {attributionRate < 20 && (
        <div className="stamp-card p-4 bg-orange/5" style={{ borderColor: "#FF3B27" }}>
          <div className="flex items-start gap-2">
            <Info size={16} className="text-orange flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-display font-bold text-[12px] uppercase tracking-wider text-orange">Tracking limitado</p>
              <p className="text-[11px] text-ink-3 mt-1">
                Solo {attributionRate.toFixed(0)}% de pedidos tienen UTM tags. Para activar attribution completo, asegúrate que el storefront capture
                <code className="font-mono mx-1 px-1 bg-cream-2/50 rounded">utm_source / utm_medium / utm_campaign</code>
                de la URL al crear el cart, y los persista en <code className="font-mono mx-1 px-1 bg-cream-2/50 rounded">order.metadata</code>.
              </p>
            </div>
          </div>
        </div>
      )}

      {sourceAgg.length === 0 ? (
        <EmptyState
          icon={Target}
          title="Sin datos de attribution"
          description={
            <>
              Ningún pedido contiene metadata de <code className="font-mono px-1 bg-cream-2 rounded">utm_source</code>{" "}
              o <code className="font-mono px-1 bg-cream-2 rounded">attribution_*</code>. Las orders nuevas con UTM
              en la URL aparecerán acá automáticamente.
            </>
          }
        />
      ) : (
        <>
          {/* Donut breakdown */}
          <div className="grid grid-cols-12 gap-5">
            <div className="col-span-5 stamp-card p-5">
              <h3 className="text-[11px] font-display font-bold uppercase tracking-wider text-ink-3 mb-4">Distribución por source</h3>
              <DonutChart data={sourceAgg.map((s) => ({ label: s.source, value: s.revenue, color: s.color }))} />
            </div>
            <div className="col-span-7 stamp-card overflow-hidden">
              <div className="px-5 py-3 bg-cream-2">
                <h3 className="font-display font-black text-[12px] uppercase tracking-wider text-ink">Por source · revenue</h3>
              </div>
              <ul className="divide-y divide-warm-200/50">
                {sourceAgg.map((s) => (
                  <li key={s.source} className="p-3 flex items-center gap-3">
                    <div className="w-9 h-9 flex items-center justify-center font-display font-black text-[12px] text-white"
                      style={{ background: s.color, border: "1.5px solid #1A1A1A" }}>
                      {s.source.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-display font-bold text-ink text-[13px] capitalize">{s.source}</div>
                      <div className="text-[10px] text-ink-3 font-mono">{s.orders} pedido{s.orders === 1 ? "" : "s"}</div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-display font-black num text-[15px]">{fmtEur(s.revenue)}</div>
                      <div className="text-[10px] text-ink-3 font-mono">{(s as AttributionSource).pct.toFixed(1)}%</div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Tabla detallada source × medium × campaign */}
          <div className="stamp-card overflow-hidden">
            <div className="px-5 py-3 bg-dark text-cream">
              <h3 className="font-display font-black text-[12px] uppercase tracking-wider">Detalle por source × medium × campaign</h3>
            </div>
            <table className="w-full text-[11px]">
              <thead>
                <tr className="bg-cream-2 text-[10px] uppercase tracking-[0.12em]" style={{ borderBottom: "1.5px solid var(--border)" }}>
                  <th className="px-3 py-2 text-left font-display font-bold text-ink-2">Source</th>
                  <th className="px-3 py-2 text-left font-display font-bold text-ink-2">Medium</th>
                  <th className="px-3 py-2 text-left font-display font-bold text-ink-2">Campaign</th>
                  <th className="px-3 py-2 text-right font-display font-bold text-ink-2">Pedidos</th>
                  <th className="px-3 py-2 text-right font-display font-bold text-ink-2">Revenue</th>
                  <th className="px-3 py-2 text-right font-display font-bold text-ink-2">% del total</th>
                  <th className="px-3 py-2 text-right font-display font-bold text-ink-2">AOV</th>
                </tr>
              </thead>
              <tbody>
                {sources.map((s, i) => {
                  const aov = s.orders > 0 ? s.revenue / s.orders : 0
                  return (
                    <tr key={i} className="row-zebra row-hover border-b border-warm-200/50 last:border-b-0">
                      <td className="px-3 py-2">
                        <span className="px-2 py-0.5 text-[10px] font-display font-bold uppercase tracking-wider rounded-md text-white"
                          style={{ background: s.color }}>
                          {s.source}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-mono text-ink-2">{s.medium ?? "—"}</td>
                      <td className="px-3 py-2 font-mono text-ink-2 truncate max-w-[200px]">{s.campaign ?? "—"}</td>
                      <td className="px-3 py-2 text-right num">{s.orders}</td>
                      <td className="px-3 py-2 text-right font-display font-bold num">{fmtEur(s.revenue)}</td>
                      <td className="px-3 py-2 text-right num text-ink-3">{s.pct.toFixed(1)}%</td>
                      <td className="px-3 py-2 text-right num text-orange">{fmtEur(aov)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

function DonutChart({ data }: { data: Array<{ label: string; value: number; color: string }> }) {
  const total = data.reduce((s, d) => s + d.value, 0)
  if (total === 0) return <p className="text-center text-[12px] text-ink-3 py-10">Sin datos</p>

  const size = 200
  const cx = size / 2, cy = size / 2
  const radius = 80
  const inner = 50
  let cumulativeAngle = -Math.PI / 2  // Start at top

  const arcs = data.map((d) => {
    const angle = (d.value / total) * 2 * Math.PI
    const startAngle = cumulativeAngle
    const endAngle = cumulativeAngle + angle
    cumulativeAngle = endAngle

    // Arc path
    const x1 = cx + radius * Math.cos(startAngle), y1 = cy + radius * Math.sin(startAngle)
    const x2 = cx + radius * Math.cos(endAngle),   y2 = cy + radius * Math.sin(endAngle)
    const ix1 = cx + inner * Math.cos(endAngle),   iy1 = cy + inner * Math.sin(endAngle)
    const ix2 = cx + inner * Math.cos(startAngle), iy2 = cy + inner * Math.sin(startAngle)
    const largeArc = angle > Math.PI ? 1 : 0

    const path = [
      `M ${x1.toFixed(2)} ${y1.toFixed(2)}`,
      `A ${radius} ${radius} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`,
      `L ${ix1.toFixed(2)} ${iy1.toFixed(2)}`,
      `A ${inner} ${inner} 0 ${largeArc} 0 ${ix2.toFixed(2)} ${iy2.toFixed(2)}`,
      `Z`,
    ].join(" ")

    return { path, color: d.color, label: d.label, value: d.value, pct: (d.value / total) * 100 }
  })

  return (
    <div className="flex items-center gap-4">
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
        {arcs.map((a, i) => (
          <path key={i} d={a.path} fill={a.color} stroke="white" strokeWidth="1.5">
            <title>{`${a.label}: €${a.value.toFixed(2)} (${a.pct.toFixed(1)}%)`}</title>
          </path>
        ))}
      </svg>
      <ul className="flex-1 space-y-1 text-[11px]">
        {arcs.map((a, i) => (
          <li key={i} className="flex items-center gap-2">
            <span className="w-3 h-3 inline-block flex-shrink-0" style={{ background: a.color }} />
            <span className="capitalize text-ink truncate flex-1">{a.label}</span>
            <span className="font-display font-bold num text-ink-2">{a.pct.toFixed(1)}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
