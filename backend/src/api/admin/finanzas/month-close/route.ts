/**
 * GET  /admin/finanzas/month-close
 *   List of all closes (open and reopened).
 *
 * POST /admin/finanzas/month-close
 *   body: { month: "YYYY-MM" }   close the given month
 *
 * DELETE /admin/finanzas/month-close
 *   body: { month, reason }      reopen the month (audit-logged)
 */

import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import FinanzasModuleService from "../../../../modules/finanzas/service"
import { FINANZAS_MODULE } from "../../../../modules/finanzas"

function actorEmail(req: MedusaRequest): { email: string | null; userId: string | null } {
  const ctx = (req as unknown as { auth_context?: { actor_id?: string; user_id?: string } }).auth_context
  return { email: null, userId: ctx?.actor_id || ctx?.user_id || null }
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const fin: FinanzasModuleService = req.scope.resolve(FINANZAS_MODULE)
  const closes = await fin.listFinanzasMonthCloses({}, {
    order: { closed_at: "DESC" },
  } as never)
  res.json({ closes })
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const fin: FinanzasModuleService = req.scope.resolve(FINANZAS_MODULE)
  const body = (req.body || {}) as { month?: string }
  if (!body.month || !/^\d{4}-\d{2}$/.test(body.month)) {
    return res.status(400).json({ error: "month YYYY-MM required" })
  }
  const role = await fin.getUserRole(actorEmail(req).userId)
  if (!FinanzasModuleService.canMutate(role, "close_month")) {
    return res.status(403).json({ error: `Tu rol (${role}) no puede cerrar meses.` })
  }
  const result = await fin.closeMonth({
    month: body.month,
    closed_by_user_id: actorEmail(req).userId,
    closed_by_email: actorEmail(req).email,
  })
  res.status(201).json(result)
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const fin: FinanzasModuleService = req.scope.resolve(FINANZAS_MODULE)
  const body = (req.body || {}) as { month?: string; reason?: string }
  if (!body.month || !body.reason) {
    return res.status(400).json({ error: "month + reason required" })
  }
  const role = await fin.getUserRole(actorEmail(req).userId)
  if (!FinanzasModuleService.canMutate(role, "close_month")) {
    return res.status(403).json({ error: `Tu rol (${role}) no puede reabrir meses.` })
  }
  try {
    await fin.reopenMonth({
      month: body.month,
      reopen_reason: body.reason,
      reopened_by_email: actorEmail(req).email,
    })
    res.json({ reopened: body.month })
  } catch (e) {
    res.status(400).json({ error: (e as Error).message })
  }
}
