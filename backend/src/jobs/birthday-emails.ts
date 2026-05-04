/**
 * Birthday Emails Job — runs daily at 9am
 * Finds customers whose birthday is today and sends a discount email
 */

import { MedusaContainer } from "@medusajs/framework"
import { Pool } from "pg"
import { sendEmail, birthdayEmailHtml } from "../lib/email-service"
import { logEmail, wasRecentlySent, getSetting, alreadyNotified, resolveCustomerCedula, getCustomerCity, applyGeoOverrides } from "../lib/remarketing-db"
import { birthdayWhatsAppText } from "../lib/whatsapp-templates"
import { findCustomerPhone, isWhatsAppEnabledFor, sendRemarketingWhatsApp } from "../lib/remarketing-wa"
import { wrapJob } from "../lib/job-runner"
import { buildUserContext } from "../lib/remarketing-user-context"
import { computeSignals } from "../lib/remarketing-signals"

async function birthdayEmailsJob(container: MedusaContainer) {
  console.log("[birthday-emails] Running birthday check…")

  const settings = await getSetting("birthday")
  if (settings?.enabled === false) {
    console.log("[birthday-emails] Disabled in settings, skipping")
    return
  }

  const baseDiscountCode = (settings?.discount_code as string) || "CUMPLE15"
  const baseDiscountPercent = (settings?.discount_percent as number) || 15

  try {
    // Query Medusa customers whose birthday (stored in metadata) matches today
    // Customers store birthday in customer.metadata.birthday as "MM-DD" or "YYYY-MM-DD"
    const pool = new Pool({ connectionString: process.env.DATABASE_URL })
    const today = new Date()
    const mm = String(today.getMonth() + 1).padStart(2, "0")
    const dd = String(today.getDate()).padStart(2, "0")

    // Match metadata->>'birthday' ending in MM-DD
    const result = await pool.query(
      `SELECT id, email, first_name, last_name, metadata
       FROM customer
       WHERE metadata->>'birthday' LIKE $1
         AND email IS NOT NULL`,
      [`%-${mm}-${dd}`]
    )
    await pool.end()

    console.log(`[birthday-emails] Found ${result.rows.length} birthdays today`)

    for (const customer of result.rows) {
      if (!customer.email) continue

      const cedula = await resolveCustomerCedula(customer.id, customer.email)
      const alreadySent = await alreadyNotified(
        "birthday",
        { email: customer.email, cedula },
        23
      )
      if (alreadySent) continue

      // Geo overrides: per-city discount/code takes precedence
      const city = await getCustomerCity(customer.id, customer.email)
      const eff = applyGeoOverrides(settings || {}, city)
      let discountCode = (eff.discount_code as string) || baseDiscountCode
      let discountPercent = (eff.discount_percent as number) || baseDiscountPercent

      // ─── Sinergia D3: VIP boost — engine signals upgrade the offer ─────────
      // Si el customer es VIP (LTV ≥ $100), bumpea el descuento +5% y usa código premium.
      let isVip = false
      try {
        const ctx = await buildUserContext({ customer_id: customer.id, email: customer.email })
        const signals = computeSignals(ctx.signalContext)
        isVip = signals.some((s) => s.id === "vip")
        if (isVip) {
          discountCode = (eff.vip_discount_code as string) || `VIP${baseDiscountPercent + 5}`
          discountPercent = (eff.vip_discount_percent as number) || baseDiscountPercent + 5
          console.log(`[birthday-emails] VIP boost applied for ${customer.email}: ${discountCode} ${discountPercent}%`)
        }
      } catch (err) {
        console.warn("[birthday-emails] VIP signal compute failed:", (err as Error).message)
      }

      const customerName = `${customer.first_name || ""} ${customer.last_name || ""}`.trim() || customer.email
      const vipPrefix = isVip ? "🌟 " : ""
      const subject = `${vipPrefix}¡Feliz cumpleaños, ${customerName.split(" ")[0]}! 🎂 Tu regalo te espera`
      const html = birthdayEmailHtml(customerName, discountCode, discountPercent)

      // WhatsApp primary, email fallback
      let whatsappSent = false
      if (await isWhatsAppEnabledFor("birthday")) {
        const phone = await findCustomerPhone(customer.id, customer.email)
        if (phone) {
          whatsappSent = await sendRemarketingWhatsApp(
            "birthday",
            phone,
            birthdayWhatsAppText(customerName, discountCode, discountPercent),
            customer.id,
            { discount_code: discountCode, discount_percent: discountPercent, cedula, city, geo_override: !!eff.__geo_override_applied }
          )
        }
      }

      const emailEnabled = (settings?.channels as any)?.email !== false
      if (emailEnabled && !whatsappSent) {
        const sent = await sendEmail({ to: customer.email, subject, html })
        if (sent) {
          await logEmail("birthday", customer.email, customer.id, subject, {
            discount_code: discountCode,
            discount_percent: discountPercent,
            cedula,
            city,
            geo_override: !!eff.__geo_override_applied,
            vip_boost: isVip,
          })
        }
      }
    }
  } catch (err) {
    console.error("[birthday-emails] Error:", err)
  }
}


export default wrapJob("birthday-emails", birthdayEmailsJob)

export const config = {
  name: "birthday-emails",
  schedule: "0 9 * * *", // daily at 9am
}
