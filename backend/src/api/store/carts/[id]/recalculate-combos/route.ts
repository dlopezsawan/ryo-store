/**
 * POST /store/carts/:id/recalculate-combos
 *
 * Single source of truth for the combo + wholesale discount logic.
 * The storefront calls this after every cart mutation (add/update/remove
 * line items). Server-authoritative — bypasses promotions/* engine entirely
 * because the rules can't be expressed as standard Medusa promotion rules:
 *
 *   COMBO  — qualifies on UNIQUE SKU COUNT (variants).
 *            Aplica descuento solo a 1 unidad por línea (no a todas).
 *            Premia VARIEDAD, no volumen.
 *              3+ variants → 10% to 1 unit of each non-wholesale line
 *              5+ variants → 15%
 *             10+ variants → 20%
 *
 *   WHOLESALE  — qualifies per-line on quantity ≥ 24 of the same SKU.
 *                Aplica 30% a TODAS las unidades de esa línea.
 *                Premia volumen del MISMO producto.
 *
 *   Una línea recibe SOLO UN tipo de descuento:
 *     - Si qty ≥ 24 → wholesale 30% (combo no aplica a esa línea ni la cuenta
 *       hacia el conteo de unique SKUs para combo qualification)
 *     - Si qty < 24 y combo califica → 10/15/20% sobre 1 unidad
 *     - Else → sin descuento
 *
 *   Idempotente: usa setLineItemAdjustments que reemplaza el set completo de
 *   adjustments del cart con los nuestros, preservando los externos
 *   (e.g. ENROLAWELCOME) tal cual.
 */

import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"

const COMBO_TIERS = [
  { minUniqueSkus: 10, discount: 0.20, code: "COMBO20", label: "20% OFF" },
  { minUniqueSkus: 5,  discount: 0.15, code: "COMBO15", label: "15% OFF" },
  { minUniqueSkus: 3,  discount: 0.10, code: "COMBO10", label: "10% OFF" },
] as const
const WHOLESALE_MIN = 24
const WHOLESALE_DISCOUNT = 0.30
const WHOLESALE_CODE = "WHOLESALE30"
const OUR_CODES = new Set(["COMBO10", "COMBO15", "COMBO20", WHOLESALE_CODE])

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const cartId = req.params.id
  if (!cartId) return res.status(400).json({ error: "cart id required" })

  try {
    const cartModule = req.scope.resolve(Modules.CART)

    const [cart] = await cartModule.listCarts(
      { id: cartId },
      {
        take: 1,
        relations: ["items", "items.adjustments"],
      } as never
    )
    if (!cart) return res.status(404).json({ error: "cart not found" })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items: any[] = cart.items || []

    // Wholesale lines: qty ≥ 24 — descontadas del conteo de unique SKUs para
    // que no inflen el tier combo "gratis" comprando volumen.
    const nonWholesaleVariantIds = new Set<string>()
    for (const it of items) {
      if (it.variant_id && it.quantity < WHOLESALE_MIN) {
        nonWholesaleVariantIds.add(it.variant_id)
      }
    }
    const uniqueSkus = nonWholesaleVariantIds.size

    let comboTier: typeof COMBO_TIERS[number] | null = null
    for (const tier of COMBO_TIERS) {
      if (uniqueSkus >= tier.minUniqueSkus) { comboTier = tier; break }
    }

    // Construir el nuevo set de OUR adjustments
    const ourNewAdjustments: Array<{
      item_id: string
      code: string
      amount: number
      description?: string
    }> = []

    for (const it of items) {
      const unitPrice = Number(it.unit_price) || 0
      if (unitPrice <= 0) continue

      const isWholesale = it.quantity >= WHOLESALE_MIN
      if (isWholesale) {
        const amount = unitPrice * it.quantity * WHOLESALE_DISCOUNT
        if (amount > 0) {
          ourNewAdjustments.push({
            item_id: it.id,
            code: WHOLESALE_CODE,
            amount,
            description: `Mayorista 30% (${it.quantity} unidades)`,
          })
        }
      } else if (comboTier) {
        // Solo 1 unidad recibe el descuento, no todas
        const amount = unitPrice * 1 * comboTier.discount
        if (amount > 0) {
          ourNewAdjustments.push({
            item_id: it.id,
            code: comboTier.code,
            amount,
            description: `${comboTier.label} en 1 unidad (${uniqueSkus} productos únicos)`,
          })
        }
      }
    }

    // Preservar adjustments externos (cupones manuales como ENROLAWELCOME)
    // tal cual estaban — no los sobrescribimos.
    const preservedAdjustments: Array<{
      id?: string
      item_id: string
      code: string | null
      amount: number
      description?: string | null
      promotion_id?: string | null
    }> = []
    for (const it of items) {
      const adjs = (it.adjustments || []) as Array<{
        id: string
        item_id: string
        code: string | null
        amount: number
        description?: string | null
        promotion_id?: string | null
      }>
      for (const a of adjs) {
        if (a.code && OUR_CODES.has(a.code)) continue // los reemplazamos
        preservedAdjustments.push({
          id: a.id, // preserve id → setLineItemAdjustments updates instead of recreates
          item_id: a.item_id,
          code: a.code,
          amount: a.amount,
          description: a.description,
          promotion_id: a.promotion_id,
        })
      }
    }

    const finalAdjustments = [...preservedAdjustments, ...ourNewAdjustments]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await cartModule.setLineItemAdjustments(cartId, finalAdjustments as any)

    return res.json({
      ok: true,
      unique_skus: uniqueSkus,
      combo_tier: comboTier?.code ?? null,
      combo_pct: comboTier?.discount ?? 0,
      wholesale_lines: items.filter((i: { quantity: number }) => i.quantity >= WHOLESALE_MIN).length,
      adjustments_applied: ourNewAdjustments.length,
    })
  } catch (err) {
    console.error("[recalculate-combos] error:", (err as Error).message)
    return res.status(500).json({ error: (err as Error).message })
  }
}
