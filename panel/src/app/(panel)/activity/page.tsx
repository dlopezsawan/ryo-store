import Link from "next/link"
import { ShoppingBag, CreditCard, Package, Truck, Undo2, X, Activity as ActivityIcon, Calendar, AlertTriangle } from "lucide-react"
import { PageHeader, PageWatermark } from "@/components/layout/PageHeader"
import { listOrders, listReturns, listSocialPosts, MedusaError } from "@/lib/medusa"
import { fmtEur } from "@/lib/utils"

interface FeedItem {
  id: string
  ts: string
  kind: "order-created" | "order-paid" | "order-shipped" | "order-canceled" | "return-requested" | "return-received" | "post-published"
  label: string
  detail: string
  href: string
  tone: "orange" | "secondary" | "primary" | "neutral"
}

const ICON: Record<FeedItem["kind"], React.ComponentType<{ size?: number; strokeWidth?: number }>> = {
  "order-created":     ShoppingBag,
  "order-paid":        CreditCard,
  "order-shipped":     Truck,
  "order-canceled":    X,
  "return-requested":  Undo2,
  "return-received":   Package,
  "post-published":    Calendar,
}

export default async function ActivityPage() {
  const items: FeedItem[] = []
  const errors: string[] = []

  try {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const ord = await listOrders({ limit: 100, created_at_gte: since, order: "-created_at" })
    for (const o of ord.orders) {
      items.push({
        id: `oc-${o.id}`,
        ts: o.created_at,
        kind: "order-created",
        label: `Pedido #${o.display_id} creado`,
        detail: `${o.email ?? "guest"} · ${(o.currency_code ?? "EUR").toUpperCase()} ${(Number(o.total) || 0).toFixed(2)}`,
        href: `/orders/${o.id}`,
        tone: "orange",
      })
      if (o.payment_status === "captured") {
        // Ideal: payment_collections[0].payments[0].captured_at — no disponible en
        // el listado (requeriría retrieveOrder). Usamos updated_at como mejor aproximación.
        items.push({
          id: `op-${o.id}`,
          ts: o.updated_at ?? o.created_at,
          kind: "order-paid",
          label: `Pago capturado #${o.display_id}`,
          detail: fmtEur(Number(o.total) || 0),
          href: `/orders/${o.id}`,
          tone: "secondary",
        })
      }
      if (o.fulfillment_status === "shipped" || o.fulfillment_status === "fulfilled" || o.fulfillment_status === "delivered") {
        // Ideal: fulfillments[0].shipped_at — no disponible en el listado.
        // Usamos updated_at como mejor aproximación al momento del envío.
        items.push({
          id: `os-${o.id}`,
          ts: o.updated_at ?? o.created_at,
          kind: "order-shipped",
          label: `#${o.display_id} ${o.fulfillment_status === "delivered" ? "entregado" : "enviado"}`,
          detail: `${o.email ?? "guest"}`,
          href: `/orders/${o.id}`,
          tone: "secondary",
        })
      }
      if (o.status === "canceled") {
        items.push({
          id: `ox-${o.id}`,
          ts: o.updated_at ?? o.created_at,
          kind: "order-canceled",
          label: `Pedido #${o.display_id} cancelado`,
          detail: `${o.email ?? "guest"}`,
          href: `/orders/${o.id}`,
          tone: "primary",
        })
      }
    }
  } catch (e) {
    if (e instanceof MedusaError && e.status === 401) errors.push("Sesión expirada")
    else errors.push(`orders: ${e instanceof Error ? e.message : "error"}`)
  }

  try {
    const ret = await listReturns({ limit: 50 })
    for (const r of ret.returns) {
      items.push({
        id: `rr-${r.id}`,
        ts: r.created_at,
        kind: "return-requested",
        label: "Retorno solicitado",
        detail: `${(r.items ?? []).length} ítem(s) · ${r.status}`,
        href: `/orders/${r.order_id}`,
        tone: "orange",
      })
      if (r.received_at) {
        items.push({
          id: `rcv-${r.id}`,
          ts: r.received_at,
          kind: "return-received",
          label: "Retorno recibido",
          detail: r.refund_amount ? `refund ${fmtEur(Number(r.refund_amount))}` : "",
          href: `/orders/${r.order_id}`,
          tone: "secondary",
        })
      }
    }
  } catch { /* silent — el endpoint a veces no está */ }

  try {
    const social = await listSocialPosts()
    for (const p of social.posts) {
      if (p.status === "published") {
        items.push({
          id: `pp-${p.id}`,
          ts: p.updated_at ?? p.created_at,
          kind: "post-published",
          label: `Post publicado en ${(p.channel ?? "social").toUpperCase()}`,
          detail: p.title,
          href: "/social",
          tone: "secondary",
        })
      }
    }
  } catch { /* silent */ }

  // Ordenar reciente primero
  items.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())
  const recent = items.slice(0, 100)

  // Bucket por día
  const buckets = new Map<string, FeedItem[]>()
  for (const it of recent) {
    const d = new Date(it.ts)
    const key = d.toISOString().slice(0, 10)
    const arr = buckets.get(key) ?? []
    arr.push(it)
    buckets.set(key, arr)
  }
  const days = Array.from(buckets.entries())

  return (
    <div className="p-7 space-y-5 relative">
      <PageWatermark char="*" />
      <PageHeader
        title="ACTIVIDAD"
        stamp={<>{recent.length} EVENTOS</>}
        stampTone="orange"
        description={
          <>
            Feed combinado de pedidos, retornos y posts · últimos 7 días
            {errors.length > 0 && <span className="text-primary"> · {errors.length} fuente(s) con error</span>}
          </>
        }
      />

      {errors.length > 0 && errors.includes("Sesión expirada") && (
        <div className="stamp-card p-4 bg-primary/5" style={{ borderColor: "#BB3B2E" }}>
          <p className="text-[13px] font-medium text-primary flex items-center gap-2">
            <AlertTriangle size={14} /> Sesión expirada — recarga el panel.
          </p>
        </div>
      )}

      {recent.length === 0 ? (
        <div className="stamp-card p-10 text-center">
          <ActivityIcon size={28} className="mx-auto text-ink-3 mb-2" />
          <p className="font-display font-bold text-[14px] uppercase tracking-wider text-ink-3">
            Sin actividad en los últimos 7 días
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {days.map(([day, evts]) => {
            const date = new Date(day + "T00:00:00")
            const today = new Date()
            today.setHours(0, 0, 0, 0)
            const isToday = date.getTime() === today.getTime()
            return (
              <div key={day}>
                <div className="text-[10px] font-display font-bold uppercase tracking-[0.18em] text-ink-3 mb-2 flex items-center gap-2">
                  <span className={isToday ? "text-orange" : ""}>
                    {isToday ? "HOY · " : ""}
                    {date.toLocaleDateString("es-VE", { weekday: "long", day: "numeric", month: "long" })}
                  </span>
                  <span className="flex-1 h-px" style={{ background: "var(--border)" }} />
                  <span className="font-mono text-ink-3">{evts.length}</span>
                </div>
                <ul className="stamp-card divide-y divide-warm-200/50 overflow-hidden">
                  {evts.map((e) => {
                    const Icon = ICON[e.kind]
                    const ts = new Date(e.ts)
                    const cls =
                      e.tone === "orange" ? "text-orange bg-orange/15" :
                      e.tone === "secondary" ? "text-secondary bg-secondary/15" :
                      e.tone === "primary" ? "text-primary bg-primary/15" :
                      "text-ink-3 bg-cream-2"
                    const border =
                      e.tone === "orange" ? "#FF3B27" :
                      e.tone === "secondary" ? "#4D5431" :
                      e.tone === "primary" ? "#BB3B2E" :
                      "var(--border)"
                    return (
                      <li key={e.id}>
                        <Link href={e.href} className="flex items-center gap-3 px-4 py-2.5 hover:bg-cream-2/60 transition-colors">
                          <span
                            className={`w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0 ${cls}`}
                            style={{ border: `1.5px solid ${border}` }}
                          >
                            <Icon size={13} strokeWidth={2.4} />
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="font-display font-bold text-[12px] text-ink uppercase tracking-wider truncate">
                              {e.label}
                            </div>
                            {e.detail && (
                              <div className="text-[11px] text-ink-2 truncate">{e.detail}</div>
                            )}
                          </div>
                          <span className="text-[10px] font-mono text-ink-3 flex-shrink-0 num">
                            {ts.toLocaleTimeString("es-VE", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
