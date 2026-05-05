/**
 * Abandoned Cart Job — runs every 2 hours
 * Finds carts not converted to orders after 2h, sends recovery email once per 48h
 */

import { MedusaContainer } from "@medusajs/framework"
import { sendEmail, abandonedCartEmailHtml } from "../lib/email-service"
import { logEmail, wasRecentlySent, getSetting, alreadyNotified, resolveCustomerCedula } from "../lib/remarketing-db"
import { abandonedCartWhatsAppText } from "../lib/whatsapp-templates"
import { findCustomerPhone, isWhatsAppEnabledFor, sendRemarketingWhatsApp } from "../lib/remarketing-wa"
import { wrapJob } from "../lib/job-runner"

async function abandonedCartJob(container: MedusaContainer) {
  console.log("[abandoned-cart] Running abandoned cart check…")

  // Check if enabled
  const settings = await getSetting("abandoned_cart")
  if (settings?.enabled === false) {
    console.log("[abandoned-cart] Disabled in settings, skipping")
    return
  }

  const hoursDelay = (settings?.hours_delay as number) || 2

  try {
    // Use Medusa query service to get carts
    const query = container.resolve("query")

    // Get carts updated more than hoursDelay hours ago, no completed_at (not converted to order)
    const cutoff = new Date(Date.now() - hoursDelay * 60 * 60 * 1000).toISOString()
    const recentLimit = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString() // not too old

    const { data: carts } = await query.graph({
      entity: "cart",
      fields: [
        "id",
        "email",
        "updated_at",
        "total",
        "items.*",
        "items.variant.*",
        "items.variant.product.*",
        "customer.*",
      ],
      filters: {
        completed_at: null,
        email: { $ne: null },
        updated_at: { $lte: cutoff, $gte: recentLimit },
      },
    })

    console.log(`[abandoned-cart] Found ${carts.length} abandoned carts`)

    for (const cart of carts) {
      if (!cart.email || !cart.items?.length) continue

      // Cross-channel dedup by email OR cédula
      const cedula = await resolveCustomerCedula(cart.customer?.id || null, cart.email)
      const alreadySent = await alreadyNotified(
        "abandoned_cart",
        { email: cart.email, cedula, referenceId: cart.id },
        48
      )
      if (alreadySent) continue

      const customerName = cart.customer?.first_name
        ? `${cart.customer.first_name} ${cart.customer.last_name || ""}`.trim()
        : cart.email

      const items = cart.items.map((item: any) => ({
        title: item.variant?.product?.title || item.title || "Producto",
        quantity: item.quantity,
        unit_price: item.unit_price,
        thumbnail: item.variant?.product?.thumbnail,
      }))

      const cartTotal = items.reduce((sum: number, i: any) => sum + i.unit_price * i.quantity, 0)
      // Use the cart-handoff endpoint (introduced in PR #34) so the link
      // opens the customer's ACTUAL abandoned cart, not a generic /cart
      // page. Without the handoff, the link previously pointed at /cart
      // which doesn't exist (the storefront uses /carrito) — every
      // recipient hit a 404. Even if we'd fixed the path to /carrito,
      // they'd still land on whatever cart their browser had locally,
      // not the one they actually abandoned.
      //
      // /carrito/handoff?cart_id=... validates the id, writes it to the
      // storefront's localStorage (`ryo_cart_id`), and redirects to
      // /carrito with the real cart loaded. Same endpoint used by the
      // WhatsApp bot's nacional handoff flow.
      const baseUrl = process.env.STORE_URL || "https://enrola.shop"
      const cartUrl = `${baseUrl}/carrito/handoff?cart_id=${encodeURIComponent(cart.id)}`
      const subject = `${customerName.split(" ")[0]}, olvidaste algo en tu carrito 🛒`
      const html = abandonedCartEmailHtml(customerName, items, cartTotal, cartUrl)

      // Preferred channel: WhatsApp if enabled + phone available; email is fallback
      let whatsappSent = false
      if (await isWhatsAppEnabledFor("abandoned_cart")) {
        const phone = await findCustomerPhone(cart.customer?.id || null, cart.email)
        if (phone) {
          whatsappSent = await sendRemarketingWhatsApp(
            "abandoned_cart",
            phone,
            abandonedCartWhatsAppText(customerName, cartTotal, cartUrl),
            cart.id,
            { cart_total: cartTotal, items_count: items.length, cedula }
          )
        }
      }

      const emailEnabled = (settings?.channels as any)?.email !== false
      if (emailEnabled && !whatsappSent) {
        const sent = await sendEmail({ to: cart.email, subject, html })
        if (sent) {
          await logEmail("abandoned_cart", cart.email, cart.id, subject, {
            cart_total: cartTotal,
            items_count: items.length,
            fallback_from_whatsapp: (await isWhatsAppEnabledFor("abandoned_cart")),
            cedula,
          })
        }
      }
    }
  } catch (err) {
    console.error("[abandoned-cart] Error:", err)
  }
}


export default wrapJob("abandoned-cart", abandonedCartJob)

export const config = {
  name: "abandoned-cart-emails",
  schedule: "0 */2 * * *", // every 2 hours
}
