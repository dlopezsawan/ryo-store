import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { LOYALTY_MODULE } from "../../../../modules/loyalty"
import LoyaltyModuleService from "../../../../modules/loyalty/service"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const loyaltyService: LoyaltyModuleService = req.scope.resolve(LOYALTY_MODULE)
  const rewards = await loyaltyService.listLoyaltyRewards(
    {},
    { order: { points_required: "ASC" } } as never
  )
  return res.json({ rewards })
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const loyaltyService: LoyaltyModuleService = req.scope.resolve(LOYALTY_MODULE)
  const body = req.body as {
    name: string
    description?: string
    points_required: number
    image_url?: string
    is_active?: boolean
    stock?: number
  }
  const reward = await loyaltyService.createLoyaltyRewards({
    name: body.name,
    description: body.description ?? null,
    points_required: body.points_required,
    image_url: body.image_url ?? null,
    is_active: body.is_active ?? true,
    stock: body.stock ?? null,
  })
  return res.status(201).json({ reward })
}
