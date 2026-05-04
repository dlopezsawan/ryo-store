/**
 * Restock Reminder Job — runs daily at noon
 *
 * Sends a restock email N days after an order is completed.
 * Product list + per-product days come from remarketing_settings.restock_products
 * (configured in the Remarketing admin page).
 *
 * Fallback: products with `restock_enabled: true` in their metadata still work
 * if no rules are configured in the admin.
 */

import { MedusaContainer } from "@medusajs/framework"
import { Pool } from "pg"
import { sendEmail, restockEmailHtml } from "../lib/email-service"
import { logEmail, wasRecentlySent, getSetting, alreadyNotified, resolveCustomerCedula } from "../lib/remarketing-db"
import { restockWhatsAppText } from "../lib/whatsapp-templates"
import { findCustomerPhone, isWhatsAppEnabledFor, sendRemarketingWhatsApp } from "../lib/remarketing-wa"
import { wrapJob } from "../lib/job-runner"

const STORE_URL = process.env.STORE_URL || "https://enrola.shop"

interface RestockRule {
  product_id: string
  product_title: string
  days: number
}

async function restockJob(container: MedusaContainer) {
  console.log("[restock] Running restock reminder check…")

  const settings = await getSetting("restock")
  if (settings?.enabled === false) {
    console.log("[restock] Disabled in settings, skipping")
    return
  }

  const defaultDays = (settings?.default_days as number) || 30

  // Load rules from admin config
  const restockProductsSetting = await getSetting("restock_products")
  const configuredRules: RestockRule[] = Array.isArray(
    (restockProductsSetting as any)?.rules
  )
    ? ((restockProductsSetting as any).rules as RestockRule[])
    : []

  try {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL })

    let rows: any[]

    if (configuredRules.length > 0) {
      // Use admin-configured product list
      const productIds = configuredRules.map((r) => r.product_id)

      const result = await pool.query(
        `
        SELECT
          o.id            AS order_id,
          o.display_id,
          o.email         AS order_email,
          o.created_at    AS order_created_at,
          c.email         AS customer_email,
          c.first_name,
          c.last_name,
          li.title        AS product_title,
          pv.product_id,
          p.handle        AS product_handle,
          p.metadata      AS product_metadata
        FROM order_item oi
        JOIN order_line_item li  ON li.id  = oi.item_id
        JOIN product_variant pv  ON pv.id  = li.variant_id
        JOIN product p           ON p.id   = pv.product_id
        JOIN "order" o           ON o.id   = oi.order_id
        LEFT JOIN customer c     ON c.id   = o.customer_id
        WHERE o.status       IN ('completed', 'delivered')
          AND o.deleted_at   IS NULL
          AND oi.deleted_at  IS NULL
          AND li.deleted_at  IS NULL
          AND p.deleted_at   IS NULL
          AND pv.product_id  = ANY($1)
          AND o.created_at > NOW() - INTERVAL '90 days'
        ORDER BY o.created_at DESC
        `,
        [productIds]
      )
      rows = result.rows
    } else {
      // Fallback: products with restock_enabled in metadata
      const result = await pool.query(`
        SELECT
          o.id            AS order_id,
          o.display_id,
          o.email         AS order_email,
          o.created_at    AS order_created_at,
          c.email         AS customer_email,
          c.first_name,
          c.last_name,
          li.title        AS product_title,
          pv.product_id,
          p.handle        AS product_handle,
          p.metadata      AS product_metadata
        FROM order_item oi
        JOIN order_line_item li  ON li.id  = oi.item_id
        JOIN product_variant pv  ON pv.id  = li.variant_id
        JOIN product p           ON p.id   = pv.product_id
        JOIN "order" o           ON o.id   = oi.order_id
        LEFT JOIN customer c     ON c.id   = o.customer_id
        WHERE o.status       IN ('completed', 'delivered')
          AND o.deleted_at   IS NULL
          AND oi.deleted_at  IS NULL
          AND li.deleted_at  IS NULL
          AND p.deleted_at   IS NULL
          AND (p.metadata->>'restock_enabled')::boolean = true
          AND o.created_at > NOW() - INTERVAL '90 days'
        ORDER BY o.created_at DESC
      `)
      rows = result.rows
    }

    await pool.end()

    console.log(`[restock] Found ${rows.length} restock-eligible order items`)

    // Build a lookup map: product_id → days from admin rules
    const ruleDaysMap: Record<string, number> = {}
    for (const rule of configuredRules) {
      ruleDaysMap[rule.product_id] = rule.days
    }

    // Today's date window (midnight → midnight)
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const todayEnd = new Date(todayStart)
    todayEnd.setDate(todayEnd.getDate() + 1)

    let sent = 0
    const processed = new Set<string>() // dedupe (email + product_id)

    for (const row of rows) {
      const metadata = row.product_metadata || {}

      // Days: admin rule → product metadata → global default
      const restockDays =
        ruleDaysMap[row.product_id] ??
        (metadata.restock_days ? parseInt(String(metadata.restock_days), 10) : defaultDays)

      // Calculate the day this reminder should be sent
      const orderDate = new Date(row.order_created_at)
      const targetDate = new Date(orderDate)
      targetDate.setDate(targetDate.getDate() + restockDays)
      targetDate.setHours(0, 0, 0, 0)

      // Only send if today is the target day
      if (targetDate < todayStart || targetDate >= todayEnd) continue

      const email = row.customer_email || row.order_email
      if (!email) continue

      const dedupeKey = `${email}:${row.product_id}`
      if (processed.has(dedupeKey)) continue
      processed.add(dedupeKey)

      // Don't resend if already sent in the last 23 hours — dedup by email OR cédula
      const cedula = await resolveCustomerCedula(row.customer_id || null, email)
      const alreadySent = await alreadyNotified(
        "restock",
        { email, cedula, referenceId: row.product_id },
        23
      )
      if (alreadySent) continue

      const customerName = `${row.first_name || ""} ${row.last_name || ""}`.trim() || email
      const productUrl = `${STORE_URL}/productos/${row.product_handle}`

      // Fetch cross-sell products: admin crosssell_map > product metadata
      const crosssellSetting = await getSetting("crosssell_map")
      const crosssellMap = (crosssellSetting?.map as Record<string, string[]>) || {}

      const crossSellIds: string[] = crosssellMap[row.product_id]?.length
        ? crosssellMap[row.product_id]
        : Array.isArray(metadata.crosssell_product_ids)
          ? metadata.crosssell_product_ids
          : []

      let crossSellProducts: Array<{ title: string; url: string }> = []

      if (crossSellIds.length > 0) {
        try {
          const csPool = new Pool({ connectionString: process.env.DATABASE_URL })
          const csResult = await csPool.query(
            `SELECT title, handle FROM product WHERE id = ANY($1) AND deleted_at IS NULL LIMIT 4`,
            [crossSellIds]
          )
          await csPool.end()
          crossSellProducts = csResult.rows.map((r: any) => ({
            title: r.title,
            url: `${STORE_URL}/productos/${r.handle}`,
          }))
        } catch (e) {
          console.warn("[restock] Could not fetch cross-sell products:", e)
        }
      }

      const subject = `¿Ya se te acabó ${row.product_title}? 🔥`
      const html = restockEmailHtml(customerName, row.product_title, productUrl, crossSellProducts)

      // WhatsApp primary, email fallback
      let whatsappSent = false
      if (await isWhatsAppEnabledFor("restock")) {
        const phone = await findCustomerPhone(row.customer_id || null, email)
        if (phone) {
          whatsappSent = await sendRemarketingWhatsApp(
            "restock",
            phone,
            restockWhatsAppText(customerName, row.product_title, productUrl),
            row.product_id,
            { order_id: row.order_id, product_id: row.product_id, restock_days: restockDays, cedula }
          )
          if (whatsappSent) sent++
        }
      }

      const emailEnabled = (settings?.channels as any)?.email !== false
      if (emailEnabled && !whatsappSent) {
        const emailSent = await sendEmail({ to: email, subject, html })
        if (emailSent) {
          await logEmail("restock", email, row.product_id, subject, {
            order_id: row.order_id,
            display_id: row.display_id,
            product_id: row.product_id,
            product_title: row.product_title,
            restock_days: restockDays,
            cedula,
          })
          sent++
        }
      }
    }

    console.log(`[restock] ✅ Sent ${sent} restock reminder email(s)`)
  } catch (err) {
    console.error("[restock] Error:", err)
  }
}


export default wrapJob("restock", restockJob)

export const config = {
  name: "restock-reminders",
  schedule: "0 12 * * *", // daily at noon
}
