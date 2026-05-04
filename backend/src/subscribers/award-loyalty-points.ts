import { SubscriberArgs, type SubscriberConfig } from "@medusajs/framework"
import { Modules } from "@medusajs/framework/utils"
import { LOYALTY_MODULE } from "../modules/loyalty"
import LoyaltyModuleService from "../modules/loyalty/service"

export default async function awardLoyaltyPoints({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const orderId = data.id
  const orderModule = container.resolve(Modules.ORDER)
  const loyaltyService: LoyaltyModuleService = container.resolve(LOYALTY_MODULE)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let order: any
  try {
    order = await orderModule.retrieveOrder(orderId, {
      select: ["id", "customer_id", "subtotal", "display_id"],
    })
  } catch (e) {
    console.error("[loyalty] could not retrieve order", orderId, e)
    return
  }

  if (!order.customer_id) return

  // 10 points per $1 of subtotal — prices are stored in plain units (300 = $300), NOT in cents
  const subtotalDollars = parseFloat(String(order.subtotal ?? 0)) || 0
  const points = Math.floor(subtotalDollars * 10)
  if (points <= 0) return

  try {
    await loyaltyService.createLoyaltyTransactions({
      customer_id: order.customer_id,
      points,
      type: "earned",
      order_id: orderId,
      description: `Puntos ganados por pedido #${order.display_id ?? orderId.slice(-6).toUpperCase()}`,
    })
    console.log(`[loyalty] Awarded ${points} points to customer ${order.customer_id}`)
  } catch (e) {
    console.error("[loyalty] could not award points", e)
  }
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
