import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Pool } from "pg"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

export async function GET(_req: MedusaRequest, res: MedusaResponse) {
  const r = await pool.query("SELECT value FROM wa_bot_config WHERE key = 'maintenance_mode'")
  return res.json({ maintenance: r.rows[0]?.value === "true" })
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const { enabled } = req.body as { enabled: boolean }
  await pool.query(
    "INSERT INTO wa_bot_config (key, value) VALUES ('maintenance_mode', $1) ON CONFLICT (key) DO UPDATE SET value = $1",
    [enabled ? "true" : "false"]
  )
  return res.json({ maintenance: enabled })
}
