/**
 * Remarketing DB helpers — connects to Medusa PostgreSQL
 * Tables: remarketing_log, remarketing_settings
 */

import { Pool } from "pg"

let pool: Pool | null = null

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL })
  }
  return pool
}

// ─── Log ─────────────────────────────────────────────────────────────────────

export type RemarketingType =
  | "abandoned_cart"
  | "birthday"
  | "win_back"
  | "welcome"
  | "post_purchase"
  | "restock"
  | "graduation"
  | "pending_payment"
  | "stockout_alert"
  | "fulfillment_delay"
  // Engine-driven buckets (B1+) — kept here so old jobs and engine share a single
  // dedup namespace via alreadyNotified()
  | "friction"
  | "multi_view_no_cart"

/**
 * Maps an engine rule_key to the legacy RemarketingType bucket so that
 * `alreadyNotified()` and `logEmail()` can dedupe across old jobs + new engine.
 *
 * Multiple engine rules can map to the same legacy bucket (e.g. abandoned_checkout_v2
 * AND cart_abandoned_v2 both → "abandoned_cart") — they should NOT double-fire on
 * the same user even though they're different rules in the engine.
 */
export function legacyTypeForRuleKey(ruleKey: string): RemarketingType | null {
  if (ruleKey.startsWith("friction_")) return "friction"
  switch (ruleKey) {
    case "cart_abandoned_v2":          return "abandoned_cart"
    case "abandoned_checkout_v2":      return "abandoned_cart"
    case "coupon_failed_no_purchase":  return "abandoned_cart"  // shares dedup bucket
    case "win_back_v2":                return "win_back"
    case "restock_due_v2":             return "restock"
    case "multi_view_no_cart_v2":      return "multi_view_no_cart"
    default:                           return null
  }
}

export async function logEmail(
  type: RemarketingType,
  recipientEmail: string,
  referenceId: string | null,
  subject: string,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  try {
    await getPool().query(
      `INSERT INTO remarketing_log (type, recipient_email, reference_id, subject, metadata)
       VALUES ($1, $2, $3, $4, $5)`,
      [type, recipientEmail, referenceId, subject, JSON.stringify(metadata)]
    )
  } catch (err) {
    console.error("[remarketing-db] Error logging email:", err)
  }
}

/** Returns true if an email of this type was sent to this address within `withinHours` hours */
export async function wasRecentlySent(
  type: RemarketingType,
  recipientEmail: string,
  referenceId: string | null,
  withinHours: number
): Promise<boolean> {
  try {
    const result = await getPool().query(
      `SELECT 1 FROM remarketing_log
       WHERE type = $1
         AND recipient_email = $2
         AND ($3::text IS NULL OR reference_id = $3)
         AND sent_at > NOW() - INTERVAL '1 hour' * $4
       LIMIT 1`,
      [type, recipientEmail, referenceId, withinHours]
    )
    return (result.rowCount ?? 0) > 0
  } catch (err) {
    console.error("[remarketing-db] Error checking wasRecentlySent:", err)
    return false
  }
}

/**
 * Cross-channel dedup: returns true if this `type` was recently sent to EITHER
 * the given email (any channel) OR the given cédula (any email/channel/record).
 * Prevents sending the same message to the same person via different records.
 */
/**
 * Cross-table, cross-channel dedup. Returns true if EITHER:
 *   - `remarketing_log` has a row of this type within the window for the email/cedula, OR
 *   - `remarketing_fire` has a sent/converted row mapped to this type within the window
 *
 * This is the single source of truth for "did we already contact this user about this".
 * Old jobs and the new engine both call this before dispatch so neither double-fires.
 *
 * Mapping engine rules → legacy types is done via `legacyTypeForRuleKey()`.
 */
