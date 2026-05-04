/**
 * GET /admin/finanzas/reports/graduation-rate
 *
 * Manual-to-web graduation funnel. For every customer whose FIRST order was
 * a manual sale (Telegram/WhatsApp/in-person, flagged via
 * `metadata.manual_sale`), checks whether their SECOND order came through
 * the website (i.e. NOT manual_sale and NOT source=whatsapp). The ratio is
 * the % of customers we successfully "graduated" from offline to online.
 *
 * This is a north-star metric for the small-team workflow: we acquire on
 * Telegram + IRL but want repeat business through the storefront where
 * margin is higher and operations are leaner.
 *
 * Migrated from the legacy `/admin/analytics` route (graduation_rate block)
 * as part of Batch FA1 — the analytics module is being absorbed into
 * Finanzas.
 *
 * Note: lifetime metric, not month-scoped — graduating takes weeks to
 * months so a calendar-month slice would be too noisy.
 */

import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { Pool } from "pg"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

export async function GET(_req: MedusaRequest, res: MedusaResponse) {
  try {
    const r = await pool.query(`
      WITH first_orders AS (
        SELECT DISTINCT ON (customer_id)
          customer_id,
          id,
          created_at,
          (metadata->>'manual_sale')::boolean AS is_manual
        FROM "order"
        WHERE is_draft_order = false
          AND deleted_at IS NULL
          AND customer_id IS NOT NULL
        ORDER BY customer_id, created_at ASC
      ),
      second_orders AS (
        SELECT DISTINCT ON (o.customer_id)
          o.customer_id,
          (o.metadata->>'manual_sale')::boolean AS is_manual,
          o.metadata->>'source' AS source
        FROM "order" o
        JOIN first_orders f
          ON f.customer_id = o.customer_id
         AND o.created_at  > f.created_at
        WHERE o.is_draft_order = false
          AND o.deleted_at IS NULL
        ORDER BY o.customer_id, o.created_at ASC
      )
      SELECT
        COUNT(*) FILTER (WHERE f.is_manual)                                      AS manual_first,
        COUNT(*) FILTER (
          WHERE f.is_manual
            AND s.is_manual IS NOT TRUE
            AND (s.source IS NULL OR s.source != 'whatsapp')
            AND s.customer_id IS NOT NULL
        )                                                                        AS graduated,
        COUNT(*) FILTER (
          WHERE f.is_manual AND s.customer_id IS NOT NULL
        )                                                                        AS manual_first_with_repeat
      FROM first_orders f
      LEFT JOIN second_orders s ON s.customer_id = f.customer_id
    `)
    const row = r.rows[0] || { manual_first: 0, graduated: 0, manual_first_with_repeat: 0 }
    const manual_first = Number(row.manual_first)
    const graduated = Number(row.graduated)
    const manual_first_with_repeat = Number(row.manual_first_with_repeat)

    res.json({
      manual_first,
      graduated,
      manual_first_with_repeat,
      // % of all manual-first customers that came back online
      rate: manual_first > 0 ? Math.round((graduated / manual_first) * 1000) / 10 : 0,
      // % of REPEATERS specifically that graduated (excludes one-and-done)
      rate_among_repeaters:
        manual_first_with_repeat > 0
          ? Math.round((graduated / manual_first_with_repeat) * 1000) / 10
          : 0,
    })
  } catch (e: any) {
    console.error("[reports/graduation-rate]", e)
    res.status(500).json({ error: e.message })
  }
}
