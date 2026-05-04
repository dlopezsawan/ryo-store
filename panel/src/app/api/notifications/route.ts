import { NextResponse } from "next/server"
import { listOrders, MedusaError } from "@/lib/medusa"

/**
 * GET /api/notifications?since=ISO
 *
 * Devuelve los pedidos creados desde `since` (default: últimas 24h),
 * ordenados por fecha desc. Lo usa el bell del topbar para hacer polling.
 *
 * Light: sólo trae los campos mínimos para mostrar el item.
 */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const sinceParam = url.searchParams.get("since")
  const since = sinceParam ?? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  try {
    const res = await listOrders({
      limit: 30,
      created_at_gte: since,
      order: "-created_at",
      fields: "id,display_id,email,total,currency_code,payment_status,status,created_at,*customer",
    })

    return NextResponse.json({
      since,
      now: new Date().toISOString(),
      total: res.count,
      orders: res.orders.map((o) => ({
        id: o.id,
        display_id: o.display_id,
        email: o.email ?? "",
        customer_name: [o.customer?.first_name, o.customer?.last_name].filter(Boolean).join(" "),
        total: Number(o.total) || 0,
        currency: o.currency_code ?? "eur",
        payment_status: o.payment_status ?? null,
        status: o.status ?? null,
        created_at: o.created_at,
      })),
    })
  } catch (e) {
    if (e instanceof MedusaError && e.status === 401) {
      return NextResponse.json({ error: "session_expired" }, { status: 401 })
    }
    return NextResponse.json({ error: e instanceof Error ? e.message : "error" }, { status: 500 })
  }
}
