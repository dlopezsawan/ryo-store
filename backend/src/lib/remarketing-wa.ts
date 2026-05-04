/**
 * Remarketing WhatsApp dispatcher.
 * Checks per-campaign WhatsApp toggle + customer consent/phone,
 * sends via existing sendWhatsApp helper, and logs into remarketing_log.
 */

import { Pool } from "pg"
import { sendWhatsApp } from "./whatsapp-sender"
import { getSetting, RemarketingType } from "./remarketing-db"

let pool: Pool | null = null
function getPool(): Pool {
  if (!pool) pool = new Pool({ connectionString: process.env.DATABASE_URL })
  return pool
}

/**
 * Looks up a customer's phone number (in metadata, order addresses, or whatsapp_phone metadata).
 */
export async function findCustomerPhone(
  customerId: string | null,
  email: string | null
): Promise<string | null> {
  try {
    if (customerId) {
      const r = await getPool().query(
        `SELECT c.phone AS c_phone,
                (
                  SELECT oa.phone FROM "order" o
                  JOIN order_address oa ON oa.id = o.shipping_address_id
                  WHERE o.customer_id = c.id AND oa.phone IS NOT NULL AND oa.phone <> ''
                  ORDER BY o.created_at DESC LIMIT 1
                ) AS order_phone,
                (c.metadata->>'whatsapp_phone') AS wa_phone
         FROM customer c WHERE c.id = $1 LIMIT 1`,
        [customerId]
      )
      const row = r.rows[0]
      const phone = row?.wa_phone || row?.c_phone || row?.order_phone
      if (phone) return String(phone)
    }
    if (email) {
      const r = await getPool().query(
        `SELECT c.phone FROM customer c WHERE c.email = $1 AND c.phone IS NOT NULL LIMIT 1`,
        [email]
      )
      if (r.rows[0]?.phone) return String(r.rows[0].phone)
    }
  } catch (err) {
    console.error("[remarketing-wa] phone lookup failed:", (err as Error).message)
  }
  return null
}

/**
 * Returns true if the WhatsApp channel is enabled for this campaign.
 * Default: disabled (safer — opt-in).
 */
export async function isWhatsAppEnabledFor(type: RemarketingType | "welcome" | "graduation"): Promise<boolean> {
  const settings = await getSetting(type) || {}
  const channels = (settings.channels || {}) as Record<string, unknown>
  return channels.whatsapp === true
}

/**
 * Send a WhatsApp remarketing message + log it.
 * Returns true if sent, false otherwise.
 */
export async function sendRemarketingWhatsApp(
  type: RemarketingType,
  phone: string,
  text: string,
  referenceId: string | null,
  metadata: Record<string, unknown> = {}
): Promise<boolean> {
  const result = await sendWhatsApp(phone, text)
  if (!result) return false

  try {
    await getPool().query(
      `INSERT INTO remarketing_log (type, recipient_email, reference_id, subject, metadata)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        type,
        `wa:${phone}`,
        referenceId,
        `[WhatsApp] ${type}`,
        JSON.stringify({ ...metadata, channel: "whatsapp", phone }),
      ]
    )
  } catch (err) {
    console.error("[remarketing-wa] log insert failed:", (err as Error).message)
  }
  return true
}
