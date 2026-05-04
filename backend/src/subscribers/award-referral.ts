/**
 * order.placed → award referral bonus.
 *
 * Reads the cart's stored attribution (set earlier via
 * /store/carts/:id/attribution) for an `attribution_ref` field. If present,
 * passes it to the loyalty service which:
 *   - rejects self-referrals
 *   - rejects unknown codes
 *   - rejects if the referee already had a prior earned transaction
 *   - awards 200/200 points + creates a loyalty_referral row
 *
 * Idempotent: re-running on the same order is a no-op (the service checks
 * for existing awarded relationships per referee).
 *
 * Never throws — referral failure must not block fulfillment.
 */
import { SubscriberArgs, type SubscriberConfig } from "@medusajs/framework"
import { Modules } from "@medusajs/framework/utils"
import { LOYALTY_MODULE } from "../modules/loyalty"
import LoyaltyModuleService from "../modules/loyalty/service"

export default async function awardReferralHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const orderId = data.id
  try {
    const orderModule = container.resolve(Modules.ORDER)
    const cartModule = container.resolve(Modules.CART)
    const loyalty: LoyaltyModuleService = container.resolve(LOYALTY_MODULE)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let order: any
    try {
      order = await orderModule.retrieveOrder(orderId, {
        select: ["id", "customer_id", "email", "metadata", "display_id"],
      })
    } catch (e) {
      console.error("[referral] could not retrieve order", orderId, e)
      return
    }

    if (!order?.customer_id) {
      // guests can't be referred — they have no stable identity
      return
    }

    // Attribution lives on the cart, not the order. Find the cart that
    // produced this order. Medusa v2 stores the link via order.cart_id when
    // available, but to be safe we also accept order.metadata.cart_id.
    let refCode: string | null = null

    // Path A: metadata copied onto the order itself (some flows do this)
    const orderMeta = (order.metadata || {}) as Record<string, unknown>
    if (typeof orderMeta.attribution_ref === "string") {
      refCode = orderMeta.attribution_ref
    }

    // Path B: locate the cart and read its metadata
    if (!refCode) {
      try {
        const cartId =
          (order.cart_id as string | undefined) ||
          (orderMeta.cart_id as string | undefined)
        if (cartId) {
          const [cart] = await cartModule.listCarts(
            { id: cartId },
            { take: 1, select: ["id", "metadata"] as never }
          )
          const meta = ((cart?.metadata || {}) as Record<string, unknown>)
          if (typeof meta.attribution_ref === "string") refCode = meta.attribution_ref
        }
      } catch {
        // ignore — cart lookup is best-effort
      }
    }

    // Path C: scan most recent cart for this customer (last 24h) — covers
    // edge cases where cart_id wasn't propagated. Cheap fallback.
    if (!refCode) {
      try {
        const recent = await cartModule.listCarts(
          { customer_id: order.customer_id } as never,
          { order: { created_at: "DESC" } as never, take: 5, select: ["metadata"] as never }
        )
        for (const c of recent) {
          const meta = ((c?.metadata || {}) as Record<string, unknown>)
          if (typeof meta.attribution_ref === "string") {
            refCode = meta.attribution_ref
            break
          }
        }
      } catch {
        // ignore
      }
    }

    if (!refCode) return

    const result = await loyalty.tryAwardReferral({
      referee_customer_id: order.customer_id,
      referee_email: order.email ?? null,
      raw_code: refCode,
      order_id: orderId,
    })

    if (result.ok) {
      console.log(
        `[referral] order ${orderId}: awarded ${result.referrer_points}+${result.referee_points} pts ` +
        `(referrer=${result.referrer_customer_id}, referee=${order.customer_id})`
      )
    } else {
      console.log(
        `[referral] order ${orderId}: rejected (reason=${result.reason}, code=${refCode})`
      )
    }
  } catch (err) {
    console.error("[referral] handler failure (non-fatal):", (err as Error).message)
  }
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
