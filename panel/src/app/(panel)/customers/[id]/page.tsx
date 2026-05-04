import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Mail, Phone, MapPin, ShoppingBag, Calendar, IdCard, UserCheck } from "lucide-react"
import {
  retrieveCustomer,
  listOrdersByCustomer,
  listCustomerGroups,
  MedusaError,
  type AdminCustomerDetail,
  type AdminCustomerGroup,
  type AdminOrderListItem,
} from "@/lib/medusa"
import { fmtEur, fmtRelative, initials, fmtNum } from "@/lib/utils"
import { CustomerGroups } from "./CustomerGroups"
import { CustomerNotesWrapper } from "./CustomerNotesWrapper"
import { EditCustomer } from "./EditCustomer"
import { AddressesManager, type AddressRow } from "./AddressesManager"
import type { CustomerNote } from "./actions"
import { getSession } from "@/lib/auth"

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  let customer: AdminCustomerDetail
  try {
    const res = await retrieveCustomer(id)
    customer = res.customer
  } catch (e) {
    if (e instanceof MedusaError && e.status === 404) notFound()
    throw e
  }

  let orders: AdminOrderListItem[] = []
  let totalOrders = 0
  let lifetimeValue = 0
  let ordersError: string | null = null
  try {
    const res = await listOrdersByCustomer(id, 50)
    orders = res.orders
    totalOrders = res.count
    lifetimeValue = orders.reduce((sum, o) => sum + (Number(o.total) || 0), 0)
  } catch (e) {
    ordersError = e instanceof Error ? e.message : "error desconocido"
  }

  let allGroups: AdminCustomerGroup[] = []
  try {
    const gRes = await listCustomerGroups()
    allGroups = gRes.customer_groups
  } catch { /* silent — segmentos opcionales */ }

  const session = await getSession()
  const notes: CustomerNote[] = Array.isArray(customer.metadata?.notes)
    ? (customer.metadata!.notes as CustomerNote[])
    : []

  const fullName =
    [customer.first_name, customer.last_name].filter(Boolean).join(" ") ||
    customer.email.split("@")[0]
  const created = new Date(customer.created_at)
  const cedula = typeof customer.metadata?.cedula === "string" ? customer.metadata.cedula : null
  const lastOrder = orders[0]

  // Aggregate fulfillment buckets
  const paid = orders.filter((o) => o.payment_status === "captured").length
  const pending = orders.filter((o) => o.payment_status === "awaiting" || o.payment_status === "not_paid").length
  const fulfilled = orders.filter(
    (o) =>
      o.fulfillment_status === "fulfilled" ||
      o.fulfillment_status === "shipped" ||
      o.fulfillment_status === "delivered"
  ).length

  const defaultShipping = customer.addresses?.find((a) => a.is_default_shipping)
  const otherAddresses = (customer.addresses ?? []).filter((a) => a.id !== defaultShipping?.id)

  return (
    <div className="p-7 space-y-5 relative">
      <div className="watermark-amp text-[400px] -top-32 right-0 select-none italic">&amp;</div>

      <div className="flex items-start justify-between relative">
        <div className="flex items-center gap-4">
          <Link
            href="/customers"
            className="w-10 h-10 hover:bg-cream-2 flex items-center justify-center text-ink transition-colors"
            style={{ border: "1.5px solid var(--border)", borderRadius: 3 }}
          >
            <ArrowLeft size={16} strokeWidth={2.5} />
          </Link>
          <div className="flex items-center gap-4">
            <div
              className="w-16 h-16 bg-secondary text-cream flex items-center justify-center font-display font-black text-[24px]"
              style={{ border: "2px solid var(--border)", boxShadow: "3px 3px 0 0 var(--shadow-color)" }}
            >
              {initials(fullName)}
            </div>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="font-display font-black text-[28px] text-ink leading-none tracking-tight">
                  {fullName}
                </h1>
                {customer.has_account ? (
                  <span className="pill text-secondary">
                    <span className="pill-dot" />
                    Registrado
                  </span>
                ) : (
                  <span className="pill text-ink-3">
                    <span className="pill-dot" />
                    Guest
                  </span>
                )}
              </div>
              <p className="text-[12px] text-ink-3 font-mono">
                Cliente desde {created.toLocaleDateString("es-VE", { month: "long", year: "numeric" })}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`mailto:${customer.email}`}
            className="flex items-center gap-1.5 px-3 py-2 bg-cream rounded-md text-[10px] font-display font-bold uppercase tracking-wider text-ink hover:bg-cream-2"
            style={{ border: "1.5px solid var(--border)", boxShadow: "3px 3px 0 0 var(--shadow-color)" }}
          >
            <Mail size={13} strokeWidth={2.5} /> Email
          </a>
          <EditCustomer
            customerId={customer.id}
            initial={{
              email: customer.email,
              first_name: customer.first_name ?? "",
              last_name: customer.last_name ?? "",
              phone: customer.phone ?? "",
              cedula: typeof customer.metadata?.cedula === "string" ? customer.metadata.cedula : "",
            }}
          />
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard label="Pedidos" value={fmtNum(totalOrders)} icon={<ShoppingBag size={16} />} />
        <StatCard label="LTV" value={fmtEur(lifetimeValue)} icon={<Calendar size={16} />} accent />
        <StatCard label="Pagados" value={fmtNum(paid)} icon={<UserCheck size={16} />} />
        <StatCard label="Pendientes" value={fmtNum(pending)} icon={<UserCheck size={16} />} tone="orange" />
      </div>

      <div className="grid grid-cols-12 gap-5">
        {/* LEFT — orders */}
        <div className="col-span-8 space-y-5">
          <div className="stamp-card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 bg-dark text-cream">
              <h3 className="font-display font-black text-[14px] uppercase tracking-wider">
                Historial de pedidos
              </h3>
              <span className="text-[11px] text-orange font-mono num">
                {totalOrders} totales · {fulfilled} entregados
              </span>
            </div>
            {ordersError && (
              <div className="p-5 text-[12px] text-primary">No se pudieron cargar pedidos: {ordersError}</div>
            )}
            {!ordersError && orders.length === 0 && (
              <div className="p-10 text-center font-display font-bold text-[12px] uppercase tracking-wider text-ink-3">
                Aún no tiene pedidos
              </div>
            )}
            {!ordersError && orders.length > 0 && (
              <table className="w-full">
                <thead>
                  <tr
                    className="bg-cream-2 text-[10px] uppercase tracking-[0.12em]"
                    style={{ borderBottom: "2px solid var(--border)" }}
                  >
                    <th className="px-3 py-2.5 text-left font-display font-bold text-ink-2">Pedido</th>
                    <th className="px-3 py-2.5 text-left font-display font-bold text-ink-2">Fecha</th>
                    <th className="px-3 py-2.5 text-left font-display font-bold text-ink-2">Estado</th>
                    <th className="px-3 py-2.5 text-right font-display font-bold text-ink-2">Total</th>
                  </tr>
                </thead>
                <tbody className="text-[13px]">
                  {orders.map((o) => {
                    const itemCount = o.items?.length ?? 0
                    return (
                      <tr key={o.id} className="row-hover row-zebra border-b border-warm-200/50 last:border-b-0">
                        <td className="px-3 py-3">
                          <Link href={`/orders/${o.id}`} className="block">
                            <div className="font-mono font-bold text-ink num">#{o.display_id}</div>
                            <div className="text-[10px] text-ink-3 font-mono">
                              {itemCount} producto{itemCount === 1 ? "" : "s"}
                            </div>
                          </Link>
                        </td>
                        <td className="px-3 py-3 text-[11px] text-ink-3 font-mono num">
                          <Link href={`/orders/${o.id}`} className="block">
                            {fmtRelative(o.created_at)}
                          </Link>
                        </td>
                        <td className="px-3 py-3">
                          <Link href={`/orders/${o.id}`} className="block space-y-0.5">
                            <span
                              className={`pill ${
                                o.payment_status === "captured"
                                  ? "text-secondary"
                                  : o.payment_status === "awaiting"
                                    ? "text-orange"
                                    : "text-ink-3"
                              }`}
                            >
                              <span className="pill-dot" />
                              {o.payment_status === "captured"
                                ? "Pagado"
                                : o.payment_status === "awaiting"
                                  ? "P. Móvil"
                                  : o.payment_status === "not_paid"
                                    ? "Sin pagar"
                                    : (o.payment_status ?? "—")}
                            </span>
                          </Link>
                        </td>
                        <td className="px-3 py-3 text-right font-display font-black num">
                          <Link href={`/orders/${o.id}`} className="block">
                            {fmtEur(Number(o.total) || 0)}
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* RIGHT — info */}
        <div className="col-span-4 space-y-4">
          {/* Contact */}
          <div className="stamp-card p-5">
            <h3 className="font-display font-black text-[14px] uppercase tracking-wider mb-3">
              Contacto
            </h3>
            <dl className="text-[12px] space-y-2.5">
              <div className="flex items-start gap-2">
                <Mail size={13} className="mt-0.5 text-ink-3 shrink-0" />
                <a href={`mailto:${customer.email}`} className="font-mono text-ink hover:text-orange truncate">
                  {customer.email}
                </a>
              </div>
              {customer.phone && (
                <div className="flex items-start gap-2">
                  <Phone size={13} className="mt-0.5 text-ink-3 shrink-0" />
                  <a href={`tel:${customer.phone}`} className="font-mono text-ink hover:text-orange num">
                    {customer.phone}
                  </a>
                </div>
              )}
              {cedula && (
                <div className="flex items-start gap-2">
                  <IdCard size={13} className="mt-0.5 text-ink-3 shrink-0" />
                  <span className="font-mono text-ink num">CI {cedula}</span>
                </div>
              )}
            </dl>
          </div>

          {/* Default address */}
          {defaultShipping && (
            <div className="stamp-card p-5">
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="w-7 h-7 bg-cream-2 flex items-center justify-center"
                  style={{ border: "1.5px solid var(--border)" }}
                >
                  <MapPin size={14} strokeWidth={2.2} />
                </div>
                <h3 className="font-display font-black text-[14px] uppercase tracking-wider">
                  Dirección principal
                </h3>
              </div>
              <div className="text-[12px] text-ink-2 font-mono leading-relaxed">
                {defaultShipping.address_1 && (
                  <>
                    {defaultShipping.address_1}
                    <br />
                  </>
                )}
                {[defaultShipping.city, defaultShipping.province].filter(Boolean).join(", ")}
                {defaultShipping.country_code && (
                  <span className="text-ink-3"> · {defaultShipping.country_code.toUpperCase()}</span>
                )}
              </div>
            </div>
          )}

          {/* Other addresses */}
          {otherAddresses.length > 0 && (
            <details className="stamp-card p-5">
              <summary className="font-display font-black text-[12px] uppercase tracking-wider cursor-pointer">
                + {otherAddresses.length} direcciones más
              </summary>
              <ul className="mt-3 space-y-2 text-[11px] font-mono text-ink-2">
                {otherAddresses.map((a) => (
                  <li key={a.id} className="leading-relaxed">
                    {a.address_1}
                    {a.city && (
                      <>
                        <br />
                        <span className="text-ink-3">
                          {[a.city, a.province].filter(Boolean).join(", ")}
                        </span>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </details>
          )}

          {/* Last order quick link */}
          {lastOrder && (
            <Link
              href={`/orders/${lastOrder.id}`}
              className="block stamp-card p-4 hover:bg-cream-2 transition-colors"
            >
              <div className="text-[10px] font-display font-bold uppercase tracking-wider text-ink-3 mb-1">
                Último pedido
              </div>
              <div className="flex items-baseline justify-between">
                <span className="font-mono font-bold num text-ink">#{lastOrder.display_id}</span>
                <span className="font-display font-black num">{fmtEur(Number(lastOrder.total) || 0)}</span>
              </div>
              <div className="text-[10px] text-ink-3 font-mono mt-1">{fmtRelative(lastOrder.created_at)}</div>
            </Link>
          )}

          {/* Notes (internal) */}
          <CustomerNotesWrapper
            customerId={customer.id}
            notes={notes}
            currentUser={session?.email}
          />

          {/* Addresses CRUD */}
          <AddressesManager
            customerId={customer.id}
            rows={(customer.addresses ?? []).map<AddressRow>((a) => ({
              id: a.id,
              first_name: a.first_name ?? "",
              last_name: a.last_name ?? "",
              address_1: a.address_1 ?? "",
              city: a.city ?? "",
              province: a.province ?? "",
              postal_code: a.postal_code ?? "",
              country_code: a.country_code ?? "",
              phone: a.phone ?? "",
              is_default_shipping: a.is_default_shipping ?? false,
              is_default_billing: a.is_default_billing ?? false,
            }))}
          />

          {/* Groups (interactive) */}
          <CustomerGroups
            customerId={customer.id}
            current={(customer.groups ?? []).map((g) => ({ id: g.id, name: g.name }))}
            available={allGroups.map((g) => ({ id: g.id, name: g.name }))}
          />
        </div>
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  icon,
  accent,
  tone,
}: {
  label: string
  value: string
  icon: React.ReactNode
  accent?: boolean
  tone?: "orange"
}) {
  const valueColor = accent ? "text-orange" : tone === "orange" ? "text-orange" : "text-ink"
  return (
    <div
      className="stamp-card p-4"
      style={{
        background: accent ? "var(--page-bg)" : undefined,
        boxShadow: accent ? "4px 4px 0 0 var(--shadow-color)" : undefined,
      }}
    >
      <div className="flex items-center gap-2 mb-1.5 text-ink-3">
        {icon}
        <span className="text-[10px] font-display font-bold uppercase tracking-[0.18em]">{label}</span>
      </div>
      <div className={`font-display font-black text-[22px] num ${valueColor}`}>{value}</div>
    </div>
  )
}
