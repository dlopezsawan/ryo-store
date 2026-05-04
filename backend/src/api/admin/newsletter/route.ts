/**
 * Newsletter admin API — reads directly from Listmonk PostgreSQL
 * Listmonk v6 broke Basic Auth for the admin API, so we bypass it entirely.
 */
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Pool } from "pg"

function getListmonkPool() {
  // Replace only the database name at the end of the path (not the username)
  const url = (process.env.DATABASE_URL || "").replace(/\/medusa(\?|$)/, "/listmonk$1")
  return new Pool({ connectionString: url })
}

export async function GET(_req: MedusaRequest, res: MedusaResponse) {
  const pool = getListmonkPool()
  try {
    const [subsResult, enabledResult, listsResult, campaignsResult, recentResult] = await Promise.all([
      pool.query("SELECT COUNT(*) as total FROM subscribers"),
      pool.query("SELECT COUNT(*) as total FROM subscribers WHERE status = 'enabled'"),
      pool.query(`
        SELECT l.id, l.name, l.type,
               COUNT(sl.subscriber_id) FILTER (WHERE sl.status = 'confirmed') as count
        FROM lists l
        LEFT JOIN subscriber_lists sl ON sl.list_id = l.id
        GROUP BY l.id, l.name, l.type
        ORDER BY l.id
      `),
      pool.query(`
        SELECT id, name, status, subject, created_at, send_at
        FROM campaigns
        ORDER BY created_at DESC
        LIMIT 5
      `),
      pool.query(`
        SELECT id, email, name, status, created_at
        FROM subscribers
        ORDER BY created_at DESC
        LIMIT 10
      `),
    ])

    res.json({
      total_subscribers: parseInt(subsResult.rows[0]?.total ?? "0", 10),
      enabled_subscribers: parseInt(enabledResult.rows[0]?.total ?? "0", 10),
      total_lists: listsResult.rows.length,
      total_campaigns: campaignsResult.rows.length,
      lists: listsResult.rows.map((l) => ({
        id: l.id,
        name: l.name,
        type: l.type,
        subscriber_count: parseInt(l.count ?? "0", 10),
      })),
      recent_campaigns: campaignsResult.rows.map((c) => ({
        id: c.id,
        name: c.name,
        status: c.status,
        subject: c.subject,
        created_at: c.created_at,
        send_at: c.send_at,
      })),
      recent_subscribers: recentResult.rows.map((s) => ({
        id: s.id,
        email: s.email,
        name: s.name,
        status: s.status,
        created_at: s.created_at,
      })),
      listmonk_url: "https://newsletter.enrola.shop",
    })
  } catch (e) {
    console.error("[newsletter] DB error:", e)
    res.status(500).json({ error: String(e) })
  } finally {
    await pool.end()
  }
}
