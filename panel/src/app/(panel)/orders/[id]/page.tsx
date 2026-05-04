import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, PackageCheck, MapPin, Pencil, FileText } from "lucide-react"
import { retrieveOrder, MedusaError, type AdminOrderDetail } from "@/lib/medusa"
import { fmtEur, fmtRelative, initials } from "@/lib/utils"
import { OrderActions } from "./OrderActions"
import { FulfillmentPanel } from "./FulfillmentPanel"
import { SendOrderEmail } from "./SendOrderEmail"
import { AfterSalesPanel, type ReturnRow } from "./AfterSalesPanel"
import { Timeline, type TimelineEvent } from "./Timeline"
import { OrderNotes } from "./OrderNotes"
import { EditOrderInfo } from "./EditOrderInfo"
import { LineItemsEditor } from "./LineItemsEditor"
import type { OrderNote } from "./actions"
import { listReturns } from "@/lib/medusa"
import { getSession } from "@/lib/auth"

const COMBO_CODES = ["COMBO10", "COMBO15", "COMBO20", "WHOLESALE30"]

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  let order: AdminOrderDetail
  try {
    const res = await retrieveOrder(id)
    order = res.order
  } catch (e) {
    if (e instanceof MedusaError && e.status === 404) notFound()
    throw e
  }

  // Returns para esta orden — fail-soft si el endpoint no existe
  let returns: Awaited<ReturnType<typeof listReturns>>["returns"] = []
  try {
    const r = await listReturns({ order_id: order.id })
    returns = r.returns
  } catch { /* silent */ }

  const session = await getSession()

  // Construir timeline a partir de timestamps existentes en la orden
  const timeline: TimelineEvent[] = []
  timeline.push({
    id: "created", ts: order.created_at,
    kind: "created",
    label: "Pedido creado",
    detail: `${order.items.length} ítem(s) · ${fmtEur(Number(order.total) || 0)}`,
  })
  for (const pc of order.payment_collections ?? []) {
    for (const pay of pc.payments ?? []) {
      timeline.push({
        id: `paid-${pay.id}`, ts: pay.created_at,
        kind: "paid",
        label: "Pago capturado",
        detail: `${pay.provider_id} · ${fmtEur(Number(pay.amount) || 0)}`,
      })
    }
  }
  for (const f of order.fulfillments ?? []) {
    timeline.push({
      id: `fulfilled-${f.id}`, ts: f.created_at,
      kind: "fulfilled",
      label: "Fulfillment creado",
      detail: f.items?.length ? `${f.items.length} ítem(s)` : undefined,
    })
    if (f.shipped_at) {
      const trackingNumbers = (f.labels ?? []).map((l) => l.tracking_number).filter(Boolean)
      timeline.push({
        id: `shipped-${f.id}`, ts: f.shipped_at,
        kind: "shipped",
        label: "Enviado",
        detail: trackingNumbers.length ? `tracking: ${trackingNumbers.join(", ")}` : undefined,
      })
    }
    if (f.delivered_at) {
      timeline.push({
        id: `delivered-${f.id}`, ts: f.delivered_at,
        kind: "delivered",
        label: "Entregado",
      })
    }
    if (f.canceled_at) {
      timeline.push({
        id: `cancel-fulfill-${f.id}`, ts: f.canceled_at,
        kind: "canceled",
        label: "Fulfillment cancelado",
      })
    }
  }
  for (const r of returns) {
    timeline.push({
      id: `return-req-${r.id}`, ts: r.created_at,
      kind: "return-requested",
      label: "Retorno solicitado",
      detail: r.refund_amount && r.refund_amount > 0
        ? `refund ${fmtEur(Number(r.refund_amount))}`
        : `${(r.items ?? []).length} ítem(s)`,
    })
    if (r.received_at) {
      timeline.push({
        id: `return-rcv-${r.id}`, ts: r.received_at,
        kind: "return-received",
        label: "Retorno recibido",
      })
    }
  }
  if (order.status === "canceled") {
    // Sin canceled_at directo en order shape, usamos updated_at como fallback
    timeline.push({
      id: "order-canceled", ts: order.updated_at ?? order.created_at,
      kind: "canceled",
      label: "Pedido cancelado",
    })
  }
  // Ordenar cronológicamente (más reciente primero)
  timeline.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())

  const notes: OrderNote[] = Array.isArray(order.metadata?.notes)
    ? (order.metadata!.notes as OrderNote[])
    : []

  const customerName =
    [order.customer?.first_name, order.customer?.last_name].filter(Boolean).join(" ") ||
    [order.shipping_address?.first_name, order.shipping_address?.last_name].filter(Boolean).join(" ") ||
    order.email ||
    "Cliente sin nombre"
  const customerEmail = order.customer?.email || order.email || "—"

  const shippingAddress = order.shipping_address
  const created = new Date(order.created_at)

  // Compute totals breakdown
  const subtotal = Number(order.subtotal) || 0
  const total = Number(order.total) || 0
  const discount = Number(order.discount_total) || 0
  const shipping = Number(order.shipping_total) || 0

  // Detectar tier dominante por adjustments
  const allCodes = new Set<string>()
  for (const it of order.items ?? []) {
    for (const adj of (it.adjustments ?? [])) {
      if (adj.code) allCodes.add(adj.code)
    }
  }
  const dominantCombo = COMBO_CODES.find((c) => allCodes.has(c)) ?? null
  const dominantPct =
    dominantCombo === "WHOLESALE30" ? "30%" :
    dominantCombo === "COMBO20"     ? "20%" :
    dominantCombo === "COMBO15"     ? "15%" :
    dominantCombo === "COMBO10"     ? "10%" : null

  // Status pills
  const paymentLabel = order.payment_status === "captured" ? "Pagado" :
                       order.payment_status === "awaiting" ? "P. Móvil pendiente" :
                       order.payment_status === "not_paid" ? "Sin pagar" :
                       order.payment_status ?? "—"
  const paymentTone = order.payment_status === "captured" ? "secondary" :
                      order.payment_status === "awaiting" ? "orange" : "ink-3"

  const fulfillLabel = order.fulfillment_status === "fulfilled" ? "Enviado" :
                       order.fulfillment_status === "shipped"   ? "En tránsito" :
                       order.fulfillment_status === "delivered" ? "Entregado" :
                       order.fulfillment_status === "canceled"  ? "Cancelado" :
                       "Pendiente envío"
  const fulfillTone = order.fulfillment_status === "fulfilled" || order.fulfillment_status === "shipped" || order.fulfillment_status === "delivered"
    ? "secondary"
    : order.fulfillment_status === "canceled" ? "primary" : "orange"

  return (
    <div className="p-7 space-y-5 relative">
      <div className="watermark-amp text-[400px] -top-32 right-0 select-none italic">&amp;</div>

      <div className="flex items-start justify-between relative">
        <div className="flex items-center gap-4">
          <Link href="/orders"
                className="w-10 h-10 hover:bg-cream-2 flex items-center justify-center text-ink transition-colors"
                style={{ border: "1.5px solid var(--border)", borderRadius: 3 }}>
            <ArrowLeft size={16} strokeWidth={2.5} />
          </Link>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="font-display font-black text-[34px] text-ink leading-none tracking-tight font-mono">
                #{order.display_id}
              </h1>
              <span className={`pill ${paymentTone === "secondary" ? "text-secondary" : paymentTone === "orange" ? "text-orange" : "text-ink-3"}`}>
                <span className="pill-dot" />{paymentLabel}
              </span>
              <span className={`pill ${fulfillTone === "secondary" ? "text-secondary" : fulfillTone === "primary" ? "text-primary" : "text-orange"}`}>
                <span className="pill-dot" />{fulfillLabel}
              </span>
            </div>
            <p className="text-[12px] text-ink-3 font-mono num">
              {created.toLocaleDateString("es-VE", { day: "numeric", month: "short", year: "numeric" })} ·{" "}
              {created.toLocaleTimeString("es-VE", { hour: "2-digit", minute: "2-digit" })}
              {order.currency_code && ` · ${order.currency_code.toUpperCase()}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <SendOrderEmail
            orderId={order.id}
            displayId={order.display_id}
            customerEmail={customerEmail !== "—" ? customerEmail : ""}
            customerName={customerName.split(" ")[0] || "Cliente"}
            total={Number(order.total) || 0}
            currency={order.currency_code ?? "eur"}
            items={order.items.map((it) => ({
              title: it.title,
              quantity: it.quantity,
              unit_price: Number(it.unit_price) || 0,
            }))}
            trackingUrl={order.fulfillments?.flatMap((f) => (f.labels ?? []).map((l) => l.tracking_url)).find((u) => !!u) ?? null}
          />
          <OrderActions
            orderId={order.id}
            paymentStatus={order.payment_status ?? order.payment_collections?.[0]?.status ?? null}
            fulfillmentStatus={order.fulfillment_status ?? null}
            orderStatus={order.status ?? null}
            currency={order.currency_code ?? "eur"}
            paidAmount={Number(order.payment_collections?.[0]?.payments?.[0]?.amount) || Number(order.total) || 0}
            items={order.items.map((it) => ({
              id: it.id,
              title: it.title,
              quantity: it.quantity,
              unitPrice: Number(it.unit_price) || 0,
            }))}
          />
        </div>
      </div>

      <div className="grid grid-cols-12 gap-5">
        {/* LEFT */}
        <div className="col-span-8 space-y-5">
          {/* Items (editable) */}
          <LineItemsEditor
            orderId={order.id}
            currency={order.currency_code ?? "eur"}
            locked={
              order.status === "canceled" ||
              order.fulfillment_status === "shipped" ||
              order.fulfillment_status === "delivered"
            }
            items={order.items.map((it) => {
              const lineSubtotal = Number(it.subtotal ?? Number(it.unit_price) * it.quantity) || 0
              const lineDiscount = (it.adjustments ?? []).reduce((s, a) => s + (Number(a.amount) || 0), 0)
              const variantLabel = [it.variant?.product?.title, it.variant?.title]
                .filter((v) => v && v !== "Default Title")
                .join(" · ")
              const adjustmentCode = it.adjustments?.find((a) => a.code && COMBO_CODES.includes(a.code))?.code ?? null
              return {
                id: it.id,
                title: it.title,
                variantTitle: variantLabel || null,
                sku: it.variant?.sku ?? null,
                thumbnail: it.thumbnail ?? null,
                quantity: it.quantity,
                unitPrice: Number(it.unit_price) || 0,
                subtotal: lineSubtotal,
                discountTotal: lineDiscount,
                comboCode: adjustmentCode,
              }
            })}
          />

          <div className="stamp-card overflow-hidden">
            {/* Totals breakdown */}
            <div className="px-5 py-5 bg-cream-2/50 relative">
              <div className="ml-auto max-w-xs space-y-1.5 text-[13px] font-mono">
                <div className="flex justify-between"><span className="text-ink-2">Subtotal</span><span className="num font-semibold">{fmtEur(subtotal)}</span></div>
                {discount > 0 && (
                  <div className="flex justify-between text-secondary">
                    <span className="font-display font-bold uppercase text-[11px] tracking-wider">
                      ⚡ {dominantCombo ?? "Descuento"}{dominantPct ? ` · ${dominantPct}` : ""}
                    </span>
                    <span className="num font-bold">−{fmtEur(discount)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-ink-2">Envío</span>
                  <span className={shipping === 0 ? "text-secondary font-display font-bold" : "num"}>
                    {shipping === 0 ? "GRATIS" : fmtEur(shipping)}
                  </span>
                </div>
                <div className="dotted-div my-2" />
                <div className="flex justify-between font-display font-black text-[18px] text-ink">
                  <span className="uppercase">Total</span><span className="num">{fmtEur(total)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Pago */}
          <div className="stamp-card p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 bg-secondary text-cream flex items-center justify-center" style={{ border: "1.5px solid var(--border)" }}>
                <PackageCheck size={14} strokeWidth={3} />
              </div>
              <h3 className="font-display font-black text-[14px] uppercase tracking-wider">Pago</h3>
            </div>
            {order.payment_collections && order.payment_collections.length > 0 ? (
              <dl className="text-[12px] space-y-1.5">
                <div className="flex justify-between"><dt className="text-ink-3">Estado colección</dt><dd className="font-semibold">{order.payment_collections[0].status}</dd></div>
                <div className="flex justify-between"><dt className="text-ink-3">Monto</dt><dd className="font-display font-bold num">{fmtEur(Number(order.payment_collections[0].amount) || 0)}</dd></div>
                {order.payment_collections[0].payments?.[0] && (
                  <>
                    <div className="dotted-div my-2" />
                    <div className="flex justify-between"><dt className="text-ink-3">Provider</dt><dd className="font-mono font-bold">{order.payment_collections[0].payments[0].provider_id}</dd></div>
                    <div className="flex justify-between"><dt className="text-ink-3">Capturado</dt><dd className="font-mono num">{fmtRelative(order.payment_collections[0].payments[0].created_at)}</dd></div>
                  </>
                )}
              </dl>
            ) : (
              <p className="text-[12px] text-ink-3">Sin información de pago.</p>
            )}
          </div>

          {/* Envíos & retornos */}
          <FulfillmentPanel
            orderId={order.id}
            currency={order.currency_code ?? "eur"}
            fulfillments={(order.fulfillments ?? []).map((f) => ({
              id: f.id,
              createdAt: f.created_at,
              shippedAt: f.shipped_at ?? null,
              deliveredAt: f.delivered_at ?? null,
              canceledAt: f.canceled_at ?? null,
              labels: (f.labels ?? []).map((l) => ({
                id: l.id,
                tracking_number: l.tracking_number,
                tracking_url: l.tracking_url ?? null,
              })),
            }))}
            items={order.items.map((it) => ({
              id: it.id,
              title: it.title,
              quantity: it.quantity,
              unitPrice: Number(it.unit_price) || 0,
            }))}
          />

          <AfterSalesPanel
            orderId={order.id}
            currency={order.currency_code ?? "eur"}
            returns={returns.map<ReturnRow>((r) => ({
              id: r.id,
              status: r.status,
              refundAmount: Number(r.refund_amount) || 0,
              receivedAt: r.received_at ?? null,
              createdAt: r.created_at,
              items: (r.items ?? []).map((ri) => {
                const lineItem = order.items.find((it) => it.id === ri.item_id)
                return {
                  id: ri.id,
                  itemId: ri.item_id,
                  title: lineItem?.title ?? "(item)",
                  quantity: ri.quantity,
                  receivedQuantity: ri.received_quantity ?? 0,
                }
              }),
            }))}
            items={order.items.map((it) => ({
              id: it.id,
              title: it.title,
              quantity: it.quantity,
              unitPrice: Number(it.unit_price) || 0,
              variantId: it.variant_id ?? null,
            }))}
          />

          <Timeline events={timeline} />
        </div>

        {/* RIGHT */}
        <div className="col-span-4 space-y-4">
          <OrderNotes
            orderId={order.id}
            notes={notes}
            currentUser={session?.email}
          />

          {/* Customer */}
          <div className="stamp-card p-5 relative overflow-hidden">
            <div className="flex items-center justify-between gap-2 mb-3">
              <h3 className="font-display font-black text-[14px] uppercase tracking-wider">Cliente</h3>
              {order.customer?.id && (
                <Link
                  href={`/customers/${order.customer.id}`}
                  className="text-[10px] font-display font-bold uppercase tracking-wider text-orange hover:underline"
                >
                  Ver perfil →
                </Link>
              )}
            </div>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 bg-secondary text-cream flex items-center justify-center font-display font-black text-[16px]"
                   style={{ border: "1.5px solid var(--border)", boxShadow: "2px 2px 0 0 var(--shadow-color)" }}>
                {initials(customerName)}
              </div>
              <div className="flex-1 min-w-0">
                {order.customer?.id ? (
                  <Link
                    href={`/customers/${order.customer.id}`}
                    className="font-display font-bold text-ink text-[14px] hover:text-orange transition-colors"
                  >
                    {customerName}
                  </Link>
                ) : (
                  <div className="font-display font-bold text-ink text-[14px]">{customerName}</div>
                )}
                <div className="text-[10px] text-ink-3 font-mono truncate">{customerEmail}</div>
              </div>
            </div>
            <div className="dotted-div my-2" />
            <dl className="text-[11px] space-y-1.5 font-mono">
              {typeof order.metadata?.cedula === "string" && (
                <div className="flex justify-between">
                  <dt className="text-ink-3 uppercase tracking-wider">Cédula</dt>
                  <dd className="font-bold">{order.metadata.cedula}</dd>
                </div>
              )}
              {typeof order.metadata?.customer_phone === "string" && (
                <div className="flex justify-between">
                  <dt className="text-ink-3 uppercase tracking-wider">Teléfono</dt>
                  <dd className="font-bold num">{order.metadata.customer_phone}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Shipping + Edit */}
          <div className="stamp-card p-5">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-cream-2 flex items-center justify-center" style={{ border: "1.5px solid var(--border)" }}>
                  <MapPin size={14} strokeWidth={2.2} />
                </div>
                <h3 className="font-display font-black text-[14px] uppercase tracking-wider">Envío</h3>
              </div>
              <EditOrderInfo
                orderId={order.id}
                initial={{
                  email: order.email ?? "",
                  first_name: shippingAddress?.first_name ?? "",
                  last_name: shippingAddress?.last_name ?? "",
                  address_1: shippingAddress?.address_1 ?? "",
                  city: shippingAddress?.city ?? "",
                  province: shippingAddress?.province ?? "",
                  postal_code: "",
                  country_code: "",
                  phone: "",
                }}
              />
            </div>
            {shippingAddress ? (
              <div className="text-[12px]">
                <div className="font-display font-bold text-ink">
                  {[shippingAddress.first_name, shippingAddress.last_name].filter(Boolean).join(" ")}
                </div>
                <div className="text-ink-2 mt-1 font-mono leading-relaxed text-[11px]">
                  {shippingAddress.address_1 && <>{shippingAddress.address_1}<br /></>}
                  {[shippingAddress.city, shippingAddress.province].filter(Boolean).join(", ")}
                </div>
              </div>
            ) : (
              <p className="text-[11px] text-ink-3 italic">Sin dirección de envío</p>
            )}
          </div>

          {/* Internal note (from metadata) */}
          {typeof order.metadata?.internal_note === "string" && (
            <div className="bg-orange/10 p-5 relative" style={{ border: "2.5px dashed #FF3B27", borderRadius: 4 }}>
              <h3 className="font-display font-black text-[14px] uppercase tracking-wider mb-2 flex items-center gap-2">
                <Pencil size={14} strokeWidth={2.2} />
                Nota interna
              </h3>
              <p className="text-[12px] text-ink leading-relaxed">{order.metadata.internal_note}</p>
            </div>
          )}

          {/* Raw metadata fallback */}
          {order.metadata && Object.keys(order.metadata).length > 0 && !order.metadata.internal_note && (
            <details className="stamp-card p-5">
              <summary className="font-display font-black text-[12px] uppercase tracking-wider cursor-pointer flex items-center gap-2">
                <FileText size={13} strokeWidth={2.2} />
                Metadata
              </summary>
              <pre className="text-[10px] font-mono text-ink-2 mt-3 overflow-x-auto">
                {JSON.stringify(order.metadata, null, 2)}
              </pre>
            </details>
          )}
        </div>
      </div>
    </div>
  )
}
