/**
 * Stockout Alert (Sinergia F) — runs daily at 9:30am
 *
 * Finds SKUs whose aggregate days-of-cover (stock / avg daily sales last 30d)
 * is below `critical_days`, then notifies the cohort of customers who bought
 * that product in the recent past (and whose dedup window is clear).
 *
 * Goal: convert a stockout risk into a sales event. Dedupes per customer × product
 * for 30 days so nobody gets spammed.
 */

import { MedusaContainer } from "@medusajs/framework"
import { Pool } from "pg"
import { sendEmail, stockoutAlertEmailHtml } from "../lib/email-service"
import { logEmail, wasRecentlySent, getSetting, alreadyNotified, resolveCustomerCedula } from "../lib/remarketing-db"
import { stockoutAlertWhatsAppText } from "../lib/whatsapp-templates"
import { findCustomerPhone, isWhatsAppEnabledFor, sendRemarketingWhatsApp } from "../lib/remarketing-wa"
import { wrapJob } from "../lib/job-runner"

const STORE_URL = process.env.STORE_URL || "https://enrola.shop"

async function stockoutAlertJob(_container: MedusaContainer) {
  console.log("[stockout-alert] Running preemptive stockout check…")

  const settings = await getSetting("stockout_alert")
  if (settings?.enabled === false) {
    console.log("[stockout-alert] Disabled in settings, skipping")
    return
  }

  const criticalDays = (settings?.critical_days as number) || 7
  const cohortDays = (settings?.cohort_days as number) || 120
  const maxPerRun = (settings?.max_per_run as number) || 50

  try {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL })

    // 1) Find products at risk: aggregate stock across all locations for each product,
    //    divided by average daily sales over 30d.
    const riskResult = await pool.query(
      `WITH sales_30d AS (
         SELECT li.product_id,
                SUM(oi.quantity)::numeric AS qty_30d
         FROM order_item oi
         JOIN order_line_item li ON li.id = oi.item_id
         JOIN "order" o ON o.id = oi.order_id
         WHERE o.is_draft_order = false AND o.deleted_at IS NULL
           AND o.created_at >= NOW() - INTERVAL '30 days'
           AND oi.deleted_at IS NULL
           AND li.product_id IS NOT NULL
         GROUP BY li.product_id
       ),
       stock_per_product AS (
         SELECT pv.product_id, SUM(il.stocked_quantity)::numeric AS total_stock
         FROM inventory_level il
         JOIN product_variant_inventory_item pvii ON pvii.inventory_item_id = il.inventory_item_id
         JOIN product_variant pv ON pv.id = pvii.variant_id
         WHERE il.deleted_at IS NULL
         GROUP BY pv.product_id
       )
       SELECT p.id, p.title, p.handle,
              spp.total_stock,
              COALESCE(s30.qty_30d, 0) AS sold_30d,
              CASE WHEN COALESCE(s30.qty_30d, 0) > 0
                   THEN ROUND(spp.total_stock / (s30.qty_30d / 30.0), 1)
                   ELSE NULL END AS days_of_cover
       FROM product p
       JOIN stock_per_product spp ON spp.product_id = p.id
       LEFT JOIN sales_30d s30 ON s30.product_id = p.id
       WHERE p.status = 'published' AND p.deleted_at IS NULL
         AND spp.total_stock > 0
         AND COALESCE(s30.qty_30d, 0) > 0
         AND (spp.total_stock / (s30.qty_30d / 30.0)) < $1
       ORDER BY days_of_cover ASC`,
      [criticalDays]
    )

    console.log(`[stockout-alert] ${riskResult.rows.length} products under ${criticalDays} days of cover`)

    let totalSent = 0

    for (const product of riskResult.rows) {
      if (totalSent >= maxPerRun) break

      // 2) Cohort: customers who bought this product in the last `cohortDays`.
      const cohortResult = await pool.query(
        `SELECT DISTINCT ON (c.id)
           c.id, c.email, c.first_name, c.last_name
         FROM customer c
         JOIN "order" o ON o.customer_id = c.id
         JOIN order_item oi ON oi.order_id = o.id AND oi.deleted_at IS NULL
         JOIN order_line_item li ON li.id = oi.item_id
         WHERE c.email IS NOT NULL
           AND o.is_draft_order = false AND o.deleted_at IS NULL
           AND o.created_at >= NOW() - INTERVAL '1 day' * $1
           AND li.product_id = $2
         ORDER BY c.id, o.created_at DESC`,
        [cohortDays, product.id]
      )

      const productUrl = `${STORE_URL}/productos/${product.handle || product.id}`

      for (const customer of cohortResult.rows) {
        if (totalSent >= maxPerRun) break
        if (!customer.email) continue

        // Dedup: 30 days per customer × product — by email OR cédula
        const cedula = await resolveCustomerCedula(customer.id, customer.email)
        const alreadySent = await alreadyNotified(
          "stockout_alert",
          { email: customer.email, cedula, referenceId: product.id },
          24 * 30
        )
        if (alreadySent) continue

        const customerName = [customer.first_name, customer.last_name].filter(Boolean).join(" ").trim() || customer.email
        const daysCover = Math.round(Number(product.days_of_cover) || 0)
        const subject = `⚠ Queda poco stock de ${product.title}`

        let whatsappSent = false
        if (await isWhatsAppEnabledFor("stockout_alert")) {
          const phone = await findCustomerPhone(customer.id, customer.email)
          if (phone) {
            whatsappSent = await sendRemarketingWhatsApp(
              "stockout_alert",
              phone,
              stockoutAlertWhatsAppText(customerName, product.title, productUrl, daysCover),
              product.id,
              { product_id: product.id, product_title: product.title, days_of_cover: daysCover, cedula }
            )
            if (whatsappSent) totalSent++
          }
        }

        const emailEnabled = (settings?.channels as any)?.email !== false
        if (emailEnabled && !whatsappSent) {
          const html = stockoutAlertEmailHtml(customerName, product.title, productUrl, daysCover)
          const sent = await sendEmail({ to: customer.email, subject, html })
          if (sent) {
            await logEmail("stockout_alert", customer.email, product.id, subject, {
              product_id: product.id,
              product_title: product.title,
              days_of_cover: daysCover,
              cedula,
            })
            totalSent++
          }
        }
      }
    }

    await pool.end()
    console.log(`[stockout-alert] Sent ${totalSent} alert(s)`)
  } catch (err) {
    console.error("[stockout-alert] Error:", err)
  }
}


export default wrapJob("stockout-alert", stockoutAlertJob)

export const config = {
  name: "stockout-alert",
  schedule: "30 9 * * *", // daily at 9:30am
}
