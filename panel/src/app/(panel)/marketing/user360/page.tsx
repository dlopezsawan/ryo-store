import Link from "next/link"
import {
  AlertCircle, User, Mail, Phone, ExternalLink, Eye, Activity, AlertTriangle,
  Search, Users, ShoppingBag,
} from "lucide-react"
import { PageHeader, PageWatermark } from "@/components/layout/PageHeader"
import { Breadcrumbs } from "@/components/ui/Breadcrumbs"
import { EmptyState } from "@/components/ui/EmptyState"
import { MarketingNav } from "../MarketingNav"
import {
  getUser360, listCustomers, listOrders, MedusaError,
  type User360Response, type AdminCustomer, type AdminOrderListItem,
} from "@/lib/medusa"
import { fmtEur, fmtRelative } from "@/lib/utils"

interface SearchParams {
  email?: string
  customer_id?: string
  distinct_id?: string
  /** Filtros de la lista */
  q?: string
  filter?: "all" | "with_orders" | "no_orders" | "has_phone" | "has_account"
  page?: string
}

const SEVERITY_META: Record<string, { label: string; color: string; bg: string }> = {
  high:   { label: "HIGH",   color: "#BB3B2E", bg: "bg-primary/10" },
  medium: { label: "MED",    color: "#FF3B27", bg: "bg-orange/10" },
  low:    { label: "LOW",    color: "#D4A015", bg: "bg-orange/5" },
  info:   { label: "INFO",   color: "#9C9285", bg: "bg-cream-2" },
}

const PAGE_SIZE = 30

export default async function User360Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams
  const hasDetailQuery = !!(params.email || params.customer_id || params.distinct_id)

  if (hasDetailQuery) {
    return <DetailView params={params} />
  }
  return <ListView params={params} />
}

// ─── List view ──────────────────────────────────────────────────────────────

