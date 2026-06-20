import Link from "next/link"
import { Search } from "lucide-react"
import { PageHeader, PageWatermark } from "@/components/layout/PageHeader"
import { OrdersTable } from "@/components/orders/OrdersTable"
import { SavedViews } from "@/components/util/SavedViews"
import {
  listOrders, listRegions, listSalesChannels,
  MedusaError, type AdminOrderListItem,
} from "@/lib/medusa"
import { fmtEur } from "@/lib/utils"
import { OrderHeaderActions } from "./OrderHeaderActions"

interface SearchParams {
  q?: string
  status?: string
  page?: string
  date_from?: string
  date_to?: string
  payment_status?: string
  fulfillment_status?: string
}

const PAGE_SIZE = 20

const statusFilters = [
  { key: "all",       label: "Todos" },
  { key: "pending",   label: "Pendientes" },
  { key: "completed", label: "Completados" },
  { key: "canceled",  label: "Cancelados" },
] as const

const paymentStatusFilters = [
  { key: "all",       label: "Cualquier pago" },
  { key: "captured",  label: "Pagados" },
  { key: "awaiting",  label: "Pendientes" },
  { key: "not_paid",  label: "Sin pagar" },
  { key: "refunded",  label: "Reembolsados" },
] as const

export default async function OrdersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams
  const page = Math.max(1, Number(params.page) || 1)
  const offset = (page - 1) * PAGE_SIZE
  const status = params.status === "all" || !params.status ? undefined : [params.status]
  const payment_status = params.payment_status === "all" || !params.payment_status ? undefined : [params.payment_status]
  const fulfillment_status = params.fulfillment_status === "all" || !params.fulfillment_status ? undefined : [params.fulfillment_status]
  const q = params.q?.trim() || undefined
  const date_from = params.date_from?.trim() || undefined
  const date_to = params.date_to?.trim() || undefined

  // Convertir date_from/to a ISO con tiempo extremo (00:00 / 23:59)
  const created_at_gte = date_from ? `${date_from}T00:00:00.000Z` : undefined
  const created_at_lte = date_to ? `${date_to}T23:59:59.999Z` : undefined

  let orders: AdminOrderListItem[] = []
  let totalCount = 0
  let total30dRevenue = 0
  let errorMsg: string | null = null

  try {
    const res = await listOrders({
      limit: PAGE_SIZE, offset, q, status, payment_status, fulfillment_status,
      created_at_gte, created_at_lte,
    })
    orders = res.orders
    totalCount = res.count
    // Siempre calculamos el revenue de 30 días de forma independiente a la paginación
    // para no sumar sólo la primera página (fix: fast-path eliminado)
    const since = new Date()
    since.setDate(since.getDate() - 30)
    const rev30 = await listOrders({ limit: 500, created_at_gte: since.toISOString() })
    total30dRevenue = rev30.orders.reduce((s, o) => s + (Number(o.total) || 0), 0)
  } catch (e) {
    if (e instanceof MedusaError && e.status === 401) {
      errorMsg = "Sesión expirada. Recarga para volver a iniciar sesión."
    } else {
      errorMsg = `No se pudo cargar los pedidos: ${e instanceof Error ? e.message : "error desconocido"}`
    }
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  // Catálogo para el form de "+ Nuevo manual" — silencioso si fallan
  const [regionsRes, channelsRes] = await Promise.all([
    listRegions().catch(() => ({ regions: [] })),
    listSalesChannels().catch(() => ({ sales_channels: [] })),
  ])
  const regionOptions = regionsRes.regions.map((r) => ({ id: r.id, name: r.name, currency_code: r.currency_code }))
  const channelOptions = regionsRes.regions.length > 0
    ? channelsRes.sales_channels.filter((c) => !c.is_disabled).map((c) => ({ id: c.id, name: c.name }))
    : []

  // Construir query string con filtros activos para el export
  const exportSp = new URLSearchParams()
  if (params.q) exportSp.set("q", params.q)
  if (params.status && params.status !== "all") exportSp.set("status", params.status)
  if (params.payment_status && params.payment_status !== "all") exportSp.set("payment_status", params.payment_status)
  if (params.fulfillment_status && params.fulfillment_status !== "all") exportSp.set("fulfillment_status", params.fulfillment_status)
  if (params.date_from) exportSp.set("date_from", params.date_from)
  if (params.date_to) exportSp.set("date_to", params.date_to)
  const exportQuery = exportSp.toString()

  const hasAnyFilter = !!(params.q || (params.status && params.status !== "all") || (params.payment_status && params.payment_status !== "all") || (params.fulfillment_status && params.fulfillment_status !== "all") || params.date_from || params.date_to)

  return (
    <div className="p-7 space-y-5 relative">
      <PageWatermark />

      <PageHeader
        title="PEDIDOS"
        stamp={<span>{totalCount.toLocaleString("es-VE")} TOTALES</span>}
        stampTone="orange"
        description={
          <>
            {totalCount} pedidos · <span className="text-ink font-bold">{fmtEur(total30dRevenue)}</span> en los últimos 30 días
          </>
        }
        actions={
          <OrderHeaderActions
            regions={regionOptions}
            salesChannels={channelOptions}
            exportQuery={exportQuery}
          />
        }
      />

      {/* Filter chips bar */}
      <div className="stamp-card p-3">
        <div className="flex items-center gap-1 mb-3 overflow-x-auto pb-1" style={{ borderBottom: "2px dashed var(--border)" }}>
          {statusFilters.map((f) => {
            const active = (params.status ?? "all") === f.key
            return (
              <Link
                key={f.key}
                href={f.key === "all" ? "/orders" : `/orders?status=${f.key}`}
                className={`px-3 py-1.5 font-display font-bold text-[11px] uppercase tracking-wider rounded-md whitespace-nowrap ${
                  active ? "bg-dark text-cream" : "hover:bg-cream-2 text-ink-3"
                }`}
              >
                {f.label}
              </Link>
            )
          })}
        </div>

        {/* Search form + filtros avanzados */}
        <form className="space-y-2 pt-1" method="GET" action="/orders">
          {params.status && <input type="hidden" name="status" value={params.status} />}
          {params.fulfillment_status && <input type="hidden" name="fulfillment_status" value={params.fulfillment_status} />}
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <Search size={14} strokeWidth={2} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3" />
              <input
                type="text"
                name="q"
                defaultValue={params.q ?? ""}
                placeholder="Buscar por #, email, nombre…"
                className="w-full pl-8 pr-3 py-2 bg-cream rounded-md text-[12px] font-medium focus:outline-none"
                style={{ border: "1.5px solid var(--border)" }}
              />
            </div>
            <select
              name="payment_status"
              defaultValue={params.payment_status ?? "all"}
              className="px-3 py-2 bg-cream rounded-md text-[10px] font-display font-bold uppercase tracking-wider text-ink"
              style={{ border: "1.5px solid var(--border)" }}
            >
              {paymentStatusFilters.map((p) => (
                <option key={p.key} value={p.key}>{p.label}</option>
              ))}
            </select>
            <input
              type="date"
              name="date_from"
              defaultValue={params.date_from ?? ""}
              title="Desde"
              className="px-3 py-2 bg-cream rounded-md text-[11px] font-mono focus:outline-none"
              style={{ border: "1.5px solid var(--border)" }}
            />
            <input
              type="date"
              name="date_to"
              defaultValue={params.date_to ?? ""}
              title="Hasta"
              className="px-3 py-2 bg-cream rounded-md text-[11px] font-mono focus:outline-none"
              style={{ border: "1.5px solid var(--border)" }}
            />
            <button
              type="submit"
              className="flex items-center gap-1.5 px-3 py-2 bg-cream rounded-md text-[10px] font-display font-bold uppercase tracking-wider text-ink hover:bg-cream-2"
              style={{ border: "1.5px solid var(--border)" }}
            >
              Filtrar
            </button>
            {hasAnyFilter && (
              <Link
                href={params.status ? `/orders?status=${params.status}` : "/orders"}
                className="px-3 py-2 text-[10px] font-display font-bold uppercase tracking-wider text-ink-3 hover:text-ink"
              >
                Limpiar
              </Link>
            )}
          </div>
        </form>
      </div>

      {/* Error banner */}
      {errorMsg && (
        <div className="stamp-card p-4 bg-primary/5" style={{ borderColor: "#BB3B2E" }}>
          <p className="text-[13px] font-medium text-primary">{errorMsg}</p>
        </div>
      )}

      {/* Saved views + quick filters */}
      <SavedViews
        storageKey="panel_views_orders"
        presets={[
          { id: "p-all",      name: "Todos",          query: "",                                                      createdAt: 0 },
          { id: "p-pending",  name: "Pendientes pago", query: "payment_status=not_paid",                              createdAt: 0 },
          { id: "p-awaiting", name: "Pago Móvil",      query: "payment_status=awaiting",                              createdAt: 0 },
          { id: "p-to-fulfill", name: "Por preparar",  query: "payment_status=captured&fulfillment_status=not_fulfilled", createdAt: 0 },
          { id: "p-completed", name: "Completados",    query: "status=completed",                                     createdAt: 0 },
          { id: "p-canceled",  name: "Cancelados",     query: "status=canceled",                                      createdAt: 0 },
        ]}
      />

      {/* Table */}
      {!errorMsg && <OrdersTable orders={orders} />}

      {/* Pagination */}
      {!errorMsg && totalPages > 1 && (
        <Pagination
          current={page}
          total={totalPages}
          status={params.status}
          q={params.q}
          payment_status={params.payment_status}
          fulfillment_status={params.fulfillment_status}
          date_from={params.date_from}
          date_to={params.date_to}
        />
      )}
    </div>
  )
}

