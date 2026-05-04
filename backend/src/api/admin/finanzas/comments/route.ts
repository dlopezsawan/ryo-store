/**
 * GET  /admin/finanzas/comments?entity_type=&entity_id=
 * POST /admin/finanzas/comments
 *   body: { entity_type, entity_id, body }
 */

import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import FinanzasModuleService from "../../../../modules/finanzas/service"
import { FINANZAS_MODULE } from "../../../../modules/finanzas"

function actor(req: MedusaRequest): { id: string | null; email: string | null } {
  const ctx = (req as unknown as { auth_context?: { actor_id?: string; user_id?: string } }).auth_context
  return { id: ctx?.actor_id || ctx?.user_id || null, email: null }
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const fin: FinanzasModuleService = req.scope.resolve(FINANZAS_MODULE)
  const entityType = typeof req.query.entity_type === "string" ? req.query.entity_type : null
  const entityId = typeof req.query.entity_id === "string" ? req.query.entity_id : null
  if (!entityType || !entityId) {
    return res.status(400).json({ error: "entity_type + entity_id required" })
  }
  const comments = await fin.listComments(entityType, entityId)
  res.json({ comments })
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const fin: FinanzasModuleService = req.scope.resolve(FINANZAS_MODULE)
  const body = (req.body || {}) as { entity_type?: string; entity_id?: string; body?: string }
  if (!body.entity_type || !body.entity_id || !body.body || body.body.trim().length === 0) {
    return res.status(400).json({ error: "entity_type, entity_id, body required" })
  }
  const a = actor(req)
  const created = await fin.createFinanzasComments({
    entity_type: body.entity_type,
    entity_id: body.entity_id,
    body: body.body.trim(),
    author_id: a.id,
    author_email: a.email,
    resolved_at: null,
  })
  const row = Array.isArray(created) ? created[0] : created
  res.status(201).json({ comment: row })
}
