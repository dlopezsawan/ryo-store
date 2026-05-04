/**
 * GET /admin/finanzas/reports/restock-detail
 *
 * Per (SKU × location) inventory health. The sibling `/restock-prediction`
 * endpoint sums stock across all locations and gives one row per variant —
 * useful for the global restock CTA. This one breaks it down BY warehouse
 * so we can spot imbalances (e.g. Caracas full, Valencia empty even though
 * Valencia sells more).
 *
 * For each (variant × location) row:
 *   stocked        — inventory_level.stocked_quantity at that location
 *   sold_30d       — variant-wide sales in last 30 days (NOT per-location;
 *                    Medusa pago_movil_line doesn't carry location info)
 *   days_of_cover  — stocked / (sold_30d / 30)   when sold_30d > 0
 *   risk           — critical (<7d) | low (<14d) | stale (>180d) | ok
 *
 * Sorted by days_of_cover ASC NULLS LAST (most urgent first), top 30.
 *
 * Built for Batch FA2 — the analytics module's stock_velocity widget being
 * absorbed into Finanzas.
 */

import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { Pool } from "pg"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

export async function GET(_req: MedusaRequest, res: MedusaResponse) {
  try {
    const r = await pool.query(`
      WITH sales_30d AS (
        SELECT
          l.variant_id,
          SUM(l.quantity) AS qty_sold_30d
        FROM finanzas_pago_movil_line l
        JOIN finanzas_pago_movil pm ON pm.id = l.pago_movil_id
        WHERE l.deleted_at IS NULL
          AND pm.deleted_at IS NULL
          AND l.variant_id IS NOT NULL
          AND pm.created_at >= NOW() - INTERVAL '30 days'
        GROUP BY l.variant_id
      ),
      stock_per_location AS (
        SELECT
          pv.id           AS variant_id,
          pv.title        AS variant_title,
          p.title         AS product_title,
          p.handle        AS product_handle,
          sl.id           AS location_id,
          sl.name         AS location_name,
          il.stocked_quantity,
          il.reserved_quantity
        FROM inventory_level il
        JOIN stock_location sl ON sl.id = il.location_id AND sl.deleted_at IS NULL
        JOIN product_variant_inventory_item pvii ON pvii.inventory_item_id = il.inventory_item_id
        JOIN product_variant pv ON pv.id = pvii.variant_id AND pv.deleted_at IS NULL
        JOIN product p ON p.id = pv.product_id AND p.deleted_at IS NULL
        WHERE il.deleted_at IS NULL
      )
      SELECT
        spl.product_handle,
        spl.product_title,
        spl.variant_title,
        spl.variant_id,
        spl.location_name,
        spl.location_id,
        spl.stocked_quantity,
        spl.reserved_quantity,
        COALESCE(s.qty_sold_30d, 0) AS sold_30d
      FROM stock_per_location spl
      LEFT JOIN sales_30d s ON s.variant_id = spl.variant_id
      WHERE spl.stocked_quantity > 0
         OR COALESCE(s.qty_sold_30d, 0) > 0
      ORDER BY
        CASE
          WHEN COALESCE(s.qty_sold_30d, 0) > 0
          THEN spl.stocked_quantity::numeric / (s.qty_sold_30d / 30.0)
          ELSE NULL
        END ASC NULLS LAST
      LIMIT 30
    `)

    const rows = r.rows.map((x) => {
      const stocked = Number(x.stocked_quantity) || 0
      const reserved = Number(x.reserved_quantity) || 0
      const sold30 = Number(x.sold_30d) || 0
      const dailyVel = sold30 / 30
      const daysOfCover = dailyVel > 0 ? Math.round((stocked / dailyVel) * 10) / 10 : null
      let risk: "critical" | "low" | "stale" | "ok"
      if (daysOfCover !== null && daysOfCover < 7) risk = "critical"
      else if (daysOfCover !== null && daysOfCover < 14) risk = "low"
      else if (daysOfCover !== null && daysOfCover > 180) risk = "stale"
      else if (sold30 === 0 && stocked > 0) risk = "stale"
      else risk = "ok"

      return {
        product_handle: x.product_handle as string,
        product_title: x.product_title as string,
        variant_title: x.variant_title as string,
        variant_id: x.variant_id as string,
        location_name: x.location_name as string,
        location_id: x.location_id as string,
        stocked,
        reserved,
        available: stocked - reserved,
        sold_30d: sold30,
        days_of_cover: daysOfCover,
        risk,
      }
    })

    const summary = {
      critical: rows.filter((r) => r.risk === "critical").length,
      low: rows.filter((r) => r.risk === "low").length,
      stale: rows.filter((r) => r.risk === "stale").length,
      ok: rows.filter((r) => r.risk === "ok").length,
    }

    res.json({ window_days: 30, rows, summary })
  } catch (e: any) {
    console.error("[reports/restock-detail]", e)
    res.status(500).json({ error: e.message })
  }
}
