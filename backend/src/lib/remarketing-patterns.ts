/**
 * Aggregated patterns across the full user base.
 *
 * Unlike `computeSignals()` which looks at ONE user at a time, this module
 * slices the whole population to give the operator a bird's-eye view:
 *   - How many users have each signal RIGHT NOW?
 *   - Which products are generating the most friction (multi-view no-cart)?
 *   - Which products are due for restock across the customer base?
 *   - Conversion funnel: candidates → signals → fires → sent → converted
 *   - Channel mix (email vs whatsapp) and avg latency
 *
 * Heavy queries — cached briefly (60s) to avoid re-hitting PostHog on every
 * refresh of the admin page.
 */

import { Pool } from "pg"
import { hogqlQuery, isAdminConfigured } from "./posthog-admin-client"
import { listFires, getRuleStats, getVariantStats } from "./remarketing-rules-db"

let pool: Pool | null = null
function db(): Pool {
  if (!pool) pool = new Pool({ connectionString: process.env.DATABASE_URL })
  return pool
}

export interface PatternsSummary {
  generated_at: string
  window_hours: number
  // User base health
  active_abandoned_checkouts: number
  active_cart_abandons: number
  active_multi_view_no_cart: number
  active_restock_due: number
  active_win_back_eligible: number
  vip_customers: number
  total_candidates_72h: number
  // Friction intelligence
  friction_products: Array<{ product_id: string; title: string; views: number; distinct_viewers: number }>
  // Restock due
  restock_due_products: Array<{ product_id: string; title: string; customers_due: number; avg_cycle_days: number }>
  // Channel mix (from fires)
  channel_mix: { email: number; whatsapp: number; manual: number }
  // Conversion funnel
  funnel: {
    candidates_7d: number
    signals_7d: number
    fires_7d: number
    sent_7d: number
    converted_7d: number
    conversion_rate_pct: number
    revenue_attributed_7d: number
  }
  // Rule performance (last 30d)
  rule_performance: Array<{
    rule_key: string
    fires_30d: number
    sent_30d: number
    converted_30d: number
    conversion_rate_pct: number
    revenue_attributed: number
  }>
  // Activity timeline (last 7d, hourly bins)
  fires_by_day: Array<{ day: string; sent: number; failed: number; skipped: number; converted: number }>
  // Active A/B experiments — only rules with 2+ variants and at least one fire each
  experiments: Array<{
    rule_key: string
    variants: Array<{
      key: string
      fires: number
      sent: number
      converted: number
      conversion_rate: number
      revenue_attributed: number
    }>
    leader: string | null              // variant key with highest conv_rate
    lift_pct: number | null            // (leader - runner_up) / runner_up * 100
    is_significant: boolean            // basic min-sample heuristic
  }>
}

let cache: { data: PatternsSummary; expiresAt: number } | null = null
const CACHE_TTL_MS = 60_000

