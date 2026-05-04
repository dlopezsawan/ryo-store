import Link from "next/link"
import { Undo2, Package, AlertTriangle, CheckCircle2 } from "lucide-react"
import { PageHeader, PageWatermark } from "@/components/layout/PageHeader"
import { listReturns, listOrders, MedusaError, type AdminReturn, type AdminOrderListItem } from "@/lib/medusa"
import { fmtRelative, fmtEur } from "@/lib/utils"

interface SearchParams {
  status?: string
}

const STATUS_META: Record<string, { label: string; cls: string; bg: string }> = {
  requested:           { label: "Solicitado",          cls: "text-orange",    bg: "bg-orange/10" },
  requires_action:     { label: "Acción requerida",    cls: "text-orange",    bg: "bg-orange/15" },
  received:            { label: "Recibido",            cls: "text-secondary", bg: "bg-secondary/10" },
  partially_received:  { label: "Recibido parcial",    cls: "text-orange",    bg: "bg-orange/10" },
  refunded:            { label: "Reembolsado",         cls: "text-secondary", bg: "bg-secondary/10" },
  partially_refunded:  { label: "Refund parcial",      cls: "text-orange",    bg: "bg-orange/10" },
  canceled:            { label: "Cancelado",           cls: "text-primary",   bg: "bg-primary/5" },
}

