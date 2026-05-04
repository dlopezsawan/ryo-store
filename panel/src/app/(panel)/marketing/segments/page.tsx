import Link from "next/link"
import { Users } from "lucide-react"
import { PageHeader, PageWatermark } from "@/components/layout/PageHeader"
import { Breadcrumbs } from "@/components/ui/Breadcrumbs"
import { MarketingNav } from "../MarketingNav"
import { listOrders, listCustomers, listCustomerGroups, MedusaError } from "@/lib/medusa"
import { computeRfm, SEGMENT_META, type RfmSegment, type RfmScore } from "../_lib"
import { SegmentSyncer } from "./SegmentSyncer"
import { fmtEur } from "@/lib/utils"

export default async function SegmentsPage({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  const params = await searchParams
  const focused = params.s as RfmSegment | undefined

  const [ordersR, customersR, groupsR] = await Promise.allSettled([
    listOrders({ limit: 1000 }),
    listCustomers({ limit: 1000 }),
    listCustomerGroups({ limit: 100 }),
  ])

  let errorMsg: string | null = null
  const orders = ordersR.status === "fulfilled" ? ordersR.value.orders : []
  const customers = customersR.status === "fulfilled" ? customersR.value.customers : []
  const existingGroups = groupsR.status === "fulfilled" ? groupsR.value.customer_groups : []
  if ([ordersR, customersR, groupsR].some((r) => r.status === "rejected" && r.reason instanceof MedusaError && r.reason.status === 401)) {
    errorMsg = "Sesión expirada. Recarga la página."
  }

  const rfm = computeRfm(customers, orders)

  // Group por segment
  const bySegment = new Map<RfmSegment, RfmScore[]>()
  for (const r of rfm) {
    const arr = bySegment.get(r.segment) ?? []
    arr.push(r)
    bySegment.set(r.segment, arr)
  }

  // Lookup grupos existentes (para mostrar "ya sincronizado")
  const groupByName = new Map(existingGroups.map((g) => [g.name, g.id]))

  // Total monetary del periodo
  const totalMonetary = rfm.reduce((s, r) => s + r.monetary, 0)

  // Ordenamiento de segmentos por valor estratégico
  const SEGMENT_ORDER: RfmSegment[] = [
    "champions", "loyal", "potential_loyalist", "new_customers", "promising",
    "at_risk", "cant_lose", "hibernating", "lost",
  ]

  return (
    <div className="p-7 space-y-5 relative">
      <PageWatermark char="%" />

      <Breadcrumbs items={[{ label: "Marketing", href: "/marketing" }, { label: "Segmentos" }]} />

      <PageHeader
        title="SEGMENTOS RFM"
        stamp={<>{rfm.length} CON COMPRA · {customers.length - rfm.length} PROSPECTOS</>}
        stampTone="orange"
        description={`Recency / Frequency / Monetary · ${rfm.length} customers analizados · €${totalMonetary.toFixed(0)} ingresos totales`}
      />

      <MarketingNav />

      {errorMsg && (
        <div className="stamp-card p-4 bg-primary/5" style={{ borderColor: "#BB3B2E" }}>
          <p className="text-[13px] font-medium text-primary">{errorMsg}</p>
        </div>
      )}

      {rfm.length === 0 ? (
        <div className="stamp-card p-10 text-center">
          <Users size={48} className="text-ink-3 mx-auto mb-3" strokeWidth={1.5} />
          <p className="font-display font-bold text-[14px] uppercase tracking-wider text-ink-3">Sin clientes con compras todavía</p>
          <p className="text-[12px] text-ink-3 mt-1">El RFM necesita al menos 1 pedido para clasificar customers.</p>
        </div>
      ) : (
        <>
          {/* Grid de segmentos */}
          <div className="grid grid-cols-3 gap-3">
            {SEGMENT_ORDER.map((seg) => {
              const arr = bySegment.get(seg) ?? []
              const meta = SEGMENT_META[seg]
              const segMonetary = arr.reduce((s, r) => s + r.monetary, 0)
              const pct = totalMonetary > 0 ? (segMonetary / totalMonetary) * 100 : 0
              const groupName = `RFM · ${meta.label}`
              const existingGroupId = groupByName.get(groupName)
              const isFocused = focused === seg
              return (
                <div key={seg}
                  className={`stamp-card p-4 ${meta.bg} transition-all ${isFocused ? "ring-2 ring-orange" : ""}`}
                  style={{ borderColor: meta.color }}>
                  <div className="flex items-baseline justify-between mb-1">
                    <Link href={`/marketing/segments?s=${seg}`}
                      className="font-display font-black text-[14px] uppercase tracking-tight hover:text-orange"
                      style={{ color: meta.color }}>
                      {meta.label}
                    </Link>
                    <span className="text-[10px] font-mono num text-ink-3">{arr.length}</span>
                  </div>
                  <p className="text-[10px] text-ink-3 line-clamp-2 mb-2 font-mono">{meta.description}</p>
                  <div className="grid grid-cols-2 gap-1 text-[10px] mb-2">
                    <div>
                      <div className="text-[8px] font-display font-bold uppercase tracking-wider text-ink-3">VALOR</div>
                      <div className="font-display font-black num text-[12px]">{fmtEur(segMonetary)}</div>
                    </div>
                    <div>
                      <div className="text-[8px] font-display font-bold uppercase tracking-wider text-ink-3">% TOTAL</div>
                      <div className="font-display font-black num text-[12px]">{pct.toFixed(1)}%</div>
                    </div>
                  </div>
                  {arr.length > 0 && (
                    <SegmentSyncer
                      segmentLabel={meta.label}
                      customerIds={arr.map((r) => r.customerId)}
                      existingGroupId={existingGroupId}
                    />
                  )}
                </div>
              )
            })}
          </div>

          {/* Tabla detalle del segmento focused */}
          {focused && bySegment.has(focused) && (
            <div className="stamp-card overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 bg-dark text-cream">
                <h3 className="font-display font-black text-[14px] uppercase tracking-wider">
                  Detalle · {SEGMENT_META[focused].label} · {bySegment.get(focused)!.length} customers
                </h3>
                <Link href="/marketing/segments" className="text-[10px] font-display font-bold uppercase tracking-wider text-cream/60 hover:text-cream">
                  cerrar
                </Link>
              </div>
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="bg-cream-2 text-[10px] uppercase tracking-[0.12em]" style={{ borderBottom: "1.5px solid var(--border)" }}>
                    <th className="px-3 py-2 text-left font-display font-bold text-ink-2">Cliente</th>
                    <th className="px-3 py-2 text-right font-display font-bold text-ink-2">R</th>
                    <th className="px-3 py-2 text-right font-display font-bold text-ink-2">F</th>
                    <th className="px-3 py-2 text-right font-display font-bold text-ink-2">M</th>
                    <th className="px-3 py-2 text-right font-display font-bold text-ink-2">Última</th>
                    <th className="px-3 py-2 text-right font-display font-bold text-ink-2">Pedidos</th>
                    <th className="px-3 py-2 text-right font-display font-bold text-ink-2">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {bySegment.get(focused)!.sort((a, b) => b.monetary - a.monetary).slice(0, 100).map((r) => (
                    <tr key={r.customerId} className="row-zebra row-hover border-b border-warm-200/50 last:border-b-0">
                      <td className="px-3 py-2">
                        <Link href={`/customers/${r.customerId}`} className="hover:text-orange">
                          <div className="font-display font-bold text-ink truncate">{r.name}</div>
                          <div className="text-[10px] text-ink-3 font-mono truncate">{r.email}</div>
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-right font-display font-black num text-secondary">{r.rScore}</td>
                      <td className="px-3 py-2 text-right font-display font-black num text-orange">{r.fScore}</td>
                      <td className="px-3 py-2 text-right font-display font-black num text-primary">{r.mScore}</td>
                      <td className="px-3 py-2 text-right num text-ink-3 font-mono text-[10px]">{r.recencyDays}d</td>
                      <td className="px-3 py-2 text-right num text-ink-2">{r.frequency}</td>
                      <td className="px-3 py-2 text-right font-display font-bold num">{fmtEur(r.monetary)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Metodología RFM */}
          <div className="stamp-card p-4 bg-cream-2/30">
            <h4 className="text-[10px] font-display font-bold uppercase tracking-wider text-ink-3 mb-2">Cómo funciona RFM</h4>
            <div className="grid grid-cols-3 gap-3 text-[11px]">
              <div>
                <div className="font-display font-bold text-secondary mb-1">R · Recency</div>
                <p className="text-ink-2 font-mono">Días desde última compra. Más reciente = score más alto (5).</p>
              </div>
              <div>
                <div className="font-display font-bold text-orange mb-1">F · Frequency</div>
                <p className="text-ink-2 font-mono"># de pedidos no-cancelados. Más pedidos = score más alto (5).</p>
              </div>
              <div>
                <div className="font-display font-bold text-primary mb-1">M · Monetary</div>
                <p className="text-ink-2 font-mono">€ total gastado. Mayor gasto = score más alto (5). Quintiles dinámicos.</p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