export async function getPatternsSummary(force = false): Promise<PatternsSummary> {
  if (!force && cache && Date.now() < cache.expiresAt) return cache.data

  const generated_at = new Date().toISOString()
  const window_hours = 72

  // ─── PostHog: friction products (multi-view no add_to_cart) ───────────────
  let frictionProducts: PatternsSummary["friction_products"] = []
  let activeAbandonedCheckouts = 0
  let activeCartAbandons = 0
  let activeMultiViewNoCart = 0
  let totalCandidates72h = 0

  if (isAdminConfigured()) {
    try {
      // 1. total candidates active in last 72h
      const candRes = await hogqlQuery(`
        SELECT count(DISTINCT distinct_id) FROM events
        WHERE timestamp >= now() - INTERVAL 72 HOUR
          AND event IN ('add_to_cart','checkout_started','product_viewed','$pageview','order_placed')
      `)
      totalCandidates72h = Number(candRes?.results?.[0]?.[0] || 0)

      // 2. active abandoned checkouts (checkout_started in 1-72h without order_placed after)
      const abRes = await hogqlQuery(`
        SELECT count(DISTINCT distinct_id) FROM (
          SELECT distinct_id,
                 max(if(event='checkout_started', toUnixTimestamp(timestamp), 0)) AS last_checkout,
                 max(if(event='order_placed',     toUnixTimestamp(timestamp), 0)) AS last_order
          FROM events
          WHERE timestamp >= now() - INTERVAL 72 HOUR
            AND event IN ('checkout_started','order_placed')
          GROUP BY distinct_id
        )
        WHERE last_checkout > 0
          AND last_checkout > last_order
          AND (toUnixTimestamp(now()) - last_checkout) >= 3600
      `)
      activeAbandonedCheckouts = Number(abRes?.results?.[0]?.[0] || 0)

      // 3. active cart abandons (add_to_cart in 2-168h without order_placed after)
      const caRes = await hogqlQuery(`
        SELECT count(DISTINCT distinct_id) FROM (
          SELECT distinct_id,
                 max(if(event='add_to_cart',  toUnixTimestamp(timestamp), 0)) AS last_add,
                 max(if(event='order_placed', toUnixTimestamp(timestamp), 0)) AS last_order
          FROM events
          WHERE timestamp >= now() - INTERVAL 168 HOUR
            AND event IN ('add_to_cart','order_placed')
          GROUP BY distinct_id
        )
        WHERE last_add > 0
          AND last_add > last_order
          AND (toUnixTimestamp(now()) - last_add) >= 7200
      `)
      activeCartAbandons = Number(caRes?.results?.[0]?.[0] || 0)

      // 4. friction: product_viewed 3+ times in 14d with no add_to_cart
      const frRes = await hogqlQuery(`
        SELECT
          properties.product_id AS pid,
          any(properties.title) AS title,
          count() AS views,
          count(DISTINCT distinct_id) AS viewers
        FROM events
        WHERE event = 'product_viewed'
          AND timestamp >= now() - INTERVAL 14 DAY
          AND properties.product_id IS NOT NULL
          AND distinct_id NOT IN (
            SELECT distinct_id FROM events
            WHERE event = 'add_to_cart'
              AND timestamp >= now() - INTERVAL 14 DAY
              AND properties.product_id = events.properties.product_id
          )
        GROUP BY pid
        HAVING count() >= 3
        ORDER BY views DESC
        LIMIT 10
      `)
      frictionProducts = (frRes?.results || []).map((r) => ({
        product_id: String(r[0] || ""),
        title: String(r[1] || ""),
        views: Number(r[2]),
        distinct_viewers: Number(r[3]),
      }))

      // 5. approximate multi_view_no_cart count = sum of viewers above
      activeMultiViewNoCart = frictionProducts.reduce((s, p) => s + p.distinct_viewers, 0)
    } catch (err) {
      console.error("[patterns] posthog aggregate failed:", (err as Error).message)
    }
  }

  // ─── Medusa: VIPs + win-back + restock due ────────────────────────────────
  let vipCustomers = 0
  let activeWinBackEligible = 0
  let restockDueProducts: PatternsSummary["restock_due_products"] = []
  let activeRestockDue = 0

  try {
    const vipRes = await db().query(`
      SELECT COUNT(DISTINCT c.id)
      FROM customer c
      JOIN "order" o ON o.customer_id = c.id
      LEFT JOIN LATERAL (
        SELECT totals FROM order_summary WHERE order_id = o.id ORDER BY created_at DESC LIMIT 1
      ) os ON true
      WHERE c.deleted_at IS NULL AND o.is_draft_order = false AND o.deleted_at IS NULL
      GROUP BY c.id
      HAVING SUM(COALESCE((os.totals->>'original_order_total')::numeric, 0)) >= 100
    `)
    vipCustomers = vipRes.rows.length

    const wbRes = await db().query(`
      SELECT COUNT(DISTINCT c.id)
      FROM customer c
      JOIN "order" o ON o.customer_id = c.id
      WHERE c.deleted_at IS NULL
        AND o.is_draft_order = false
        AND o.deleted_at IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM "order" o2
          WHERE o2.customer_id = c.id
            AND o2.created_at > NOW() - INTERVAL '60 days'
            AND o2.is_draft_order = false
            AND o2.deleted_at IS NULL
        )
    `)
    activeWinBackEligible = Number(wbRes.rows[0]?.count || 0)

    // Restock due: products where a customer has bought 2+ times and avg_cycle_days elapsed
    const rdRes = await db().query(`
      WITH purchase_events AS (
        SELECT o.customer_id,
               oli.product_id,
               oli.title AS product_title,
               o.created_at
        FROM "order" o
        JOIN order_item oit ON oit.order_id = o.id
        JOIN order_line_item oli ON oli.id = oit.item_id
        WHERE o.is_draft_order = false
          AND o.deleted_at IS NULL
          AND oli.product_id IS NOT NULL
      ),
      customer_product_cycles AS (
        SELECT customer_id,
               product_id,
               MAX(product_title) AS title,
               COUNT(*) AS buy_count,
               MAX(created_at) AS last_buy,
               EXTRACT(EPOCH FROM (MAX(created_at) - MIN(created_at))) / NULLIF(COUNT(*) - 1, 0) / 86400 AS avg_cycle_days
        FROM purchase_events
        GROUP BY customer_id, product_id
        HAVING COUNT(*) >= 2
      )
      SELECT product_id,
             MAX(title) AS title,
             COUNT(*) FILTER (
               WHERE last_buy < NOW() - INTERVAL '1 day' * GREATEST(avg_cycle_days - 3, 1)
                 AND last_buy > NOW() - INTERVAL '365 days'
             ) AS customers_due,
             AVG(avg_cycle_days) AS avg_cycle_days
      FROM customer_product_cycles
      GROUP BY product_id
      HAVING COUNT(*) FILTER (
        WHERE last_buy < NOW() - INTERVAL '1 day' * GREATEST(avg_cycle_days - 3, 1)
          AND last_buy > NOW() - INTERVAL '365 days'
      ) > 0
      ORDER BY customers_due DESC
      LIMIT 10
    `)
    restockDueProducts = rdRes.rows.map((r: any) => ({
      product_id: String(r.product_id),
      title: String(r.title || ""),
      customers_due: Number(r.customers_due),
      avg_cycle_days: Math.round(Number(r.avg_cycle_days || 0)),
    }))
    activeRestockDue = restockDueProducts.reduce((s, p) => s + p.customers_due, 0)
  } catch (err) {
    console.error("[patterns] medusa aggregate failed:", (err as Error).message)
  }

  // ─── Fires: channel mix + funnel + rule perf + activity timeline ──────────
  const [fires7d, fires30d, ruleStats, variantStats] = await Promise.all([
    listFires({ since_hours: 168, limit: 500 }),
    listFires({ since_hours: 720, limit: 500 }),
    getRuleStats(),
    getVariantStats(),
  ])

  const channelMix = { email: 0, whatsapp: 0, manual: 0 }
  for (const f of fires7d) {
    if (f.channel === "email") channelMix.email++
    else if (f.channel === "whatsapp") channelMix.whatsapp++
    else channelMix.manual++
  }

  const sent7d = fires7d.filter((f) => f.status === "sent" || f.status === "converted").length
  const converted7d = fires7d.filter((f) => f.status === "converted").length
  const revenue7d = 0 // computed later via rule_performance

  const funnel = {
    candidates_7d: totalCandidates72h, // approximation using 72h window
    signals_7d: fires7d.length,         // every fire = a detected & matched signal
    fires_7d: fires7d.length,
    sent_7d: sent7d,
    converted_7d: converted7d,
    conversion_rate_pct: sent7d > 0 ? Number(((converted7d / sent7d) * 100).toFixed(2)) : 0,
    revenue_attributed_7d: Number(revenue7d.toFixed(2)),
  }

  const rulePerformance = ruleStats.map((s) => ({
    rule_key: s.rule_key,
    fires_30d: s.fires_30d,
    sent_30d: Math.min(s.sent, s.fires_30d),
    converted_30d: s.converted,
    conversion_rate_pct: s.conversion_rate,
    revenue_attributed: s.revenue_attributed,
  }))

  // Replace revenue_attributed_7d with sum across rules (30d approx → fine for this widget)
  funnel.revenue_attributed_7d = Number(
    rulePerformance.reduce((s, r) => s + r.revenue_attributed, 0).toFixed(2)
  )

  // Activity timeline — last 7 days bucketed per day
  const fireTimelineRes = await db().query(`
    SELECT
      to_char(date_trunc('day', fired_at), 'YYYY-MM-DD') AS day,
      COUNT(*) FILTER (WHERE status = 'sent')      AS sent,
      COUNT(*) FILTER (WHERE status = 'failed')    AS failed,
      COUNT(*) FILTER (WHERE status LIKE 'skipped_%') AS skipped,
      COUNT(*) FILTER (WHERE status = 'converted') AS converted
    FROM remarketing_fire
    WHERE fired_at > NOW() - INTERVAL '7 days'
    GROUP BY 1
    ORDER BY 1 ASC
  `)
  const firesByDay = fireTimelineRes.rows.map((r: any) => ({
    day: String(r.day),
    sent: Number(r.sent || 0),
    failed: Number(r.failed || 0),
    skipped: Number(r.skipped || 0),
    converted: Number(r.converted || 0),
  }))

  // ─── Experiments: rules with 2+ variants having fires ─────────────────────
  const variantsByRule = new Map<string, typeof variantStats>()
  for (const v of variantStats) {
    if (v.variant === "(none)") continue
    const arr = variantsByRule.get(v.rule_key) || []
    arr.push(v)
    variantsByRule.set(v.rule_key, arr)
  }
  const experiments: PatternsSummary["experiments"] = []
  for (const [rule_key, variants] of variantsByRule) {
    if (variants.length < 2) continue
    // Pick leader by conv_rate; if tied, pick higher fires
    const sorted = [...variants].sort((a, b) => {
      if (b.conversion_rate !== a.conversion_rate) return b.conversion_rate - a.conversion_rate
      return b.fires - a.fires
    })
    const leader = sorted[0]
    const runnerUp = sorted[1]
    const lift_pct =
      runnerUp.conversion_rate > 0
        ? Number(
            (((leader.conversion_rate - runnerUp.conversion_rate) / runnerUp.conversion_rate) * 100).toFixed(1)
          )
        : null
    // Basic significance: each variant has >= 30 sent AND lift >= 20% (not real chi-squared, just a smell test)
    const is_significant =
      variants.every((v) => v.sent >= 30) && lift_pct != null && Math.abs(lift_pct) >= 20
    experiments.push({
      rule_key,
      variants: variants.map((v) => ({
        key: v.variant,
        fires: v.fires,
        sent: v.sent,
        converted: v.converted,
        conversion_rate: v.conversion_rate,
        revenue_attributed: v.revenue_attributed,
      })),
      leader: leader.variant,
      lift_pct,
      is_significant,
    })
  }

  const summary: PatternsSummary = {
    generated_at,
    window_hours,
    active_abandoned_checkouts: activeAbandonedCheckouts,
    active_cart_abandons: activeCartAbandons,
    active_multi_view_no_cart: activeMultiViewNoCart,
    active_restock_due: activeRestockDue,
    active_win_back_eligible: activeWinBackEligible,
    vip_customers: vipCustomers,
    total_candidates_72h: totalCandidates72h,
    friction_products: frictionProducts,
    restock_due_products: restockDueProducts,
    channel_mix: channelMix,
    funnel,
    rule_performance: rulePerformance,
    fires_by_day: firesByDay,
    experiments,
  }

  cache = { data: summary, expiresAt: Date.now() + CACHE_TTL_MS }
  return summary
}
