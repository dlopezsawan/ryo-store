import Link from "next/link"
import { TrendingUp, TrendingDown, Package, Users, Undo2, Clock, DollarSign } from "lucide-react"
import { PageHeader, PageWatermark } from "@/components/layout/PageHeader"
import { listOrders, listReturns, MedusaError, type AdminOrderListItem } from "@/lib/medusa"
import { fmtEur } from "@/lib/utils"

interface SearchParams {
  period?: string
}

const PERIODS = [
  { value: "30",  label: "30 días" },
  { value: "90",  label: "90 días" },
  { value: "180", label: "6 meses" },
  { value: "365", label: "1 año" },
] as const

export default async function ReportsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams
  const periodDays = Math.max(7, Math.min(730, Number(params.period) || 90))

  const since = new Date(Date.now() - periodDays * 86400_000).toISOString()
  const sincePrev = new Date(Date.now() - 2 * periodDays * 86400_000).toISOString()

  let orders: AdminOrderListItem[] = []
  let prevOrders: AdminOrderListItem[] = []
  let returnsCount = 0
  let returnsAmount = 0
  let errorMsg: string | null = null

  try {
    const [curR, prevR, retR] = await Promise.allSettled([
      listOrders({ limit: 500, created_at_gte: since, order: "-created_at" }),
      listOrders({ limit: 500, created_at_gte: sincePrev, created_at_lte: since, order: "-created_at" }),
      listReturns({ limit: 500 }),
    ])
    orders = curR.status === "fulfilled" ? curR.value.orders : []
    prevOrders = prevR.status === "fulfilled" ? prevR.value.orders : []
    if (retR.status === "fulfilled") {
      const periodMs = new Date(since).getTime()
      const recentReturns = retR.value.returns.filter((r) => new Date(r.created_at).getTime() >= periodMs)
      returnsCount = recentReturns.length
      returnsAmount = recentReturns.reduce((s, r) => s + (Number(r.refund_amount) || 0), 0)
    }
  } catch (e) {
    if (e instanceof MedusaError && e.status === 401) errorMsg = "Sesión expirada"
    else errorMsg = `Error: ${e instanceof Error ? e.message : "desconocido"}`
  }

  // Aggregations actuales
  const currency = orders[0]?.currency_code ?? "eur"
  const totalRevenue = orders.reduce((s, o) => s + (Number(o.total) || 0), 0)
  const totalOrders = orders.length
  const aov = totalOrders > 0 ? totalRevenue / totalOrders : 0
  const refundRatio = totalOrders > 0 ? (returnsCount / totalOrders) * 100 : 0
  const refundDollarRatio = totalRevenue > 0 ? (returnsAmount / totalRevenue) * 100 : 0

  // Aggregations previas (para deltas)
  const prevRevenue = prevOrders.reduce((s, o) => s + (Number(o.total) || 0), 0)
  const prevOrdersCount = prevOrders.length
  const prevAov = prevOrdersCount > 0 ? prevRevenue / prevOrdersCount : 0

  const revenueDelta = prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 : null
  const ordersDelta = prevOrdersCount > 0 ? ((totalOrders - prevOrdersCount) / prevOrdersCount) * 100 : null
  const aovDelta = prevAov > 0 ? ((aov - prevAov) / prevAov) * 100 : null

  // Top SKUs
  const skuMap = new Map<string, { id: string; title: string; sku: string | null; thumbnail: string | null; productId: string | null; units: number; revenue: number }>()
  for (const o of orders) {
    for (const it of o.items ?? []) {
      const key = it.variant?.id ?? `title:${it.title}`
      const subtotal = Number(it.subtotal ?? Number(it.unit_price) * it.quantity) || 0
      const cur = skuMap.get(key)
      if (cur) {
        cur.units += it.quantity
        cur.revenue += subtotal
      } else {
        skuMap.set(key, {
          id: key,
          title: it.variant?.product?.title ?? it.title,
          sku: it.variant?.sku ?? null,
          thumbnail: it.thumbnail ?? null,
          productId: it.variant?.product?.id ?? it.product_id ?? null,
          units: it.quantity,
          revenue: subtotal,
        })
      }
    }
  }
  const topSkus = Array.from(skuMap.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 20)

  // Top customers
  const custMap = new Map<string, { id: string | null; name: string; email: string; orders: number; revenue: number }>()
  for (const o of orders) {
    const key = o.customer?.id ?? o.email ?? "anon"
    const name = [o.customer?.first_name, o.customer?.last_name].filter(Boolean).join(" ") || (o.email ?? "guest")
    const cur = custMap.get(key)
    const total = Number(o.total) || 0
    if (cur) {
      cur.orders += 1
      cur.revenue += total
    } else {
      custMap.set(key, {
        id: o.customer?.id ?? null,
        name,
        email: o.email ?? "",
        orders: 1,
        revenue: total,
      })
    }
  }
  const topCustomers = Array.from(custMap.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10)

  // AOV / revenue mensual (últimos N meses dentro del periodo)
  const monthMap = new Map<string, { revenue: number; orders: number }>()
  for (const o of orders) {
    const d = new Date(o.created_at)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    const cur = monthMap.get(key) ?? { revenue: 0, orders: 0 }
    cur.revenue += Number(o.total) || 0
    cur.orders += 1
    monthMap.set(key, cur)
  }
  const months = Array.from(monthMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))

  // Fulfillment time promedio (created → shipped)
  const fulfilTimes: number[] = []
  for (const o of orders) {
    if (o.fulfillment_status === "shipped" || o.fulfillment_status === "delivered" || o.fulfillment_status === "fulfilled") {
      // Sin shipped_at exacto, usamos updated_at - created_at como proxy
      const created = new Date(o.created_at).getTime()
      const updated = new Date(o.updated_at ?? o.created_at).getTime()
      const hours = (updated - created) / 3_600_000
      if (hours > 0 && hours < 24 * 30) fulfilTimes.push(hours)
    }
  }
  const avgFulfilHours = fulfilTimes.length > 0
    ? fulfilTimes.reduce((s, h) => s + h, 0) / fulfilTimes.length
    : 0

  return (
    <div className="p-7 space-y-5 relative">
      <PageWatermark char="%" />

      <PageHeader
        title="REPORTS"
        stamp={<>{periodDays}D</>}
        stampTone="orange"
        description={
          <>
            Top sellers · refund ratio · fulfillment time · AOV mensual ·{" "}
            <span className="text-ink font-bold num">{totalOrders}</span> pedidos en el período
          </>
        }
        actions={
          <div className="flex items-center gap-1 p-0.5 bg-cream rounded-md" style={{ border: "1.5px solid var(--border)" }}>
            {PERIODS.map((p) => (
              <Link
                key={p.value}
                href={p.value === "90" ? "/reports" : `/reports?period=${p.value}`}
                className={`px-3 py-1.5 rounded-md text-[10px] font-display font-bold uppercase tracking-wider whitespace-nowrap ${
                  String(periodDays) === p.value || (p.value === "90" && !params.period)
                    ? "bg-dark text-cream"
                    : "text-ink-3 hover:text-ink"
                }`}
              >
                {p.label}
              </Link>
            ))}
          </div>
        }
      />

      {errorMsg && (
        <div className="stamp-card p-4 bg-primary/5" style={{ borderColor: "#BB3B2E" }}>
          <p className="text-[13px] font-medium text-primary">{errorMsg}</p>
        </div>
      )}

      {/* KPI strip */}
      <div className="grid grid-cols-4 gap-5">
        <Kpi
          label="Revenue"
          value={fmtEur(totalRevenue)}
          delta={revenueDelta}
          icon={<DollarSign size={14} />}
        />
        <Kpi
          label="Pedidos"
          value={String(totalOrders)}
          delta={ordersDelta}
          icon={<Package size={14} />}
        />
        <Kpi
          label="AOV"
          value={fmtEur(aov)}
          delta={aovDelta}
          icon={<TrendingUp size={14} />}
        />
        <Kpi
          label="Refund ratio"
          value={`${refundRatio.toFixed(1)}%`}
          sub={`${returnsCount} retornos · ${refundDollarRatio.toFixed(1)}% del revenue`}
          tone={refundRatio > 5 ? "primary" : "secondary"}
          icon={<Undo2 size={14} />}
        />
      </div>

      {/* Fulfillment time card */}
      {avgFulfilHours > 0 && (
        <div className="stamp-card p-4 flex items-center gap-4">
          <div className="w-10 h-10 bg-orange/15 text-orange flex items-center justify-center" style={{ border: "1.5px solid #FF3B27" }}>
            <Clock size={18} strokeWidth={2.4} />
          </div>
          <div>
            <div className="text-[10px] font-display font-bold uppercase tracking-[0.18em] text-ink-3">
              Tiempo promedio de fulfillment
            </div>
            <div className="text-[20px] font-display font-black num">
              {avgFulfilHours < 24
                ? `${avgFulfilHours.toFixed(1)} hrs`
                : `${(avgFulfilHours / 24).toFixed(1)} días`}
            </div>
            <div className="text-[10px] text-ink-3 font-mono">
              basado en {fulfilTimes.length} pedidos enviados
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-12 gap-5">
        {/* Top SKUs */}
        <div className="col-span-7 stamp-card overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3 bg-dark text-cream">
            <Package size={14} strokeWidth={2.4} />
            <h3 className="font-display font-black text-[14px] uppercase tracking-wider">
              Top 20 productos
            </h3>
            <span className="ml-auto text-[10px] text-cream/60 font-mono">por revenue</span>
          </div>
          {topSkus.length === 0 ? (
            <div className="p-10 text-center text-[13px] text-ink-3">Sin ventas en el período</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="bg-cream-2 text-[10px] uppercase tracking-[0.12em]" style={{ borderBottom: "2px solid var(--border)" }}>
                  <th className="px-3 py-2 text-left font-display font-bold text-ink-2 w-8">#</th>
                  <th className="px-3 py-2 text-left font-display font-bold text-ink-2">Producto</th>
                  <th className="px-3 py-2 text-right font-display font-bold text-ink-2">Units</th>
                  <th className="px-3 py-2 text-right font-display font-bold text-ink-2">Revenue</th>
                  <th className="px-3 py-2 text-right font-display font-bold text-ink-2">% rev</th>
                </tr>
              </thead>
              <tbody className="text-[13px]">
                {topSkus.map((sku, i) => {
                  const pct = totalRevenue > 0 ? (sku.revenue / totalRevenue) * 100 : 0
                  return (
                    <tr key={sku.id} className="row-zebra row-hover border-b border-warm-200/50 last:border-b-0">
                      <td className="px-3 py-2 font-display font-black text-ink-3 num">{i + 1}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 bg-cream-2 overflow-hidden flex-shrink-0" style={{ border: "1.5px solid var(--border)" }}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            {sku.thumbnail && <img src={sku.thumbnail} alt="" className="w-full h-full object-cover" />}
                          </div>
                          <div className="min-w-0">
                            {sku.productId ? (
                              <Link href={`/products/${sku.productId}`} className="font-display font-bold text-ink text-[12px] truncate hover:text-orange block">
                                {sku.title}
                              </Link>
                            ) : (
                              <div className="font-display font-bold text-ink text-[12px] truncate">{sku.title}</div>
                            )}
                            {sku.sku && <div className="text-[10px] text-ink-3 font-mono">{sku.sku}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right font-display font-black num text-orange">{sku.units}</td>
                      <td className="px-3 py-2 text-right font-display font-bold num">
                        {currency.toUpperCase()} {sku.revenue.toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <div className="w-12 h-1.5 bg-cream-2 rounded-full overflow-hidden">
                            <div className="h-full bg-orange" style={{ width: `${Math.min(100, pct)}%` }} />
                          </div>
                          <span className="text-[10px] font-mono text-ink-2 num">{pct.toFixed(1)}%</span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Top customers */}
        <div className="col-span-5 stamp-card overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3 bg-dark text-cream">
            <Users size={14} strokeWidth={2.4} />
            <h3 className="font-display font-black text-[14px] uppercase tracking-wider">
              Top 10 clientes
            </h3>
          </div>
          {topCustomers.length === 0 ? (
            <div className="p-10 text-center text-[13px] text-ink-3">Sin pedidos</div>
          ) : (
            <ul className="divide-y divide-warm-200/50">
              {topCustomers.map((c, i) => {
                const Item = (
                  <div className="px-4 py-2.5 flex items-center gap-3 row-hover">
                    <div className={`font-display font-black text-[14px] num w-5 text-right flex-shrink-0 ${i === 0 ? "text-orange" : "text-ink-3"}`}>
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-display font-bold text-[12px] text-ink truncate">{c.name}</div>
                      <div className="text-[10px] text-ink-3 font-mono truncate">
                        {c.email || "guest"} · {c.orders} pedido{c.orders === 1 ? "" : "s"}
                      </div>
                    </div>
                    <div className="font-display font-black num text-[13px] text-right flex-shrink-0">
                      {currency.toUpperCase()} {c.revenue.toFixed(0)}
                    </div>
                  </div>
                )
                return (
                  <li key={c.id ?? c.email}>
                    {c.id ? <Link href={`/customers/${c.id}`}>{Item}</Link> : Item}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Revenue mensual */}
      {months.length > 0 && (
        <div className="stamp-card overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3 bg-dark text-cream">
            <TrendingUp size={14} strokeWidth={2.4} />
            <h3 className="font-display font-black text-[14px] uppercase tracking-wider">
              Revenue mensual
            </h3>
          </div>
          <table className="w-full">
            <thead>
              <tr className="bg-cream-2 text-[10px] uppercase tracking-[0.12em]" style={{ borderBottom: "2px solid var(--border)" }}>
                <th className="px-3 py-2 text-left font-display font-bold text-ink-2">Mes</th>
                <th className="px-3 py-2 text-right font-display font-bold text-ink-2">Pedidos</th>
                <th className="px-3 py-2 text-right font-display font-bold text-ink-2">Revenue</th>
                <th className="px-3 py-2 text-right font-display font-bold text-ink-2">AOV</th>
                <th className="px-3 py-2 text-left font-display font-bold text-ink-2">Visual</th>
              </tr>
            </thead>
            <tbody className="text-[13px]">
              {months.map(([key, b]) => {
                const maxRev = Math.max(...months.map(([, m]) => m.revenue))
                const monthAov = b.orders > 0 ? b.revenue / b.orders : 0
                const date = new Date(key + "-01")
                return (
                  <tr key={key} className="row-zebra border-b border-warm-200/50 last:border-b-0">
                    <td className="px-3 py-2 font-display font-bold text-ink uppercase">
                      {date.toLocaleDateString("es-VE", { month: "long", year: "numeric" })}
                    </td>
                    <td className="px-3 py-2 text-right font-mono num">{b.orders}</td>
                    <td className="px-3 py-2 text-right font-display font-black num text-orange">
                      {currency.toUpperCase()} {b.revenue.toFixed(0)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono num">
                      {currency.toUpperCase()} {monthAov.toFixed(2)}
                    </td>
                    <td className="px-3 py-2">
                      <div className="h-2 bg-cream-2 rounded overflow-hidden max-w-[200px]">
                        <div className="h-full bg-orange" style={{ width: `${maxRev > 0 ? (b.revenue / maxRev) * 100 : 0}%` }} />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function Kpi({
  label, value, sub, delta, tone, icon,
}: {
  label: string
  value: string
  sub?: string
  delta?: number | null
  tone?: "primary" | "orange" | "secondary"
  icon?: React.ReactNode
}) {
  const valueColor = tone === "primary" ? "text-primary" : tone === "orange" ? "text-orange" : tone === "secondary" ? "text-secondary" : "text-ink"
  const showDelta = delta != null && Number.isFinite(delta)
  const positive = (delta ?? 0) >= 0
  return (
    <div className="stamp-card p-5">
      <div className="flex items-start justify-between mb-2">
        <div className="text-[9px] font-display font-bold uppercase tracking-[0.18em] text-ink-3">{label}</div>
        {showDelta && (
          <span
            className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-display font-bold num ${
              positive ? "text-secondary bg-secondary/10" : "text-primary bg-primary/10"
            }`}
            style={{ border: `1px solid ${positive ? "#4D5431" : "#BB3B2E"}` }}
          >
            {positive ? <TrendingUp size={9} strokeWidth={3} /> : <TrendingDown size={9} strokeWidth={3} />}
            {positive ? "+" : ""}{delta.toFixed(0)}%
          </span>
        )}
      </div>
      <div className={`stat-display text-[28px] mt-1 num ${valueColor}`}>{value}</div>
      {sub && <div className="text-[10px] text-ink-3 font-mono mt-1">{sub}</div>}
      {!sub && icon && <div className="text-ink-3 mt-1">{icon}</div>}
    </div>
  )
}
