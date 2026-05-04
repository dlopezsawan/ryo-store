/**
 * Admin API — Funnel analytics for the WhatsApp bot (Batch 2 — F5.1)
 * Returns aggregated metrics + per-step counts + drop-off rates.
 */

import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Pool } from "pg"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

// Funnel steps in canonical order. Each step's "count" is the number of unique
// (phone, channel) pairs that hit that event at least once in the time window.
const FUNNEL_STEPS = [
  { event: "greeting_sent",            label: "Saludo enviado" },
  { event: "delivery_zone_set",        label: "Zona cualificada" },
  { event: "search_executed",          label: "Búsqueda" },
  { event: "cart_first_item_added",    label: "Primer item al carrito" },
  { event: "combo_threshold_reached",  label: "Combo desbloqueado" },
  { event: "customer_info_provided",   label: "Datos del cliente" },
  { event: "address_provided",         label: "Dirección" },
  { event: "payment_screen_shown",     label: "Vio Pago Móvil" },
  { event: "proof_received",           label: "Comprobante recibido" },
  { event: "order_submitted",          label: "Pedido creado" },
  { event: "order_completed",          label: "Pedido completado" },
] as const

type Period = "today" | "week" | "month" | "all"

function intervalFor(period: Period): string {
  switch (period) {
    case "today": return "1 day"
    case "week":  return "7 days"
    case "month": return "30 days"
    case "all":   return "1000 days"
  }
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const period = (req.query.period as Period) || "week"
  const interval = intervalFor(period)

  try {
    // 1. Per-step counts (unique phones)
    const stepCountsR = await pool.query(
      `SELECT event, COUNT(DISTINCT phone) AS unique_phones, COUNT(*) AS total_events
       FROM wa_funnel_events
       WHERE occurred_at > NOW() - INTERVAL '${interval}'
       GROUP BY event`
    )
    const stepCounts: Record<string, { unique: number; total: number }> = {}
    for (const row of stepCountsR.rows) {
      stepCounts[row.event] = { unique: parseInt(row.unique_phones), total: parseInt(row.total_events) }
    }

    const steps = FUNNEL_STEPS.map((s, idx) => {
      const curr = stepCounts[s.event]?.unique || 0
      const prev = idx > 0 ? (stepCounts[FUNNEL_STEPS[idx - 1].event]?.unique || 0) : null
      const dropoff = prev !== null && prev > 0 ? Math.round((1 - curr / prev) * 100) : null
      const conversion_from_top = stepCounts[FUNNEL_STEPS[0].event]?.unique
        ? Math.round((curr / stepCounts[FUNNEL_STEPS[0].event].unique) * 1000) / 10
        : 0
      return {
        event: s.event,
        label: s.label,
        unique_phones: curr,
        total_events: stepCounts[s.event]?.total || 0,
        dropoff_pct: dropoff,
        conversion_from_top_pct: conversion_from_top,
      }
    })

    // 2. Overall conversion (greeting → order_completed)
    const top = stepCounts["greeting_sent"]?.unique || 0
    const submitted = stepCounts["order_submitted"]?.unique || 0
    const completed = stepCounts["order_completed"]?.unique || 0
    const conversion = {
      greeting_to_submitted_pct: top > 0 ? Math.round((submitted / top) * 1000) / 10 : 0,
      greeting_to_completed_pct: top > 0 ? Math.round((completed / top) * 1000) / 10 : 0,
      submitted_to_completed_pct: submitted > 0 ? Math.round((completed / submitted) * 1000) / 10 : 0,
    }

    // 3. Distribution by hour of day (greeting_sent events)
    const hourlyR = await pool.query(
      `SELECT EXTRACT(HOUR FROM occurred_at AT TIME ZONE 'America/Caracas')::int AS hour,
              COUNT(*) AS count
       FROM wa_funnel_events
       WHERE event = 'greeting_sent'
         AND occurred_at > NOW() - INTERVAL '${interval}'
       GROUP BY hour ORDER BY hour`
    )
    const hourly = hourlyR.rows.map((r) => ({ hour: r.hour, count: parseInt(r.count) }))

    // 4. Median time per step (greeting → submitted)
    const timingR = await pool.query(
      `WITH journey AS (
         SELECT phone,
                MIN(CASE WHEN event='greeting_sent' THEN occurred_at END) AS t_greeting,
                MIN(CASE WHEN event='cart_first_item_added' THEN occurred_at END) AS t_first_item,
                MIN(CASE WHEN event='address_provided' THEN occurred_at END) AS t_address,
                MIN(CASE WHEN event='proof_received' THEN occurred_at END) AS t_proof,
                MIN(CASE WHEN event='order_submitted' THEN occurred_at END) AS t_submitted
         FROM wa_funnel_events
         WHERE occurred_at > NOW() - INTERVAL '${interval}'
         GROUP BY phone
       )
       SELECT
         AVG(EXTRACT(EPOCH FROM (t_first_item - t_greeting)))::int AS sec_greeting_to_first_item,
         AVG(EXTRACT(EPOCH FROM (t_address - t_first_item)))::int AS sec_first_item_to_address,
         AVG(EXTRACT(EPOCH FROM (t_proof - t_address)))::int AS sec_address_to_proof,
         AVG(EXTRACT(EPOCH FROM (t_submitted - t_proof)))::int AS sec_proof_to_submitted,
         AVG(EXTRACT(EPOCH FROM (t_submitted - t_greeting)))::int AS sec_full_journey
       FROM journey
       WHERE t_submitted IS NOT NULL`
    )
    const timing = timingR.rows[0] || {}

    // 5. Combo distribution among submitted orders
    const comboR = await pool.query(
      `SELECT (metadata->>'discount_pct')::int AS pct, COUNT(*) AS count
       FROM wa_funnel_events
       WHERE event = 'order_submitted'
         AND occurred_at > NOW() - INTERVAL '${interval}'
       GROUP BY pct ORDER BY pct`
    )
    const combo_distribution = comboR.rows.map((r) => ({
      discount_pct: parseInt(r.pct) || 0,
      count: parseInt(r.count),
    }))

    // 6. Top abandoners — phones that reached payment_screen_shown but no order
    const abandonR = await pool.query(
      `WITH paid_view AS (
         SELECT DISTINCT phone FROM wa_funnel_events
         WHERE event = 'payment_screen_shown'
           AND occurred_at > NOW() - INTERVAL '${interval}'
       ),
       submitted AS (
         SELECT DISTINCT phone FROM wa_funnel_events
         WHERE event = 'order_submitted'
           AND occurred_at > NOW() - INTERVAL '${interval}'
       )
       SELECT pv.phone,
              (SELECT MAX(occurred_at) FROM wa_funnel_events WHERE phone = pv.phone) AS last_event_at
       FROM paid_view pv
       WHERE pv.phone NOT IN (SELECT phone FROM submitted)
       ORDER BY last_event_at DESC
       LIMIT 20`
    )
    const abandoners = abandonR.rows.map((r) => ({
      phone: r.phone,
      last_event_at: r.last_event_at,
    }))

    // 7. Objection metrics (F3.2 — measure objection handling effectiveness)
    const objR = await pool.query(
      `WITH objections AS (
         SELECT DISTINCT phone FROM wa_funnel_events
         WHERE event = 'objection_detected'
           AND occurred_at > NOW() - INTERVAL '${interval}'
       ),
       recovered AS (
         SELECT DISTINCT phone FROM wa_funnel_events
         WHERE event = 'objection_recovered'
           AND occurred_at > NOW() - INTERVAL '${interval}'
       )
       SELECT
         (SELECT COUNT(*) FROM objections) AS detected,
         (SELECT COUNT(*) FROM recovered) AS recovered`
    )
    const obj = objR.rows[0]
    const objections = {
      detected: parseInt(obj.detected),
      recovered: parseInt(obj.recovered),
      recovery_rate_pct: parseInt(obj.detected) > 0
        ? Math.round((parseInt(obj.recovered) / parseInt(obj.detected)) * 1000) / 10
        : 0,
    }

    // 8. Recovery metrics (F1.1)
    const recR = await pool.query(
      `WITH sent AS (
         SELECT DISTINCT phone FROM wa_funnel_events
         WHERE event = 'recovery_sent'
           AND occurred_at > NOW() - INTERVAL '${interval}'
       ),
       responded AS (
         SELECT DISTINCT phone FROM wa_funnel_events
         WHERE event = 'recovery_responded'
           AND occurred_at > NOW() - INTERVAL '${interval}'
       )
       SELECT
         (SELECT COUNT(*) FROM sent) AS sent,
         (SELECT COUNT(*) FROM responded) AS responded`
    )
    const rec = recR.rows[0]
    const recovery = {
      sent: parseInt(rec.sent),
      responded: parseInt(rec.responded),
      response_rate_pct: parseInt(rec.sent) > 0
        ? Math.round((parseInt(rec.responded) / parseInt(rec.sent)) * 1000) / 10
        : 0,
    }

    return res.json({
      period,
      window_label: { today: "últimas 24 h", week: "últimos 7 días", month: "últimos 30 días", all: "todo el histórico" }[period],
      steps,
      conversion,
      timing,
      hourly,
      combo_distribution,
      abandoners,
      objections,
      recovery,
    })
  } catch (err) {
    console.error("[admin/funnel] error:", err)
    return res.status(500).json({ error: "internal", message: (err as Error).message })
  }
}
