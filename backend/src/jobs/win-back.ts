/**
 * Win-Back Job — runs weekly on Monday at 10am
 * Targets customers who haven't ordered in 60+ days
 */

import { MedusaContainer } from "@medusajs/framework"
import { sendEmail, winBackEmailHtml } from "../lib/email-service"
import { logEmail, wasRecentlySent, getSetting, alreadyNotified, resolveCustomerCedula, getCustomerCity, applyGeoOverrides } from "../lib/remarketing-db"
import { winBackWhatsAppText } from "../lib/whatsapp-templates"
import { findCustomerPhone, isWhatsAppEnabledFor, sendRemarketingWhatsApp } from "../lib/remarketing-wa"
import { Pool } from "pg"
import { wrapJob } from "../lib/job-runner"

async function winBackJob(container: MedusaContainer) {
  console.log("[win-back] Running win-back check…")

  const settings = await getSetting("win_back")
  if (settings?.enabled === false) {
    console.log("[win-back] Disabled in settings, skipping")
    return
  }

  const daysSinceOrder = (settings?.days_since_order as number) || 60
  const baseDiscountCode = (settings?.discount_code as string) || "TEVEMOS20"
  const baseDiscountPercent = (settings?.discount_percent as number) || 20
  const usePersonalCycle = settings?.use_personal_cycle === true
  const personalMultiplier = (settings?.personal_cycle_multiplier as number) || 1.2

  try {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL })

    // Base candidates: customers with a last order between `daysSinceOrder` and 180 days ago.
    // When personal cycle is enabled, also include customers whose personal cycle × multiplier
    // puts them past their expected re-order date (even if shorter than global floor).
    const floorDays = usePersonalCycle ? Math.min(daysSinceOrder, 14) : daysSinceOrder

    const result = await pool.query(
      `WITH customer_stats AS (
         SELECT
           c.id, c.email, c.first_name, c.last_name,
           MAX(o.created_at) AS last_order_at,
           EXTRACT(EPOCH FROM (NOW() - MAX(o.created_at))) / 86400 AS days_ago,
           COUNT(DISTINCT o.id) AS total_orders
         FROM customer c
         JOIN "order" o ON o.customer_id = c.id
         WHERE c.email IS NOT NULL
           AND o.is_draft_order = false AND o.deleted_at IS NULL
         GROUP BY c.id
       ),
       customer_cycles AS (
         SELECT
           customer_id,
           PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY days_between) AS median_cycle_days
         FROM (
           SELECT
             o.customer_id,
             EXTRACT(EPOCH FROM (o.created_at - LAG(o.created_at) OVER (
               PARTITION BY o.customer_id ORDER BY o.created_at
             ))) / 86400 AS days_between
           FROM "order" o
           WHERE o.is_draft_order = false AND o.deleted_at IS NULL
             AND o.customer_id IS NOT NULL
         ) gaps
         WHERE days_between IS NOT NULL
         GROUP BY customer_id
         HAVING COUNT(*) >= 1
       )
       SELECT
         cs.id, cs.email, cs.first_name, cs.last_name,
         cs.last_order_at, cs.days_ago, cs.total_orders,
         cc.median_cycle_days
       FROM customer_stats cs
       LEFT JOIN customer_cycles cc ON cc.customer_id = cs.id
       WHERE cs.days_ago > $1
         AND cs.days_ago < 180
       ORDER BY cs.days_ago DESC`,
      [floorDays]
    )
    await pool.end()

    console.log(`[win-back] Found ${result.rows.length} customers to re-engage`)

    let skippedByPersonalCycle = 0

    for (const customer of result.rows) {
      if (!customer.email) continue

      const daysAgo = Math.round(parseFloat(customer.days_ago))
      const medianCycle = customer.median_cycle_days != null
        ? parseFloat(customer.median_cycle_days)
        : null

      // Personal-cycle gate: only fire when the customer is past their own pattern
      // (median × multiplier). Uses the global floor as fallback when we have no
      // personal data yet.
      if (usePersonalCycle) {
        const personalThreshold = medianCycle !== null
          ? Math.max(medianCycle * personalMultiplier, floorDays)
          : daysSinceOrder
        if (daysAgo < personalThreshold) {
          skippedByPersonalCycle++
          continue
        }
      }

      // Don't send more than once every 30 days — dedup by email OR cédula
      const cedula = await resolveCustomerCedula(customer.id, customer.email)
      const alreadySent = await alreadyNotified(
        "win_back",
        { email: customer.email, cedula },
        30 * 24
      )
      if (alreadySent) continue

      const city = await getCustomerCity(customer.id, customer.email)
      const eff = applyGeoOverrides(settings || {}, city)
      const discountCode = (eff.discount_code as string) || baseDiscountCode
      const discountPercent = (eff.discount_percent as number) || baseDiscountPercent

      const customerName = `${customer.first_name || ""} ${customer.last_name || ""}`.trim() || customer.email
      const subject = `¡Te echamos de menos, ${customerName.split(" ")[0]}! Aquí tienes un regalo 🎁`
      const html = winBackEmailHtml(customerName, discountCode, discountPercent, daysAgo)

      // WhatsApp primary, email fallback
      let whatsappSent = false
      if (await isWhatsAppEnabledFor("win_back")) {
        const phone = await findCustomerPhone(customer.id, customer.email)
        if (phone) {
          whatsappSent = await sendRemarketingWhatsApp(
            "win_back",
            phone,
            winBackWhatsAppText(customerName, discountCode, discountPercent, daysAgo),
            customer.id,
            {
              days_since_order: daysAgo,
              discount_code: discountCode,
              discount_percent: discountPercent,
              personal_cycle_days: medianCycle != null ? Math.round(medianCycle * 10) / 10 : null,
              used_personal_gate: usePersonalCycle,
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
          await logEmail("win_back", customer.email, customer.id, subject, {
            days_since_order: daysAgo,
            discount_code: discountCode,
            discount_percent: discountPercent,
            personal_cycle_days: medianCycle != null ? Math.round(medianCycle * 10) / 10 : null,
            used_personal_gate: usePersonalCycle,
            cedula,
            city,
            geo_override: !!eff.__geo_override_applied,
          })
        }
      }
    }

    if (usePersonalCycle) {
      console.log(`[win-back] personal-cycle mode: skipped ${skippedByPersonalCycle} customers still within their normal pattern`)
    }
  } catch (err) {
    console.error("[win-back] Error:", err)
  }
}

export default wrapJob("win-back", winBackJob)

export const config = {
  name: "win-back-emails",
  schedule: "0 10 * * 1", // every Monday at 10am
}
