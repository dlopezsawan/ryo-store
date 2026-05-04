/**
 * Post-Purchase Follow-Up Job — runs daily at 11am
 * Sends a follow-up email 3 days after order is delivered/completed
 */

import { MedusaContainer } from "@medusajs/framework"
import { sendEmail, postPurchaseEmailHtml } from "../lib/email-service"
import { logEmail, wasRecentlySent, getSetting, alreadyNotified, resolveCustomerCedula } from "../lib/remarketing-db"
import { postPurchaseWhatsAppText } from "../lib/whatsapp-templates"
import { findCustomerPhone, isWhatsAppEnabledFor, sendRemarketingWhatsApp } from "../lib/remarketing-wa"
import { wrapJob } from "../lib/job-runner"

async function postPurchaseJob(container: MedusaContainer) {
  console.log("[post-purchase] Running post-purchase check…")

  const settings = await getSetting("post_purchase")
  if (settings?.enabled === false) {
    console.log("[post-purchase] Disabled in settings, skipping")
    return
  }

  const daysAfter = (settings?.days_after as number) || 3

  try {
    const query = container.resolve("query")

    // Orders completed/delivered daysAfter days ago (±12h window)
    const fromDate = new Date(Date.now() - (daysAfter + 0.5) * 24 * 60 * 60 * 1000).toISOString()
    const toDate = new Date(Date.now() - (daysAfter - 0.5) * 24 * 60 * 60 * 1000).toISOString()

    const { data: orders } = await query.graph({
      entity: "order",
      fields: [
        "id",
        "display_id",
        "email",
        "status",
        "updated_at",
        "customer.*",
        "items.*",
        "items.variant.*",
        "items.variant.product.*",
      ],
      filters: {
        status: { $in: ["completed", "delivered"] },
        updated_at: { $gte: fromDate, $lte: toDate },
      },
    })

    console.log(`[post-purchase] Found ${orders.length} orders for follow-up`)

    for (const order of orders) {
      if (!order.email) continue

      const cedula = await resolveCustomerCedula(order.customer?.id || null, order.email)
      const alreadySent = await alreadyNotified(
        "post_purchase",
        { email: order.email, cedula, referenceId: order.id },
        23
      )
      if (alreadySent) continue

      const customerName = order.customer?.first_name
        ? `${order.customer.first_name} ${order.customer.last_name || ""}`.trim()
        : order.email

      const items = (order.items || []).map((item: any) => ({
        title: item.variant?.product?.title || item.title || "Producto",
        quantity: item.quantity,
      }))

      const orderNumber = String(order.display_id || order.id)
      const subject = `¿Cómo fue tu pedido #${orderNumber}? 📦`
      const html = postPurchaseEmailHtml(customerName, orderNumber, items)

      // WhatsApp primary, email fallback
      let whatsappSent = false
      if (await isWhatsAppEnabledFor("post_purchase")) {
        const phone = await findCustomerPhone(order.customer?.id || null, order.email)
        if (phone) {
          whatsappSent = await sendRemarketingWhatsApp(
            "post_purchase",
            phone,
            postPurchaseWhatsAppText(customerName, orderNumber),
            order.id,
            { order_id: order.id, display_id: order.display_id, cedula }
          )
        }
      }

      const emailEnabled = (settings?.channels as any)?.email !== false
      if (emailEnabled && !whatsappSent) {
        const sent = await sendEmail({ to: order.email, subject, html })
        if (sent) {
          await logEmail("post_purchase", order.email, order.id, subject, {
            order_id: order.id,
            display_id: order.display_id,
            cedula,
          })
        }
      }
    }
  } catch (err) {
    console.error("[post-purchase] Error:", err)
  }
}


export default wrapJob("post-purchase", postPurchaseJob)

export const config = {
  name: "post-purchase-emails",
  schedule: "0 11 * * *", // daily at 11am
}
