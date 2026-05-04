/**
 * POST /admin/finanzas/send-monthly-close
 *
 * Manually triggers the monthly-close email send. Replaces the disabled
 * scheduled job (whose cron got into a 24×/sec runaway loop and burned the
 * Resend daily quota).
 *
 * Body (all optional):
 *   - month: "YYYY-MM"  Default: previous month relative to today
 *   - to: "email@..."   Default: FINANZAS_REPORT_EMAIL env
 *
 * Returns the same shape as the internal sendMonthlyCloseEmail function so
 * the UI can show the result inline (sent vs skipped + reason).
 */

import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { sendMonthlyCloseEmail } from "../../../../lib/finanzas-monthly-close"
import FinanzasModuleService from "../../../../modules/finanzas/service"
import { FINANZAS_MODULE } from "../../../../modules/finanzas"

function actorFromReq(req: MedusaRequest): { userId: string | null } {
  const ctx = (req as unknown as { auth_context?: { actor_id?: string; user_id?: string } }).auth_context
  return { userId: ctx?.actor_id || ctx?.user_id || null }
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  // Same role gate as month-close — only roles with `close_month` permission.
  try {
    const fin: FinanzasModuleService = req.scope.resolve(FINANZAS_MODULE)
    const role = await fin.getUserRole(actorFromReq(req).userId)
    if (!FinanzasModuleService.canMutate(role, "close_month")) {
      return res.status(403).json({ error: `Tu rol (${role}) no puede enviar el cierre mensual.` })
    }
  } catch (err) {
    console.warn("[send-monthly-close] role check failed (allowing through):", (err as Error).message)
    // Don't hard-fail if role module unavailable — admin auth already happened upstream.
  }

  const body = (req.body || {}) as { month?: string; to?: string }
  const month = body.month
  const toOverride = body.to

  if (month && !/^\d{4}-\d{2}$/.test(month)) {
    return res.status(400).json({ error: "month must be YYYY-MM format" })
  }

  try {
    const result = await sendMonthlyCloseEmail({ month, toOverride })
    return res.status(200).json(result)
  } catch (err) {
    console.error("[send-monthly-close] failed:", err)
    return res.status(500).json({ error: (err as Error).message })
  }
}
