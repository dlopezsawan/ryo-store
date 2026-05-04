import { NextResponse } from "next/server"
import { listOrders, MedusaError } from "@/lib/medusa"
import { getSession } from "@/lib/auth"

/**
 * GET /api/orders/live
 *
 * Endpoint optimizado para polling desde /orders/live.
 * Trae las órdenes activas (no canceladas, no archivadas) de las últimas 7 días.
 *
 * Resp: {
 *   ok: true
 *   orders: LiveOrder[]
 *   kpis: {
 *     today: { revenue, count, aov }
 *     last_hour: { count }
 *     pending: { count }   // por capturar pago
 *     to_fulfill: { count } // pagados sin preparar
 *   }
 *   server_time: ISO
 * }
 */

export async function GET() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ ok: false, error: "no_session" }, { status: 401 })
  }

  try {
    // Pull last 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400 * 1000).toISOString()
    const res = await listOrders({
      limit: 200,
      created_at_gte: sevenDaysAgo,
      order: "-created_at",
      // Necesitamos items + variant + shipping_address completo para tickets view
      fields: "id,display_id,email,status,payment_status,fulfillment_status,total,subtotal,discount_total,currency_code,created_at,*customer,*shipping_address,*items,*items.variant,*items.variant.product",
    })

    // Filter active (no canceled / archived)
    const orders = res.orders.filter((o) => o.status !== "canceled" && o.status !== "archived")

    // Compute KPIs
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const todayMs = todayStart.getTime()
    const hourAgoMs = Date.now() - 60 * 60 * 1000

    const todayOrders = orders.filter((o) => new Date(o.created_at).getTime() >= todayMs)
    const todayRevenue = todayOrders.reduce((s, o) => s + (Number(o.total) || 0), 0)
    const todayCount = todayOrders.length
    const aov = todayCount > 0 ? todayRevenue / todayCount : 0
    const lastHourCount = orders.filter((o) => new Date(o.created_at).getTime() >= hourAgoMs).length

    const pendingCount = orders.filter((o) => o.payment_status === "not_paid" || o.payment_status === "awaiting").length
    const toFulfillCount = orders.filter((o) => {
      const paid = o.payment_status === "captured" || o.payment_status === "authorized"
      const notFulfilled = !o.fulfillment_status || o.fulfillment_status === "not_fulfilled"
      return paid && notFulfilled
    }).length

    return NextResponse.json({
      ok: true,
      orders: orders.map((o) => ({
        id: o.id,
        display_id: o.display_id,
        email: o.email ?? "",
        customer_name: o.customer
          ? [o.customer.first_name, o.customer.last_name].filter(Boolean).join(" ")
          : (o.shipping_address ? [o.shipping_address.first_name, o.shipping_address.last_name].filter(Boolean).join(" ") : ""),
        total: Number(o.total) || 0,
        currency: o.currency_code ?? "eur",
        status: o.status ?? null,
        payment_status: o.payment_status ?? null,
        fulfillment_status: o.fulfillment_status ?? null,
        created_at: o.created_at,
        shipping_city: o.shipping_address?.city ?? null,
        shipping_country: o.shipping_address?.country_code ?? null,
        shipping_address_1: o.shipping_address?.address_1 ?? null,
        shipping_phone: o.shipping_address?.phone ?? null,
        items_count: o.items?.length ?? 0,
        // Items detallados para tickets view
        items: (o.items ?? []).map((it) => ({
          id: it.id,
          title: it.title,
          variant_title: it.variant?.title ?? null,
          quantity: it.quantity,
          thumbnail: it.thumbnail ?? null,
          sku: it.variant?.sku ?? null,
        })),
      })),
      kpis: {
        today: { revenue: todayRevenue, count: todayCount, aov, currency: orders[0]?.currency_code ?? "eur" },
        last_hour: { count: lastHourCount },
        pending: { count: pendingCount },
        to_fulfill: { count: toFulfillCount },
      },
      server_time: new Date().toISOString(),
    })
  } catch (e) {
    if (e instanceof MedusaError) {
      return NextResponse.json({ ok: false, error: `Medusa ${e.status}: ${e.message}` }, { status: e.status === 401 ? 401 : 502 })
    }
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "fetch error" }, { status: 500 })
  }
}
