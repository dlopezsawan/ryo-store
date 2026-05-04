import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Pool } from "pg"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

export async function GET(_req: MedusaRequest, res: MedusaResponse) {
  try {
    const r = await pool.query("SELECT value FROM wa_bot_config WHERE key = 'maintenance_mode'")
    const enabled = r.rows[0]?.value === "true"
    res.setHeader("Cache-Control", "no-store")
    return res.json({ maintenance: enabled })
  } catch {
    return res.json({ maintenance: false })
  }
}
