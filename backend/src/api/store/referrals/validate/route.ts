/**
 * POST /store/referrals/validate
 * Body: { code: string }
 *
 * Public endpoint — used by the cart UI to confirm "yes, this code exists"
 * before the user checks out. Doesn't leak the referrer's identity.
 *
 * Response: { valid, code, referrer_initial }
 */
import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { LOYALTY_MODULE } from "../../../../modules/loyalty"
import LoyaltyModuleService from "../../../../modules/loyalty/service"

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const body = (req.body || {}) as { code?: string }
  const loyalty: LoyaltyModuleService = req.scope.resolve(LOYALTY_MODULE)
  const result = await loyalty.describeReferralCode(body.code)
  return res.json(result)
}
