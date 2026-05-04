/**
 * GET /admin/referrals/list
 * Returns recent referral relationships (awarded + rejected) for audit.
 * Optional query: ?status=awarded|rejected, ?limit=50
 */
import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { LOYALTY_MODULE } from "../../../../modules/loyalty"
import LoyaltyModuleService from "../../../../modules/loyalty/service"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const loyalty: LoyaltyModuleService = req.scope.resolve(LOYALTY_MODULE)
  const status = (req.query.status as string) || undefined
  const limit = Math.min(Number(req.query.limit) || 50, 200)

  const where: Record<string, unknown> = {}
  if (status === "awarded" || status === "rejected" || status === "pending") {
    where.status = status
  }

  const rows = await loyalty.listLoyaltyReferrals(
    where as never,
    { order: { created_at: "DESC" } as never, take: limit } as never
  )

  return res.json({
    count: rows.length,
    referrals: rows.map((r) => ({
      id: r.id,
      referrer_customer_id: r.referrer_customer_id,
      referee_customer_id: r.referee_customer_id,
      referee_email: r.referee_email,
      code: r.code,
      order_id: r.order_id,
      status: r.status,
      rejected_reason: r.rejected_reason,
      referrer_points: r.referrer_points,
      referee_points: r.referee_points,
      awarded_at: r.awarded_at,
      created_at: r.created_at,
    })),
  })
}
