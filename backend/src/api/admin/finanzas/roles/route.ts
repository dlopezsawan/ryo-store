/**
 * GET  /admin/finanzas/roles                  list all explicit grants
 * POST /admin/finanzas/roles                  upsert grant (admin only)
 *   body: { user_id, user_email?, role: "admin"|"contador"|"operario" }
 * DELETE /admin/finanzas/roles                remove grant (revert to admin default)
 *   body: { user_id }
 */

import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import FinanzasModuleService from "../../../../modules/finanzas/service"
import { FINANZAS_MODULE } from "../../../../modules/finanzas"

function actorId(req: MedusaRequest): string | null {
  const ctx = (req as unknown as { auth_context?: { actor_id?: string; user_id?: string } }).auth_context
  return ctx?.actor_id || ctx?.user_id || null
}

const VALID = new Set(["admin", "contador", "operario"])

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const fin: FinanzasModuleService = req.scope.resolve(FINANZAS_MODULE)
  const roles = await fin.listFinanzasUserRoles({}, {
    order: { user_email: "ASC" },
  } as never)
  res.json({ roles })
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const fin: FinanzasModuleService = req.scope.resolve(FINANZAS_MODULE)
  const body = (req.body || {}) as { user_id?: string; user_email?: string; role?: string }
  if (!body.user_id || !body.role) {
    return res.status(400).json({ error: "user_id + role required" })
  }
  if (!VALID.has(body.role)) {
    return res.status(400).json({ error: `role must be one of: ${[...VALID].join(", ")}` })
  }
  const myRole = await fin.getUserRole(actorId(req))
  if (myRole !== "admin") {
    return res.status(403).json({ error: "Solo un admin puede otorgar roles." })
  }
  const existing = await fin.listFinanzasUserRoles({ user_id: body.user_id })
  if (existing.length > 0) {
    await fin.updateFinanzasUserRoles({
      id: existing[0].id,
      role: body.role,
      user_email: body.user_email ?? existing[0].user_email,
      granted_by: actorId(req),
    })
  } else {
    await fin.createFinanzasUserRoles({
      user_id: body.user_id,
      user_email: body.user_email ?? null,
      role: body.role,
      granted_by: actorId(req),
    })
  }
  await fin.recordAudit({
    entity_type: "user_role",
    entity_id: body.user_id,
    action: existing.length > 0 ? "update" : "create",
    after: { user_id: body.user_id, role: body.role },
    user_id: actorId(req),
  })
  res.json({ user_id: body.user_id, role: body.role })
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const fin: FinanzasModuleService = req.scope.resolve(FINANZAS_MODULE)
  const body = (req.body || {}) as { user_id?: string }
  if (!body.user_id) return res.status(400).json({ error: "user_id required" })
  const myRole = await fin.getUserRole(actorId(req))
  if (myRole !== "admin") {
    return res.status(403).json({ error: "Solo un admin puede revocar roles." })
  }
  const rows = await fin.listFinanzasUserRoles({ user_id: body.user_id })
  if (rows.length > 0) {
    await fin.deleteFinanzasUserRoles(rows.map((r) => r.id))
    await fin.recordAudit({
      entity_type: "user_role",
      entity_id: body.user_id,
      action: "delete",
      before: { user_id: body.user_id, role: rows[0].role },
      user_id: actorId(req),
    })
  }
  res.json({ deleted: true })
}
