import { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { Pool } from "pg"
import {
  sendEmail,
  orderShippedEmailHtml,
  orderDeliveredEmailHtml,
} from "../lib/email-service"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

/**
 * Look up the order linked to a fulfillment and return order + customer info.
 */
async function getOrderForFulfillment(fulfillmentId: string) {
  const result = await pool.query(
    `
    SELECT o.id, o.display_id, o.email, c.first_name, c.last_name, c.email AS customer_email
    FROM fulfillment f
    JOIN order_fulfillment of2 ON of2.fulfillment_id = f.id
    JOIN "order" o ON o.id = of2.order_id
    LEFT JOIN customer c ON c.id = o.customer_id
    WHERE f.id = $1
    LIMIT 1
    `,
    [fulfillmentId]
  )
  return result.rows[0] ?? null
}

/**
 * Single handler for shipment + delivery events.
 * Medusa v2 emits:
 *   shipment.created  → when "Mark as shipped" is clicked
 *   delivery.created  → when "Mark as delivered" is clicked
 */
export default async function fulfillmentNotificationHandler({
  event,
}: SubscriberArgs<{ id: string; fulfillment_id?: string }>) {
  const eventName = (event as unknown as { name: string }).name
  const data = event.data
  try {
    const fulId = data.fulfillment_id || data.id
    const order = await getOrderForFulfillment(fulId)
    if (!order) {
      console.warn("[fulfillment-notify] No order for fulfillment", fulId)
      return
    }

    const email = order.customer_email || order.email
    if (!email) return

    const name = [order.first_name, order.last_name].filter(Boolean).join(" ") || "Cliente"
    const orderNum = String(order.display_id)

    if (eventName === "shipment.created") {
      const html = orderShippedEmailHtml(name, orderNum)
      const sent = await sendEmail({
        to: email,
        subject: `📦 Pedido #${orderNum} enviado — Club Enrola`,
        html,
      })
      if (sent) console.log(`[fulfillment-notify] ✅ Shipped email → ${email} #${orderNum}`)
    } else if (eventName === "delivery.created") {
      const html = orderDeliveredEmailHtml(name, orderNum)
      const sent = await sendEmail({
        to: email,
        subject: `✅ Pedido #${orderNum} entregado — Club Enrola`,
        html,
      })
      if (sent) console.log(`[fulfillment-notify] ✅ Delivered email → ${email} #${orderNum}`)
    } else {
      console.log(`[fulfillment-notify] Order #${orderNum} fulfillment created (preparing)`)
    }
  } catch (err) {
    console.error("[fulfillment-notify] Error:", err)
  }
}

export const config: SubscriberConfig = {
  event: ["shipment.created", "delivery.created"],
}
