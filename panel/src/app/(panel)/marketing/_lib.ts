/**
 * Helpers compartidos del módulo Marketing — server-side puro.
 * RFM segmentation, funnels, attribution.
 */

import type { AdminOrderListItem, AdminCustomer } from "@/lib/medusa"

// ─── RFM segmentation ────────────────────────────────────────────────

export interface RfmScore {
  customerId: string
  email: string
  name: string
  recencyDays: number   // días desde última compra
  frequency: number     // # pedidos
  monetary: number      // EUR total gastado
  rScore: 1 | 2 | 3 | 4 | 5
  fScore: 1 | 2 | 3 | 4 | 5
  mScore: 1 | 2 | 3 | 4 | 5
  segment: RfmSegment
  lastOrderAt: string | null
}

export type RfmSegment =
  | "champions"        // R5 F5 M5 — top customers
  | "loyal"            // R3-5 F4-5
  | "potential_loyalist" // R4-5 F2-3
  | "new_customers"    // R5 F1
  | "promising"        // R4 F1
  | "at_risk"          // R2-3 F4-5
  | "cant_lose"        // R1 F4-5 — VIPs perdidos
  | "hibernating"      // R2-3 F2-3
  | "lost"             // R1 F1-2

export const SEGMENT_META: Record<RfmSegment, { label: string; color: string; description: string; bg: string }> = {
  champions:           { label: "Champions",          color: "#4D5431", bg: "bg-secondary/10", description: "Top tier — compraron reciente, frecuente y mucho. Conservar a toda costa." },
  loyal:               { label: "Loyal",              color: "#4D5431", bg: "bg-secondary/5",  description: "Clientes recurrentes consistentes. Premiarlos y upsellear." },
  potential_loyalist:  { label: "Potential loyalist", color: "#FF3B27", bg: "bg-orange/10",    description: "Compraron 2-3 veces hace poco — empujar al siguiente nivel." },
  new_customers:       { label: "New customers",      color: "#FF3B27", bg: "bg-orange/5",     description: "Primera compra reciente — onboarding y educación." },
  promising:           { label: "Promising",          color: "#FF3B27", bg: "bg-orange/5",     description: "Una compra hace algunos días — quitar fricción para siguiente." },
  at_risk:             { label: "At risk",            color: "#BB3B2E", bg: "bg-primary/5",    description: "Eran frecuentes pero no compran hace tiempo — enviar oferta personalizada." },
  cant_lose:           { label: "Can't lose",         color: "#BB3B2E", bg: "bg-primary/10",   description: "VIPs históricos perdidos. Llamar/email personal urgente." },
  hibernating:         { label: "Hibernating",        color: "#9C9285", bg: "bg-cream-2",      description: "Bajos en todas las dimensiones — campaña masiva de win-back." },
  lost:                { label: "Lost",               color: "#9C9285", bg: "bg-cream-2",      description: "Probablemente perdidos. Limpiar de listas activas." },
}

/** Quintiles → score 1-5 (5 = mejor para R-monetary, 5 = más reciente). */
function quintileScore(value: number, sortedValues: number[], reverse = false): 1 | 2 | 3 | 4 | 5 {
  if (sortedValues.length === 0) return 3
  // Find percentile of `value` in sorted array
  let i = 0
  while (i < sortedValues.length && sortedValues[i] <= value) i++
  let pct = i / sortedValues.length  // 0 → 1
  if (reverse) pct = 1 - pct
  if (pct >= 0.8) return 5
  if (pct >= 0.6) return 4
  if (pct >= 0.4) return 3
  if (pct >= 0.2) return 2
  return 1
}

function classifyRfm(r: number, f: number, m: number): RfmSegment {
  // Reglas estándar simplificadas (ver: https://en.wikipedia.org/wiki/RFM)
  if (r >= 4 && f >= 4 && m >= 4) return "champions"
  if (r >= 3 && f >= 4) return "loyal"
  if (r >= 4 && f >= 2 && f <= 3) return "potential_loyalist"
  if (r === 5 && f === 1) return "new_customers"
  if (r === 4 && f === 1) return "promising"
  if (r >= 2 && r <= 3 && f >= 4) return "at_risk"
  if (r === 1 && f >= 4) return "cant_lose"
  if (r >= 2 && r <= 3 && f >= 2 && f <= 3) return "hibernating"
  return "lost"
}