export async function alreadyNotified(
  type: RemarketingType,
  opts: {
    email?: string | null
    cedula?: string | null
    referenceId?: string | null
    customerId?: string | null
  },
  withinHours: number
): Promise<boolean> {
  try {
    const emailLower = opts.email ? opts.email.toLowerCase() : null
    if (!emailLower && !opts.cedula && !opts.customerId) return false

    // ─── Source 1: remarketing_log (legacy jobs) ──────────────────────────────
    {
      const conditions: string[] = []
      const params: unknown[] = [type, withinHours]
      if (emailLower) {
        params.push(emailLower)
        conditions.push(`lower(recipient_email) = $${params.length}`)
      }
      if (opts.cedula) {
        params.push(opts.cedula)
        conditions.push(`metadata->>'cedula' = $${params.length}`)
      }
      if (conditions.length) {
        let sql = `SELECT 1 FROM remarketing_log
                   WHERE type = $1
                     AND sent_at > NOW() - INTERVAL '1 hour' * $2
                     AND (${conditions.join(" OR ")})`
        if (opts.referenceId) {
          params.push(opts.referenceId)
          sql += ` AND reference_id = $${params.length}`
        }
        sql += " LIMIT 1"
        const r = await getPool().query(sql, params)
        if ((r.rowCount ?? 0) > 0) return true
      }
    }

    // ─── Source 2: remarketing_fire (engine, mapped via legacy bucket) ────────
    // We don't filter by rule_key — we want ANY rule that maps to this legacy
    // bucket to count as a recent notification.
    try {
      const fireConditions: string[] = []
      const fireParams: unknown[] = [withinHours]
      if (emailLower) {
        fireParams.push(emailLower)
        fireConditions.push(`lower(email) = $${fireParams.length}`)
      }
      if (opts.customerId) {
        fireParams.push(opts.customerId)
        fireConditions.push(`customer_id = $${fireParams.length}`)
      }
      if (fireConditions.length) {
        // Build the mapped rule_keys list — this should mirror legacyTypeForRuleKey
        const ruleKeys: string[] = []
        switch (type) {
          case "abandoned_cart":
            ruleKeys.push(
              "cart_abandoned_v2",
              "abandoned_checkout_v2",
              "coupon_failed_no_purchase"
            )
            break
          case "win_back":
            ruleKeys.push("win_back_v2")
            break
          case "restock":
            ruleKeys.push("restock_due_v2")
            break
          case "multi_view_no_cart":
            ruleKeys.push("multi_view_no_cart_v2")
            break
          case "friction":
            // Friction rules use prefix friction_<slug>; handled below
            break
        }
        let ruleClause = ""
        if (ruleKeys.length) {
          fireParams.push(ruleKeys)
          ruleClause = `AND rule_key = ANY($${fireParams.length}::text[])`
        } else if (type === "friction") {
          ruleClause = `AND rule_key LIKE 'friction\\_%'`
        } else {
          // No engine rules map to this legacy type → skip fire source
          return false
        }
        const sql = `
          SELECT 1 FROM remarketing_fire
          WHERE status IN ('sent', 'pending', 'converted')
            AND fired_at > NOW() - INTERVAL '1 hour' * $1
            ${ruleClause}
            AND (${fireConditions.join(" OR ")})
          LIMIT 1
        `
        const r = await getPool().query(sql, fireParams)
        if ((r.rowCount ?? 0) > 0) return true
      }
    } catch (err) {
      // remarketing_fire may not exist yet on fresh installs — fall through
      console.warn("[remarketing-db] fire dedup query skipped:", (err as Error).message)
    }

    return false
  } catch (err) {
    console.error("[remarketing-db] Error checking alreadyNotified:", err)
    return false
  }
}

/**
 * Looks up a customer's most recent shipping city (from their latest order's
 * shipping address). Returns a normalized lowercase city name or null.
 */
export async function getCustomerCity(
  customerId: string | null,
  email: string | null
): Promise<string | null> {
  if (!customerId && !email) return null
  try {
    if (customerId) {
      const r = await getPool().query(
        `SELECT LOWER(TRIM(oa.city)) AS city
         FROM "order" o
         JOIN order_address oa ON oa.id = o.shipping_address_id
         WHERE o.customer_id = $1
           AND o.is_draft_order = false AND o.deleted_at IS NULL
           AND oa.city IS NOT NULL AND TRIM(oa.city) <> ''
         ORDER BY o.created_at DESC LIMIT 1`,
        [customerId]
      )
      if (r.rows[0]?.city) return String(r.rows[0].city)
    }
    if (email) {
      const r = await getPool().query(
        `SELECT LOWER(TRIM(oa.city)) AS city
         FROM "order" o
         JOIN order_address oa ON oa.id = o.shipping_address_id
         WHERE o.email = $1
           AND o.is_draft_order = false AND o.deleted_at IS NULL
           AND oa.city IS NOT NULL AND TRIM(oa.city) <> ''
         ORDER BY o.created_at DESC LIMIT 1`,
        [email]
      )
      if (r.rows[0]?.city) return String(r.rows[0].city)
    }
  } catch (err) {
    console.error("[remarketing-db] city lookup failed:", (err as Error).message)
  }
  return null
}

/**
 * Merges a campaign's `geo_overrides` with the base settings for the customer's city.
 * Override keys present in the city entry shadow the base values.
 * Returns a new object — the input is not mutated.
 */
export function applyGeoOverrides(
  baseSettings: Record<string, unknown>,
  city: string | null
): Record<string, unknown> {
  if (!city) return baseSettings
  const overrides = (baseSettings.geo_overrides || {}) as Record<string, Record<string, unknown>>
  const entry = overrides[city.toLowerCase()]
  if (!entry || typeof entry !== "object") return baseSettings
  return { ...baseSettings, ...entry, __geo_override_applied: city }
}

/**
 * Looks up a customer's cédula from customer.metadata.cedula or, as fallback,
 * the most recent order.metadata.cedula. Returns null if not found.
 */
