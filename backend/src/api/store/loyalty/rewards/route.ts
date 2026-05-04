import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { LOYALTY_MODULE } from "../../../../modules/loyalty"
import LoyaltyModuleService from "../../../../modules/loyalty/service"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const loyaltyService: LoyaltyModuleService = req.scope.resolve(LOYALTY_MODULE)

  const rewards = await loyaltyService.listLoyaltyRewards(
    { is_active: true },
    { order: { points_required: "ASC" } } as never
  )

  return res.json({ rewards })
}
