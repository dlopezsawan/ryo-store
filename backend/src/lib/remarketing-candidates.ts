/**
 * Candidate discovery for the remarketing engine.
 *
 * Returns a deduped list of users worth evaluating on this engine tick.
 * Combines two streams:
 *   1. PostHog distinct_ids with activity in the last `lookback_hours` hours
 *      — captures users currently navigating, abandoning checkout, etc.
 *   2. Medusa customers with a recent order (last N days)
 *      — captures restock-due, win-back, post-purchase cohorts that may not
 *        have PostHog activity in the lookback window.
 */

import { Pool } from "pg"
import { hogqlQuery, isAdminConfigured } from "./posthog-admin-client"

let sharedPool: Pool | null = null
function pool(): Pool {
  if (!sharedPool) sharedPool = new Pool({ connectionString: process.env.DATABASE_URL })
  return sharedPool
}

export type Candidate = {
  email?: string
  customer_id?: string
  distinct_id?: string
  source: "posthog" | "medusa_customer"
}

export async function discoverCandidates(opts: {
  lookback_hours?: number     // PostHog event window
  customer_days?: number      // Medusa customer recency window (by last order)
  max?: number                // hard cap
} = {}): Promise<Candidate[]> {
  const lookbackHours = opts.lookback_hours ?? 72
  const customerDays = opts.customer_days ?? 180
  const max = opts.max ?? 500

  const out = new Map<string, Candidate>() // key by email|customer_id|distinct_id

  // ─── 1. PostHog active distinct_ids ───────────────────────────────────────
  if (isAdminConfigured()) {
    try {
      const r = await hogqlQuery(`
        SELECT
          any(properties.email) AS email,
          distinct_id,
          max(timestamp) AS last_seen
        FROM events
        WHERE timestamp >= now() - INTERVAL ${lookbackHours} HOUR
          AND event IN ('add_to_cart', 'checkout_started', 'product_viewed', '$pageview', 'order_placed')
        GROUP BY distinct_id
        ORDER BY last_seen DESC
        LIMIT ${max}
      `)
      for (const row of r?.results || []) {
        const email = row[0] ? String(row[0]).toLowerCase().trim() : undefined
        const distinct_id = row[1] ? String(row[1]) : undefined
        if (!distinct_id) continue
        const key = email || distinct_id
        if (out.has(key)) continue
        out.set(key, { email, distinct_id, source: "posthog" })
      }
    } catch (err) {
      console.error("[candidates] posthog query failed:", (err as Error).message)
    }
  }

  // ─── 2. Medusa customers with recent orders ───────────────────────────────
  try {
    const r = await pool().query(
      `
      SELECT DISTINCT ON (c.id) c.id, c.email
      FROM customer c
      JOIN "order" o ON o.customer_id = c.id
      WHERE c.deleted_at IS NULL
        AND c.email IS NOT NULL
        AND o.created_at >= NOW() - INTERVAL '1 day' * $1
      ORDER BY c.id, o.created_at DESC
      LIMIT $2
      `,
      [customerDays, max]
    )
    for (const row of r.rows) {
      const email = row.email ? String(row.email).toLowerCase().trim() : undefined
      const customer_id = row.id as string
      const key = email || customer_id
      if (out.has(key)) {
        // Merge customer_id into existing posthog candidate
        const existing = out.get(key)!
        if (!existing.customer_id) existing.customer_id = customer_id
      } else {
        out.set(key, { email, customer_id, source: "medusa_customer" })
      }
    }
  } catch (err) {
    console.error("[candidates] medusa query failed:", (err as Error).message)
  }

  return Array.from(out.values()).slice(0, max)
}
