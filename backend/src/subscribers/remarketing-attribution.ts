/**
 * Remarketing conversion attribution.
 *
 * On order.placed, find the most recent `sent` remarketing fire dispatched to
 * this customer (by email or customer_id) within the last 30 days and mark it
 * as `converted` with the order_id. Last-touch attribution — one order =
 * one converted fire, so revenue attribution never double-counts.
 *
 * Plays nicely with the engine's cooldowns: by the time we look, only fires
 * still "in effect" (within their cooldown, thus plausibly influencing the
 * purchase) should be considered.
 */

import { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { Pool } from "pg"
import { markFireConverted } from "../lib/remarketing-rules-db"
import { markLogConverted } from "../lib/remarketing-db"
import { captureServerSide, isPosthogConfigured } from "../lib/posthog-server"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

// Attribution window: look back this many days for the latest fire
const ATTRIBUTION_WINDOW_DAYS = 30

export default async function remarketingAttributionHandler({
  event,
}: SubscriberArgs<{ id: string }>) {
  try {
    // Resolve order → customer identifiers
    const r = await pool.query(
      `SELECT id, email, customer_id FROM "order"
       WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
      [event.data.id]
    )
    const order = r.rows[0]
    if (!order) return
    const email = order.email ? String(order.email).toLowerCase() : null
    const customerId = order.customer_id || null
    if (!email && !customerId) return

    // ─── Search BOTH tables for the most recent dispatch within the window
    //     and pick last-touch (max timestamp).
    const [fireRes, logRes] = await Promise.all([
      pool.query(
        `SELECT id, rule_key, signal_id, signal_severity, channel,
                distinct_id, fired_at, context
         FROM remarketing_fire
         WHERE status = 'sent'
           AND fired_at > NOW() - INTERVAL '1 day' * $1
           AND (
             ($2::text IS NOT NULL AND lower(email) = $2) OR
             ($3::text IS NOT NULL AND customer_id = $3)
           )
         ORDER BY fired_at DESC
         LIMIT 1`,
        [ATTRIBUTION_WINDOW_DAYS, email, customerId]
      ),
      // Legacy log — exclude entries already mirrored from engine fires
      // (they have metadata.source='engine'); we want only "true legacy" dispatches.
      pool.query(
        `SELECT id, type, recipient_email, sent_at, metadata
         FROM remarketing_log
         WHERE sent_at > NOW() - INTERVAL '1 day' * $1
           AND COALESCE(metadata->>'source', '') <> 'engine'
           AND (
             ($2::text IS NOT NULL AND lower(recipient_email) = $2)
           )
         ORDER BY sent_at DESC
         LIMIT 1`,
        [ATTRIBUTION_WINDOW_DAYS, email]
      ),
    ])

    const fire = fireRes.rows[0]
    const log = logRes.rows[0]
    if (!fire && !log) return

    const fireTime = fire ? new Date(fire.fired_at).getTime() : 0
    const logTime = log ? new Date(log.sent_at).getTime() : 0
    const useFireSide = fireTime >= logTime

    if (useFireSide && fire) {
      await markFireConverted(fire.id, order.id)
      console.log(
        `[remarketing-attribution] order ${order.id} → fire ${fire.id} ` +
        `(rule=${fire.rule_key}, last-touch from engine)`
      )
      // PostHog event for funnel analysis
      if (isPosthogConfigured()) {
        const phDistinctId = fire.distinct_id || customerId || email || `order_${order.id}`
        const variant = (fire.context as any)?.variant || null
        const hoursToConvert = Math.round(
          (Date.now() - new Date(fire.fired_at).getTime()) / 3600000
        )
        await captureServerSide({
          distinctId: phDistinctId,
          event: "remarketing_converted",
          properties: {
            rule_key: fire.rule_key,
            signal_id: fire.signal_id,
            signal_severity: fire.signal_severity,
            channel: fire.channel,
            variant,
            fire_id: fire.id,
            order_id: order.id,
            hours_to_convert: hoursToConvert,
            attributed_via: "fire",
          },
        }).catch(() => { /* never block */ })
      }
    } else if (log) {
      await markLogConverted(log.id, order.id)
      console.log(
        `[remarketing-attribution] order ${order.id} → log ${log.id} ` +
        `(type=${log.type}, last-touch from legacy job)`
      )
      if (isPosthogConfigured()) {
        const phDistinctId = customerId || email || `order_${order.id}`
        const hoursToConvert = Math.round(
          (Date.now() - new Date(log.sent_at).getTime()) / 3600000
        )
        await captureServerSide({
          distinctId: phDistinctId,
          event: "remarketing_converted",
          properties: {
            legacy_type: log.type,
            log_id: log.id,
            order_id: order.id,
            hours_to_convert: hoursToConvert,
            attributed_via: "log",
          },
        }).catch(() => { /* never block */ })
      }
    }
  } catch (err) {
    // Never block order fulfillment on attribution failure
    console.error("[remarketing-attribution] error:", (err as Error).message)
  }
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
