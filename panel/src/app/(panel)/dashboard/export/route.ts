import { NextResponse } from "next/server"
import { listOrders, MedusaError } from "@/lib/medusa"

/**
 * GET /dashboard/export?period=30
 *
 * Exporta los pedidos del período como CSV. Se genera en el server con
 * la sesión del admin actual; útil para análisis offline en hojas de
 * cálculo o para enviar a contabilidad.
 */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const period = Math.max(1, Math.min(365, Number(url.searchParams.get("period") ?? 30)))

  const since = new Date()
  since.setHours(0, 0, 0, 0)
  since.setDate(since.getDate() - (period - 1))

  let orders
  try {
    const res = await listOrders({
      limit: 500,
      created_at_gte: since.toISOString(),
      order: "-created_at",
    })
    orders = res.orders
  } catch (e) {
    if (e instanceof MedusaError && e.status === 401) {
      return NextResponse.json({ error: "session_expired" }, { status: 401 })
    }
    return NextResponse.json({ error: e instanceof Error ? e.message : "error" }, { status: 500 })
  }

  // CSV format: id,display_id,created_at,email,customer,total,currency,status,payment_status,fulfillment_status,items_count
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
  const filename = `enrola-orders-${period}d-${new Date().toISOString().slice(0, 10)}.csv`

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  })
}

function csvEscape(field: string): string {
  if (field === "") return ""
  if (/[",\n\r]/.test(field)) {
    return `"${field.replace(/"/g, '""')}"`
  }
  return field
}
