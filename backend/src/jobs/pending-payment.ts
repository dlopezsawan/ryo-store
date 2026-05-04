/**
 * Pending Payment Reminder — runs every hour
 * Finds orders in status=pending that are older than `hours_threshold` hours
 * and haven't had a transaction recorded yet. Nudges the customer (WhatsApp
 * primary, email fallback). Dedupes per-order for 7 days.
 *
 * Source metric: Sinergia E — reduces p90 pending-order aging by catching
 * abandoned/forgotten checkouts and recovering otherwise-lost revenue.
 */

import { MedusaContainer } from "@medusajs/framework"
import { Pool } from "pg"
import { sendEmail, pendingPaymentEmailHtml } from "../lib/email-service"
import { logEmail, wasRecentlySent, getSetting, alreadyNotified, resolveCustomerCedula } from "../lib/remarketing-db"
import { pendingPaymentWhatsAppText } from "../lib/whatsapp-templates"
import { findCustomerPhone, isWhatsAppEnabledFor, sendRemarketingWhatsApp } from "../lib/remarketing-wa"
import { wrapJob } from "../lib/job-runner"

async function pendingPaymentJob(_container: MedusaContainer) {
  console.log("[pending-payment] Running pending payment reminder check…")

  const settings = await getSetting("pending_payment")
  if (settings?.enabled === false) {
    console.log("[pending-payment] Disabled in settings, skipping")
    return
  }

  const hoursThreshold = (settings?.hours_threshold as number) || 4
  const maxAgeHours = (settings?.max_age_hours as number) || 48

  try {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL })

    // Orders placed between (hoursThreshold) and (maxAgeHours) hours ago,
    // status=pending, with NO transactions yet (= no captured payment).
    const result = await pool.query(
      `SELECT
         o.id, o.display_id, o.email, o.customer_id, o.created_at,
         EXTRACT(EPOCH FROM (NOW() - o.created_at)) / 3600 AS hours_ago,
         COALESCE((os.totals->>'original_order_total')::numeric, 0) AS total,
         c.first_name, c.last_name,
         oa.phone AS address_phone
       FROM "order" o
       LEFT JOIN LATERAL (
         SELECT totals FROM order_summary
         WHERE order_id = o.id ORDER BY created_at DESC LIMIT 1
       ) os ON true
       LEFT JOIN customer c ON c.id = o.customer_id
       LEFT JOIN order_address oa ON oa.id = o.shipping_address_id
       WHERE o.is_draft_order = false
         AND o.deleted_at IS NULL
         AND o.status = 'pending'
         AND o.created_at < NOW() - INTERVAL '1 hour' * $1
         AND o.created_at > NOW() - INTERVAL '1 hour' * $2
         AND NOT EXISTS (
           SELECT 1 FROM order_transaction t
           WHERE t.order_id = o.id AND t.deleted_at IS NULL
         )
       ORDER BY o.created_at ASC`,
      [hoursThreshold, maxAgeHours]
    )
    await pool.end()

    console.log(`[pending-payment] Found ${result.rows.length} aged pending orders`)

    for (const order of result.rows) {
      const email = order.email
      if (!email) continue

      // Don't remind the same order twice in 7 days — dedup by email OR cédula
      const cedula = await resolveCustomerCedula(order.customer_id, email)
      const alreadySent = await alreadyNotified(
        "pending_payment",
        { email, cedula, referenceId: order.id },
        24 * 7
      )
      if (alreadySent) continue

      const customerName = [order.first_name, order.last_name].filter(Boolean).join(" ").trim() || email
      const orderNumber = String(order.display_id || order.id)
      const hoursAgo = Math.round(parseFloat(order.hours_ago))
      const total = Number(order.total) || 0
      const subject = `⏳ Pedido #${orderNumber} espera confirmación de pago`

      // WhatsApp primary, email fallback
      let whatsappSent = false
      if (await isWhatsAppEnabledFor("pending_payment")) {
        const phone = await findCustomerPhone(order.customer_id, email) || order.address_phone || null
        if (phone) {
          whatsappSent = await sendRemarketingWhatsApp(
            "pending_payment",
            phone,
            pendingPaymentWhatsAppText(customerName, orderNumber, total, hoursAgo),
            order.id,
            { order_id: order.id, display_id: order.display_id, total, hours_ago: hoursAgo, cedula }
          )
        }
      }

      const emailEnabled = (settings?.channels as any)?.email !== false
      if (emailEnabled && !whatsappSent) {
        const html = pendingPaymentEmailHtml(customerName, orderNumber, total, hoursAgo)
        const sent = await sendEmail({ to: email, subject, html })
        if (sent) {
          await logEmail("pending_payment", email, order.id, subject, {
            order_id: order.id,
            display_id: order.display_id,
            total,
            hours_ago: hoursAgo,
            cedula,
          })
        }
      }
    }
  } catch (err) {
    console.error("[pending-payment] Error:", err)
  }
}


export default wrapJob("pending-payment", pendingPaymentJob)

export const config = {
  name: "pending-payment-reminders",
  schedule: "0 * * * *", // every hour, on the hour
}
