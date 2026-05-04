/**
 * Attribution — channel-level revenue and sessions from GA4.
 *
 * Also surfaces Medusa orders that came through the manual_sale/whatsapp
 * path (when present via order.metadata), so the "total attributed" picture
 * includes offline-cross-channel revenue.
 *
 * Query params: days (default 28), country (default 'all')
 */
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Pool } from "pg"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const days = Math.max(1, Math.min(365, parseInt(String(req.query.days || "28"), 10)))
  const country = String(req.query.country || "all")
  const countryFilter = country === "all" ? "" : "AND country = $2"
  const args: any[] = [days]
  if (country !== "all") args.push(country)

  // ── GA4: channel mix ─────────────────────────────────────────────────────
  const channelMix = await pool.query(
    `
    SELECT channel,
      SUM(sessions)::bigint AS sessions,
      SUM(transactions)::bigint AS transactions,
      SUM(revenue)::numeric AS revenue
    FROM seo_ga4_daily
    WHERE date >= CURRENT_DATE - ($1::int || ' days')::interval
      AND deleted_at IS NULL
      ${countryFilter}
    GROUP BY channel
    ORDER BY revenue DESC NULLS LAST, sessions DESC
    `,
    args
  )

  // ── GA4: source/medium breakdown (top 20) ────────────────────────────────
  const sourceMix = await pool.query(
    `
    SELECT source, medium,
      SUM(sessions)::bigint AS sessions,
      SUM(transactions)::bigint AS transactions,
      SUM(revenue)::numeric AS revenue
    FROM seo_ga4_daily
    WHERE date >= CURRENT_DATE - ($1::int || ' days')::interval
      AND deleted_at IS NULL
      ${countryFilter}
    GROUP BY source, medium
    ORDER BY sessions DESC
    LIMIT 20
    `,
    args
  )

  // ── Medusa orders: manual_sale vs web breakdown ──────────────────────────
  // This uses order.metadata.source_channel to bucket orders placed through
  // WhatsApp/Telegram/manual. Works whether or not wa_ref is in place.
  const medusaOrders = await pool.query(
    `
    SELECT
      COALESCE(o.metadata->>'source_channel',
        CASE WHEN (o.metadata->>'manual_sale')::boolean THEN 'manual' ELSE 'web' END
      ) AS bucket,
      COUNT(*)::bigint AS orders,
      COALESCE(SUM((os.totals->>'original_order_total')::numeric), 0) AS revenue
    FROM "order" o
    LEFT JOIN order_summary os ON os.order_id = o.id
    WHERE o.created_at >= CURRENT_DATE - ($1::int || ' days')::interval
      AND o.canceled_at IS NULL
    GROUP BY bucket
    ORDER BY revenue DESC
    `,
    [days]
  )

  // ── Totals ───────────────────────────────────────────────────────────────
  const totalGaRevenue = channelMix.rows.reduce((s: number, r: any) => s + Number(r.revenue || 0), 0)
  const totalGaSessions = channelMix.rows.reduce((s: number, r: any) => s + Number(r.sessions || 0), 0)
  const totalGaTransactions = channelMix.rows.reduce((s: number, r: any) => s + Number(r.transactions || 0), 0)

  const organic = channelMix.rows.find((r: any) => r.channel === "Organic Search")
  const direct = channelMix.rows.find((r: any) => r.channel === "Direct")
  const social = channelMix.rows.find((r: any) => r.channel === "Organic Social")

  res.json({
    filters: { days, country },
    summary: {
      total_sessions: totalGaSessions,
      total_transactions: totalGaTransactions,
      total_revenue_ga4: totalGaRevenue,
      organic_sessions: organic ? Number(organic.sessions) : 0,
      organic_revenue: organic ? Number(organic.revenue) : 0,
      organic_transactions: organic ? Number(organic.transactions) : 0,
      direct_sessions: direct ? Number(direct.sessions) : 0,
      social_sessions: social ? Number(social.sessions) : 0,
    },
    channel_mix: channelMix.rows.map((r: any) => ({
      channel: r.channel,
      sessions: Number(r.sessions),
      transactions: Number(r.transactions),
      revenue: Number(r.revenue || 0),
    })),
    source_medium: sourceMix.rows.map((r: any) => ({
      source: r.source,
      medium: r.medium,
      sessions: Number(r.sessions),
      transactions: Number(r.transactions),
      revenue: Number(r.revenue || 0),
    })),
    medusa_bucket: medusaOrders.rows.map((r: any) => ({
      bucket: r.bucket,
      orders: Number(r.orders),
      revenue: Number(r.revenue || 0),
    })),
  })
}
