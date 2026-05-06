/**
 * PATCH /admin/dana/conversations/:phone/status
 *
 * Toggle entre `bot_active` (Dana responde) y `human_active` (Dana
 * silenciada — el operador toma control). Esto es lo que dispara el
 * botón "Tomar control" del chat view en el panel.
 *
 * El bot ya respeta este flag: webhooks/whatsapp/route.ts comprueba
 * `conversation.session_status === "human_active"` y salta el LLM
 * (sigue guardando el mensaje del cliente para historial pero no
 * responde). Cuando el operador termina y vuelve a poner bot_active,
 * Dana retoma desde el siguiente mensaje del cliente.
 *
 * Body: { status: "bot_active" | "human_active" }
 *
 * Auto-cleanup: cuando una conversación queda en human_active sin
 * actividad por `human_timeout` minutos (config), el cron
 * closeInactiveSessions() la regresa a bot_active. Esto significa que
 * un operador que olvide soltar el control no bloquea a Dana
 * indefinidamente.
 */

import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  getConversation,
  setSessionStatus,
  ensureTables,
} from "../../../../../../lib/whatsapp-db"

let ready = false

export async function PATCH(req: MedusaRequest, res: MedusaResponse) {
  if (!ready) { try { await ensureTables(); ready = true } catch { /* tolerate */ } }

  const phone = String((req.params as Record<string, string>)?.phone ?? "").replace(/\D/g, "")
  if (!phone) return res.status(400).json({ error: "phone required" })

  const body = (req.body ?? {}) as { status?: string }
  const status = body.status
  if (status !== "bot_active" && status !== "human_active") {
    return res.status(400).json({ error: "status must be 'bot_active' or 'human_active'" })
  }

  const conv = await getConversation(phone)
  if (!conv) return res.status(404).json({ error: "conversation not found" })

  await setSessionStatus(phone, status)
  return res.json({ ok: true, conversation: { ...conv, session_status: status } })
}
