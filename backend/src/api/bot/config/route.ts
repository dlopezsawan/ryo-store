/**
 * Bot config API — ADMIN ONLY.
 * Auth is enforced in ../../middlewares.ts (matcher "/bot/*",
 * authenticate("user", ...)). Do not rely on this handler for auth.
 *
 * GET  /bot/config — get config (secret values are redacted, see below)
 * POST /bot/config — update config
 */

import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { getAllConfig, setConfig, ensureTables } from "../../../lib/whatsapp-db"

let ready = false

// Config keys that hold secret material (API keys, tokens, app secrets).
// Their raw values must NEVER be returned in an API response — not even to an
// authenticated admin. GET returns an opaque "configured / not configured"
// marker instead, and POST ignores that marker so re-saving the form never
// overwrites a real secret with the placeholder.
const SENSITIVE_KEYS = [
  "wasender_key",
  "deepseek_key",
  "groq_key",
  "telegram_bot_token",
  "meta_page_token",
  "meta_app_secret",
  "meta_verify_token",
  "google_maps_key",
]

// Opaque placeholder shown for a secret that IS configured. Reveals nothing
// about the underlying value (unlike a partial "first 8 chars" mask). The
// admin UI renders it inside a password field.
const SECRET_SET_MASK = "••••••••"

/** Replace every sensitive value with an opaque set/not-set marker. */
function redactConfig(config: Record<string, string>): Record<string, string> {
  const out = { ...config }
  for (const key of SENSITIVE_KEYS) {
    if (key in out) {
      out[key] = out[key] && out[key].length > 0 ? SECRET_SET_MASK : ""
    }
  }
  return out
}

/** True when the submitted value is just the placeholder GET handed back
 *  (or the legacy "abc12345..." partial mask) → i.e. the secret is unchanged. */
function isUnchangedSecret(value: string): boolean {
  return value === SECRET_SET_MASK || value.endsWith("...")
}

export async function GET(_req: MedusaRequest, res: MedusaResponse) {
  if (!ready) { await ensureTables(); ready = true }
  const config = await getAllConfig()
  return res.json({ config: redactConfig(config) })
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  if (!ready) { await ensureTables(); ready = true }
  const body = req.body as Record<string, string>

  const allowedKeys = ["enabled", "bot_name", "human_timeout", "bot_timeout", "owner_phone", "wasender_key", "deepseek_key"]

  for (const [key, value] of Object.entries(body)) {
    if (allowedKeys.includes(key) && typeof value === "string") {
      // Never overwrite a stored secret with the masked placeholder the UI
      // received from GET (or a legacy "..." partial mask).
      if (SENSITIVE_KEYS.includes(key) && isUnchangedSecret(value)) continue
      await setConfig(key, value)
    }
  }

  const config = await getAllConfig()
  return res.json({ config: redactConfig(config) })
}
