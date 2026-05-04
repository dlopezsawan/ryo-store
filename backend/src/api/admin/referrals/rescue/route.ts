/**
 * POST /admin/referrals/rescue
 * Body: { order_id: string, code: string }
 *
 * Manually invokes the referral award flow for an existing order. Used when
 * the order.placed subscriber failed to pick up the attribution (e.g. cart
 * metadata was lost, payment provider used a non-standard checkout flow,
 * subscriber crashed at the wrong time, etc).
 *
 * The award path is itself idempotent — the service rejects duplicate awards
 * for the same referee. So this can be safely re-run.
 */
import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { Modules } from "@medusajs/framework/utils"
import { LOYALTY_MODULE } from "../../../../modules/loyalty"
import LoyaltyModuleService from "../../../../modules/loyalty/service"

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const body = (req.body || {}) as { order_id?: string; code?: string }
  if (!body.order_id || !body.code) {
    return res.status(400).json({ error: "order_id and code are required" })
  }

  try {
    const orderModule = req.scope.resolve(Modules.ORDER)
    const loyalty: LoyaltyModuleService = req.scope.resolve(LOYALTY_MODULE)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const order: any = await orderModule.retrieveOrder(body.order_id, {
      select: ["id", "customer_id", "email"],
    })
    if (!order?.customer_id) {
      return res.status(400).json({ error: "order has no customer_id (guest order)" })
    }

    const result = await loyalty.tryAwardReferral({
      referee_customer_id: order.customer_id,
      referee_email: order.email ?? null,
      raw_code: body.code,
      order_id: body.order_id,
    })

    return res.json({ ...result, order_id: body.order_id, code: body.code })
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message })
  }
}
