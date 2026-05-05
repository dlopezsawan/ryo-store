/**
 * Lógica de descuentos por VARIEDAD (combo) y VOLUMEN (mayorista).
 *
 * COMBOS — calificación por SKUs ÚNICOS en el cart, aplicación a 1 unidad
 * por línea:
 *    3+ productos distintos → 10% off a 1 unidad de cada línea no-mayorista
 *    5+ productos distintos → 15% off ...
 *   10+ productos distintos → 20% off ...
 *
 *   Premia VARIEDAD. No se puede inflar el tier con muchas unidades del
 *   mismo producto (esa es la zona de mayorista).
 *
 * MAYORISTA — per-línea por VOLUMEN del mismo SKU:
 *   24+ unidades de la MISMA línea → 30% a TODAS las unidades de esa línea
 *
 *   Una línea recibe SÓLO UN tipo de descuento:
 *   - Si la línea es mayorista (qty ≥ 24) → 30% a todas las unidades. La
 *     línea NO cuenta hacia el conteo de unique SKUs para combo qualification
 *     (evita que un cliente compre volumen de A + 2 productos baratos para
 *     forzar tier combo).
 *   - Si no es mayorista y combo califica → tier % sobre 1 unidad.
 *
 * IMPORTANTE: este archivo es sólo para DISPLAY — los descuentos reales se
 * aplican server-side via POST /api/cart/:id/recalculate-combos llamado tras
 * cada operación. El backend tiene la misma lógica replicada (single source
 * of truth en el endpoint).
 */

export interface ComboTier {
  /** Mínimo de SKUs únicos NO mayoristas para que aplique */
  minUniqueSkus: number
  discount: number
  label: string
  code: string
}

/** Ordenado de mayor a menor para que el `find` natural devuelva el mejor */
export const COMBO_TIERS: ComboTier[] = [
  { minUniqueSkus: 10, discount: 0.20, label: "20% OFF", code: "COMBO20" },
  { minUniqueSkus: 5,  discount: 0.15, label: "15% OFF", code: "COMBO15" },
  { minUniqueSkus: 3,  discount: 0.10, label: "10% OFF", code: "COMBO10" },
]

export const WHOLESALE_MIN = 24
export const WHOLESALE_DISCOUNT = 0.30
export const WHOLESALE_CODE = "WHOLESALE30"

interface LineItem {
  quantity: number
  unit_price: number
  /** variant_id necesario para contar SKUs únicos. Si falta, la línea
   *  contribuye al conteo via su id en items[] (degradación graceful). */
  variant_id?: string
}

/** Cuenta SKUs únicos NO mayoristas (los wholesale no califican para combo) */
export function countQualifyingUniqueSkus(items: Array<{ variant_id?: string; quantity: number }>): number {
  const set = new Set<string>()
  for (const it of items) {
    if (!it.variant_id) continue
    if (it.quantity >= WHOLESALE_MIN) continue // wholesale lines no cuentan
    set.add(it.variant_id)
  }
  return set.size
}

/** Tier combo activo según SKUs únicos calificantes */
export function getActiveTier(uniqueSkus: number): ComboTier | null {
  for (const tier of COMBO_TIERS) {
    if (uniqueSkus >= tier.minUniqueSkus) return tier
  }
  return null
}

/** Próximo tier desbloqueable: cuántos productos DISTINTOS más hacen falta */
export function getNextTier(uniqueSkus: number): { tier: ComboTier; skusNeeded: number } | null {
  for (let i = COMBO_TIERS.length - 1; i >= 0; i--) {
    const t = COMBO_TIERS[i]
    if (uniqueSkus < t.minUniqueSkus) {
      return { tier: t, skusNeeded: t.minUniqueSkus - uniqueSkus }
    }
  }
  return null
}

export interface ComboDiscountResult {
  /** Suma total descontada */
  discount: number
  discountedTotal: number
  subtotal: number
  /** Tier combo activo (10/15/20%) o null */
  activeTier: ComboTier | null
  /** Total descontado por líneas mayoristas (qty ≥ 24 → 30%) */
  wholesaleDiscount: number
  hasWholesale: boolean
  wholesaleLines: number
  /** Conteo de SKUs únicos calificantes (excluye wholesale) */
  uniqueSkus: number
  /** Desglose por línea — coincide en orden con `items` */
  perLine: Array<{
    lineSubtotal: number
    /** % aplicado: 0, 0.10, 0.15, 0.20, o 0.30 */
    discountPct: number
    /** Monto descontado a esta línea (combo: solo 1 unidad; wholesale: todas) */
    discountAmount: number
    isWholesale: boolean
    /** Cuántas unidades de esta línea reciben el descuento (1 o all) */
    discountedUnits: number
  }>
}

/**
 * Sobrecargas para retrocompat con callers viejos:
 *   applyComboDiscount(items)
 *   applyComboDiscount(subtotal, totalItems, items)   ← legacy, args 1-2 ignorados
 */
export function applyComboDiscount(items: LineItem[]): ComboDiscountResult
export function applyComboDiscount(
  subtotalOrItems: number | LineItem[],
  totalItems?: number,
  items?: LineItem[]
): ComboDiscountResult
export function applyComboDiscount(
  subtotalOrItems: number | LineItem[],
  _totalItems?: number,
  itemsArg?: LineItem[]
): ComboDiscountResult {
  const items: LineItem[] = Array.isArray(subtotalOrItems)
    ? subtotalOrItems
    : (itemsArg ?? [])

  const uniqueSkus = countQualifyingUniqueSkus(items)
  const activeTier = getActiveTier(uniqueSkus)

  let subtotal = 0
  let discount = 0
  let wholesaleDiscount = 0
  let wholesaleLines = 0

  const perLine: ComboDiscountResult["perLine"] = items.map((item) => {
    const lineSubtotal = item.unit_price * item.quantity
    subtotal += lineSubtotal

    const isWholesale = item.quantity >= WHOLESALE_MIN
    let discountPct = 0
    let discountAmount = 0
    let discountedUnits = 0

    if (isWholesale) {
      discountPct = WHOLESALE_DISCOUNT
      discountAmount = lineSubtotal * WHOLESALE_DISCOUNT
      discountedUnits = item.quantity
      wholesaleDiscount += discountAmount
      wholesaleLines += 1
    } else if (activeTier) {
      // SOLO 1 unidad recibe el descuento, no todas las de la línea
      discountPct = activeTier.discount
      discountAmount = item.unit_price * 1 * activeTier.discount
      discountedUnits = 1
    }

    discount += discountAmount
    return { lineSubtotal, discountPct, discountAmount, isWholesale, discountedUnits }
  })

  return {
    discount,
    discountedTotal: subtotal - discount,
    subtotal,
    activeTier,
    wholesaleDiscount,
    hasWholesale: wholesaleLines > 0,
    wholesaleLines,
    uniqueSkus,
    perLine,
  }
}

// ─── Compat aliases para callers no migrados ───────────────────────────────
export const LINE_TIERS = COMBO_TIERS
export const getLineTier = getActiveTier
export const getNextLineTier = getNextTier
