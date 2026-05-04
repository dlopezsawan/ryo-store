/**
 * Alerts feed + bulk actions.
 * GET  ?status=unacked|all — list alerts (default: unacked, max 100)
 * POST { id?: string | ids?: string[] } — ack (mark as resolved)
 */
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Pool } from "pg"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const status = String(req.query.status || "unacked")
  const limit = Math.max(1, Math.min(200, parseInt(String(req.query.limit || "100"), 10)))
  const filter = status === "all" ? "" : "AND acked_at IS NULL"

  const result = await pool.query(
    `SELECT id, type, severity, title, message, meta, created_at, acked_at, acked_by
     FROM seo_alert
     WHERE deleted_at IS NULL ${filter}
     ORDER BY created_at DESC
     LIMIT $1`,
    [limit]
  )

  const counts = await pool.query(
    `SELECT severity, COUNT(*)::bigint AS n
     FROM seo_alert
     WHERE acked_at IS NULL AND deleted_at IS NULL
     GROUP BY severity`
  )
  const summary: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 }
  counts.rows.forEach((r: any) => { summary[r.severity] = Number(r.n) })

  res.json({
    alerts: result.rows,
    summary,
    total: result.rows.length,
  })
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const body = (req as any).body || {}
  const ids: string[] = body.ids || (body.id ? [body.id] : [])
  if (ids.length === 0) {
    res.status(400).json({ error: "id or ids required" })
    return
  }
  const ackedBy = (req as any).user?.email || "admin"
  await pool.query(
    `UPDATE seo_alert SET acked_at = NOW(), acked_by = $1, updated_at = NOW()
     WHERE id = ANY($2::text[]) AND acked_at IS NULL`,
    [ackedBy, ids]
  )
  res.json({ ok: true, acked: ids.length })
}
