/**
 * Job: Post-purchase followup — Batch 4 / F1.2
 *
 * Manda mensaje de seguimiento empático + invitación a reposición a clientes que
 * compraron consumibles hace 9-11 días, si no han comprado de nuevo.
 *
 * Cron: diario a las 14:00 Caracas (18:00 UTC).
 *
 * Solo aplica a pedidos que contienen al menos 1 producto consumible
 * (rolling papers, conos, filtros) — clasificación en product_consumption_estimate.
 *
 * Idempotencia: tabla wa_followup_log con UNIQUE(order_id) impide duplicados.
 *
 * Mensaje fijo (no LLM), personalizado con nombre + producto consumible.
 */

import { Pool } from "pg"
import { logFunnelEvent, isProactiveThrottled } from "../lib/whatsapp-db"
import { sendWhatsApp } from "../lib/whatsapp-sender"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

function isWithinSendingHours(): boolean {
  const caracasHour = (new Date().getUTCHours() - 4 + 24) % 24
  return caracasHour >= 9 && caracasHour < 21
}

export default async function whatsappPostPurchaseFollowup() {
  if (!isWithinSendingHours()) return

  try {
    // Pedidos completados hace 9-11 días con al menos 1 consumible
    // que no tengan followup ya enviado, cuyo cliente no haya comprado de nuevo en ese rango
    const r = await pool.query(
      `WITH eligible AS (
         SELECT DISTINCT
           o.id AS order_id,
           o.customer_id,
           o.display_id,
           c.first_name,
           c.last_name,
           COALESCE(c.phone, sa.phone) AS phone,
           (SELECT p.title FROM order_item oi
            JOIN order_line_item li ON li.id = oi.item_id
            JOIN product_variant pv ON pv.id = li.variant_id
            JOIN product p ON p.id = pv.product_id
            JOIN product_consumption_estimate pce ON pce.product_id = p.id
            WHERE oi.order_id = o.id AND pce.is_consumable = true AND oi.deleted_at IS NULL
            LIMIT 1) AS top_consumable_title
         FROM "order" o
         LEFT JOIN customer c ON c.id = o.customer_id
         LEFT JOIN order_address sa ON sa.id = o.shipping_address_id
         WHERE o.status = 'completed'
           AND o.created_at BETWEEN NOW() - INTERVAL '11 days' AND NOW() - INTERVAL '9 days'
           AND EXISTS (
             SELECT 1 FROM order_item oi
             JOIN order_line_item li ON li.id = oi.item_id
             JOIN product_variant pv ON pv.id = li.variant_id
             JOIN product_consumption_estimate pce ON pce.product_id = pv.product_id
             WHERE oi.order_id = o.id AND pce.is_consumable = true AND oi.deleted_at IS NULL
           )
           AND NOT EXISTS (
             SELECT 1 FROM "order" o2
             WHERE o2.customer_id = o.customer_id
               AND o2.created_at > o.created_at
               AND o2.id <> o.id
           )
           AND NOT EXISTS (
             SELECT 1 FROM wa_followup_log fl WHERE fl.order_id = o.id
           )
       )
       SELECT * FROM eligible WHERE phone IS NOT NULL AND phone <> ''`
    )

    if (r.rows.length === 0) return
    console.log(`[wa-followup] ${r.rows.length} customers eligible`)

    for (const row of r.rows) {
      const cleanPhone = String(row.phone).replace(/[\s+\-()]/g, "")
      if (cleanPhone.length < 8) continue

      // B7.2 anti-spam throttle
      if (await isProactiveThrottled(cleanPhone)) {
        await logFunnelEvent(cleanPhone, "antispam_throttled", { from_job: "followup", order_id: row.order_id })
        console.log(`[wa-followup] Throttled ${cleanPhone}`)
        continue
      }

      const name = row.first_name || "amigui" // fallback gentle
      const productTitle = row.top_consumable_title || "tu pedido"

      const message = `Holiis ${name}! 🌸 Hace una semana te llegó tu ${productTitle}.

¿Te quedó bien? Si te toca reponer, te lo dejo listo en un toque ✨`

      const sent = await sendWhatsApp(cleanPhone, message)
      if (!sent) {
        console.error(`[wa-followup] Send failed for ${cleanPhone}`)
        continue
      }

      // Idempotency
      await pool.query(
        `INSERT INTO wa_followup_log (order_id, customer_id, phone) VALUES ($1, $2, $3)
         ON CONFLICT (order_id) DO NOTHING`,
        [row.order_id, row.customer_id, cleanPhone]
      )

      // Save in history so Dana sees it on next turn
      await pool.query(
        `INSERT INTO wa_messages (phone, role, content) VALUES ($1, 'assistant', $2)`,
        [cleanPhone, message]
      )

      await logFunnelEvent(cleanPhone, "followup_sent", {
        order_id: row.order_id,
        display_id: row.display_id,
        product: productTitle,
      })

      console.log(`[wa-followup] ✅ Sent to ${name} (${cleanPhone}) for order #${row.display_id}`)
    }
  } catch (err) {
    console.error("[wa-followup] Error:", err)
  }
}

export const config = {
  name: "whatsapp-post-purchase-followup",
  schedule: "0 18 * * *", // 18:00 UTC = 14:00 Caracas
}
