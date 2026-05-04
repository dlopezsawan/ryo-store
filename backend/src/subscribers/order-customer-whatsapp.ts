/**
 * Subscriber: Send WhatsApp status updates to the CUSTOMER.
 * Events:
 *   order.placed        → "Tu pedido ha sido recibido"
 *   order.completed      → "Tu pago ha sido verificado"
 *   shipment.created     → "Tu pedido va en camino"
 */

import { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { Pool } from "pg"
import { sendWhatsApp } from "../lib/whatsapp-sender"
import { logFunnelEvent } from "../lib/whatsapp-db"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const STORE_URL = process.env.STORE_URL || "https://enrola.shop"

/** Get customer phone + name + order info */
async function getOrderCustomerInfo(orderId: string) {
  const r = await pool.query(
    `SELECT o.display_id, o.email,
            c.phone AS customer_phone, c.first_name, c.last_name,
            sa.phone AS shipping_phone
     FROM "order" o
     LEFT JOIN customer c ON c.id = o.customer_id
     LEFT JOIN order_address sa ON sa.id = o.shipping_address_id
     WHERE o.id = $1`,
    [orderId]
  )
  const row = r.rows[0]
  if (!row) return null

  const phone = row.customer_phone || row.shipping_phone
  if (!phone) return null

  // Clean phone: remove +, spaces, dashes
  const cleanPhone = phone.replace(/[\s+\-()]/g, "")
  if (cleanPhone.length < 8) return null

  return {
    phone: cleanPhone,
    name: row.first_name || "Cliente",
    orderNumber: String(row.display_id),
  }
}

/**
 * F6.2 — Introducir el código de referido del cliente UNA SOLA VEZ tras su primera
 * compra completada. Idempotente vía customer.metadata.wa_referral_introduced.
 * Si el storefront aún no genera códigos para todos los clientes,
 * el query devolverá 0 rows y se salta sin error.
 */
async function maybeIntroReferral(orderId: string, phone: string, name: string): Promise<void> {
  const r = await pool.query(
    `SELECT o.customer_id,
            (SELECT COUNT(*) FROM "order" WHERE customer_id = o.customer_id AND status = 'completed') AS total_completed,
            COALESCE((c.metadata->>'wa_referral_introduced')::boolean, false) AS already_introduced,
            (SELECT code FROM loyalty_referral_code lrc WHERE lrc.customer_id = o.customer_id AND lrc.deleted_at IS NULL LIMIT 1) AS code
     FROM "order" o
     LEFT JOIN customer c ON c.id = o.customer_id
     WHERE o.id = $1`,
    [orderId]
  )
  const row = r.rows[0]
  if (!row || !row.customer_id) return
  if (row.already_introduced) return
  if (parseInt(row.total_completed) !== 1) return // solo en primera compra
  if (!row.code) return // si aún no hay código, skip silencioso

  const link = `https://enrola.shop/?ref=${row.code}`
  const message = `Por cierto ${name} 🌸 tu código de referido es ${row.code}.

Compártelo y los dos ganan puntos cuando tu amigo compra:
🔗 ${link}`

  const sent = await sendWhatsApp(phone, message)
  if (!sent) return

  // Marca idempotencia
  await pool.query(
    `UPDATE customer SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('wa_referral_introduced', true), updated_at = NOW()
     WHERE id = $1`,
    [row.customer_id]
  )
  // Save in WA history so Dana sees it on next turn
  await pool.query(
    `INSERT INTO wa_messages (phone, role, content) VALUES ($1, 'assistant', $2)`,
    [phone, message]
  )
  console.log(`[customer-wa] 🎁 Referral intro sent to ${phone} (code=${row.code})`)
}

/** Get customer phone from a fulfillment ID */
async function getOrderFromFulfillment(fulfillmentId: string) {
  const r = await pool.query(
    `SELECT o.id FROM fulfillment f
     JOIN order_fulfillment of2 ON of2.fulfillment_id = f.id
     JOIN "order" o ON o.id = of2.order_id
     WHERE f.id = $1 LIMIT 1`,
    [fulfillmentId]
  )
  if (!r.rows[0]) return null
  return getOrderCustomerInfo(r.rows[0].id)
}

export default async function orderCustomerWhatsAppHandler({
  event,
}: SubscriberArgs<{ id: string; fulfillment_id?: string }>) {
  const eventName = (event as unknown as { name: string }).name
  const data = event.data

  try {
    let info: Awaited<ReturnType<typeof getOrderCustomerInfo>> = null

    if (eventName === "shipment.created") {
      info = await getOrderFromFulfillment(data.fulfillment_id || data.id)
    } else {
      info = await getOrderCustomerInfo(data.id)
    }

    if (!info) return

    const { phone, name, orderNumber } = info
    let message = ""

    switch (eventName) {
      case "order.placed":
        message = `¡Hola ${name}! 🛒\n\nTu pedido *#${orderNumber}* ha sido recibido correctamente.\n\nEstamos revisando tu pago. Te avisaremos cuando esté verificado.\n\nPuedes ver el estado de tu pedido en:\n${STORE_URL}/cuenta`
        break

      case "order.completed":
        message = `¡${name}, buenas noticias! ✅\n\nEl pago de tu pedido *#${orderNumber}* ha sido verificado.\n\nEstamos preparando tu envío. Te avisaremos cuando salga de nuestro almacén.\n\nSigue tu pedido en:\n${STORE_URL}/cuenta`
        break

      case "shipment.created":
        message = `¡${name}, tu pedido va en camino! 📦\n\nEl pedido *#${orderNumber}* ha salido de nuestro almacén.\n\nTe notificaremos cuando sea entregado.\n\nSigue tu pedido en:\n${STORE_URL}/cuenta`
        break

      default:
        return
    }

    const sent = await sendWhatsApp(phone, message)
    if (sent) {
      console.log(`[customer-wa] ✅ ${eventName} → ${phone} for #${orderNumber}`)
    }

    // Funnel event when order is fully completed (only for orders that originated from WA)
    if (eventName === "order.completed") {
      // Check if order has source=whatsapp metadata
      const meta = await pool.query(
        `SELECT metadata->>'source' as src, metadata->>'whatsapp_phone' as wa_phone FROM "order" WHERE id = $1`,
        [data.id]
      )
      const src = meta.rows[0]?.src
      const waPhone = meta.rows[0]?.wa_phone || phone
      if (src === "whatsapp") {
        await logFunnelEvent(waPhone, "order_completed", { order_id: data.id, order_number: orderNumber })
      }

      // F6.2 — Introducir código de referido en PRIMERA compra completada del cliente
      await maybeIntroReferral(data.id, phone, info.name).catch((err) =>
        console.error("[customer-wa] referral intro failed:", err)
      )
    }
  } catch (err) {
    console.error("[customer-wa] Error:", err)
  }
}

export const config: SubscriberConfig = {
  event: ["order.placed", "order.completed", "shipment.created"],
}
