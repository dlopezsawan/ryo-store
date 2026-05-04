/**
 * Bot config API
 * GET  /admin/whatsapp/config — get all config
 * POST /admin/whatsapp/config — update config
 */

import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { getAllConfig, setConfig, ensureTables } from "../../../../lib/whatsapp-db"

let ready = false

export async function GET(_req: MedusaRequest, res: MedusaResponse) {
  if (!ready) { await ensureTables(); ready = true }
  const config = await getAllConfig()
  // Mask sensitive keys
  config.wasender_key = config.wasender_key?.length > 3 ? config.wasender_key.substring(0, 8) + "..." : ""
  config.deepseek_key = config.deepseek_key?.length > 3 ? config.deepseek_key.substring(0, 8) + "..." : ""
  return res.json({ config })
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  if (!ready) { await ensureTables(); ready = true }
  const body = req.body as Record<string, string>

  const allowedKeys = ["enabled", "bot_name", "human_timeout", "bot_timeout", "owner_phone", "wasender_key", "deepseek_key"]

  for (const [key, value] of Object.entries(body)) {
    if (allowedKeys.includes(key) && typeof value === "string") {
      // Skip masked values (don't overwrite real keys with "xxxx...")
      if ((key === "wasender_key" || key === "deepseek_key") && value.endsWith("...")) continue
      await setConfig(key, value)
    }
  }

  const config = await getAllConfig()
  config.wasender_key = config.wasender_key?.length > 3 ? config.wasender_key.substring(0, 8) + "..." : ""
  config.deepseek_key = config.deepseek_key?.length > 3 ? config.deepseek_key.substring(0, 8) + "..." : ""
  return res.json({ config })
}
