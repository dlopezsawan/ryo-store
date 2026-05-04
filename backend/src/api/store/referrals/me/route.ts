/**
 * GET /store/referrals/me
 * Returns the authenticated customer's canonical referral code + their stats.
 * Mirrors the auth pattern used in /store/loyalty.
 */
import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { LOYALTY_MODULE } from "../../../../modules/loyalty"
import LoyaltyModuleService from "../../../../modules/loyalty/service"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const authCtx = (req as unknown as Record<string, Record<string, string>>).auth_context
  const customerId = authCtx?.actor_id
  if (!customerId) {
    return res.status(401).json({ error: "Se requiere autenticación" })
  }

  const loyalty: LoyaltyModuleService = req.scope.resolve(LOYALTY_MODULE)
  const stats = await loyalty.getReferralStats(customerId)

  return res.json({
    code: stats.code,
    link: `https://enrola.shop/?ref=${stats.code}`,
    friends_invited: stats.friends_invited,
    points_earned: stats.points_earned,
    awarded: stats.awarded,
  })
}
