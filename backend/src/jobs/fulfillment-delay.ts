/**
 * Fulfillment Delay Apology — runs every 2 hours.
 *
 * Detects orders placed 24h+ ago that are still pending / un-fulfilled and
 * sends a proactive WhatsApp/email apology. Reduces churn and refund requests
 * driven by frustration over delays.
 *
 * One message per order — uses `remarketing_log` with type='fulfillment_delay'
 * (added to RemarketingType) for dedup.
 */

import { MedusaContainer } from "@medusajs/framework"
import { Pool } from "pg"
import { sendEmail } from "../lib/email-service"
import { findCustomerPhone, sendRemarketingWhatsApp } from "../lib/remarketing-wa"
import { logEmail, alreadyNotified, resolveCustomerCedula } from "../lib/remarketing-db"
import { wrapJob } from "../lib/job-runner"

async function fulfillmentDelayJob(_container: MedusaContainer) {
  console.log("[fulfillment-delay] Running…")

  const pool = new Pool({ connectionString: process.env.DATABASE_URL })

  try {
    // Orders created 24-72h ago (don't reach back too far) that are NOT fulfilled.
    // Medusa v2 stores fulfillment status on the order_fulfillment table; we proxy
    // by counting deliveries/shipments via `order_fulfillment` join.
    const r = await pool.query(`
      SELECT o.id, o.display_id, o.email, o.customer_id, o.created_at,
             c.first_name, c.phone
      FROM "order" o
      LEFT JOIN customer c ON c.id = o.customer_id
      WHERE o.is_draft_order = false
        AND o.deleted_at IS NULL
        AND o.email IS NOT NULL
        AND o.created_at > NOW() - INTERVAL '72 hours'
        AND o.created_at < NOW() - INTERVAL '24 hours'
        AND NOT EXISTS (
          SELECT 1 FROM order_fulfillment of
          JOIN fulfillment f ON f.id = of.fulfillment_id
          WHERE of.order_id = o.id
            AND f.shipped_at IS NOT NULL
        )
      LIMIT 50
    `)
    console.log(`[fulfillment-delay] Found ${r.rows.length} delayed orders`)

    for (const order of r.rows) {
      const cedula = await resolveCustomerCedula(order.customer_id, order.email)
      const already = await alreadyNotified(
        "fulfillment_delay" as any,
        { email: order.email, cedula, referenceId: order.id, customerId: order.customer_id },
        24 * 7   // once per week per order
      )
      if (already) continue

      const firstName = order.first_name || order.email.split("@")[0]
      const subject = `${firstName}, tu orden #${order.display_id} se demoró un poco — actualizamos pronto`
      const body = `<p>Hola ${firstName},</p>
<p>Vi que tu orden <strong>#${order.display_id}</strong> aún no ha salido y queríamos avisarte directamente.</p>
<p>Te confirmamos despacho dentro de las próximas 24h. Si necesitas adelantarlo o tienes cualquier duda, respondele a este email o escríbenos por WhatsApp.</p>
<p>— Equipo enrola</p>`

      // Prefer WhatsApp if phone available
      let sent = false
      const phone = order.phone || (await findCustomerPhone(order.customer_id, order.email))
      if (phone) {
        const waText = `Hola ${firstName} 👋 Tu orden #${order.display_id} se demoró un poco. Te confirmamos despacho dentro de las próximas 24h. Si necesitas adelantarlo, respóndeme aquí.`
        sent = await sendRemarketingWhatsApp(
          "fulfillment_delay" as any,
          phone,
          waText,
          order.id,
          { display_id: order.display_id, cedula }
        )
      }
      if (!sent) {
        sent = await sendEmail({ to: order.email, subject, html: body })
      }
      if (sent) {
        await logEmail(
          "fulfillment_delay" as any,
          order.email,
          order.id,
          subject,
          { display_id: order.display_id, cedula, channel: phone && sent ? "whatsapp" : "email" }
        )
      }
    }
  } catch (err) {
    console.error("[fulfillment-delay] Error:", err)
  } finally {
    await pool.end()
  }
}

export default wrapJob("fulfillment-delay", fulfillmentDelayJob)

export const config = {
  name: "fulfillment-delay-apology",
  schedule: "0 */2 * * *", // every 2 hours
}
