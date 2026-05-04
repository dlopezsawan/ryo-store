/**
 * Mirror of the storefront combo-tier logic so the finanzas module can apply
 * the same discount when the storefront didn't materialize it as a real
 * Medusa promotion (current implementation only displays it client-side).
 *
 * Keep this in sync with `storefront/src/lib/combo-tiers.ts`.
 */

export interface ComboTier {
  minQty: number
  discount: number // 0.10, 0.15, …
  label: string
}

export const COMBO_TIERS: ComboTier[] = [
  { minQty: 3, discount: 0.10, label: "10% OFF" },
  { minQty: 5, discount: 0.15, label: "15% OFF" },
  { minQty: 10, discount: 0.20, label: "20% OFF" },
]

export const WHOLESALE_MIN = 24
export const WHOLESALE_DISCOUNT = 0.30

export function getActiveTier(totalItems: number): ComboTier | null {
  let active: ComboTier | null = null
  for (const tier of COMBO_TIERS) {
    if (totalItems >= tier.minQty) active = tier
  }
  return active
}

interface LineItem {
  quantity: number
  unit_price: number
}

export function applyComboDiscount(
  subtotal: number,
  totalItems: number,
  items: LineItem[]
): {
  discount: number
  discountedTotal: number
  activeTier: ComboTier | null
  comboDiscount: number
  wholesaleDiscount: number
  hasWholesale: boolean
} {
  const activeTier = getActiveTier(totalItems)

  let wholesaleSubtotal = 0
  let comboSubtotal = 0
  for (const item of items) {
    const lineTotal = Number(item.unit_price) * Number(item.quantity)
    if (Number(item.quantity) >= WHOLESALE_MIN) wholesaleSubtotal += lineTotal
    else comboSubtotal += lineTotal
  }

  const wholesaleDiscount = wholesaleSubtotal * WHOLESALE_DISCOUNT
  const comboDiscount = activeTier ? comboSubtotal * activeTier.discount : 0
  const totalDiscount = wholesaleDiscount + comboDiscount

  return {
    discount: totalDiscount,
    discountedTotal: subtotal - totalDiscount,
    activeTier,
    comboDiscount,
    wholesaleDiscount,
    hasWholesale: wholesaleSubtotal > 0,
  }
}