/** Calcula RFM scores para todos los customers. */
export function computeRfm(
  customers: AdminCustomer[],
  orders: AdminOrderListItem[],
  asOfDate: Date = new Date(),
): RfmScore[] {
  // Group orders by customer (only paid/captured/non-canceled)
  const byCustomer = new Map<string, AdminOrderListItem[]>()
  for (const o of orders) {
    if (!o.customer?.id) continue
    if (o.status === "canceled") continue
    const arr = byCustomer.get(o.customer.id) ?? []
    arr.push(o)
    byCustomer.set(o.customer.id, arr)
  }

  // Calcular metrics raw para todos los customers que tienen al menos 1 orden
  const raw: Array<{ c: AdminCustomer; recencyDays: number; freq: number; monetary: number; lastDate: string | null }> = []
  for (const c of customers) {
    const cOrders = byCustomer.get(c.id) ?? []
    if (cOrders.length === 0) continue  // sólo customers con compra
    const sorted = cOrders.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    const lastDate = sorted[0].created_at
    const recencyDays = Math.max(0, Math.floor((asOfDate.getTime() - new Date(lastDate).getTime()) / 86400000))
    const monetary = cOrders.reduce((s, o) => s + (Number(o.total) || 0), 0)
    raw.push({ c, recencyDays, freq: cOrders.length, monetary, lastDate })
  }

  if (raw.length === 0) return []

  // Sorted arrays para quintiles
  const recencyValues = raw.map((r) => r.recencyDays).sort((a, b) => a - b)
  const freqValues    = raw.map((r) => r.freq).sort((a, b) => a - b)
  const monetaryValues = raw.map((r) => r.monetary).sort((a, b) => a - b)

  return raw.map(({ c, recencyDays, freq, monetary, lastDate }) => {
    // Recency: low = better (más reciente). Invertimos.
    const rScore = quintileScore(recencyDays, recencyValues, true)
    const fScore = quintileScore(freq, freqValues, false)
    const mScore = quintileScore(monetary, monetaryValues, false)
    const segment = classifyRfm(rScore, fScore, mScore)
    return {
      customerId: c.id,
      email: c.email,
      name: [c.first_name, c.last_name].filter(Boolean).join(" ") || c.email.split("@")[0],
      recencyDays,
      frequency: freq,
      monetary,
      rScore,
      fScore,
      mScore,
      segment,
      lastOrderAt: lastDate,
    }
  })
}

// ─── Conversion funnel ───────────────────────────────────────────────

export interface FunnelStage {
  key: string
  label: string
  count: number
  /** Conversion rate vs stage anterior (%) */
  rateFromPrev?: number
  /** Conversion rate vs primer stage (%) */
  rateFromStart?: number
}

/** Construye un funnel desde los orders. Etapas:
 *   1. Total clientes (de la lista de customers)
 *   2. Customers con al menos 1 orden
 *   3. Orders con pago capturado
 *   4. Orders fulfilled/shipped
 *   5. Orders entregados (delivered)
 */
export function buildFunnel(customers: AdminCustomer[], orders: AdminOrderListItem[]): FunnelStage[] {
  const totalCustomers = customers.length
  const customersWithOrder = new Set(orders.map((o) => o.customer?.id).filter(Boolean)).size
  const paidOrders = orders.filter((o) => o.payment_status === "captured" || o.payment_status === "authorized").length
  const fulfilledOrders = orders.filter((o) => {
    return o.fulfillment_status === "fulfilled" || o.fulfillment_status === "shipped" || o.fulfillment_status === "delivered"
  }).length
  const deliveredOrders = orders.filter((o) => o.fulfillment_status === "delivered").length

  const stages: FunnelStage[] = [
    { key: "customers",         label: "Total clientes",           count: totalCustomers },
    { key: "customers_buyers",  label: "Con al menos 1 pedido",    count: customersWithOrder },
    { key: "orders_paid",       label: "Pedidos pagados",          count: paidOrders },
    { key: "orders_fulfilled",  label: "Preparados/enviados",      count: fulfilledOrders },
    { key: "orders_delivered",  label: "Entregados",               count: deliveredOrders },
  ]

  // Compute conversion rates
  const start = stages[0].count || 1
  for (let i = 0; i < stages.length; i++) {
    if (i === 0) continue
    const prev = stages[i - 1].count || 1
    stages[i].rateFromPrev = (stages[i].count / prev) * 100
    stages[i].rateFromStart = (stages[i].count / start) * 100
  }
  return stages
}

// ─── UTM / Attribution ───────────────────────────────────────────────

export interface AttributionSource {
  source: string
  medium: string | null
  campaign: string | null
  orders: number
  revenue: number
  pct: number
  color: string
}

const SOURCE_COLORS: Record<string, string> = {
  organic:    "#4D5431",
  direct:     "#9C9285",
  instagram:  "#E1306C",
  tiktok:     "#000000",
  facebook:   "#1877F2",
  google:     "#4285F4",
  whatsapp:   "#25D366",
  email:      "#FF3B27",
  referral:   "#FF6B27",
  unknown:    "#BB3B2E",
}

