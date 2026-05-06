/**
 * GET /admin/dana/conversations
 *
 * Lista paginada de conversaciones de Dana (WhatsApp + Telegram, todo
 * canal que escriba en wa_conversations). Pensado para alimentar el
 * sidebar izquierdo del módulo /dana del panel operador.
 *
 * Query params:
 *   - limit:  máximo 200 (default 50)
 *   - offset: para paginación
 *   - status: bot_active | human_active | all (default all)
 *   - q:      búsqueda por phone o customer_name (ILIKE)
 *
 * Respuesta:
 *   {
 *     conversations: [{ id, phone, customer_name, session_status,
 *                       last_message_at, last_message, last_message_role,
 *                       message_count, ... }],
 *     total: number,
 *     limit, offset,
 *     human_active_count: number   // para el badge del sidebar
 *   }
 */

import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  listConversationsForPanel,
  getHumanActiveCount,
  ensureTables,
} from "../../../../lib/whatsapp-db"

let ready = false

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  if (!ready) { try { await ensureTables(); ready = true } catch { /* tolerate */ } }

  const status = (typeof req.query.status === "string" ? req.query.status : "all") as
    | "bot_active"
    | "human_active"
    | "all"
  const q = typeof req.query.q === "string" ? req.query.q : ""
  const limit = Number(req.query.limit ?? 50)
  const offset = Number(req.query.offset ?? 0)

  if (status !== "bot_active" && status !== "human_active" && status !== "all") {
    return res.status(400).json({ error: "invalid status" })
  }

  const data = await listConversationsForPanel({ limit, offset, status, q })
  const humanActive = await getHumanActiveCount()
  return res.json({ ...data, human_active_count: humanActive })
}
