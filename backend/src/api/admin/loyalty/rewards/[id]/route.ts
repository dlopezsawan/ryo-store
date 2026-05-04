import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { LOYALTY_MODULE } from "../../../../../modules/loyalty"
import LoyaltyModuleService from "../../../../../modules/loyalty/service"

export async function PUT(req: MedusaRequest, res: MedusaResponse) {
  const { id } = req.params
  const loyaltyService: LoyaltyModuleService = req.scope.resolve(LOYALTY_MODULE)
  const reward = await loyaltyService.updateLoyaltyRewards(
    { id },
    req.body as Record<string, unknown>
  )
  return res.json({ reward })
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const { id } = req.params
  const loyaltyService: LoyaltyModuleService = req.scope.resolve(LOYALTY_MODULE)
  await loyaltyService.deleteLoyaltyRewards([id])
  return res.status(200).json({ success: true })
}