/** Lee orders y agrupa por source/medium leído de metadata.utm_*  */
export function attributionBreakdown(orders: AdminOrderListItem[]): AttributionSource[] {
  const map = new Map<string, AttributionSource>()
  let totalRevenue = 0

  for (const o of orders) {
    if (o.status === "canceled") continue
    const meta = (o as { metadata?: Record<string, unknown> }).metadata ?? {}
    // Read both legacy keys (utm_*) and the canonical `attribution_utm_*` keys
    // written by the storefront's POST /store/carts/:id/attribution endpoint
    // and by Dana (whatsapp-bot) / Telegram bot at order creation.
    let source = String(
      meta.attribution_utm_source ?? meta.utm_source ?? meta.source ?? meta.source_channel ?? ""
    ).toLowerCase().trim() || "unknown"
    const medium = (meta.attribution_utm_medium ?? meta.utm_medium)
      ? String(meta.attribution_utm_medium ?? meta.utm_medium).toLowerCase()
      : null
    const campaign = (meta.attribution_utm_campaign ?? meta.utm_campaign)
      ? String(meta.attribution_utm_campaign ?? meta.utm_campaign)
      : null

    // Si vino de un dominio referrer simple, intentar mapear
    if (source.includes("instagram")) source = "instagram"
    else if (source.includes("tiktok")) source = "tiktok"
    else if (source.includes("facebook") || source.includes("fb")) source = "facebook"
    else if (source.includes("google")) source = "google"
    else if (source.includes("wa.me") || source.includes("whatsapp")) source = "whatsapp"

    const key = `${source}|${medium ?? ""}|${campaign ?? ""}`
    const cur = map.get(key) ?? {
      source,
      medium,
      campaign,
      orders: 0,
      revenue: 0,
      pct: 0,
      color: SOURCE_COLORS[source] ?? SOURCE_COLORS.unknown,
    }
    cur.orders += 1
    cur.revenue += Number(o.total) || 0
    map.set(key, cur)
    totalRevenue += Number(o.total) || 0
  }

  const arr = Array.from(map.values())
  for (const s of arr) {
    s.pct = totalRevenue > 0 ? (s.revenue / totalRevenue) * 100 : 0
  }
  arr.sort((a, b) => b.revenue - a.revenue)
  return arr
}

// ─── Loyalty tier helpers ────────────────────────────────────────────

export type LoyaltyTier = "bronze" | "silver" | "gold" | "platinum" | "diamond"

export const TIER_THRESHOLDS: Record<LoyaltyTier, number> = {
  bronze: 0,
  silver: 100,
  gold: 500,
  platinum: 1500,
  diamond: 5000,
}

export const TIER_META: Record<LoyaltyTier, { label: string; color: string; bg: string; benefit: string }> = {
  bronze:   { label: "BRONZE",   color: "#A56A3D", bg: "bg-orange/5",    benefit: "5% descuento próxima compra" },
  silver:   { label: "SILVER",   color: "#9C9285", bg: "bg-cream-2",     benefit: "10% + envío gratis >€30" },
  gold:     { label: "GOLD",     color: "#D4A015", bg: "bg-orange/10",   benefit: "15% + acceso early-drops" },
  platinum: { label: "PLATINUM", color: "#4D5431", bg: "bg-secondary/10", benefit: "20% + regalos exclusivos" },
  diamond:  { label: "DIAMOND",  color: "#1A1A1A", bg: "bg-dark text-cream", benefit: "25% + concierge directo" },
}

/** Determina tier a partir de monetary total (EUR). */
export function tierFromMonetary(monetary: number): LoyaltyTier {
  if (monetary >= TIER_THRESHOLDS.diamond) return "diamond"
  if (monetary >= TIER_THRESHOLDS.platinum) return "platinum"
  if (monetary >= TIER_THRESHOLDS.gold) return "gold"
  if (monetary >= TIER_THRESHOLDS.silver) return "silver"
  return "bronze"
}

/** Para un monto, devuelve cuánto falta para el siguiente tier. */
export function distanceToNextTier(monetary: number): { current: LoyaltyTier; next: LoyaltyTier | null; missingEur: number; pct: number } {
  const current = tierFromMonetary(monetary)
  const tiers: LoyaltyTier[] = ["bronze", "silver", "gold", "platinum", "diamond"]
  const idx = tiers.indexOf(current)
  if (idx === tiers.length - 1) return { current, next: null, missingEur: 0, pct: 100 }
  const next = tiers[idx + 1]
  const lower = TIER_THRESHOLDS[current]
  const upper = TIER_THRESHOLDS[next]
  const missingEur = upper - monetary
  const pct = ((monetary - lower) / (upper - lower)) * 100
  return { current, next, missingEur, pct: Math.max(0, Math.min(100, pct)) }
}
