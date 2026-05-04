/**
 * Build a UserContext for signal computation — the canonical "User 360" read.
 *
 * Used by:
 *   - `/admin/remarketing/user360` API route (interactive view)
 *   - The rules engine batch cron
 *
 * Given any identifier (email / customer_id / distinct_id), returns a
 * fully-hydrated UserContext ready to feed into `computeSignals()`.
 *
 * This is pure read-only — no writes, no side effects.
 */

import { Pool } from "pg"
import {
  findPersonByEmail,
  findPersonByDistinctId,
  getEventsForDistinctIds,
  getBehaviorForDistinctIds,
  isAdminConfigured,
  type PostHogPerson,
} from "./posthog-admin-client"
import { getCustomerCity } from "./remarketing-db"
import type { UserContext } from "./remarketing-signals"

let sharedPool: Pool | null = null
function pool(): Pool {
  if (!sharedPool) sharedPool = new Pool({ connectionString: process.env.DATABASE_URL })
  return sharedPool
}

export interface UserLookup {
  email?: string
  customer_id?: string
  distinct_id?: string
}

export interface User360Result {
  customer: {
    id: string
    email: string
    first_name?: string
    last_name?: string
    phone?: string
    created_at: string
    metadata?: Record<string, unknown>
  } | null
  orders: Array<{
    id: string
    display_id: number
    total: number
    currency_code: string
    created_at: string
    items: Array<{ product_id: string; title: string; quantity: number; unit_price: number }>
    metadata?: Record<string, unknown>
  }>
  medusaSummary: UserContext["medusa"] & {
    preferred_payment_method: string | null
    avg_order_value: number
  }
  posthogPerson: PostHogPerson | null
  posthogBehavior: {
    sessions: number
    pageviews: number
    product_views: number
    cart_events: number
    checkout_starts: number
    orders: number
    add_to_carts: number
    whatsapp_clicks: number
    first_seen_at: string | null
    last_seen_at: string | null
    top_pages: Array<{ url: string; views: number }>
    top_products_viewed: Array<{ product_id: string; title: string; views: number; last_viewed_at: string }>
  }
  recentEvents: Array<{ timestamp: string; event: string; properties: Record<string, any>; distinct_id?: string }>
  /** UserContext ready for `computeSignals(ctx)` */
  signalContext: UserContext
}

