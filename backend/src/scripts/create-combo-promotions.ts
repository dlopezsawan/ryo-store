/**
 * Tear-down idempotente de las promociones legacy COMBO10/15/20/WHOLESALE30.
 *
 * El nuevo modelo de descuentos (combo por VARIEDAD a 1 unidad por línea +
 * mayorista por VOLUMEN del mismo SKU) NO usa el sistema de promociones de
 * Medusa porque las reglas no son expresables como rules estándar
 * (qualification por unique-SKU count + apply solo a 1 unidad por línea).
 * En su lugar, el endpoint POST /store/carts/:id/recalculate-combos aplica
 * los descuentos como line-item adjustments custom.
 *
 * Este script borra cualquier promoción residual con esos códigos para que
 * no interfiera con el flujo nuevo. Idempotente: si no hay promociones, no
 * hace nada.
 *
 * Run:
 *   docker exec ryo-store-medusa-1 npx medusa exec ./src/scripts/create-combo-promotions.js
 */

import { ExecArgs } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"

const LEGACY_CODES = ["COMBO10", "COMBO15", "COMBO20", "WHOLESALE30"]

export default async function teardownComboPromotions({ container }: ExecArgs) {
  const promotionService = container.resolve(Modules.PROMOTION)

  let deleted = 0
  for (const code of LEGACY_CODES) {
    const existing = await promotionService.listPromotions({ code })
    for (const p of existing) {
      try {
        await promotionService.deletePromotions(p.id)
        console.log(`[combo-teardown] 🗑  Deleted ${code} (id=${p.id})`)
        deleted++
      } catch (err) {
        console.warn(`[combo-teardown] could not delete ${code}:`, (err as Error).message)
      }
    }
  }
  if (deleted === 0) {
    console.log(`[combo-teardown] No legacy combo promotions found — nothing to remove.`)
  } else {
    console.log(`[combo-teardown] Done — removed ${deleted} legacy promotions.`)
  }
  console.log(`[combo-teardown] Discounts now applied via POST /store/carts/:id/recalculate-combos.`)
}
