/**
 * Job: Restock predictive reminder — Batch 4 / F1.3
 *
 * Detecta cuando un consumible específico se debe estar acabando según
 * `product_consumption_estimate.days_to_restock`, y manda un recordatorio
 * concreto de reposición.
 *
 * Cron: diario a las 14:30 Caracas (18:30 UTC).
 *
 * Logic:
 *   Para cada (customer × product consumible):
 *     - Última compra del producto = MAX(o.created_at) where item.product_id = X
 *     - Si today está en [last + days_to_restock - 3, last + days_to_restock + 3]
 *     - AND no hay restock_reminder enviado para ese par en últimos 14 días
 *     → enviar mensaje
 *
 * Mensaje fijo (no LLM), personalizado con nombre + producto.
 */

import { Pool } from "pg"
import { logFunnelEvent, isProactiveThrottled } from "../lib/whatsapp-db"
import { sendWhatsApp } from "../lib/whatsapp-sender"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

function isWithinSendingHours(): boolean {
  const caracasHour = (new Date().getUTCHours() - 4 + 24) % 24
  return caracasHour >= 9 && caracasHour < 21
}

export default async function whatsappRestockReminder() {
  if (!isWithinSendingHours()) return

  try {
    const r = await pool.query(
      `WITH last_purchase AS (
         SELECT
           o.customer_id,
           pv.product_id,
           MAX(o.created_at) AS last_at
         FROM "order" o
         JOIN order_item oi ON oi.order_id = o.id AND oi.deleted_at IS NULL
         JOIN order_line_item li ON li.id = oi.item_id
         JOIN product_variant pv ON pv.id = li.variant_id
         JOIN product_consumption_estimate pce ON pce.product_id = pv.product_id
         WHERE pce.is_consumable = true
           AND o.status = 'completed'
           AND o.customer_id IS NOT NULL
         GROUP BY o.customer_id, pv.product_id
       ),
       eligible AS (
         SELECT
           lp.customer_id,
           lp.product_id,
           lp.last_at,
           pce.days_to_restock,
           p.title AS product_title,
           c.first_name,
           c.phone,
           (SELECT sa.phone FROM "order" o
            LEFT JOIN order_address sa ON sa.id = o.shipping_address_id
            WHERE o.customer_id = lp.customer_id AND sa.phone IS NOT NULL
            ORDER BY o.created_at DESC LIMIT 1) AS shipping_phone
         FROM last_purchase lp
         JOIN product_consumption_estimate pce ON pce.product_id = lp.product_id
         JOIN product p ON p.id = lp.product_id
         JOIN customer c ON c.id = lp.customer_id
         WHERE NOW() >= lp.last_at + (pce.days_to_restock - 3) * INTERVAL '1 day'
           AND NOW() <= lp.last_at + (pce.days_to_restock + 3) * INTERVAL '1 day'
           AND NOT EXISTS (
             SELECT 1 FROM wa_restock_reminders rr
             WHERE rr.customer_id = lp.customer_id
               AND rr.product_id = lp.product_id
               AND rr.sent_at > NOW() - INTERVAL '14 days'
           )
       )
       SELECT * FROM eligible WHERE COALESCE(phone, shipping_phone) IS NOT NULL`
    )

    if (r.rows.length === 0) return
    console.log(`[wa-restock] ${r.rows.length} reminders to send`)

    for (const row of r.rows) {
      const rawPhone = row.phone || row.shipping_phone
      const cleanPhone = String(rawPhone).replace(/[\s+\-()]/g, "")
      if (cleanPhone.length < 8) continue

      // B7.2 anti-spam throttle
      if (await isProactiveThrottled(cleanPhone)) {
        await logFunnelEvent(cleanPhone, "antispam_throttled", { from_job: "restock", product_id: row.product_id })
        console.log(`[wa-restock] Throttled ${cleanPhone}`)
        continue
      }

      const name = row.first_name || "amigui"
      const product = row.product_title

      const message = `Holiis ${name} 🌸 Ya casi se te acaban los ${product} del último pedido.
¿Te dejo listo el siguiente? 💁‍♀️`

      const sent = await sendWhatsApp(cleanPhone, message)
      if (!sent) {
        console.error(`[wa-restock] Send failed for ${cleanPhone}`)
        continue
      }

      await pool.query(
        `INSERT INTO wa_restock_reminders (customer_id, product_id, phone) VALUES ($1, $2, $3)`,
        [row.customer_id, row.product_id, cleanPhone]
      )

      await pool.query(
        `INSERT INTO wa_messages (phone, role, content) VALUES ($1, 'assistant', $2)`,
        [cleanPhone, message]
      )

      await logFunnelEvent(cleanPhone, "restock_reminder_sent", {
        product_id: row.product_id,
        product: product,
        days_since_last: Math.floor((Date.now() - new Date(row.last_at).getTime()) / 86400000),
      })

      console.log(`[wa-restock] ✅ Sent to ${name} (${cleanPhone}) for ${product}`)
    }
  } catch (err) {
    console.error("[wa-restock] Error:", err)
  }
}

export const config = {
  name: "whatsapp-restock-reminder",
  schedule: "30 18 * * *", // 18:30 UTC = 14:30 Caracas
}
