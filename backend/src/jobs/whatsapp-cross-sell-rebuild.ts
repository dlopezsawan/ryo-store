/**
 * Job: Rebuild empirical cross-sell affinity map — Batch 6 / F5.2
 *
 * Computes co-occurrence of products in completed orders and stores the
 * affinity in product_affinity. Used by Dana to make data-driven cross-sell
 * suggestions instead of the static CROSS_SELL category map.
 *
 * Cron: weekly (Monday 03:00 UTC).
 *
 * NOTE: this used to be monthly (`0 3 1 * *`) but Medusa's in-process cron
 * runner schedules the next firing via setTimeout, and Node's setTimeout
 * overflows above ~24.8 days (Number.MAX_INT32 ms ≈ 2,147,483,647). The
 * monthly delay computed (~2.59 × 10^9 ms) was over the limit, Node
 * silently clamped it to 1ms, and the job re-fired every ~3 seconds
 * causing log spam + DB load. Symptom in production was thousands of
 * "[cross-sell] Rebuilding affinity map..." lines per minute.
 *
 * Weekly (~6.05 × 10^8 ms) is well under the int32 ceiling and is fine
 * for this workload — the affinity map evolves slowly (only changes when
 * new completed orders include new product combinations) and weekly is
 * actually a better cadence than monthly: bot recommendations stay fresh.
 *
 * The bot reads this table; when there's not enough data (low confidence) it
 * falls back to the static map. The threshold is enforced at read time, not here.
 */

import { Pool } from "pg"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

export default async function rebuildCrossSell() {
  try {
    console.log("[cross-sell] Rebuilding affinity map...")

    // Compute affinity in a single query — no truncate/insert dance, use upsert.
    await pool.query(`
      WITH order_products AS (
        SELECT DISTINCT o.id AS order_id, pv.product_id
        FROM "order" o
        JOIN order_item oi ON oi.order_id = o.id AND oi.deleted_at IS NULL
        JOIN order_line_item li ON li.id = oi.item_id
        JOIN product_variant pv ON pv.id = li.variant_id
        WHERE o.status = 'completed' AND o.deleted_at IS NULL
      ),
      pair_counts AS (
        SELECT
          a.product_id AS product_a,
          b.product_id AS product_b,
          COUNT(*) AS co_occurrence
        FROM order_products a
        JOIN order_products b ON a.order_id = b.order_id AND a.product_id <> b.product_id
        GROUP BY a.product_id, b.product_id
      ),
      product_totals AS (
        SELECT product_id, COUNT(*) AS total
        FROM order_products
        GROUP BY product_id
      )
      INSERT INTO product_affinity (product_a, product_b, co_occurrence, total_a, affinity_pct, computed_at)
      SELECT
        pc.product_a,
        pc.product_b,
        pc.co_occurrence,
        pt.total,
        ROUND((pc.co_occurrence::numeric / pt.total) * 100, 2),
        NOW()
      FROM pair_counts pc
      JOIN product_totals pt ON pt.product_id = pc.product_a
      ON CONFLICT (product_a, product_b) DO UPDATE SET
        co_occurrence = EXCLUDED.co_occurrence,
        total_a = EXCLUDED.total_a,
        affinity_pct = EXCLUDED.affinity_pct,
        computed_at = NOW()
    `)

    // Clean up stale entries (products that no longer co-occur)
    await pool.query(`DELETE FROM product_affinity WHERE computed_at < NOW() - INTERVAL '1 day'`)

    const r = await pool.query(`SELECT COUNT(*) AS pairs FROM product_affinity`)
    console.log(`[cross-sell] ✅ Affinity map rebuilt — ${r.rows[0].pairs} product pairs`)
  } catch (err) {
    console.error("[cross-sell] Rebuild failed:", err)
  }
}

export const config = {
  name: "whatsapp-cross-sell-rebuild",
  // Monday 03:00 UTC. Avoid schedules with > 24-day gaps until Medusa
  // fixes the setTimeout int32 overflow in its cron runner.
  schedule: "0 3 * * 1",
}
