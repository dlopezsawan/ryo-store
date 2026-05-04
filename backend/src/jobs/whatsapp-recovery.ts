/**
 * Job: Recovery silent — Batch 4 / F1.1
 *
 * Detecta carritos abandonados con datos completos pero sin comprobante,
 * y manda UN SOLO nudge no insistente a los 30 min de inactividad.
 *
 * Cron: cada 10 minutos.
 *
 * Trigger conditions (todas true):
 *   - order_data NO es NULL
 *   - order_data.items es array no vacío
 *   - order_data.address_1 está seteado
 *   - order_data.payment_proof_received != true
 *   - order_data.recovery_sent_at NO existe (no se mandó antes)
 *   - last_message_at < NOW() - 30 minutes
 *   - session_status = 'bot_active' (no interrumpir si humano tomó)
 *   - delivery_zone != 'nacional' (no recovery para casos redirigidos a web)
 *
 * Mensaje fijo (no LLM):
 *   "Holiis, te tengo el pedido guardado por si quieres terminarlo 🌸
 *    Si te quedó alguna duda, escríbeme."
 *
 * Tras enviar:
 *   - Marca order_data.recovery_sent_at con timestamp ISO
 *   - Logea funnel event 'recovery_sent' + 'cart_abandoned'
 *
 * El evento `recovery_responded` se logea en el webhook cuando el cliente
 * responde dentro de 24 h (ver webhooks/whatsapp/route.ts).
 */

import { Pool } from "pg"
import { logFunnelEvent, isProactiveThrottled } from "../lib/whatsapp-db"
import { sendWhatsApp } from "../lib/whatsapp-sender"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

const RECOVERY_MESSAGE = `Holiis, te tengo el pedido guardado por si quieres terminarlo 🌸
Si te quedó alguna duda, escríbeme.`

// Time window: send recovery only between 9am and 9pm Caracas time (UTC-4)
function isWithinSendingHours(): boolean {
  const caracasHour = (new Date().getUTCHours() - 4 + 24) % 24
  return caracasHour >= 9 && caracasHour < 21
}

export default async function whatsappRecovery() {
  if (!isWithinSendingHours()) {
    return // silent skip — no log spam outside hours
  }

  try {
    // Find candidates
    const candidates = await pool.query(
      `SELECT phone
       FROM wa_conversations
       WHERE channel = 'whatsapp'
         AND session_status = 'bot_active'
         AND order_data IS NOT NULL
         AND jsonb_array_length(COALESCE(order_data->'items', '[]'::jsonb)) > 0
         AND order_data->>'address_1' IS NOT NULL AND order_data->>'address_1' <> ''
         AND COALESCE((order_data->>'payment_proof_received')::boolean, false) = false
         AND order_data->>'recovery_sent_at' IS NULL
         AND COALESCE(order_data->>'delivery_zone', 'unknown') <> 'nacional'
         AND last_message_at < NOW() - INTERVAL '30 minutes'
         AND last_message_at > NOW() - INTERVAL '24 hours'`
    )

    if (candidates.rows.length === 0) return

    console.log(`[wa-recovery] Found ${candidates.rows.length} carts to nudge`)

    for (const row of candidates.rows) {
      const phone = row.phone as string

      // B7.2 anti-spam throttle
      if (await isProactiveThrottled(phone)) {
        await logFunnelEvent(phone, "antispam_throttled", { from_job: "recovery" })
        console.log(`[wa-recovery] Throttled ${phone} (>${2} proactive in 7d)`)
        continue
      }

      // Get JID for reliable delivery
      const jidR = await pool.query("SELECT value FROM wa_bot_config WHERE key = $1", [`jid_${phone}`])
      const sendTo = jidR.rows[0]?.value || phone

      const sent = await sendWhatsApp(sendTo, RECOVERY_MESSAGE)
      if (!sent) {
        console.error(`[wa-recovery] Send failed for ${phone}, skipping mark`)
        continue
      }

      // Mark as sent (idempotency)
      await pool.query(
        `UPDATE wa_conversations
         SET order_data = jsonb_set(order_data, '{recovery_sent_at}', to_jsonb(NOW()::text))
         WHERE phone = $1`,
        [phone]
      )

      // Save the bot's outgoing message in history so the LLM sees it on next turn
      await pool.query(
        `INSERT INTO wa_messages (phone, role, content) VALUES ($1, 'assistant', $2)`,
        [phone, RECOVERY_MESSAGE]
      )

      // Funnel events
      await logFunnelEvent(phone, "cart_abandoned", { recovered_at: new Date().toISOString() })
      await logFunnelEvent(phone, "recovery_sent", {})

      console.log(`[wa-recovery] ✅ Nudge sent to ${phone}`)
    }
  } catch (err) {
    console.error("[wa-recovery] Error:", err)
  }
}

export const config = {
  name: "whatsapp-recovery",
  schedule: "*/10 * * * *", // every 10 minutes
}
