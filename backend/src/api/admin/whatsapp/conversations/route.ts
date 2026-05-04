/**
 * Conversations API
 * GET /admin/whatsapp/conversations — list recent conversations with last message
 */

import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { getRecentConversations, getConversationHistory, ensureTables } from "../../../../lib/whatsapp-db"

let ready = false

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  if (!ready) { await ensureTables(); ready = true }

  const phone = (req.query as Record<string, string>).phone

  if (phone) {
    // Get full conversation history for a specific phone
    const messages = await getConversationHistory(phone, 50)
    return res.json({ messages })
  }

  // List all recent conversations
  const conversations = await getRecentConversations(30)
  return res.json({ conversations })
}
