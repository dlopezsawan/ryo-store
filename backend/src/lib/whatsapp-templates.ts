/**
 * WhatsApp message templates for remarketing campaigns.
 * Short, conversational — matches the bot's existing tone.
 * Each template returns plain text (with emoji), no HTML.
 */

import { withUtm } from "./email-service"

const STORE_URL = process.env.STORE_URL || "https://enrola.shop"

function firstName(fullName: string): string {
  return fullName.split(" ")[0] || "Amigo/a"
}

export function welcomeWhatsAppText(customerName: string): string {
  return (
    `👋 ¡Hola ${firstName(customerName)}, bienvenido/a al Club Enrola!\n\n` +
    `Nos alegra tenerte aquí. Explorá nuestra selección artesanal cuando quieras:\n` +
    withUtm(STORE_URL, "welcome", "whatsapp") +
    `\n\nCualquier duda, respondé este mensaje 🤝`
  )
}

export function abandonedCartWhatsAppText(
  customerName: string,
  cartTotal: number,
  cartUrl: string
): string {
  return (
    `🛒 Ey ${firstName(customerName)}, dejaste algo en tu carrito.\n\n` +
    `Total: €${cartTotal.toFixed(2)}\n\n` +
    `Completá tu pedido antes de que se agoten:\n` +
    withUtm(cartUrl, "abandoned_cart", "whatsapp")
  )
}

export function birthdayWhatsAppText(
  customerName: string,
  discountCode: string,
  discountPercent: number
): string {
  return (
    `🎂 ¡Feliz cumple, ${firstName(customerName)}!\n\n` +
    `Tu regalo: *${discountCode}* — ${discountPercent}% de descuento válido 48h.\n\n` +
    withUtm(STORE_URL, "birthday", "whatsapp")
  )
}

export function winBackWhatsAppText(
  customerName: string,
  discountCode: string,
  discountPercent: number,
  daysSincePurchase: number
): string {
  const months = Math.round(daysSincePurchase / 30)
  const timeText = months >= 2 ? `hace ${months} meses` : `hace más de un mes`
  return (
    `💝 ${firstName(customerName)}, te echamos de menos.\n\n` +
    `Tu última compra fue ${timeText}. Como recordatorio, tenemos un descuento exclusivo para ti:\n\n` +
    `*${discountCode}* — ${discountPercent}% off · 7 días\n\n` +
    withUtm(STORE_URL, "win_back", "whatsapp")
  )
}

export function restockWhatsAppText(
  customerName: string,
  productTitle: string,
  productUrl: string
): string {
  return (
    `🔁 ${firstName(customerName)}, ¿ya se te acabó el *${productTitle}*?\n\n` +
    `Tenemos stock disponible. Repone el tuyo:\n` +
    withUtm(productUrl, "restock", "whatsapp")
  )
}

export function stockoutAlertWhatsAppText(
  customerName: string,
  productTitle: string,
  productUrl: string,
  daysOfCover: number
): string {
  const urgency = daysOfCover < 3 ? "se agota en pocos días" : `quedan ~${daysOfCover} días de stock`
  return (
    `⚠ Hola ${firstName(customerName)}, tu *${productTitle}* ${urgency}.\n\n` +
    `Como ya lo pediste antes, te aviso para que repongas antes de que se acabe:\n` +
    withUtm(productUrl, "stockout_alert", "whatsapp") +
    `\n\nNo te volvemos a avisar de este producto en 30 días.`
  )
}

export function pendingPaymentWhatsAppText(
  customerName: string,
  orderNumber: string,
  total: number,
  hoursAgo: number
): string {
  return (
    `⏳ Hola ${firstName(customerName)}, tu pedido #${orderNumber} sigue pendiente de pago (hace ${Math.round(hoursAgo)}h).\n\n` +
    `Total: €${total.toFixed(2)}\n\n` +
    `Si ya transferiste, mandá el comprobante por acá y lo procesamos enseguida. ` +
    `Si tuviste algún problema, respondé este mensaje y te ayudamos 🤝`
  )
}

export function graduationWhatsAppText(
  customerName: string,
  discountCode: string,
  discountPercent: number
): string {
  return (
    `🎓 ¡${firstName(customerName)}, tu próximo pedido en la web tiene descuento!\n\n` +
    `*${discountCode}* — ${discountPercent}% off · 14 días · Solo en enrola.shop\n\n` +
    `Pedí más rápido y sin esperas acá:\n` +
    withUtm(STORE_URL, "graduation", "whatsapp")
  )
}

export function postPurchaseWhatsAppText(
  customerName: string,
  orderNumber: string
): string {
  return (
    `📦 ${firstName(customerName)}, ¿cómo te fue con el pedido #${orderNumber}?\n\n` +
    `Queremos asegurarnos de que todo llegó bien. Si tenés alguna duda, respondé este mensaje y te ayudamos.\n\n` +
    `Ver detalles: ` +
    withUtm(STORE_URL + "/account/orders", "post_purchase", "whatsapp")
  )
}