export async function resolveCustomerCedula(
  customerId: string | null,
  email: string | null
): Promise<string | null> {
  if (!customerId && !email) return null
  try {
    if (customerId) {
      const r = await getPool().query(
        `SELECT c.metadata->>'cedula' AS c_cedula,
                (
                  SELECT o.metadata->>'cedula' FROM "order" o
                  WHERE o.customer_id = c.id AND o.metadata->>'cedula' IS NOT NULL
                  ORDER BY o.created_at DESC LIMIT 1
                ) AS order_cedula
         FROM customer c WHERE c.id = $1 LIMIT 1`,
        [customerId]
      )
      const row = r.rows[0]
      const ced = row?.c_cedula || row?.order_cedula
      if (ced) return String(ced)
    }
    if (email) {
      const r = await getPool().query(
        `SELECT metadata->>'cedula' AS cedula FROM customer
         WHERE email = $1 AND metadata->>'cedula' IS NOT NULL LIMIT 1`,
        [email]
      )
      if (r.rows[0]?.cedula) return String(r.rows[0].cedula)
    }
  } catch (err) {
    console.error("[remarketing-db] cedula lookup failed:", (err as Error).message)
  }
  return null
}

/**
 * Mark a legacy remarketing_log entry as converted by stamping its metadata.
 * Used by the attribution subscriber when last-touch is a legacy job dispatch.
 */
export async function markLogConverted(
  id: number,
  order_id: string
): Promise<void> {
  try {
    await getPool().query(
      `UPDATE remarketing_log
       SET metadata = COALESCE(metadata, '{}'::jsonb)
                      || jsonb_build_object(
                           'converted_order_id', $1::text,
                           'converted_at', NOW()::text
                         )
       WHERE id = $2`,
      [order_id, id]
    )
  } catch (err) {
    console.error("[remarketing-db] markLogConverted error:", (err as Error).message)
  }
}

// ─── Settings ────────────────────────────────────────────────────────────────

export interface RemarketingSettingRow {
  key: string
  value: Record<string, unknown>
}

export async function getSetting(key: string): Promise<Record<string, unknown> | null> {
  try {
    const result = await getPool().query(
      `SELECT value FROM remarketing_settings WHERE key = $1`,
      [key]
    )
    return result.rows[0]?.value ?? null
  } catch (err) {
    console.error("[remarketing-db] Error getting setting:", err)
    return null
  }
}

export async function getAllSettings(): Promise<RemarketingSettingRow[]> {
  try {
    const result = await getPool().query(
      `SELECT key, value FROM remarketing_settings ORDER BY key`
    )
    return result.rows
  } catch (err) {
    console.error("[remarketing-db] Error getting all settings:", err)
    return []
  }
}

export async function updateSetting(key: string, value: Record<string, unknown>): Promise<void> {
  await getPool().query(
    `INSERT INTO remarketing_settings (key, value, updated_at) VALUES ($1, $2, NOW())
     ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
    [key, JSON.stringify(value)]
  )
}

// ─── Stats ───────────────────────────────────────────────────────────────────

export interface RemarketingStats {
  total: number
  by_type: Record<string, number>
  conversions_by_type: Record<string, number>
  last_7_days: number
  last_30_days: number
  recent: Array<{
    id: number
    type: string
    recipient_email: string
    subject: string
    sent_at: string
    converted_order_id?: string | null
  }>
}

export async function getStats(): Promise<RemarketingStats> {
  const db = getPool()
  const [totalRes, byTypeRes, last7Res, last30Res, recentRes, conversionsRes] = await Promise.all([
    db.query(`SELECT COUNT(*) as total FROM remarketing_log`),
    db.query(`SELECT type, COUNT(*) as count FROM remarketing_log GROUP BY type ORDER BY count DESC`),
    db.query(`SELECT COUNT(*) as total FROM remarketing_log WHERE sent_at > NOW() - INTERVAL '7 days'`),
    db.query(`SELECT COUNT(*) as total FROM remarketing_log WHERE sent_at > NOW() - INTERVAL '30 days'`),
    db.query(
      `SELECT id, type, recipient_email, subject, sent_at,
              metadata->>'converted_order_id' AS converted_order_id
       FROM remarketing_log ORDER BY sent_at DESC LIMIT 20`
    ),
    db.query(
      `SELECT type, COUNT(*) as count
       FROM remarketing_log
       WHERE metadata ? 'converted_order_id'
         AND sent_at > NOW() - INTERVAL '90 days'
       GROUP BY type`
    ),
  ])

  const by_type: Record<string, number> = {}
  for (const row of byTypeRes.rows) {
    by_type[row.type] = parseInt(row.count, 10)
  }
  const conversions_by_type: Record<string, number> = {}
  for (const row of conversionsRes.rows) {
    conversions_by_type[row.type] = parseInt(row.count, 10)
  }

  return {
    total: parseInt(totalRes.rows[0]?.total ?? "0", 10),
    by_type,
    conversions_by_type,
    last_7_days: parseInt(last7Res.rows[0]?.total ?? "0", 10),
    last_30_days: parseInt(last30Res.rows[0]?.total ?? "0", 10),
    recent: recentRes.rows,
  }
}
