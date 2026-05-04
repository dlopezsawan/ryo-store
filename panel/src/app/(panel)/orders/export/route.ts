import { NextResponse } from "next/server"
import { listOrders, MedusaError } from "@/lib/medusa"

/**
 * GET /orders/export?q=…&status=…
 *
 * Exporta los pedidos del listing actual (respetando search + status filter)
 * como CSV. Distinto al /dashboard/export que filtra por período.
 */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const q = url.searchParams.get("q") ?? undefined
  const statusParam = url.searchParams.get("status")
  const status = statusParam && statusParam !== "all" ? [statusParam] : undefined
  const psParam = url.searchParams.get("payment_status")
  const payment_status = psParam && psParam !== "all" ? [psParam] : undefined
  const date_from = url.searchParams.get("date_from") || undefined
  const date_to = url.searchParams.get("date_to") || undefined
  const created_at_gte = date_from ? `${date_from}T00:00:00.000Z` : undefined
  const created_at_lte = date_to ? `${date_to}T23:59:59.999Z` : undefined
  const idsParam = url.searchParams.get("ids")
  const idsFilter = idsParam ? new Set(idsParam.split(",").filter(Boolean)) : null

  let orders: Awaited<ReturnType<typeof listOrders>>["orders"] = []
  try {
    let offset = 0
    const limit = 200
    for (let i = 0; i < 20; i++) {
      const res = await listOrders({ limit, offset, q, status, payment_status, created_at_gte, created_at_lte })
      orders = orders.concat(res.orders)
      if (orders.length >= res.count || res.orders.length === 0) break
      offset += limit
    }
    // Si vienen `ids=…`, filtramos client-side al final (no tipo en listOrders)
    if (idsFilter) {
      orders = orders.filter((o) => idsFilter.has(o.id))
    }
  } catch (e) {
    if (e instanceof MedusaError && e.status === 401) {
      return NextResponse.json({ error: "session_expired" }, { status: 401 })
    }
    return NextResponse.json({ error: e instanceof Error ? e.message : "error" }, { status: 500 })
  }

  const header = [
    "id", "display_id", "created_at", "email", "customer_name",
    "total", "subtotal", "discount_total", "currency",
    "status", "payment_status", "fulfillment_status", "items_count",
  ]
  const rows = orders.map((o) => {
    const customerName =
      [o.customer?.first_name, o.customer?.last_name].filter(Boolean).join(" ") ||
      [o.shipping_address?.first_name, o.shipping_address?.last_name].filter(Boolean).join(" ") ||
      ""
    const itemsCount = (o.items ?? []).reduce((s, i) => s + (i.quantity ?? 0), 0)
    return [
      o.id,
      String(o.display_id),
      o.created_at,
      o.email ?? "",
      customerName,
      String(Number(o.total) || 0),
      String(Number(o.subtotal) || 0),
      String(Number(o.discount_total) || 0),
      (o.currency_code ?? "").toUpperCase(),
      o.status ?? "",
      o.payment_status ?? "",
      o.fulfillment_status ?? "",
      String(itemsCount),
    ].map(csvEscape).join(",")
  })

  const csv = [header.join(","), ...rows].join("\n")
  const suffix = [q ? `q-${q}` : "", status ? `s-${status[0]}` : ""].filter(Boolean).join("-")
  const filename = `enrola-orders${suffix ? "-" + suffix : ""}-${new Date().toISOString().slice(0, 10)}.csv`
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  })
}

function csvEscape(s: string): string {
  if (s === "") return ""
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}
