import { NextResponse } from "next/server"
import { listOrders, listProducts, listCustomers, MedusaError } from "@/lib/medusa"

/**
 * GET /api/search?q=…
 *
 * Búsqueda global desde el Cmd+K palette. Hace 3 queries en paralelo
 * (orders + products + customers) y devuelve top 5 de cada uno.
 *
 * No paginated, intencionalmente liviano para latency baja en cada keystroke.
 */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const q = (url.searchParams.get("q") ?? "").trim()
  if (!q) {
    return NextResponse.json({ orders: [], products: [], customers: [] })
  }

  try {
    const [oRes, pRes, cRes] = await Promise.allSettled([
      listOrders({ q, limit: 5, fields: "id,display_id,email,total,currency_code,status,payment_status,created_at" }),
      listProducts({ q, limit: 5 }),
      listCustomers({ q, limit: 5 }),
    ])

    return NextResponse.json({
      orders: oRes.status === "fulfilled"
        ? oRes.value.orders.map((o) => ({
            id: o.id,
            display_id: o.display_id,
            email: o.email ?? "",
            total: Number(o.total) || 0,
            currency: o.currency_code,
            status: o.status,
            payment_status: o.payment_status,
          }))
        : [],
      products: pRes.status === "fulfilled"
        ? pRes.value.products.map((p) => ({
            id: p.id,
            title: p.title,
            handle: p.handle ?? "",
            status: p.status,
            thumbnail: p.thumbnail ?? null,
          }))
        : [],
      customers: cRes.status === "fulfilled"
        ? cRes.value.customers.map((c) => ({
            id: c.id,
            email: c.email,
            name: [c.first_name, c.last_name].filter(Boolean).join(" "),
          }))
        : [],
    })
  } catch (e) {
    if (e instanceof MedusaError && e.status === 401) {
      return NextResponse.json({ error: "session_expired" }, { status: 401 })
    }
    return NextResponse.json({ error: e instanceof Error ? e.message : "error" }, { status: 500 })
  }
}
