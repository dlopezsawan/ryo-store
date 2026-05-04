/**
 * GET /admin/remarketing/intelligence
 *
 * Two product-intelligence datasets the Remarketing admin UI consumes:
 *
 *   replenishment_cycles[]  — for each product where we have at least 2
 *                             repeat-purchase gaps, the median days between
 *                             repeat purchases. Used to seed the "días" hint
 *                             on each restock rule and surface candidates
 *                             that don't yet have a rule.
 *
 *   attach_matrix[]         — top product co-purchase pairs in the last 90
 *                             days with attach_pct = co_count / anchor_orders.
 *                             Used to suggest cross-sell mappings.
 *
 * Migrated out of the legacy `/admin/analytics` route as part of the
 * Analytics-into-Finanzas absorption (Batch FA4). Living here keeps the
 * remarketing UI's data dependencies inside the remarketing module.
 */

import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { Pool } from "pg"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

export async function GET(_req: MedusaRequest, res: MedusaResponse) {
  try {
    const [replenishmentResult, attachResult] = await Promise.all([
      pool.query(`
        WITH purchases AS (
          SELECT
            o.customer_id,
            li.product_id,
            li.title AS product_title,
            o.created_at,
            LAG(o.created_at) OVER (
              PARTITION BY o.customer_id, li.product_id ORDER BY o.created_at
            ) AS prev_purchased_at
          FROM "order" o
          JOIN order_item oi ON oi.order_id = o.id AND oi.deleted_at IS NULL
          JOIN order_line_item li ON li.id = oi.item_id
          WHERE o.is_draft_order = false
            AND o.deleted_at IS NULL
            AND o.customer_id IS NOT NULL
            AND li.product_id IS NOT NULL
        ),
        gaps AS (
          SELECT
            product_id,
            product_title,
            EXTRACT(EPOCH FROM (created_at - prev_purchased_at)) / 86400 AS days_between
          FROM purchases
          WHERE prev_purchased_at IS NOT NULL
        )
        SELECT
          product_id,
          MAX(product_title) AS product_title,
          ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY days_between)::numeric, 1) AS median_days,
          COUNT(*) AS repeat_purchases
        FROM gaps
        GROUP BY product_id
        HAVING COUNT(*) >= 2
        ORDER BY repeat_purchases DESC
        LIMIT 20
      `),
      pool.query(`
        WITH order_products AS (
          SELECT DISTINCT o.id AS order_id, li.product_id, li.title AS product_title
          FROM "order" o
          JOIN order_item oi ON oi.order_id = o.id AND oi.deleted_at IS NULL
          JOIN order_line_item li ON li.id = oi.item_id
          WHERE o.is_draft_order = false
            AND o.deleted_at IS NULL
            AND o.created_at >= NOW() - INTERVAL '90 days'
            AND o.status != 'canceled'
            AND li.product_id IS NOT NULL
        ),
        pairs AS (
          SELECT
            a.product_id    AS anchor_id,
            a.product_title AS anchor_title,
            b.product_id    AS also_id,
            b.product_title AS also_title,
            COUNT(*)        AS co_count
          FROM order_products a
          JOIN order_products b
            ON a.order_id = b.order_id
           AND a.product_id < b.product_id
          GROUP BY a.product_id, a.product_title, b.product_id, b.product_title
        ),
        anchor_totals AS (
          SELECT product_id, COUNT(DISTINCT order_id) AS anchor_orders
          FROM order_products
          GROUP BY product_id
        )
        SELECT
          p.anchor_id, p.anchor_title, p.also_id, p.also_title, p.co_count,
          at.anchor_orders,
          ROUND((p.co_count::numeric / at.anchor_orders) * 100, 1) AS attach_pct
        FROM pairs p
        JOIN anchor_totals at ON at.product_id = p.anchor_id
        WHERE at.anchor_orders >= 3
        ORDER BY p.co_count DESC
        LIMIT 80
      `),
    ])

    const replenishment_cycles = replenishmentResult.rows.map((r) => ({
      product_id: r.product_id as string,
      product_title: r.product_title as string,
      median_days: Number(r.median_days),
      sample_size: Number(r.repeat_purchases),
    }))

    const attach_matrix = attachResult.rows.map((r) => ({
      anchor_id: r.anchor_id as string,
      anchor_title: r.anchor_title as string,
      also_id: r.also_id as string,
      also_title: r.also_title as string,
      co_count: Number(r.co_count),
      anchor_orders: Number(r.anchor_orders),
      attach_pct: Number(r.attach_pct),
    }))

    res.json({ replenishment_cycles, attach_matrix })
  } catch (e: any) {
    console.error("[remarketing/intelligence]", e)
    res.status(500).json({ error: e.message })
  }
}