export default async function ReturnsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams
  const filter = params.status

  const [retR, ordR] = await Promise.allSettled([
    listReturns({ limit: 200 }),
    listOrders({ limit: 200, fields: "id,display_id,email,total,currency_code,*customer" }),
  ])
  let errorMsg: string | null = null
  const returns: AdminReturn[] = retR.status === "fulfilled" ? retR.value.returns : []
  const orders: AdminOrderListItem[] = ordR.status === "fulfilled" ? ordR.value.orders : []
  if ([retR, ordR].some((r) => r.status === "rejected" && r.reason instanceof MedusaError && r.reason.status === 401)) {
    errorMsg = "Sesión expirada. Recarga la página."
  }

  const orderById = new Map(orders.map((o) => [o.id, o]))

  const filtered = filter ? returns.filter((r) => r.status === filter) : returns

  // KPIs
  const totalRefunded = returns.reduce((s, r) => s + (Number(r.refund_amount) || 0), 0)
  const pendingCount = returns.filter((r) => r.status !== "received" && r.status !== "canceled" && r.status !== "refunded").length
  const receivedCount = returns.filter((r) => r.status === "received" || r.status === "partially_received").length
  const refundedCount = returns.filter((r) => r.status === "refunded" || r.status === "partially_refunded").length

  // Return rate (returns / total orders)
  const returnRate = orders.length > 0 ? (returns.length / orders.length) * 100 : 0

  // Counts por status para tabs
  const statusCounts = new Map<string, number>()
  for (const r of returns) statusCounts.set(r.status, (statusCounts.get(r.status) ?? 0) + 1)

  return (
    <div className="p-7 space-y-5 relative">
      <PageWatermark char="↺" />

      <PageHeader
        title="DEVOLUCIONES"
        stamp={<>{returns.length} TOTALES · {pendingCount} PENDIENTES</>}
        stampTone={pendingCount > 0 ? "orange" : "secondary"}
        description={`${pendingCount} en proceso · ${receivedCount} recibidos · ${refundedCount} reembolsados · tasa ${returnRate.toFixed(1)}%`}
      />

      {errorMsg && (
        <div className="stamp-card p-4 bg-primary/5" style={{ borderColor: "#BB3B2E" }}>
          <p className="text-[13px] font-medium text-primary">{errorMsg}</p>
        </div>
      )}

      {/* KPI strip */}
      <div className="grid grid-cols-4 gap-3">
        <Kpi label="Total devoluciones" value={String(returns.length)}    sub={`tasa ${returnRate.toFixed(1)}%`} />
        <Kpi label="Pendientes"          value={String(pendingCount)}     sub="sin recibir + sin cancelar" tone="orange" icon={<AlertTriangle size={12} className="text-orange" />} />
        <Kpi label="Recibidos"           value={String(receivedCount)}    sub="esperando refund o procesados" tone="secondary" />
        <Kpi label="Total reembolsado"   value={fmtEur(totalRefunded)}    sub={`${refundedCount} refunds`} tone="primary" />
      </div>

      {/* Status filter tabs */}
      <div className="stamp-card p-3">
        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          <FilterChip label={`Todos · ${returns.length}`} active={!filter} href="/returns" />
          {Object.keys(STATUS_META).map((s) => {
            const count = statusCounts.get(s) ?? 0
            if (count === 0 && filter !== s) return null
            return (
              <FilterChip key={s}
                label={`${STATUS_META[s].label} · ${count}`}
                active={filter === s}
                href={`/returns?status=${s}`}
                tone={STATUS_META[s].cls.replace("text-", "")} />
            )
          })}
        </div>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="stamp-card p-10 text-center">
          <Undo2 size={48} className="text-ink-3 mx-auto mb-3" strokeWidth={1.5} />
          <p className="font-display font-bold text-[14px] uppercase tracking-wider text-ink-3">Sin devoluciones en este filtro</p>
        </div>
      ) : (
        <div className="stamp-card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 bg-dark text-cream">
            <h3 className="font-display font-black text-[14px] uppercase tracking-wider">Lista de devoluciones</h3>
            <span className="text-[10px] font-mono text-cream/60">{filtered.length} resultado(s)</span>
          </div>
          <table className="w-full text-[12px]">
            <thead>
              <tr className="bg-cream-2 text-[10px] uppercase tracking-[0.12em]" style={{ borderBottom: "1.5px solid var(--border)" }}>
                <th className="px-3 py-2 text-left font-display font-bold text-ink-2">Estado</th>
                <th className="px-3 py-2 text-left font-display font-bold text-ink-2">Pedido</th>
                <th className="px-3 py-2 text-left font-display font-bold text-ink-2">Cliente</th>
                <th className="px-3 py-2 text-right font-display font-bold text-ink-2">Items</th>
                <th className="px-3 py-2 text-right font-display font-bold text-ink-2">Refund</th>
                <th className="px-3 py-2 text-right font-display font-bold text-ink-2">Solicitado</th>
                <th className="px-3 py-2 text-right font-display font-bold text-ink-2">Recibido</th>
              </tr>
            </thead>
            <tbody>
              {filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map((r) => {
                const meta = STATUS_META[r.status] ?? { label: r.status, cls: "text-ink-3", bg: "bg-cream-2" }
                const order = orderById.get(r.order_id)
                const totalQty = r.items?.reduce((s, it) => s + it.quantity, 0) ?? 0
                const receivedQty = r.items?.reduce((s, it) => s + (it.received_quantity ?? 0), 0) ?? 0
                return (
                  <tr key={r.id} className="row-zebra row-hover border-b border-warm-200/50 last:border-b-0">
                    <td className="px-3 py-2">
                      <span className={`pill ${meta.cls}`}>
                        <span className="pill-dot" />{meta.label}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <Link href={`/orders/${r.order_id}`} className="font-mono font-bold text-ink hover:text-orange">
                        #{order?.display_id ?? r.order_id.slice(-6)}
                      </Link>
                    </td>
                    <td className="px-3 py-2">
                      {order ? (
                        <>
                          <div className="font-display font-bold text-ink truncate">
                            {[order.customer?.first_name, order.customer?.last_name].filter(Boolean).join(" ") || order.email || "—"}
                          </div>
                          <div className="text-[10px] text-ink-3 font-mono truncate">{order.customer?.email ?? order.email}</div>
                        </>
                      ) : <span className="text-ink-3">—</span>}
                    </td>
                    <td className="px-3 py-2 text-right num">
                      <span className="font-display font-bold text-[13px]">{receivedQty}</span>
                      <span className="text-ink-3"> / {totalQty}</span>
                    </td>
                    <td className="px-3 py-2 text-right font-display font-bold num text-secondary">
                      {r.refund_amount ? fmtEur(Number(r.refund_amount)) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-[10px] text-ink-3 num">{fmtRelative(r.created_at)}</td>
                    <td className="px-3 py-2 text-right font-mono text-[10px] text-ink-3 num">
                      {r.received_at ? fmtRelative(r.received_at) : "—"}
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

function FilterChip({ label, active, href, tone }: { label: string; active: boolean; href: string; tone?: string }) {
  const activeColor = tone === "orange" ? "bg-orange text-dark"
                    : tone === "primary" ? "bg-primary text-white"
                    : tone === "secondary" ? "bg-secondary text-cream"
                    : "bg-dark text-cream"
  return (
    <Link href={href}
      className={`px-2.5 py-1.5 rounded-md text-[10px] font-display font-bold uppercase tracking-wider whitespace-nowrap transition-colors ${
        active ? activeColor : "text-ink-3 hover:bg-cream-2"
      }`}
      style={!active ? { border: "1.5px solid var(--border)" } : undefined}>
      {label}
    </Link>
  )
}
