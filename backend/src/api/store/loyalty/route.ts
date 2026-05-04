import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { LOYALTY_MODULE } from "../../../modules/loyalty"
import LoyaltyModuleService from "../../../modules/loyalty/service"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const authCtx = (req as unknown as Record<string, Record<string, string>>).auth_context
  const customerId = authCtx?.actor_id
  if (!customerId) {
    return res.status(401).json({ error: "Se requiere autenticación" })
  }

  const loyaltyService: LoyaltyModuleService = req.scope.resolve(LOYALTY_MODULE)

  const transactions = await loyaltyService.listLoyaltyTransactions(
    { customer_id: customerId },
    { order: { created_at: "DESC" }, take: 30 } as never
  )

  const totalPoints = transactions.reduce((sum, t) => sum + (t.points ?? 0), 0)

  return res.json({
    points: totalPoints,
    transactions: transactions.map((t) => ({
      id: t.id,
      points: t.points,
      type: t.type,
      order_id: t.order_id,
      description: t.description,
      created_at: t.created_at,
    })),
  })
}
