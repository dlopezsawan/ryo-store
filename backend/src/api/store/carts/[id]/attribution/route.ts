/**
 * POST /store/carts/:id/attribution
 * Records UTM attribution on a cart so it carries over to the order metadata
 * when the cart is completed.
 *
 * Body: { utm_source?, utm_medium?, utm_campaign?, utm_term?, utm_content?, referrer? }
 */

import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"

interface AttributionBody {
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  utm_term?: string
  utm_content?: string
  referrer?: string
  /** Referral code from ?ref= URL param. Persisted as attribution_ref on the cart. */
  ref?: string
}

function sanitize(val: unknown): string | undefined {
  if (typeof val !== "string") return undefined
  const trimmed = val.trim().slice(0, 120)
  return trimmed || undefined
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const cartId = req.params.id
  if (!cartId) return res.status(400).json({ error: "cart id required" })

  const body = (req.body || {}) as AttributionBody
  const attribution: Record<string, string> = {}
  for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "referrer", "ref"] as const) {
    const v = sanitize(body[key])
    if (v) attribution[`attribution_${key}`] = v
  }

  if (Object.keys(attribution).length === 0) {
    return res.json({ updated: false, reason: "no attribution fields provided" })
  }

  try {
    const cartModule = req.scope.resolve(Modules.CART)
    const [cart] = await cartModule.listCarts({ id: cartId }, { take: 1 })
    if (!cart) return res.status(404).json({ error: "cart not found" })

    const mergedMetadata = { ...(cart.metadata as Record<string, unknown> || {}), ...attribution }
    await cartModule.updateCarts(cartId, { metadata: mergedMetadata })

    return res.json({ updated: true, attribution })
  } catch (err) {
    console.error("[attribution] failed:", (err as Error).message)
    return res.status(500).json({ error: (err as Error).message })
  }
}
