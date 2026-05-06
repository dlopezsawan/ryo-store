/**
 * GET /admin/dana/conversations/:phone
 *
 * Detalle de una conversación + sus mensajes. Pensado para el chat
 * view del módulo /dana. Incluye mensaje order_data si se hizo handoff
 * de pedido durante el chat (útil para el operador que toma control).
 *
 * Query: ?limit=200&before_id=NN para paginación de historial largo.
 * Mensajes vienen ordenados oldest→newest (chat reading order).
 *
 * El path param es `phone` (numérico, sin el `@s.whatsapp.net`). El bot
 * normaliza así en wa_conversations.phone.
 */

import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  getConversation,
  listMessagesForPanel,
  ensureTables,
} from "../../../../../lib/whatsapp-db"

let ready = false

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  if (!ready) { try { await ensureTables(); ready = true } catch { /* tolerate */ } }

  const phone = String((req.params as Record<string, string>)?.phone ?? "").replace(/\D/g, "")
  if (!phone) return res.status(400).json({ error: "phone required" })

  const conv = await getConversation(phone)
  if (!conv) return res.status(404).json({ error: "conversation not found" })

  const limit = Number(req.query.limit ?? 200)
  const before_id = req.query.before_id ? Number(req.query.before_id) : undefined
  const messages = await listMessagesForPanel(phone, { limit, before_id })

  return res.json({ conversation: conv, messages })
}
