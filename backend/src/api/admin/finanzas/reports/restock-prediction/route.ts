/**
 * GET /admin/finanzas/reports/restock-prediction?days=30
 *
 * Per-variant velocity vs current Medusa inventory:
 *
 *   units_sold_30d        — sum of pago_movil_line.quantity in last 30 days
 *   daily_velocity        — units / 30
 *   current_stock         — Medusa inventory_level for the variant (best-effort)
 *   days_remaining        — current_stock / daily_velocity
 *   recommended_qty       — daily_velocity × 45  (~1.5 month buffer)
 *   restock_cost_usdt     — recommended_qty × unit_cost_eur ÷ 1.08
 *
 * Sorted by days_remaining ASC (most urgent first). Variants with no sales
 * in the period are omitted.
 */

import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { Pool } from "pg"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const EUR_PER_USDT = 1.08

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const days = Math.min(Math.max(Number(req.query.days) || 30, 7), 90)

  const r = await pool.query(
    `WITH velocity AS (
       SELECT l.variant_id,
              MAX(l.product_id)        AS product_id,
              MAX(l.product_handle)    AS product_handle,
              MAX(l.title)             AS title,
              SUM(l.quantity)          AS units_sold
       FROM finanzas_pago_movil_line l
       JOIN finanzas_pago_movil pm ON pm.id = l.pago_movil_id
       WHERE l.deleted_at IS NULL AND pm.deleted_at IS NULL
         AND l.variant_id IS NOT NULL
         AND pm.created_at >= NOW() - ($1::int * INTERVAL '1 day')
       GROUP BY l.variant_id
     )
     SELECT v.variant_id, v.product_id, v.product_handle, v.title, v.units_sold,
            pc.unit_cost_eur,
            COALESCE((
              SELECT SUM(il.stocked_quantity - il.reserved_quantity)
              FROM product_variant_inventory_item pvii
              JOIN inventory_level il ON il.inventory_item_id = pvii.inventory_item_id
                                     AND il.deleted_at IS NULL
              WHERE pvii.variant_id = v.variant_id
            ), 0) AS current_stock
     FROM velocity v
     LEFT JOIN finanzas_product_cost pc ON pc.variant_id = v.variant_id
                                       AND pc.deleted_at IS NULL
     WHERE v.units_sold > 0`,
    [days]
  )

  const rows = r.rows.map((x) => {
    const unitsSold = Number(x.units_sold) || 0
    const dailyVelocity = unitsSold / days
    const currentStock = Math.max(0, Number(x.current_stock) || 0)
    const daysRemaining = dailyVelocity > 0 ? currentStock / dailyVelocity : Infinity
    const recommendedQty = Math.max(0, Math.ceil(dailyVelocity * 45) - currentStock)
    const unitCostEur = Number(x.unit_cost_eur) || 0
    const restockCostUsdt =
      recommendedQty * unitCostEur / EUR_PER_USDT

    let urgency: "critical" | "warning" | "ok"
    if (daysRemaining < 7) urgency = "critical"
    else if (daysRemaining < 21) urgency = "warning"
    else urgency = "ok"

    return {
      variant_id: x.variant_id,
      product_id: x.product_id,
      product_handle: x.product_handle,
      title: x.title,
      units_sold: unitsSold,
      daily_velocity: Math.round(dailyVelocity * 100) / 100,
      current_stock: currentStock,
      days_remaining:
        Number.isFinite(daysRemaining) ? Math.round(daysRemaining * 10) / 10 : null,
      recommended_qty: recommendedQty,
      unit_cost_eur: unitCostEur,
      restock_cost_usdt: Math.round(restockCostUsdt * 100) / 100,
      urgency,
    }
  })

  // sort: critical first, then by days_remaining
  rows.sort((a, b) => {
    const order = { critical: 0, warning: 1, ok: 2 } as const
    if (order[a.urgency] !== order[b.urgency]) return order[a.urgency] - order[b.urgency]
    const da = a.days_remaining ?? 9999
    const db = b.days_remaining ?? 9999
    return da - db
  })

  const summary = {
    critical: rows.filter((x) => x.urgency === "critical").length,
    warning: rows.filter((x) => x.urgency === "warning").length,
    ok: rows.filter((x) => x.urgency === "ok").length,
    total_restock_cost_usdt: Math.round(
      rows.reduce((s, x) => s + x.restock_cost_usdt, 0) * 100
    ) / 100,
  }

  res.json({ window_days: days, rows, summary })
}
