/**
 * Welcome Email Subscriber
 * Fires when a new customer account is created
 */

import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { sendEmail, welcomeEmailHtml } from "../lib/email-service"
import { logEmail, getSetting, alreadyNotified, resolveCustomerCedula } from "../lib/remarketing-db"
import { welcomeWhatsAppText } from "../lib/whatsapp-templates"
import { findCustomerPhone, isWhatsAppEnabledFor, sendRemarketingWhatsApp } from "../lib/remarketing-wa"

export default async function welcomeEmailHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const settings = await getSetting("welcome")
  if (settings?.enabled === false) return

  try {
    const query = container.resolve("query")
    const { data: customers } = await query.graph({
      entity: "customer",
      fields: ["id", "email", "first_name", "last_name"],
      filters: { id: data.id },
    })

    const customer = customers[0]
    if (!customer?.email) return

    const customerName = customer.first_name
      ? `${customer.first_name} ${customer.last_name || ""}`.trim()
      : customer.email

    const subject = `¡Bienvenido/a al Club Enrola! 🎉`
    const html = welcomeEmailHtml(customerName)

    // Dedup by cédula in case user created a second account with a new email
    const cedula = await resolveCustomerCedula(customer.id, customer.email)
    const alreadyWelcomed = await alreadyNotified(
      "welcome",
      { email: customer.email, cedula },
      365 * 24
    )
    if (alreadyWelcomed) return

    // WhatsApp primary, email fallback
    let whatsappSent = false
    if (await isWhatsAppEnabledFor("welcome")) {
      const phone = await findCustomerPhone(customer.id, customer.email)
      if (phone) {
        whatsappSent = await sendRemarketingWhatsApp(
          "welcome",
          phone,
          welcomeWhatsAppText(customerName),
          customer.id,
          { customer_name: customerName, cedula }
        )
      }
    }

    const emailEnabled = (settings?.channels as any)?.email !== false
    if (emailEnabled && !whatsappSent) {
      const sent = await sendEmail({ to: customer.email, subject, html })
      if (sent) {
        await logEmail("welcome", customer.email, customer.id, subject, {
          customer_name: customerName,
          cedula,
        })
      }
    }
  } catch (err) {
    console.error("[welcome-email] Error:", err)
  }
}

export const config: SubscriberConfig = {
  event: "customer.created",
}
