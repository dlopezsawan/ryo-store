/**
 * GET   /admin/dana/config — devuelve config completo (keys sensibles enmascaradas)
 * PATCH /admin/dana/config — actualiza un subset de keys
 *
 * Re-expone el wa_bot_config con un allowlist más amplio que el
 * /admin/whatsapp/config existente (ese estaba limitado a las 7 keys
 * básicas — bot_name, timeouts, keys —, no permitía editar el system
 * prompt ni los campos de pago móvil que el chat view necesita
 * mostrar). El endpoint viejo seguirá funcionando para retro-compat.
 *
 * Keys editables desde el panel /dana/config:
 *
 *   General                         enabled, bot_name, maintenance_mode
 *   Timeouts (minutos)              human_timeout, bot_timeout
 *   Notificaciones                  owner_phone, telegram_messages_chat_id
 *   Credenciales (masked)           wasender_key, deepseek_key, groq_key
 *   Pago móvil (visible al cliente) pago_movil_banco, pago_movil_cedula,
 *                                   pago_movil_telefono
 *   Logística                       delivery_whatsapp_group, google_maps_key
 *   Instagram                       ig_enabled, ig_comment_trigger,
 *                                   ig_welcome_message
 *   System prompt override          system_prompt_override (string,
 *                                   default vacío → usa el hardcoded)
 *
 * Las keys sensibles (wasender_key, deepseek_key, groq_key,
 * meta_page_token, meta_app_secret, meta_verify_token, telegram_bot_token)
 * se enmascaran a `<8 primeros chars>...` en GET. PATCH ignora valores
 * que terminan en `...` (no sobrescribe la real con la mascarada).
 */

import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { getAllConfig, setConfig, ensureTables } from "../../../../lib/whatsapp-db"

// Keys que el operador puede editar desde el panel. Cualquier otra key
// que pueda existir en wa_bot_config (ej. `maintenance_mode` heredado,
// o internos del bot) NO se devuelve ni se acepta vía PATCH.
const EDITABLE_KEYS = [
  "enabled",
  "bot_name",
  "maintenance_mode",
  "human_timeout",
  "bot_timeout",
  "owner_phone",
  "telegram_messages_chat_id",
  "telegram_bot_token",
  "wasender_key",
  "deepseek_key",
  "groq_key",
  "pago_movil_banco",
  "pago_movil_cedula",
  "pago_movil_telefono",
  "delivery_whatsapp_group",
  "google_maps_key",
  "ig_enabled",
  "ig_comment_trigger",
  "ig_welcome_message",
  "system_prompt_override",
] as const

// Keys donde el valor es secreto — enmascarar en GET, ignorar en PATCH
// si llega ya enmascarado (panel devuelve la mask al hacer save).
const SENSITIVE_KEYS = new Set([
  "wasender_key",
  "deepseek_key",
  "groq_key",
  "telegram_bot_token",
])

function mask(value: string): string {
  if (!value) return ""
  if (value.length <= 8) return "***"
  return value.substring(0, 8) + "..."
}

function isMasked(value: string): boolean {
  return value.endsWith("...") || value === "***"
}

let ready = false

export async function GET(_req: MedusaRequest, res: MedusaResponse) {
  if (!ready) { try { await ensureTables(); ready = true } catch { /* tolerate */ } }

  const all = await getAllConfig()
  const filtered: Record<string, string> = {}
  for (const k of EDITABLE_KEYS) {
    const v = all[k] ?? ""
    filtered[k] = SENSITIVE_KEYS.has(k) ? mask(v) : v
  }
  // Marcador para el panel: hay system_prompt_override custom o se usa
  // el built-in. Útil para que el textarea muestre placeholder si está
  // vacío en vez de un texto enorme.
  return res.json({
    config: filtered,
    has_system_prompt_override: Boolean(all.system_prompt_override?.trim()),
  })
}

export async function PATCH(req: MedusaRequest, res: MedusaResponse) {
  if (!ready) { try { await ensureTables(); ready = true } catch { /* tolerate */ } }

  const body = (req.body ?? {}) as Record<string, unknown>
  const updates: Record<string, string> = {}
  for (const [k, v] of Object.entries(body)) {
    if (!(EDITABLE_KEYS as readonly string[]).includes(k)) continue
    if (typeof v !== "string") continue
    if (SENSITIVE_KEYS.has(k) && isMasked(v)) continue // No sobrescribir con la máscara
    updates[k] = v
  }

  for (const [k, v] of Object.entries(updates)) {
    await setConfig(k, v)
  }

  // Devolvemos el config refrescado para que el panel re-pinte sin
  // segunda request.
  const all = await getAllConfig()
  const filtered: Record<string, string> = {}
  for (const k of EDITABLE_KEYS) {
    const v = all[k] ?? ""
    filtered[k] = SENSITIVE_KEYS.has(k) ? mask(v) : v
  }
  return res.json({
    config: filtered,
    has_system_prompt_override: Boolean(all.system_prompt_override?.trim()),
    updated_keys: Object.keys(updates),
  })
}