export async function buildUserContext(lookup: UserLookup): Promise<User360Result> {
  const email = (lookup.email || "").trim().toLowerCase()
  const customerId = (lookup.customer_id || "").trim()
  const distinctId = (lookup.distinct_id || "").trim()

  // ─── 1. Medusa customer + orders ──────────────────────────────────────────
  let customer: any = null
  let orders: User360Result["orders"] = []

  // If the distinct_id looks like a Medusa customer_id ("cus_..."), use it
  const resolvedCustomerId =
    customerId || (distinctId.startsWith("cus_") ? distinctId : "")

  try {
    const customerQuery = resolvedCustomerId
      ? `SELECT id, email, first_name, last_name, phone, created_at, metadata
         FROM customer WHERE id = $1 AND deleted_at IS NULL LIMIT 1`
      : email
      ? `SELECT id, email, first_name, last_name, phone, created_at, metadata
         FROM customer WHERE lower(email) = lower($1) AND deleted_at IS NULL LIMIT 1`
      : null
    const customerArg = resolvedCustomerId || email

    if (customerQuery) {
      const r = await pool().query(customerQuery, [customerArg])
      customer = r.rows[0] || null
    }

    if (customer) {
      const ordersRes = await pool().query(
        `
        SELECT o.id, o.display_id, o.email, o.created_at, o.currency_code, o.metadata,
          COALESCE((os.totals->>'original_order_total')::numeric, 0) AS total
        FROM "order" o
        LEFT JOIN LATERAL (
          SELECT totals FROM order_summary WHERE order_id = o.id ORDER BY created_at DESC LIMIT 1
        ) os ON true
        WHERE o.customer_id = $1
        ORDER BY o.created_at DESC
        LIMIT 25
        `,
        [customer.id]
      )
      const ordersWithItems: User360Result["orders"] = []
      for (const o of ordersRes.rows) {
        const items = await pool().query(
          `SELECT oli.product_id, oli.title, oit.quantity, oli.unit_price
           FROM order_item oit
           JOIN order_line_item oli ON oli.id = oit.item_id
           WHERE oit.order_id = $1`,
          [o.id]
        )
        ordersWithItems.push({
          id: o.id,
          display_id: o.display_id,
          total: Number(o.total || 0),
          currency_code: o.currency_code,
          created_at: o.created_at,
          items: items.rows.map((it: any) => ({
            product_id: it.product_id,
            title: it.title,
            quantity: Number(it.quantity),
            unit_price: Number(it.unit_price),
          })),
          metadata: o.metadata || {},
        })
      }
      orders = ordersWithItems
    }
  } catch (err) {
    console.error("[user-context] medusa query error:", err)
  }

  // ─── 2. PostHog person + behavior + events ────────────────────────────────
  let posthogPerson: PostHogPerson | null = null
  const emptyBehavior = {
    sessions: 0, pageviews: 0, product_views: 0, cart_events: 0,
    checkout_starts: 0, orders: 0, add_to_carts: 0, whatsapp_clicks: 0,
    first_seen_at: null as string | null, last_seen_at: null as string | null,
    top_pages: [] as Array<{ url: string; views: number }>,
    top_products_viewed: [] as Array<{ product_id: string; title: string; views: number; last_viewed_at: string }>,
  }
  let posthogBehavior = emptyBehavior
  let recentEvents: User360Result["recentEvents"] = []

  if (isAdminConfigured()) {
    try {
      if (email) posthogPerson = await findPersonByEmail(email)
      if (!posthogPerson && distinctId) posthogPerson = await findPersonByDistinctId(distinctId)
      if (!posthogPerson && customer?.id) posthogPerson = await findPersonByDistinctId(customer.id)
      if (!posthogPerson && customer?.email) posthogPerson = await findPersonByEmail(customer.email)

      if (posthogPerson) {
        const dids = posthogPerson.distinct_ids || []
        const [behavior, events] = await Promise.all([
          getBehaviorForDistinctIds(dids, 30),
          getEventsForDistinctIds(dids, 200),
        ])
        posthogBehavior = behavior
        recentEvents = events

        // Enrich customer record via PostHog Person properties if we didn't
        // find one in Medusa. This catches users who identified in PostHog
        // (checkout_started) before creating a Medusa customer record.
        if (!customer) {
          const phEmail = (posthogPerson.properties?.email as string | undefined)?.toLowerCase()
          if (phEmail) {
            const r = await pool().query(
              `SELECT id, email, first_name, last_name, phone, created_at, metadata
               FROM customer WHERE lower(email) = $1 AND deleted_at IS NULL LIMIT 1`,
              [phEmail]
            )
            customer = r.rows[0] || null
            if (customer) {
              // Re-fetch orders for this customer
              const ordersRes = await pool().query(
                `
                SELECT o.id, o.display_id, o.email, o.created_at, o.currency_code, o.metadata,
                  COALESCE((os.totals->>'original_order_total')::numeric, 0) AS total
                FROM "order" o
                LEFT JOIN LATERAL (
                  SELECT totals FROM order_summary WHERE order_id = o.id ORDER BY created_at DESC LIMIT 1
                ) os ON true
                WHERE o.customer_id = $1
                ORDER BY o.created_at DESC
                LIMIT 25
                `,
                [customer.id]
              )
              const enriched: User360Result["orders"] = []
              for (const o of ordersRes.rows) {
                const items = await pool().query(
                  `SELECT oli.product_id, oli.title, oit.quantity, oli.unit_price
                   FROM order_item oit
                   JOIN order_line_item oli ON oli.id = oit.item_id
                   WHERE oit.order_id = $1`,
                  [o.id]
                )
                enriched.push({
                  id: o.id,
                  display_id: o.display_id,
                  total: Number(o.total || 0),
                  currency_code: o.currency_code,
                  created_at: o.created_at,
                  items: items.rows.map((it: any) => ({
                    product_id: it.product_id,
                    title: it.title,
                    quantity: Number(it.quantity),
                    unit_price: Number(it.unit_price),
                  })),
                  metadata: o.metadata || {},
                })
              }
              orders = enriched
            }
          }
        }
      }
    } catch (err) {
      console.error("[user-context] posthog query error:", err)
    }
  }

  // ─── 3. Build medusaSummary AFTER possible PostHog-driven customer enrichment
  const lifetimeRevenue = orders.reduce((s, o) => s + Number(o.total || 0), 0)
  const lastOrderAt = orders[0]?.created_at || null
  const medusaSummary = {
    orders_count: orders.length,
    lifetime_revenue: Number(lifetimeRevenue.toFixed(2)),
    avg_order_value: orders.length ? Number((lifetimeRevenue / orders.length).toFixed(2)) : 0,
    last_order_at: lastOrderAt,
    days_since_last_order: lastOrderAt
      ? Math.floor((Date.now() - new Date(lastOrderAt).getTime()) / 86400000)
      : null,
    preferred_payment_method: (orders[0]?.metadata?.payment_method as string) || null,
    orders,
  }

  // Fall back to PostHog Person properties if we still have no customer record
  const phProps = posthogPerson?.properties || {}
  const resolvedEmail =
    customer?.email ||
    email ||
    (phProps.email ? String(phProps.email) : undefined)
  const resolvedPhone =
    customer?.phone ||
    (phProps.phone ? String(phProps.phone) : undefined)
  const resolvedFirstName =
    customer?.first_name ||
    (phProps.first_name ? String(phProps.first_name) : undefined) ||
    (phProps.name ? String(phProps.name).split(" ")[0] : undefined)

  // If no Medusa customer was found, synthesize one from the PostHog person
  // so the rules engine still gets email/phone for dispatch.
  if (!customer && (resolvedEmail || resolvedPhone)) {
    customer = {
      id: null as unknown as string,
      email: resolvedEmail || "",
      first_name: resolvedFirstName,
      phone: resolvedPhone,
      created_at: posthogPerson?.created_at || new Date().toISOString(),
      metadata: {},
    }
  }

  // ─── 3.5 Resolve customer city (best-effort) for geo overrides ────────────
  let resolvedCity: string | null = null
  try {
    resolvedCity = await getCustomerCity(customer?.id || null, resolvedEmail || null)
  } catch (err) {
    // Non-fatal — geo overrides degrade gracefully to defaults
    console.warn("[user-context] city lookup failed:", (err as Error).message)
  }

  // ─── 3.6 Resolve loyalty points balance (best-effort) ─────────────────────
  let loyaltyPoints = 0
  if (customer?.id) {
    try {
      const lr = await pool().query(
        `SELECT COALESCE(SUM(points), 0) AS balance
         FROM loyalty_transaction
         WHERE customer_id = $1 AND deleted_at IS NULL`,
        [customer.id]
      )
      loyaltyPoints = Number(lr.rows[0]?.balance || 0)
    } catch (err) {
      // Loyalty table may not exist on fresh installs
      console.warn("[user-context] loyalty lookup failed:", (err as Error).message)
    }
  }

  // ─── 4. Build signalContext (shape expected by computeSignals) ────────────
  const signalContext: UserContext = {
    customer: {
      id: customer?.id,
      email: resolvedEmail,
      first_name: resolvedFirstName,
      phone: resolvedPhone,
      created_at: customer?.created_at,
      city: resolvedCity || undefined,
    },
    medusa: {
      orders_count: medusaSummary.orders_count,
      lifetime_revenue: medusaSummary.lifetime_revenue,
      last_order_at: medusaSummary.last_order_at,
      days_since_last_order: medusaSummary.days_since_last_order,
      orders: medusaSummary.orders.map((o) => ({
        id: o.id,
        total: o.total,
        created_at: o.created_at,
        items: o.items.map((it) => ({
          product_id: it.product_id,
          title: it.title,
          quantity: it.quantity,
        })),
      })),
    },
    loyalty: {
      points_balance: loyaltyPoints,
    },
    posthog: {
      sessions: posthogBehavior.sessions,
      pageviews: posthogBehavior.pageviews,
      product_views: posthogBehavior.product_views,
      cart_events: posthogBehavior.cart_events,
      checkout_starts: posthogBehavior.checkout_starts,
      orders: posthogBehavior.orders,
      add_to_carts: posthogBehavior.add_to_carts,
      whatsapp_clicks: posthogBehavior.whatsapp_clicks,
      first_seen_at: posthogBehavior.first_seen_at,
      last_seen_at: posthogBehavior.last_seen_at,
      top_products_viewed: posthogBehavior.top_products_viewed,
      recent_events: recentEvents,
    },
  }

  return {
    customer,
    orders,
    medusaSummary,
    posthogPerson,
    posthogBehavior,
    recentEvents,
    signalContext,
  }
}
