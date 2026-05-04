/**
 * User 360 — combina Medusa (customer + orders) + PostHog (behavior + events)
 * + Clarity link + Signals para UN usuario específico.
 *
 * GET /admin/remarketing/user360?email=foo@bar.com
 *     or         ?customer_id=cus_...
 *     or         ?distinct_id=019dba...
 */
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Pool } from "pg"
import {
  findPersonByEmail,
  findPersonByDistinctId,
  getEventsForDistinctIds,
  getBehaviorForDistinctIds,
  isAdminConfigured,
  getPosthogProjectUrl,
} from "../../../../lib/posthog-admin-client"
import { computeSignals } from "../../../../lib/remarketing-signals"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

const CLARITY_ID = process.env.NEXT_PUBLIC_CLARITY_ID || "wfp9s5wh5i"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const email = String(req.query.email || "").trim().toLowerCase()
  const customerId = String(req.query.customer_id || "").trim()
  const distinctId = String(req.query.distinct_id || "").trim()

  if (!email && !customerId && !distinctId) {
    res.status(400).json({ error: "Provide email, customer_id, or distinct_id" })
    return
  }

  // ─── 1. Medusa customer + orders ─────────────────────────────────────────
  let customer: any = null
  let orders: any[] = []

  try {
    const customerQuery = customerId
      ? `SELECT id, email, first_name, last_name, phone, created_at, metadata FROM customer WHERE id = $1 AND deleted_at IS NULL LIMIT 1`
      : email
      ? `SELECT id, email, first_name, last_name, phone, created_at, metadata FROM customer WHERE lower(email) = lower($1) AND deleted_at IS NULL LIMIT 1`
      : null
    const customerArg = customerId || email

    if (customerQuery) {
      const r = await pool.query(customerQuery, [customerArg])
      customer = r.rows[0] || null
    }

    if (customer) {
      const ordersRes = await pool.query(
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
      const ordersWithItems: any[] = []
      for (const o of ordersRes.rows) {
        const items = await pool.query(
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
    console.error("[user360] medusa query error:", err)
  }

  const medusaSummary = (() => {
    const lifetimeRevenue = orders.reduce((s, o) => s + Number(o.total || 0), 0)
    const lastOrderAt = orders[0]?.created_at || null
    return {
      orders_count: orders.length,
      lifetime_revenue: Number(lifetimeRevenue.toFixed(2)),
      avg_order_value: orders.length ? Number((lifetimeRevenue / orders.length).toFixed(2)) : 0,
      last_order_at: lastOrderAt,
      days_since_last_order: lastOrderAt
        ? Math.floor((Date.now() - new Date(lastOrderAt).getTime()) / 86400000)
        : null,
      preferred_payment_method: (orders[0]?.metadata?.payment_method) || null,
      orders,
    }
  })()

  // ─── 2. PostHog person + behavior + events ──────────────────────────────
  let posthogPerson: any = null
  let posthogBehavior: any = {
    sessions: 0, pageviews: 0, product_views: 0, cart_events: 0,
    checkout_starts: 0, orders: 0, add_to_carts: 0, whatsapp_clicks: 0,
    first_seen_at: null, last_seen_at: null,
    top_pages: [], top_products_viewed: [],
  }
  let recentEvents: any[] = []

  if (isAdminConfigured()) {
    try {
      // Prefer email, then distinct_id, then customer_id
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
      }
    } catch (err) {
      console.error("[user360] posthog query error:", err)
    }
  }

  // ─── 3. Signals ─────────────────────────────────────────────────────────
  const signals = computeSignals({
    customer: {
      id: customer?.id,
      email: customer?.email || email,
      first_name: customer?.first_name,
      phone: customer?.phone,
      created_at: customer?.created_at,
    },
    medusa: medusaSummary,
    posthog: {
      ...posthogBehavior,
      recent_events: recentEvents,
    },
  })

  // ─── 4. Remarketing fire history (last 60d) ─────────────────────────────
  let fires: Array<{
    id: string
    rule_key: string
    signal_id: string
    signal_severity: string
    channel: string
    status: string
    subject: string | null
    body: string | null
    error_message: string | null
    fired_at: string
    converted_order_id: string | null
    converted_at: string | null
  }> = []
  try {
    const params: unknown[] = []
    const conditions: string[] = []
    if (customer?.email || email) {
      params.push(customer?.email || email)
      conditions.push(`email = $${params.length}`)
    }
    if (customer?.id) {
      params.push(customer.id)
      conditions.push(`customer_id = $${params.length}`)
    }
    if (posthogPerson?.distinct_ids?.length) {
      for (const did of posthogPerson.distinct_ids) {
        params.push(did)
        conditions.push(`distinct_id = $${params.length}`)
      }
    }
    if (conditions.length) {
      const r = await pool.query(
        `SELECT id, rule_key, signal_id, signal_severity, channel, status,
                subject, body, error_message, fired_at, converted_order_id, converted_at
         FROM remarketing_fire
         WHERE (${conditions.join(" OR ")})
           AND fired_at > NOW() - INTERVAL '60 days'
         ORDER BY fired_at DESC
         LIMIT 50`,
        params
      )
      fires = r.rows
    }
  } catch (err) {
    console.error("[user360] fires query error:", err)
  }

  // ─── 5. Deep links to external tools ────────────────────────────────────
  const posthogPersonUrl = posthogPerson
    ? `${getPosthogProjectUrl()}/person/${posthogPerson.distinct_ids?.[0] || posthogPerson.id}`
    : null
  // Clarity no permite filter por user_id específico en dashboard URL (no hay param estable),
  // pero sí por email buscando en recordings. Este link lleva al dashboard y el user filtra manual.
  const clarityUrl = `https://clarity.microsoft.com/projects/view/${CLARITY_ID}/impressions`

  res.json({
    query: { email, customer_id: customerId, distinct_id: distinctId },
    customer: customer ? {
      id: customer.id,
      email: customer.email,
      first_name: customer.first_name,
      last_name: customer.last_name,
      phone: customer.phone,
      created_at: customer.created_at,
      metadata: customer.metadata || {},
    } : null,
    medusa_summary: medusaSummary,
    posthog_behavior: {
      person_id: posthogPerson?.id || null,
      person_uuid: posthogPerson?.uuid || null,
      distinct_ids: posthogPerson?.distinct_ids || [],
      ...posthogBehavior,
      recent_events: recentEvents.slice(0, 50),  // limit lo retornado al cliente
      recent_events_count: recentEvents.length,
    },
    signals,
    fires,
    fires_summary: {
      total: fires.length,
      sent: fires.filter((f) => f.status === "sent" || f.status === "converted").length,
      converted: fires.filter((f) => f.status === "converted").length,
      last_fired_at: fires[0]?.fired_at || null,
    },
    links: {
      posthog_person: posthogPersonUrl,
      clarity_dashboard: clarityUrl,
      whatsapp: customer?.phone ? `https://wa.me/${String(customer.phone).replace(/\D/g, "")}` : null,
    },
  })
}
