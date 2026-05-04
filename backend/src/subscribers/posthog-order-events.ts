/**
 * PostHog server-side capture for order lifecycle events.
 *
 * Ensures `order_placed` is captured reliably regardless of whether the
 * client-side event fires (ad-blockers, mobile Safari reloads, etc.).
 * Server-side is source of truth for revenue attribution in PostHog.
 */
import { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { Pool } from "pg"
import { trackOrderPlaced, isPosthogConfigured } from "../lib/posthog-server"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

export default async function posthogOrderHandler({
  event,
}: SubscriberArgs<{ id: string }>) {
  if (!isPosthogConfigured()) return

  try {
    const r = await pool.query(
      `
      SELECT
        o.id,
        o.display_id,
        o.email,
        o.customer_id,
        o.currency_code,
        COALESCE((os.totals->>'original_order_total')::numeric, 0) AS total,
        (
          SELECT SUM(oit.quantity)::int FROM order_item oit WHERE oit.order_id = o.id
        ) AS item_count,
        sa.city,
        o.metadata
      FROM "order" o
      LEFT JOIN LATERAL (
        SELECT totals FROM order_summary WHERE order_id = o.id ORDER BY created_at DESC LIMIT 1
      ) os ON true
      LEFT JOIN order_address sa ON sa.id = o.shipping_address_id
      WHERE o.id = $1
      `,
      [event.data.id]
    )
    const order = r.rows[0]
    if (!order) return

    // items for context
    const itemsRes = await pool.query(
      `SELECT oli.product_id, oli.variant_id, oit.quantity, oli.unit_price
       FROM order_item oit
       JOIN order_line_item oli ON oli.id = oit.item_id
       WHERE oit.order_id = $1`,
      [event.data.id]
    )

    // Distinct ID preference: customer_id (identified) → email → order.id fallback
    const distinctId = order.customer_id || order.email || order.id
    const meta: any = order.metadata || {}
    const sourceChannel = meta.source_channel || (meta.manual_sale ? "manual" : "web")
    const paymentMethod = meta.payment_method || "pago_movil"

    await trackOrderPlaced({
      distinctId,
      order: {
        id: order.id,
        display_id: order.display_id,
        total: Number(order.total || 0),
        currency_code: String(order.currency_code || "usd"),
        item_count: Number(order.item_count || 0),
        source_channel: sourceChannel,
        payment_method: paymentMethod,
        shipping_city: order.city || undefined,
        items: itemsRes.rows.map((it: any) => ({
          product_id: it.product_id,
          variant_id: it.variant_id,
          quantity: Number(it.quantity),
          unit_price: Number(it.unit_price),
        })),
      },
    })
    console.log(`[posthog] order_placed captured for ${order.id}`)
  } catch (err) {
    console.error("[posthog-order] error:", err)
  }
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