function Pagination({
  current, total, status, q, payment_status, fulfillment_status, date_from, date_to,
}: {
  current: number; total: number
  status?: string; q?: string
  payment_status?: string; fulfillment_status?: string; date_from?: string; date_to?: string
}) {
  const buildHref = (p: number) => {
    const sp = new URLSearchParams()
    if (p > 1) sp.set("page", String(p))
    if (status) sp.set("status", status)
    if (q) sp.set("q", q)
    if (payment_status) sp.set("payment_status", payment_status)
    if (fulfillment_status) sp.set("fulfillment_status", fulfillment_status)
    if (date_from) sp.set("date_from", date_from)
    if (date_to) sp.set("date_to", date_to)
    const s = sp.toString()
    return s ? `/orders?${s}` : "/orders"
  }
  const pages: number[] = []
  // mostrar primeras 3, current ± 1, última
  const set = new Set([1, 2, 3, current - 1, current, current + 1, total - 1, total])
  for (let i = 1; i <= total; i++) if (set.has(i) && i >= 1 && i <= total) pages.push(i)
  return (
    <div className="flex items-center justify-between px-4 py-3 stamp-card">
      <div className="font-mono text-[11px] text-ink-3">
        Página <span className="text-ink font-bold num">{current}</span> de <span className="text-ink font-bold num">{total}</span>
      </div>
      <div className="flex items-center gap-1 font-display font-bold uppercase tracking-wider text-[11px]">
        {current > 1 ? (
          <Link href={buildHref(current - 1)} className="px-2 py-1 text-ink hover:text-orange">‹ Ant.</Link>
        ) : <span className="px-2 py-1 text-ink-3 opacity-40">‹ Ant.</span>}
        {pages.map((p, i) => (
          <span key={p}>
            {i > 0 && pages[i - 1] !== p - 1 && <span className="px-1 text-ink-3">…</span>}
            {p === current ? (
              <span className="px-2.5 py-1 bg-orange text-dark rounded-md num">{p}</span>
            ) : (
              <Link href={buildHref(p)} className="px-2.5 py-1 hover:bg-cream-2 rounded-md text-ink num">{p}</Link>
            )}
          </span>
        ))}
        {current < total ? (
          <Link href={buildHref(current + 1)} className="px-2 py-1 text-ink hover:text-orange">Sig. ›</Link>
        ) : <span className="px-2 py-1 text-ink-3 opacity-40">Sig. ›</span>}
      </div>
    </div>
  )
}
