/**
 * Graduation Job — runs daily at 10am
 * Finds customers whose FIRST order was manual (Telegram /venta) or WhatsApp bot,
 * was placed N days ago, and has no subsequent order. Sends a web-exclusive
 * discount to pull them toward self-service checkout.
 *
 * Source metric: Sinergia D in the analytics proposal — reduces operational load
 * on the WhatsApp/Telegram team and increases LTV via web purchases.
 */

import { MedusaContainer } from "@medusajs/framework"
import { Pool } from "pg"
import { sendEmail, graduationEmailHtml } from "../lib/email-service"
import { logEmail, wasRecentlySent, getSetting, alreadyNotified, resolveCustomerCedula, getCustomerCity, applyGeoOverrides } from "../lib/remarketing-db"
import { graduationWhatsAppText } from "../lib/whatsapp-templates"
import { findCustomerPhone, isWhatsAppEnabledFor, sendRemarketingWhatsApp } from "../lib/remarketing-wa"
import { wrapJob } from "../lib/job-runner"

async function graduationJob(_container: MedusaContainer) {
  console.log("[graduation] Running graduation check…")

  const settings = await getSetting("graduation")
  if (settings?.enabled === false) {
    console.log("[graduation] Disabled in settings, skipping")
    return
  }

  const daysAfter = (settings?.days_after as number) || 3
  const baseDiscountCode = (settings?.discount_code as string) || "WEB20"
  const baseDiscountPercent = (settings?.discount_percent as number) || 20

  try {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL })

    // Candidates: customers whose first order is manual/whatsapp, placed exactly
    // `daysAfter` days ago (1-day window), with no later order.
    const result = await pool.query(
      `WITH first_orders AS (
         SELECT DISTINCT ON (o.customer_id)
           o.customer_id,
           o.id AS order_id,
           o.created_at,
           (o.metadata->>'manual_sale')::boolean AS is_manual,
           o.metadata->>'source' AS source
         FROM "order" o
         WHERE o.is_draft_order = false AND o.deleted_at IS NULL AND o.customer_id IS NOT NULL
         ORDER BY o.customer_id, o.created_at ASC
       ),
       customer_order_counts AS (
         SELECT customer_id, COUNT(*) AS total_orders
         FROM "order"
         WHERE is_draft_order = false AND deleted_at IS NULL AND customer_id IS NOT NULL
         GROUP BY customer_id
       )
       SELECT
         c.id, c.email, c.first_name, c.last_name,
         f.order_id, f.source, f.is_manual, f.created_at AS first_order_at
       FROM first_orders f
       JOIN customer_order_counts coc ON coc.customer_id = f.customer_id
       JOIN customer c ON c.id = f.customer_id
       WHERE (f.is_manual = true OR f.source = 'whatsapp')
         AND coc.total_orders = 1
         AND c.email IS NOT NULL
         AND f.created_at >= NOW() - INTERVAL '1 day' * ($1 + 1)
         AND f.created_at <  NOW() - INTERVAL '1 day' * $1`,
      [daysAfter]
    )
    await pool.end()

    console.log(`[graduation] Found ${result.rows.length} candidates for graduation push`)

    for (const customer of result.rows) {
      if (!customer.email) continue

      // Only once per customer (ever) — graduation is a one-shot nudge.
      // Dedup by email OR cédula to avoid multiple records.
      const cedula = await resolveCustomerCedula(customer.id, customer.email)
      const alreadySent = await alreadyNotified(
        "graduation",
        { email: customer.email, cedula },
        365 * 24
      )
      if (alreadySent) continue

      const city = await getCustomerCity(customer.id, customer.email)
      const eff = applyGeoOverrides(settings || {}, city)
      const discountCode = (eff.discount_code as string) || baseDiscountCode
      const discountPercent = (eff.discount_percent as number) || baseDiscountPercent

      const customerName = `${customer.first_name || ""} ${customer.last_name || ""}`.trim() || customer.email
      const subject = `🎓 ${customerName.split(" ")[0]}, tu descuento exclusivo web`
      const html = graduationEmailHtml(customerName, discountCode, discountPercent)

      // WhatsApp primary, email fallback
      let whatsappSent = false
      if (await isWhatsAppEnabledFor("graduation")) {
        const phone = await findCustomerPhone(customer.id, customer.email)
        if (phone) {
          whatsappSent = await sendRemarketingWhatsApp(
            "graduation",
            phone,
            graduationWhatsAppText(customerName, discountCode, discountPercent),
            customer.id,
            {
              discount_code: discountCode,
              discount_percent: discountPercent,
              first_order_source: customer.source || (customer.is_manual ? "manual" : null),
              cedula,
              city,
              geo_override: !!eff.__geo_override_applied,
            }
          )
        }
      }

      const emailEnabled = (settings?.channels as any)?.email !== false
      if (emailEnabled && !whatsappSent) {
        const sent = await sendEmail({ to: customer.email, subject, html })
        if (sent) {
          await logEmail("graduation", customer.email, customer.id, subject, {
            discount_code: discountCode,
            discount_percent: discountPercent,
            first_order_source: customer.source || (customer.is_manual ? "manual" : null),
            cedula,
            city,
            geo_override: !!eff.__geo_override_applied,
          })
        }
      }
    }
  } catch (err) {
    console.error("[graduation] Error:", err)
  }
}


export default wrapJob("graduation", graduationJob)

export const config = {
  name: "graduation-emails",
  schedule: "0 10 * * *", // daily at 10am
}
