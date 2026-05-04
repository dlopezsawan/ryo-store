/**
 * MRW shipment tracking notifications.
 *
 * Two events the operator can trigger from the order page after the
 * shipment has been dispatched (we already have a Telegram-side flow that
 * uploads the receipt photo and stores the tracking number from its QR):
 *
 *   1) "arrived" — package reached the destination MRW office and is ready
 *      for the customer to pick up. This is the action that adds value:
 *      MRW does not auto-notify, so the customer would otherwise have to
 *      check daily.
 *
 *   2) "delivered" — customer has retrieved the package. Used to mark the
 *      order complete and send a thank-you message.
 *
 * Each event sends a WhatsApp message AND an email in parallel; failures
 * in one channel don't block the other. Returns a per-channel success map
 * so the admin UI can show partial-failure feedback.
 */

import { Pool } from "pg"
import { sendWhatsApp } from "../whatsapp-sender"
import { sendEmail, mrwArrivedEmailHtml, mrwDeliveredEmailHtml } from "../email-service"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

type OrderRow = {
  id: string
  display_id: number
  email: string | null
  metadata: Record<string, unknown> | null
  first_name: string | null
  last_name: string | null
  phone: string | null
}

async function loadOrder(orderId: string): Promise<OrderRow | null> {
  const r = await pool.query(
    `SELECT o.id, o.display_id, o.email, o.metadata,
            sa.first_name, sa.last_name, sa.phone
     FROM "order" o
     LEFT JOIN order_address sa ON sa.id = o.shipping_address_id
     WHERE o.id = $1`,
    [orderId]
  )
  return (r.rows[0] as OrderRow | undefined) ?? null
}

function pickPhone(order: OrderRow): string | null {
  // Customer phone might come from the shipping address OR from a JID we
  // cached in metadata when they previously messaged the WhatsApp bot.
  const meta = order.metadata || {}
  const cachedJid = (meta as Record<string, string>).wa_jid
  if (cachedJid) return cachedJid
  return order.phone || null
}

function fullName(order: OrderRow): string {
  const fn = (order.first_name || "").trim()
  const ln = (order.last_name || "").trim()
  const combined = [fn, ln].filter(Boolean).join(" ")
  return combined || "Cliente"
}

function trackingNumber(order: OrderRow): string | null {
  const meta = (order.metadata || {}) as Record<string, string>
  return meta.mrw_tracking_number || null
}

function destinationAgency(order: OrderRow): string | null {
  const meta = (order.metadata || {}) as Record<string, string>
  return meta.mrw_destination_agency || null
}

export type ChannelOutcome = { whatsapp: boolean; email: boolean }

/**
 * Notify the customer that their MRW package arrived at the destination
 * office and is ready to pick up. Idempotent at the metadata level: callers
 * should set `mrw_arrived_notified_at` after a successful call to avoid
 * double-sending if the operator clicks the button twice.
 */
export async function notifyMrwArrived(orderId: string): Promise<ChannelOutcome> {
  const order = await loadOrder(orderId)
  if (!order) {
    console.warn(`[mrw-notif] arrived: order ${orderId} not found`)
    return { whatsapp: false, email: false }
  }

  const name = fullName(order)
  const firstName = name.split(" ")[0]
  const tracking = trackingNumber(order)
  const agency = destinationAgency(order)
  const phone = pickPhone(order)
  const email = order.email
  const orderNumber = String(order.display_id)

  const trackingLine = tracking ? `🎫 *Guía:* ${tracking}\n` : ""
  const agencyLine = agency ? `📍 *Agencia:* ${agency}\n` : ""
  const waText =
    `📦 *¡Tu pedido ya está en MRW!*\n\n` +
    `Hola ${firstName} 👋\n\n` +
    `Tu encomienda *#${orderNumber}* ya llegó a la oficina MRW y está lista para que la retires.\n\n` +
    agencyLine +
    trackingLine +
    `\nPodés pasar a buscarla con tu cédula. MRW guarda los paquetes hasta 15 días.\n\n` +
    `¡Gracias por comprar en RYO! 🌿`

  const [waOk, emailOk] = await Promise.all([
    phone
      ? sendWhatsApp(phone, waText).then((r) => !!r).catch((e) => {
          console.error("[mrw-notif] arrived whatsapp failed:", (e as Error).message)
          return false
        })
      : Promise.resolve(false),
    email
      ? sendEmail({
          to: email,
          subject: `📦 Tu pedido #${orderNumber} llegó a MRW — listo para retirar`,
          html: mrwArrivedEmailHtml(name, orderNumber, tracking, agency),
        }).catch((e) => {
          console.error("[mrw-notif] arrived email failed:", (e as Error).message)
          return false
        })
      : Promise.resolve(false),
  ])

  return { whatsapp: !!waOk, email: !!emailOk }
}

/**
 * Notify customer that we confirmed delivery. This is the closing message —
 * thank-you + light invitation to come back.
 */
export async function notifyMrwDelivered(orderId: string): Promise<ChannelOutcome> {
  const order = await loadOrder(orderId)
  if (!order) {
    console.warn(`[mrw-notif] delivered: order ${orderId} not found`)
    return { whatsapp: false, email: false }
  }

  const name = fullName(order)
  const firstName = name.split(" ")[0]
  const phone = pickPhone(order)
  const email = order.email
  const orderNumber = String(order.display_id)

  const waText =
    `✅ *¡Gracias por elegirnos, ${firstName}!*\n\n` +
    `Confirmamos que retiraste tu pedido *#${orderNumber}*. Esperamos que lo disfrutes.\n\n` +
    `Para tu próxima compra, podés volver directo desde la web:\n` +
    `🔗 enrola.shop\n\n` +
    `Si te gustó la experiencia, contanos por acá — leemos cada mensaje 🌿`

  const [waOk, emailOk] = await Promise.all([
    phone
      ? sendWhatsApp(phone, waText).then((r) => !!r).catch((e) => {
          console.error("[mrw-notif] delivered whatsapp failed:", (e as Error).message)
          return false
        })
      : Promise.resolve(false),
    email
      ? sendEmail({
          to: email,
          subject: `Pedido #${orderNumber} entregado — ¡gracias por tu compra!`,
          html: mrwDeliveredEmailHtml(name, orderNumber),
        }).catch((e) => {
          console.error("[mrw-notif] delivered email failed:", (e as Error).message)
          return false
        })
      : Promise.resolve(false),
  ])

  return { whatsapp: !!waOk, email: !!emailOk }
}