async function ListView({ params }: { params: SearchParams }) {
  const filter = params.filter ?? "all"
  const page = Math.max(1, Number(params.page ?? "1"))
  const offset = (page - 1) * PAGE_SIZE
  const q = params.q?.trim() || undefined

  // 1) Fetch customers (Medusa)
  let customers: AdminCustomer[] = []
  let total = 0
  let listError: string | null = null
  try {
    const r = await listCustomers({
      q,
      offset,
      limit: PAGE_SIZE,
      has_account: filter === "has_account" ? true : undefined,
    })
    customers = r.customers
    total = r.count
  } catch (e) {
    listError = e instanceof MedusaError ? `Backend ${e.status}: ${e.message}` : "error"
  }

  // 2) Fetch últimos orders para anotar customers con pedidos / revenue
  //    Cargamos un batch grande, lo bucketeamos por customer_id en memoria.
  let recentOrders: AdminOrderListItem[] = []
  try {
    const r = await listOrders({ limit: 500 })
    recentOrders = r.orders
  } catch { /* ignore */ }

  const ordersByCustomer = new Map<string, { count: number; revenue: number; lastAt: string | null; lastTotal: number }>()
  for (const o of recentOrders) {
    const cid = o.customer?.id
    if (!cid) continue
    const cur = ordersByCustomer.get(cid) ?? { count: 0, revenue: 0, lastAt: null, lastTotal: 0 }
    cur.count += 1
    cur.revenue += Number(o.total) || 0
    if (!cur.lastAt || new Date(o.created_at) > new Date(cur.lastAt)) {
      cur.lastAt = o.created_at
      cur.lastTotal = Number(o.total) || 0
    }
    ordersByCustomer.set(cid, cur)
  }

  // 3) Aplicar filtros que dependen de orders
  let filtered = customers
  if (filter === "with_orders") {
    filtered = customers.filter((c) => (ordersByCustomer.get(c.id)?.count ?? 0) > 0)
  } else if (filter === "no_orders") {
    filtered = customers.filter((c) => (ordersByCustomer.get(c.id)?.count ?? 0) === 0)
  } else if (filter === "has_phone") {
    filtered = customers.filter((c) => !!c.phone)
  }

  const filterCounts = {
    all: customers.length,
    with_orders: customers.filter((c) => (ordersByCustomer.get(c.id)?.count ?? 0) > 0).length,
    no_orders: customers.filter((c) => (ordersByCustomer.get(c.id)?.count ?? 0) === 0).length,
    has_phone: customers.filter((c) => !!c.phone).length,
    has_account: customers.filter((c) => c.has_account).length,
  }

  return (
    <div className="p-7 space-y-5 relative">
      <PageWatermark char="◉" />
      <Breadcrumbs items={[{ label: "Marketing", href: "/marketing" }, { label: "User 360" }]} />
      <PageHeader
        title="USER 360"
        stamp={<>{total.toLocaleString("es-VE")} CLIENTES TOTALES</>}
        stampTone="orange"
        description="Vista combinada de un usuario · pedidos + comportamiento web + signals de remarketing"
      />
      <MarketingNav />

      {/* Search bar */}
      <form action="/marketing/user360" method="GET" className="stamp-card p-3">
        <div className="flex items-center gap-2">
          <Search size={14} className="text-ink-3 mx-1" strokeWidth={2.5} />
          <input
            type="text"
            name="q"
            defaultValue={params.q ?? ""}
            placeholder="Buscá por email, nombre, teléfono… o pegá un customer_id / distinct_id directo"
            className="flex-1 px-3 py-2 bg-cream rounded-md text-[12px] focus:outline-none"
            style={{ border: "1.5px solid var(--border)" }}
          />
          <button
            type="submit"
            className="px-3 py-2 bg-orange text-dark rounded-md text-[10px] font-display font-bold uppercase tracking-wider"
            style={{ border: "2px solid #1A1A1A", boxShadow: "3px 3px 0 0 var(--shadow-color)" }}
          >
            Buscar
          </button>
          {/* preserve filter while searching */}
          {filter !== "all" && <input type="hidden" name="filter" value={filter} />}
        </div>
        <p className="text-[10px] text-ink-3 font-mono mt-2 ml-7">
          Tip: para abrir el 360 directo de un usuario, usá los enlaces directos abajo · ó{" "}
          <Link href={`/marketing/user360?email=${encodeURIComponent(params.q ?? "")}`} className="text-orange hover:underline">
            buscar como email exacto →
          </Link>
        </p>
      </form>

      {/* Filtros */}
      <div className="flex items-center gap-1 flex-wrap">
        <FilterPill href={buildHref(params, { filter: "all", page: undefined })} active={filter === "all"} label="Todos" count={filterCounts.all} />
        <FilterPill href={buildHref(params, { filter: "with_orders", page: undefined })} active={filter === "with_orders"} label="Con pedidos" count={filterCounts.with_orders} tone="secondary" />
        <FilterPill href={buildHref(params, { filter: "no_orders", page: undefined })} active={filter === "no_orders"} label="Sin pedidos" count={filterCounts.no_orders} tone="warning" />
        <FilterPill href={buildHref(params, { filter: "has_phone", page: undefined })} active={filter === "has_phone"} label="Con WhatsApp" count={filterCounts.has_phone} />
        <FilterPill href={buildHref(params, { filter: "has_account", page: undefined })} active={filter === "has_account"} label="Cuenta creada" count={filterCounts.has_account} />
      </div>

      {listError && (
        <div className="stamp-card p-4 bg-primary/5" style={{ borderColor: "#BB3B2E" }}>
          <p className="text-[13px] text-primary flex items-center gap-2">
            <AlertCircle size={14} /> {listError}
          </p>
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No hay clientes que coincidan"
          description={
            <>
              {q ? (
                <>Probá otro término o limpiá la búsqueda. {filter !== "all" && "También podés cambiar el filtro."}</>
              ) : (
                <>Todavía no hay customers en la base con este filtro.</>
              )}
            </>
          }
          action={q ? { kind: "link", label: "Limpiar búsqueda", href: `/marketing/user360${filter !== "all" ? `?filter=${filter}` : ""}` } : undefined}
        />
      ) : (
        <div className="stamp-card overflow-hidden">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="bg-dark text-cream text-[10px] uppercase tracking-[0.12em]">
                <th className="px-3 py-2 text-left font-display font-bold">Cliente</th>
                <th className="px-3 py-2 text-left font-display font-bold">Contacto</th>
                <th className="px-3 py-2 text-right font-display font-bold">Pedidos</th>
                <th className="px-3 py-2 text-right font-display font-bold">LTV</th>
                <th className="px-3 py-2 text-right font-display font-bold">Última actividad</th>
                <th className="px-3 py-2 text-right font-display font-bold w-[1%]"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const stats = ordersByCustomer.get(c.id)
                const fullName = [c.first_name, c.last_name].filter(Boolean).join(" ") || c.email.split("@")[0]
                const initials = (c.first_name?.[0] ?? c.email[0] ?? "?").toUpperCase()
                return (
                  <tr key={c.id} className="row-zebra row-hover border-b border-warm-200/50 last:border-b-0">
                    <td className="px-3 py-2.5">
                      <Link href={`/marketing/user360?customer_id=${c.id}`} className="flex items-center gap-2 hover:opacity-80">
                        <span className="w-7 h-7 bg-orange text-dark flex items-center justify-center font-display font-black text-[11px] flex-shrink-0"
                          style={{ border: "1.5px solid #1A1A1A", borderRadius: 4 }}>
                          {initials}
                        </span>
                        <span className="min-w-0">
                          <span className="font-display font-bold text-ink truncate block">{fullName}</span>
                          <span className="text-[10px] font-mono text-ink-3 truncate block">{c.email}</span>
                        </span>
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 text-[10px] font-mono text-ink-3">
                      {c.phone ? (
                        <span className="inline-flex items-center gap-1">
                          <Phone size={9} strokeWidth={2.5} /> {c.phone}
                        </span>
                      ) : (
                        <span className="opacity-50">— sin tel</span>
                      )}
                      {c.has_account && (
                        <span className="ml-2 px-1 py-0.5 text-[9px] font-display font-bold bg-secondary/15 text-secondary rounded">CUENTA</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right num">
                      {stats ? <span className="font-display font-bold">{stats.count}</span> : <span className="text-ink-3">—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right num">
                      {stats ? <span className="font-display font-bold text-secondary">{fmtEur(stats.revenue)}</span> : <span className="text-ink-3">—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {stats?.lastAt ? (
                        <>
                          <div className="text-[11px] font-mono text-ink-2">{fmtRelative(stats.lastAt)}</div>
                          <div className="text-[9px] font-mono text-ink-3">último: {fmtEur(stats.lastTotal)}</div>
                        </>
                      ) : (
                        <span className="text-[10px] font-mono text-ink-3">creó cuenta {fmtRelative(c.created_at)}</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <Link href={`/marketing/user360?customer_id=${c.id}`}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-cream hover:bg-orange/10 text-ink rounded-md text-[10px] font-display font-bold uppercase tracking-wider"
                        style={{ border: "1.5px solid var(--border)" }}>
                        Ver 360 →
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {/* Pagination */}
          <div className="flex items-center justify-between px-3 py-2 bg-cream-2/40 border-t-[1.5px] border-warm-200/60 text-[10px] font-mono">
            <span className="text-ink-3">
              Mostrando {filtered.length} · página {page} · total ~{total.toLocaleString("es-VE")}
            </span>
            <span className="flex items-center gap-1">
              {page > 1 && (
                <Link href={buildHref(params, { page: String(page - 1) })}
                  className="px-2 py-1 bg-cream hover:bg-cream-2 rounded"
                  style={{ border: "1.5px solid var(--border)" }}>← prev</Link>
              )}
              {customers.length === PAGE_SIZE && (
                <Link href={buildHref(params, { page: String(page + 1) })}
                  className="px-2 py-1 bg-cream hover:bg-cream-2 rounded"
                  style={{ border: "1.5px solid var(--border)" }}>next →</Link>
              )}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

function FilterPill({
  href, active, label, count, tone,
}: { href: string; active: boolean; label: string; count: number; tone?: "secondary" | "warning" }) {
  const activeBg = tone === "secondary" ? "bg-secondary text-cream" : tone === "warning" ? "bg-orange text-dark" : "bg-dark text-cream"
  return (
    <Link href={href}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-display font-bold uppercase tracking-wider transition-colors ${
        active ? activeBg : "bg-cream hover:bg-cream-2 text-ink"
      }`}
      style={{ border: "1.5px solid var(--border)" }}>
      {label}
      <span className={`text-[9px] font-mono ${active ? "opacity-80" : "opacity-60"}`}>· {count}</span>
    </Link>
  )
}

function buildHref(current: SearchParams, patch: Partial<Record<keyof SearchParams, string | undefined>>): string {
  const merged = { ...current, ...patch } as Record<string, string | undefined>
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(merged)) {
    if (v !== undefined && v !== "" && v !== "all" /* default */) sp.set(k, v)
  }
  const qs = sp.toString()
  return `/marketing/user360${qs ? "?" + qs : ""}`
}

// ─── Detail view ────────────────────────────────────────────────────────────

async function DetailView({ params }: { params: SearchParams }) {
  let data: User360Response | null = null
  let errorMsg: string | null = null
  try {
    data = await getUser360({
      email: params.email,
      customer_id: params.customer_id,
      distinct_id: params.distinct_id,
    })
  } catch (e) {
    errorMsg = e instanceof MedusaError ? `Backend ${e.status}: ${e.message}` : (e instanceof Error ? e.message : "error")
  }

  const ph = data?.posthog_behavior
  const phHasData = !!ph?.person_id
  const orders = data?.medusa_summary?.orders ?? []
  const summary = data?.medusa_summary
  const signals = data?.signals ?? []
  const events = ph?.recent_events ?? []
  const links = data?.links

  return (
    <div className="p-7 space-y-5 relative">
      <PageWatermark char="◉" />
      <Breadcrumbs items={[
        { label: "Marketing", href: "/marketing" },
        { label: "User 360", href: "/marketing/user360" },
        { label: data?.customer?.email ?? params.email ?? params.customer_id ?? "Detalle" },
      ]} />

      <PageHeader
        title="USER 360"
        stamp="MEDUSA + POSTHOG"
        stampTone="orange"
        description={data?.customer?.email ? `Detalle de ${data.customer.email}` : "Detalle del usuario buscado"}
        actions={
          <Link href="/marketing/user360"
            className="px-3 py-2 bg-cream rounded-md text-[10px] font-display font-bold uppercase tracking-wider hover:bg-cream-2"
            style={{ border: "1.5px solid var(--border)" }}>
            ← Lista
          </Link>
        }
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

      {data && (
        <>
          {/* Customer header */}
          <div className="stamp-card p-5">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 bg-orange flex items-center justify-center font-display font-black text-[24px] text-dark"
                style={{ border: "2px solid #1A1A1A", boxShadow: "3px 3px 0 0 var(--shadow-color)" }}>
                {((data.customer?.first_name?.[0] ?? data.customer?.email?.[0]) ?? "?").toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="font-display font-black text-[20px] uppercase tracking-tight text-ink">
                  {data.customer
                    ? `${data.customer.first_name ?? ""} ${data.customer.last_name ?? ""}`.trim() || data.customer.email
                    : "Sin customer en Medusa"}
                </h2>
                {data.customer && (
                  <div className="flex items-center gap-3 text-[11px] font-mono text-ink-3 mt-1 flex-wrap">
                    <span><Mail size={11} className="inline mr-1" />{data.customer.email}</span>
                    {data.customer.phone && (
                      <span><Phone size={11} className="inline mr-1" />{data.customer.phone}</span>
                    )}
                    <span>cliente desde {fmtRelative(data.customer.created_at)}</span>
                    {data.customer.id && (
                      <Link href={`/customers/${data.customer.id}`} className="text-orange hover:underline flex items-center gap-1">
                        Ver en /customers <ExternalLink size={9} />
                      </Link>
                    )}
                  </div>
                )}
              </div>

              {/* External tools */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {links?.posthog_person && (
                  <a href={links.posthog_person} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 px-2 py-1 bg-cream rounded-md text-[10px] font-display font-bold uppercase tracking-wider hover:bg-cream-2"
                    style={{ border: "1.5px solid var(--border)" }}>
                    PostHog <ExternalLink size={10} />
                  </a>
                )}
                {links?.whatsapp && (
                  <a href={links.whatsapp} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 px-2 py-1 bg-secondary text-cream rounded-md text-[10px] font-display font-bold uppercase tracking-wider hover:opacity-90"
                    style={{ border: "1.5px solid #1A1A1A" }}>
                    WhatsApp <ExternalLink size={10} />
                  </a>
                )}
              </div>
            </div>

            {/* Summary stats inline */}
            {summary && (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-4">
                <SummaryStat label="Pedidos" value={String(summary.orders_count)} icon={ShoppingBag} />
                <SummaryStat label="Lifetime revenue" value={fmtEur(summary.lifetime_revenue)} tone="secondary" />
                <SummaryStat label="AOV" value={fmtEur(summary.avg_order_value)} />
                <SummaryStat label="Días sin comprar" value={summary.days_since_last_order != null ? `${summary.days_since_last_order}d` : "—"} tone={summary.days_since_last_order && summary.days_since_last_order > 60 ? "warning" : undefined} />
                <SummaryStat label="Pago preferido" value={summary.preferred_payment_method ?? "—"} />
              </div>
            )}
          </div>

          {/* Signals */}
          {signals.length > 0 && (
            <div className="stamp-card overflow-hidden">
              <div className="px-5 py-3 bg-dark text-cream">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={14} strokeWidth={2.5} />
                  <h3 className="font-display font-black text-[14px] uppercase tracking-wider">Signals de remarketing</h3>
                  <span className="text-[10px] font-mono text-cream/60">· {signals.length}</span>
                </div>
              </div>
              <ul className="divide-y divide-warm-200/50">
                {signals.map((s) => {
                  const sm = SEVERITY_META[s.severity] ?? SEVERITY_META.info
                  return (
                    <li key={s.id} className={`p-3 ${sm.bg}`}>
                      <div className="flex items-start gap-3">
                        <span className="text-[20px]">{s.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2 flex-wrap">
                            <span className="font-display font-bold text-[13px] text-ink">{s.title}</span>
                            <span className="px-1.5 py-0.5 text-[9px] font-display font-bold uppercase tracking-wider rounded-md text-white"
                              style={{ background: sm.color }}>{sm.label}</span>
                            <span className="text-[10px] font-mono text-ink-3">{fmtRelative(s.detected_at)}</span>
                          </div>
                          <p className="text-[11px] text-ink-2 mt-0.5">{s.description}</p>
                          <div className="text-[10px] text-orange font-mono mt-1">
                            👉 {s.suggested_action} <span className="text-ink-3">via {s.suggested_channel}</span>
                          </div>
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Orders */}
            <div className="stamp-card overflow-hidden">
              <div className="px-5 py-3 bg-dark text-cream">
                <h3 className="font-display font-black text-[14px] uppercase tracking-wider">Pedidos · {orders.length}</h3>
              </div>
              {orders.length === 0 ? (
                <p className="p-5 text-[12px] text-ink-3 italic">Sin pedidos</p>
              ) : (
                <ul className="divide-y divide-warm-200/50 max-h-96 overflow-y-auto">
                  {orders.map((o) => (
                    <li key={o.id} className="p-3 flex items-center gap-3 row-hover">
                      <Link href={`/orders/${o.id}`} className="font-mono font-bold text-ink hover:text-orange">
                        #{o.display_id}
                      </Link>
                      <div className="flex-1 min-w-0 text-[10px] font-mono text-ink-3 truncate">
                        {o.items?.length || 0} item{o.items?.length === 1 ? "" : "s"}
                        {o.items?.[0] && <> · {o.items[0].title}</>}
                      </div>
                      <div className="text-right">
                        <div className="font-display font-black num text-[13px]">{fmtEur(Number(o.total) || 0)}</div>
                        <div className="text-[9px] text-ink-3 font-mono">{fmtRelative(o.created_at)}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* PostHog behavior */}
            <div className="stamp-card overflow-hidden">
              <div className="px-5 py-3 bg-dark text-cream">
                <div className="flex items-center gap-2">
                  <Eye size={14} strokeWidth={2.5} />
                  <h3 className="font-display font-black text-[14px] uppercase tracking-wider">Comportamiento web</h3>
                </div>
              </div>
              {!phHasData ? (
                <p className="p-5 text-[12px] text-ink-3 italic">Usuario no identificado en PostHog (todavía no navegó loged-in)</p>
              ) : (
                <div className="p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <Stat label="Primera visita" value={ph.first_seen_at ? fmtRelative(ph.first_seen_at) : "—"} />
                    <Stat label="Última visita" value={ph.last_seen_at ? fmtRelative(ph.last_seen_at) : "—"} />
                    <Stat label="Sesiones" value={String(ph.sessions ?? 0)} />
                    <Stat label="Pageviews" value={String(ph.pageviews ?? 0)} />
                    <Stat label="Add-to-carts" value={String(ph.add_to_carts ?? 0)} />
                    <Stat label="Checkout starts" value={String(ph.checkout_starts ?? 0)} />
                    <Stat label="WhatsApp clicks" value={String(ph.whatsapp_clicks ?? 0)} />
                    <Stat label="Orders trackeadas" value={String(ph.orders ?? 0)} />
                    {ph.device && <Stat label="Device" value={ph.device} />}
                    {ph.browser && <Stat label="Browser" value={ph.browser} />}
                    {(ph.city || ph.country) && (
                      <Stat label="Ubicación" value={[ph.city, ph.country].filter(Boolean).join(", ") || "—"} />
                    )}
                  </div>

                  {ph.top_products_viewed && ph.top_products_viewed.length > 0 && (
                    <div>
                      <h4 className="text-[10px] font-display font-bold uppercase tracking-wider text-ink-3 mb-1">Productos vistos</h4>
                      <ul className="space-y-1">
                        {ph.top_products_viewed.slice(0, 8).map((p, i) => (
                          <li key={i} className="text-[11px] flex items-center justify-between bg-cream-2/40 px-2 py-1 rounded-md">
                            <span className="truncate">{p.title}</span>
                            <span className="font-display font-bold text-orange ml-2">{p.count}×</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Recent events */}
          {events.length > 0 && (
            <div className="stamp-card overflow-hidden">
              <div className="px-5 py-3 bg-dark text-cream">
                <div className="flex items-center gap-2">
                  <Activity size={14} strokeWidth={2.5} />
                  <h3 className="font-display font-black text-[14px] uppercase tracking-wider">Eventos recientes</h3>
                  <span className="text-[10px] font-mono text-cream/60">· {events.length}</span>
                </div>
              </div>
              <ul className="divide-y divide-warm-200/50 max-h-80 overflow-y-auto">
                {events.slice(0, 30).map((e, i) => (
                  <li key={i} className="px-4 py-2 flex items-baseline gap-3 text-[11px] hover:bg-cream-2/30">
                    <span className="font-display font-bold text-orange">{e.event}</span>
                    <span className="text-[10px] font-mono text-ink-3">{fmtRelative(e.timestamp)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {!data && !errorMsg && (
        <EmptyState
          icon={User}
          title="Usuario no encontrado"
          description="Probá con email exacto, customer_id (cus_…) o distinct_id de PostHog."
          action={{ kind: "link", label: "Volver a la lista", href: "/marketing/user360" }}
        />
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-cream-2/40 px-2 py-1.5 rounded-md" style={{ border: "1px solid var(--border-soft)" }}>
      <div className="text-[9px] font-display font-bold uppercase tracking-wider text-ink-3">{label}</div>
      <div className="font-display font-bold text-[12px] text-ink truncate">{value}</div>
    </div>
  )
}

function SummaryStat({
  label, value, icon: Icon, tone,
}: { label: string; value: string; icon?: typeof ShoppingBag; tone?: "secondary" | "warning" }) {
  const valueColor = tone === "secondary" ? "text-secondary" : tone === "warning" ? "text-primary" : ""
  return (
    <div className="bg-cream-2/40 px-3 py-2 rounded-md" style={{ border: "1px solid var(--border-soft)" }}>
      <div className="flex items-center gap-1 text-[9px] font-display font-bold uppercase tracking-wider text-ink-3">
        {Icon && <Icon size={9} strokeWidth={2.5} />} {label}
      </div>
      <div className={`font-display font-black text-[16px] ${valueColor}`}>{value}</div>
    </div>
  )
}
