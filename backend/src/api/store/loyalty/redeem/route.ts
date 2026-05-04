import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { LOYALTY_MODULE } from "../../../../modules/loyalty"
import LoyaltyModuleService from "../../../../modules/loyalty/service"

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const authCtx = (req as unknown as Record<string, Record<string, string>>).auth_context
  const customerId = authCtx?.actor_id
  if (!customerId) return res.status(401).json({ error: "Se requiere autenticación" })

  const { reward_ids, order_id } = req.body as { reward_ids: string[]; order_id?: string }
  if (!Array.isArray(reward_ids) || reward_ids.length === 0) {
    return res.status(400).json({ error: "No se especificaron recompensas" })
  }

  const loyaltyService: LoyaltyModuleService = req.scope.resolve(LOYALTY_MODULE)

  // Puntos disponibles
  const currentPoints = await loyaltyService.getCustomerPoints(customerId)

  // Obtener recompensas solicitadas
  const rewards = await loyaltyService.listLoyaltyRewards({ id: reward_ids })
  if (rewards.length !== reward_ids.length) {
    return res.status(400).json({ error: "Una o más recompensas no existen" })
  }

  // Validar stock
  for (const reward of rewards) {
    if (reward.stock !== null && reward.stock !== undefined && reward.stock <= 0) {
      return res.status(400).json({ error: `"${reward.name}" está agotado` })
    }
  }

  // Validar puntos suficientes
  const totalCost = rewards.reduce((s, r) => s + r.points_required, 0)
  if (currentPoints < totalCost) {
    return res.status(400).json({
      error: `Puntos insuficientes. Tienes ${currentPoints} pts, necesitas ${totalCost} pts`,
    })
  }

  // Descontar puntos y decrementar stock
  for (const reward of rewards) {
    await loyaltyService.createLoyaltyTransactions({
      customer_id: customerId,
      points: -reward.points_required,
      type: "redeemed",
      order_id: order_id,
      description: `Canje: ${reward.name}`,
    })
    if (reward.stock !== null && reward.stock !== undefined) {
      await loyaltyService.updateLoyaltyRewards(
        { id: reward.id },
        { stock: reward.stock - 1 }
      )
    }
  }

  return res.json({
    success: true,
    redeemed: rewards.map((r) => ({
      id: r.id,
      name: r.name,
      points_required: r.points_required,
    })),
    points_used: totalCost,
    remaining_points: currentPoints - totalCost,
  })
}

// Reversar un canje (si el pedido falla después del canje)
export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const authCtx = (req as unknown as Record<string, Record<string, string>>).auth_context
  const customerId = authCtx?.actor_id
  if (!customerId) return res.status(401).json({ error: "Se requiere autenticación" })

  const { reward_ids } = req.body as { reward_ids: string[] }
  if (!Array.isArray(reward_ids) || reward_ids.length === 0) {
    return res.status(400).json({ error: "No se especificaron recompensas" })
  }

  const loyaltyService: LoyaltyModuleService = req.scope.resolve(LOYALTY_MODULE)
  const rewards = await loyaltyService.listLoyaltyRewards({ id: reward_ids })

  for (const reward of rewards) {
    await loyaltyService.createLoyaltyTransactions({
      customer_id: customerId,
      points: reward.points_required,
      type: "reversed",
      description: `Reversión de canje: ${reward.name}`,
    })
    // Restaurar stock
    if (reward.stock !== null && reward.stock !== undefined) {
      await loyaltyService.updateLoyaltyRewards(
        { id: reward.id },
        { stock: reward.stock + 1 }
      )
    }
  }

  return res.json({ success: true })
}
