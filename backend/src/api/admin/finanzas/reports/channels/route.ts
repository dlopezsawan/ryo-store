/**
 * GET /admin/finanzas/reports/channels?month=YYYY-MM
 *
 * Revenue + margin per acquisition channel. Source is bucketed via the
 * `attribution_*` fields the storefront writes into `order.metadata`.
 *
 * Mapping rules (highest priority first):
 *   - utm_source includes "instagram"|"meta"|"facebook"  → "instagram_ads"
 *   - utm_source includes "google" / referrer host google → "google"
 *   - referrer host accounts.google.com (login flow)     → "google_login"
 *   - referrer host whatsapp / utm_medium=whatsapp        → "whatsapp_share"
 *   - utm_source set otherwise                            → utm_source verbatim
 *   - referrer host present (other)                       → "ref_<host>"
 *   - else                                                → "directo"
 *
 * WhatsApp-bot orders (those that came in via the WhatsApp bot flow) are
 * detected via order.metadata.source === "whatsapp_bot" if present.
 */

import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { Pool } from "pg"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

function bounds(month?: string) {
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [y, m] = month.split("-").map(Number)
    return { from: new Date(Date.UTC(y, m - 1, 1)), to: new Date(Date.UTC(y, m, 1)), label: month }
  }
  return { from: new Date(0), to: new Date(Date.now() + 86400000), label: "all" }
}

function hostnameOf(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return null
  }
}

type ChannelKey =
  | "instagram_ads"
  | "google"
  | "google_login"
  | "whatsapp_share"
  | "whatsapp_bot"
  | "directo"
  | string

function classifyOrder(metadata: Record<string, unknown>): ChannelKey {
  const source = (metadata.source as string) || ""
  if (source === "whatsapp_bot") return "whatsapp_bot"

  const utmSource = String(metadata.attribution_utm_source ?? metadata.utm_source ?? "").toLowerCase()
  const utmMedium = String(metadata.attribution_utm_medium ?? metadata.utm_medium ?? "").toLowerCase()
  const referrer = String(metadata.attribution_referrer ?? metadata.referrer ?? "")

  if (/instagram|meta|facebook|ig\b/.test(utmSource)) return "instagram_ads"
  if (/google/.test(utmSource)) return "google"

  const host = hostnameOf(referrer)
  if (host === "accounts.google.com") return "google_login"
  if (host && /google/.test(host)) return "google"
  if ((utmMedium && /whatsapp|wa/.test(utmMedium)) || (host && /whatsapp/.test(host))) {
    return "whatsapp_share"
  }

  if (utmSource) return utmSource
  if (host) return `ref_${host}`
  return "directo"
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const { from, to, label } = bounds(
    typeof req.query.month === "string" ? req.query.month : undefined
  )

  const r = await pool.query(
    `SELECT pm.id, pm.amount_eur_total, pm.amount_eur_margin, pm.order_id,
            o.metadata
     FROM finanzas_pago_movil pm
     LEFT JOIN "order" o ON o.id = pm.order_id
     WHERE pm.deleted_at IS NULL
       AND pm.created_at >= $1 AND pm.created_at < $2`,
    [from, to]
  )

  const buckets = new Map<string, {
    channel: string
    orders: number
    revenue_eur: number
    margin_eur: number
  }>()
  for (const row of r.rows) {
    const meta = (row.metadata || {}) as Record<string, unknown>
    const ch = classifyOrder(meta)
    const b = buckets.get(ch) || { channel: ch, orders: 0, revenue_eur: 0, margin_eur: 0 }
    b.orders++
    b.revenue_eur += Number(row.amount_eur_total) || 0
    b.margin_eur += Number(row.amount_eur_margin) || 0
    buckets.set(ch, b)
  }

  const channels = Array.from(buckets.values())
    .map((c) => ({
      ...c,
      aov_eur: c.orders > 0 ? c.revenue_eur / c.orders : 0,
      margin_pct: c.revenue_eur > 0 ? c.margin_eur / c.revenue_eur : 0,
    }))
    .sort((a, b) => b.revenue_eur - a.revenue_eur)

  const totalOrders = channels.reduce((s, c) => s + c.orders, 0)
  const totalRevenue = channels.reduce((s, c) => s + c.revenue_eur, 0)
  const totalMargin = channels.reduce((s, c) => s + c.margin_eur, 0)

  res.json({
    period: label,
    channels,
    totals: {
      orders: totalOrders,
      revenue_eur: totalRevenue,
      margin_eur: totalMargin,
    },
  })
}
