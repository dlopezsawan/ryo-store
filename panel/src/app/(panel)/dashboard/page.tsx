import Link from "next/link"
import { Download, Trophy, ShoppingBag, TrendingUp, TrendingDown, Package, Users } from "lucide-react"
import { Sparkline } from "@/components/ui/Sparkline"
import {
  getDashboardStats, MedusaError,
  type DashboardStats, type DashboardPeriod,
} from "@/lib/medusa"
import { fmtEur, fmtRelative, initials } from "@/lib/utils"

interface SearchParams {
  period?: string
}

const VALID_PERIODS: DashboardPeriod[] = [7, 30, 90, 365]
const PERIOD_LABEL: Record<DashboardPeriod, string> = {
  7: "7 días",
  30: "30 días",
  90: "90 días",
  365: "1 año",
}

function parsePeriod(raw: string | undefined): DashboardPeriod {
  const n = Number(raw)
  if (VALID_PERIODS.includes(n as DashboardPeriod)) return n as DashboardPeriod
  return 30
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams
  const period = parsePeriod(params.period)

  let stats: DashboardStats | null = null
  let errorMsg: string | null = null
  try {
    stats = await getDashboardStats(period)
  } catch (e) {
    if (e instanceof MedusaError && e.status === 401) {
      errorMsg = "Sesión expirada. Recarga la página."
    } else {
      errorMsg = `No se pudo cargar el dashboard: ${e instanceof Error ? e.message : "error desconocido"}`
    }
  }

  const todayLabel = new Date().toLocaleDateString("es-VE", {
    weekday: "long", day: "numeric", month: "short", year: "numeric",
  })

  const revenueDailySeries = stats?.daily.map((d) => d.revenue) ?? []
  const ordersDailySeries  = stats?.daily.map((d) => d.orders)  ?? []

  // Comparación periodo vs previo
  const revenueDelta = stats && stats.revenuePrev > 0
    ? ((stats.revenue - stats.revenuePrev) / stats.revenuePrev) * 100
    : null
  const ordersDelta = stats && stats.ordersCountPrev > 0
    ? ((stats.ordersCount - stats.ordersCountPrev) / stats.ordersCountPrev) * 100
    : null

  // Hoy vs promedio diario del periodo
  const avgDailyRev = revenueDailySeries.length
    ? revenueDailySeries.reduce((s, n) => s + n, 0) / revenueDailySeries.length
    : 0
  const todayVsAvg = stats?.revenueToday && avgDailyRev > 0
    ? ((stats.revenueToday - avgDailyRev) / avgDailyRev) * 100
    : 0

  // AOV
  const aov = stats && stats.ordersCount > 0
    ? stats.revenue / stats.ordersCount
    : 0
  const aovPrev = stats && stats.ordersCountPrev > 0
    ? stats.revenuePrev / stats.ordersCountPrev
    : 0
  const aovDelta = aovPrev > 0 ? ((aov - aovPrev) / aovPrev) * 100 : null

  // Build SVG path para el chart
  const chartPath = (() => {
    if (revenueDailySeries.length < 2) return ""
    const max = Math.max(...revenueDailySeries, 1)
    const W = 600, H = 180, P = 10
    const step = (W - P * 2) / (revenueDailySeries.length - 1)
    return revenueDailySeries
      .map((v, i) => {
        const x = P + i * step
        const y = H - P - ((v / max) * (H - P * 2))
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`
      })
      .join(" ")
  })()
  const chartArea = chartPath
    ? `${chartPath} L${600 - 10},${180 - 10} L10,${180 - 10} Z`
    : ""

  // X axis labels: ~6 ticks repartidos
  const tickStep = Math.max(1, Math.floor(revenueDailySeries.length / 6))

  return (
    <div className="p-7 space-y-5 relative">
      <div className="watermark-amp text-[400px] -top-32 right-0 select-none italic">&amp;</div>

      <div className="flex items-end justify-between relative">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="font-display font-black text-[34px] text-ink leading-none tracking-tight">DASHBOARD</h1>
            <div className="vintage-stamp text-primary mt-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-primary inline-block" />
              LIVE
            </div>
          </div>
          <p className="text-[13px] text-ink-3 font-medium capitalize">Resumen del negocio · {todayLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <PeriodSelector active={period} />
          <a
            href={`/dashboard/export?period=${period}`}
            className="flex items-center gap-2 px-4 py-2 bg-orange text-dark rounded-md text-[11px] font-display font-bold uppercase tracking-wide transition-all hover:translate-x-[2px] hover:translate-y-[2px]"
            style={{ border: "2px solid #1A1A1A", boxShadow: "4px 4px 0 0 var(--shadow-color)" }}
          >
            <Download size={14} strokeWidth={2.5} />
            Exportar CSV
          </a>
        </div>
      </div>

      {errorMsg && (
        <div className="stamp-card p-4 bg-primary/5" style={{ borderColor: "#BB3B2E" }}>
          <p className="text-[13px] font-medium text-primary">{errorMsg}</p>
        </div>
      )}

      {stats && (
        <>
          {/* KPI grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-5">
            <Kpi
              label={`Revenue · ${PERIOD_LABEL[period]}`}
              value={fmtEur(stats.revenue)}
              delta={revenueDelta}
              sub={<>Hoy: <span className="text-orange font-bold num">{fmtEur(stats.revenueToday)}</span></>}
              spark={revenueDailySeries.length ? <Sparkline data={revenueDailySeries.slice(-Math.min(13, revenueDailySeries.length))} color="#4D5431" /> : null}
            />
            <Kpi
              label={`Pedidos · ${PERIOD_LABEL[period]}`}
              value={String(stats.ordersCount)}
              delta={ordersDelta}
              sub={<>Hoy: <span className="text-orange font-bold num">{stats.ordersToday}</span></>}
              spark={ordersDailySeries.length ? <Sparkline data={ordersDailySeries.slice(-Math.min(13, ordersDailySeries.length))} color="#FF3B27" /> : null}
            />
            <Kpi
              label="Ticket promedio"
              value={fmtEur(aov)}
              delta={aovDelta}
              sub={<>{stats.ordersCount} pedidos · {stats.currency.toUpperCase()}</>}
            />
            <Kpi
              label="Hoy vs promedio"
              value={`${todayVsAvg >= 0 ? "+" : ""}${todayVsAvg.toFixed(0)}%`}
              tone={todayVsAvg >= 0 ? "secondary" : "primary"}
              sub={<>Promedio diario: {fmtEur(avgDailyRev)}</>}
            />
          </div>

          {/* Achievement strip — solo si hoy supera el promedio */}
          {todayVsAvg > 10 && (
            <div className="bg-dark text-cream p-4 relative overflow-hidden"
                 style={{ border: "2.5px solid #1A1A1A", borderRadius: 3, boxShadow: "5px 5px 0 0 #FF3B27" }}>
              <div className="watermark-amp text-[200px] -top-12 right-4 text-orange opacity-20 select-none italic">&amp;</div>
              <div className="flex items-center gap-4 relative">
                <div className="w-12 h-12 bg-orange flex items-center justify-center trophy" style={{ border: "2px solid #1A1A1A" }}>
                  <Trophy size={24} strokeWidth={2.5} className="text-dark" />
                </div>
                <div className="flex-1">
                  <div className="font-display font-black text-[15px] text-orange uppercase tracking-wide">Día por encima del promedio</div>
                  <div className="text-[12px] text-cream/80">
                    Hoy llevas <span className="font-bold text-white num">{fmtEur(stats.revenueToday)}</span> en revenue · superas el promedio diario en{" "}
                    <span className="text-orange font-bold">+{todayVsAvg.toFixed(0)}%</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Chart + recent orders */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 md:gap-5">
            <div className="lg:col-span-7 stamp-card p-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-display font-black text-[16px] text-ink uppercase tracking-tight">Revenue Diario</h3>
                  <p className="text-[11px] text-ink-3 font-medium mt-0.5">{stats.currency.toUpperCase()} · últimos {period} días</p>
                </div>
              </div>
              <svg viewBox="0 0 600 180" className="w-full h-[200px]">
                <line x1="0" y1="45"  x2="600" y2="45"  stroke="rgb(var(--ink))" strokeWidth="0.5" strokeDasharray="2 4" opacity="0.15" />
                <line x1="0" y1="90"  x2="600" y2="90"  stroke="rgb(var(--ink))" strokeWidth="0.5" strokeDasharray="2 4" opacity="0.15" />
                <line x1="0" y1="135" x2="600" y2="135" stroke="rgb(var(--ink))" strokeWidth="0.5" strokeDasharray="2 4" opacity="0.15" />
                {chartArea && <path d={chartArea} fill="url(#brandgrad)" opacity="0.18" />}
                {chartPath && (
                  <path d={chartPath} stroke="#FF3B27" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                )}
                <defs>
                  <linearGradient id="brandgrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#FF3B27" />
                    <stop offset="100%" stopColor="#FF3B27" stopOpacity="0" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="flex justify-between text-[9px] text-ink-3 num mt-1 font-mono">
                {stats.daily
                  .filter((_, i) => i % tickStep === 0)
                  .map((d) => (
                    <span key={d.date}>
                      {new Date(d.date).toLocaleDateString("es-VE", { day: "numeric", month: "short" })}
                    </span>
                  ))}
              </div>
            </div>

            {/* Recent orders feed */}
            <div className="lg:col-span-5 stamp-card flex flex-col">
              <div className="flex items-center justify-between p-5 pb-3">
                <div>
                  <h3 className="font-display font-black text-[16px] text-ink uppercase tracking-tight">Últimos Pedidos</h3>
                  <p className="text-[10px] text-ink-3 font-mono mt-0.5">● live · {stats.recent.length} más recientes</p>
                </div>
                <Link href="/orders" className="text-[11px] text-orange font-display font-bold hover:underline uppercase tracking-wide">
                  Ver todos →
                </Link>
              </div>
              <div className="dotted-div mx-5" />
              <div className="flex-1">
                {stats.recent.length === 0 && (
                  <div className="p-5 text-center">
                    <ShoppingBag size={24} className="mx-auto text-ink-3 mb-2" />
                    <p className="text-[12px] text-ink-3">Sin pedidos en {period}d</p>
                  </div>
                )}
                {stats.recent.map((o) => {
                  const customerName =
                    [o.customer?.first_name, o.customer?.last_name].filter(Boolean).join(" ") ||
                    [o.shipping_address?.first_name, o.shipping_address?.last_name].filter(Boolean).join(" ") ||
                    o.email ||
                    "Cliente sin nombre"
                  const totalItems = o.items?.reduce((s, i) => s + (i.quantity ?? 0), 0) ?? 0
                  const isPaid = o.payment_status === "captured"
                  const isCancelled = o.status === "canceled"
                  const tone = isCancelled ? "primary" : isPaid ? "secondary" : "orange"
                  const statusLabel = isCancelled ? "Cancelado" : isPaid ? "Pagado" : (o.payment_status === "awaiting" ? "P. Móvil" : "Pendiente")
                  return (
                    <Link
                      key={o.id}
                      href={`/orders/${o.id}`}
                      className="px-5 py-3 row-hover flex items-center gap-3 border-b border-warm-200/50 last:border-b-0"
                    >
                      <div className={`w-9 h-9 flex items-center justify-center text-[11px] font-display font-black ${
                        tone === "secondary" ? "bg-secondary/15 text-secondary"
                        : tone === "orange" ? "bg-orange/15 text-orange"
                        : "bg-primary/15 text-primary"
                      }`} style={{ border: `1.5px solid ${tone === "secondary" ? "#4D5431" : tone === "orange" ? "#FF3B27" : "#BB3B2E"}` }}>
                        {initials(customerName)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-semibold text-ink truncate">{customerName}</div>
                        <div className="text-[10px] text-ink-3 font-mono">
                          #{o.display_id} · {totalItems} ítems · {fmtRelative(o.created_at)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`font-display font-black text-[15px] num ${isCancelled ? "text-ink-3 line-through" : "text-ink"}`}>
                          {fmtEur(Number(o.total) || 0)}
                        </div>
                        <span className={`pill mt-0.5 ${tone === "secondary" ? "text-secondary" : tone === "orange" ? "text-orange" : "text-primary"}`}>
                          <span className="pill-dot" />{statusLabel}
                        </span>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Top SKUs + Top Customers */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 md:gap-5">
            <TopSkus rows={stats.topSkus} period={period} currency={stats.currency} />
            <TopCustomers rows={stats.topCustomers} period={period} currency={stats.currency} />
          </div>
        </>
      )}

      {/* Footer signature */}
      <div className="text-center pt-6 pb-2">
        <div className="text-[9px] text-ink-3 font-mono uppercase tracking-[0.3em]">
          Enrola Shop · Panel v1.0 · Made in Caracas
        </div>
      </div>
    </div>
  )
}

function PeriodSelector({ active }: { active: DashboardPeriod }) {
  return (
    <div className="flex items-center gap-0.5 p-0.5 bg-cream rounded-md" style={{ border: "1.5px solid var(--border)", boxShadow: "3px 3px 0 0 var(--shadow-color)" }}>
      {VALID_PERIODS.map((p) => (
        <Link
          key={p}
          href={p === 30 ? "/dashboard" : `/dashboard?period=${p}`}
          className={`px-3 py-1.5 rounded-md text-[10px] font-display font-bold uppercase tracking-wider whitespace-nowrap transition-colors ${
            active === p ? "bg-dark text-cream" : "text-ink-3 hover:text-ink"
          }`}
        >
          {PERIOD_LABEL[p]}
        </Link>
      ))}
    </div>
  )
}

function Kpi({
  label, value, sub, spark, tone, delta,
}: {
  label: string
  value: string
  sub: React.ReactNode
  spark?: React.ReactNode
  tone?: "secondary" | "primary"
  delta?: number | null
}) {
  const valueClass = tone === "secondary" ? "text-secondary" : tone === "primary" ? "text-primary" : "text-ink"
  const showDelta = delta !== null && delta !== undefined && Number.isFinite(delta)
  const positive = (delta ?? 0) >= 0
  return (
    <div className="stamp-card p-5 relative overflow-hidden">
      <div className="flex items-center justify-between mb-3">
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
      <div className={`stat-display text-[34px] ${valueClass}`}>{value}</div>
      <div className="text-[12px] text-ink-3 font-medium mt-1">{sub}</div>
      {spark && (
        <>
          <div className="dotted-div my-3" />
          <div className="flex items-center justify-end">{spark}</div>
        </>
      )}
    </div>
  )
}

function TopSkus({
  rows, period, currency,
}: {
  rows: DashboardStats["topSkus"]
  period: DashboardPeriod
  currency: string
}) {
  return (
    <div className="lg:col-span-7 stamp-card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 bg-dark text-cream">
        <div className="flex items-center gap-2">
          <Package size={14} strokeWidth={2.4} />
          <h3 className="font-display font-black text-[14px] uppercase tracking-wider">
            Top productos · {PERIOD_LABEL[period]}
          </h3>
        </div>
        <span className="text-[10px] font-mono text-cream/60">{rows.length} más vendidos</span>
      </div>
      {rows.length === 0 ? (
        <div className="p-10 text-center text-[13px] text-ink-3">
          Sin ventas en este período.
        </div>
      ) : (
        <table className="w-full text-[13px]">
          <thead>
            <tr className="bg-cream-2 text-[10px] uppercase tracking-[0.12em]" style={{ borderBottom: "2px solid var(--border)" }}>
              <th className="px-3 py-2.5 text-left font-display font-bold text-ink-2 w-12">#</th>
              <th className="px-3 py-2.5 text-left font-display font-bold text-ink-2">Producto</th>
              <th className="px-3 py-2.5 text-right font-display font-bold text-ink-2">Unidades</th>
              <th className="px-3 py-2.5 text-right font-display font-bold text-ink-2">Revenue</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((sku, i) => {
              const key = sku.productId ?? `${sku.productTitle}-${i}`
              const href = sku.productId ? `/products/${sku.productId}` : null
              const Cell = ({ children, className = "", align = "left" }: { children: React.ReactNode; className?: string; align?: "left" | "right" }) => (
                <td className={`px-3 py-2 ${align === "right" ? "text-right" : ""} ${className}`}>
                  {href ? (
                    <Link href={href} className="block w-full h-full">{children}</Link>
                  ) : (
                    children
                  )}
                </td>
              )
              return (
                <tr key={key} className="row-zebra row-hover border-b border-warm-200/50 last:border-b-0">
                  <Cell className="font-display font-black text-ink-3 num w-12">{i + 1}</Cell>
                  <Cell>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-cream-2 overflow-hidden flex-shrink-0" style={{ border: "1.5px solid var(--border)" }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {sku.thumbnail && <img src={sku.thumbnail} alt="" className="w-full h-full object-cover" />}
                      </div>
                      <div className="min-w-0">
                        <div className="font-display font-bold text-ink text-[12px] truncate">{sku.productTitle}</div>
                        <div className="text-[10px] text-ink-3 font-mono">
                          {sku.variantTitle && <>{sku.variantTitle} · </>}
                          {sku.sku ?? "—"}
                        </div>
                      </div>
                    </div>
                  </Cell>
                  <Cell align="right" className="font-display font-black num text-orange">{sku.unitsSold}</Cell>
                  <Cell align="right" className="font-display font-bold num">
                    {currency.toUpperCase()} {sku.revenue.toFixed(2)}
                  </Cell>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}

function TopCustomers({
  rows, period, currency,
}: {
  rows: DashboardStats["topCustomers"]
  period: DashboardPeriod
  currency: string
}) {
  return (
    <div className="lg:col-span-5 stamp-card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 bg-dark text-cream">
        <div className="flex items-center gap-2">
          <Users size={14} strokeWidth={2.4} />
          <h3 className="font-display font-black text-[14px] uppercase tracking-wider">
            Top clientes · {PERIOD_LABEL[period]}
          </h3>
        </div>
        <span className="text-[10px] font-mono text-cream/60">{rows.length}</span>
      </div>
      {rows.length === 0 ? (
        <div className="p-10 text-center text-[13px] text-ink-3">Sin clientes en este período.</div>
      ) : (
        <ul className="divide-y divide-warm-200/50">
          {rows.map((c, i) => {
            const Item = (
              <div className="px-4 py-2.5 flex items-center gap-3 row-hover">
                <div className="font-display font-black text-ink-3 num text-[14px] w-5 text-right flex-shrink-0">{i + 1}</div>
                <div className={`w-9 h-9 flex items-center justify-center text-[11px] font-display font-black flex-shrink-0 ${
                  i === 0 ? "bg-orange text-dark" : i < 3 ? "bg-secondary/15 text-secondary" : "bg-cream-2 text-ink"
                }`} style={{ border: "1.5px solid var(--border)" }}>
                  {initials(c.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-display font-bold text-ink text-[12px] truncate">{c.name}</div>
                  <div className="text-[10px] text-ink-3 font-mono truncate">
                    {c.email !== "—" ? c.email : "guest"} · {c.ordersCount} pedido{c.ordersCount === 1 ? "" : "s"}
                  </div>
                </div>
                <div className="font-display font-black num text-[14px] text-right flex-shrink-0">
                  {currency.toUpperCase()} {c.totalSpent.toFixed(0)}
                </div>
              </div>
            )
            const key = c.customerId ?? `${c.email}-${i}`
            return (
              <li key={key}>
                {c.customerId ? (
                  <Link href={`/customers/${c.customerId}`}>{Item}</Link>
                ) : (
                  Item
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
