import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Pool } from "pg"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const todayOnly = req.query.today === "1"

  const dateFilter = todayOnly
    ? `AND o.created_at >= CURRENT_DATE`
    : ""

  const { rows } = await pool.query(`
    SELECT
      o.id,
      o.display_id,
      o.status,
      o.created_at,
      o.metadata,
      sa.first_name,
      sa.last_name,
      sa.phone,
      sa.address_1,
      sa.city,
      sa.province,
      COALESCE((os.totals->>'original_order_total')::numeric, 0) AS total,
      o.currency_code,
      -- payment status
      CASE
        WHEN p.captured_at IS NOT NULL THEN 'captured'
        WHEN p.id IS NOT NULL THEN 'authorized'
        ELSE 'pending'
      END AS payment_status,
      p.captured_at,
      -- fulfillment status
      CASE
        WHEN f.delivered_at IS NOT NULL THEN 'delivered'
        WHEN f.shipped_at IS NOT NULL THEN 'shipped'
        WHEN f.id IS NOT NULL THEN 'fulfilled'
        ELSE 'unfulfilled'
      END AS fulfillment_status,
      f.shipped_at,
      f.delivered_at,
      sl.name AS warehouse_name,
      -- item count
      (SELECT COUNT(*)::int FROM order_item oi
       WHERE oi.order_id = o.id
         AND oi.version = (SELECT MAX(version) FROM order_item WHERE order_id = o.id)
      ) AS item_count,
      -- item names
      (SELECT string_agg(li.title, ', ' ORDER BY li.created_at)
       FROM order_item oi
       JOIN order_line_item li ON li.id = oi.item_id
       WHERE oi.order_id = o.id
         AND oi.version = (SELECT MAX(version) FROM order_item WHERE order_id = o.id)
      ) AS item_names
    FROM "order" o
    LEFT JOIN order_address sa ON sa.id = o.shipping_address_id
    LEFT JOIN LATERAL (
      SELECT totals FROM order_summary WHERE order_id = o.id ORDER BY created_at DESC LIMIT 1
    ) os ON true
    LEFT JOIN order_payment_collection opc ON opc.order_id = o.id AND opc.deleted_at IS NULL
    LEFT JOIN payment p ON p.payment_collection_id = opc.payment_collection_id AND p.deleted_at IS NULL
    LEFT JOIN order_fulfillment of2 ON of2.order_id = o.id AND of2.deleted_at IS NULL
    LEFT JOIN fulfillment f ON f.id = of2.fulfillment_id AND f.canceled_at IS NULL AND f.deleted_at IS NULL
    LEFT JOIN stock_location sl ON sl.id = f.location_id
    WHERE o.canceled_at IS NULL
      AND o.deleted_at IS NULL
      AND o.is_draft_order = false
      ${dateFilter}
    ORDER BY o.created_at DESC
    LIMIT 50
  `)

  return res.json({ orders: rows })
}
