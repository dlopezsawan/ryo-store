import { model } from "@medusajs/framework/utils"

/**
 * Unit cost (what *we* paid for the product, including assigned shipping) per
 * product variant. Stored in EUR — same display unit as the storefront.
 * One row per variant_id; updated in place. Each `finanzas_pago_movil_line`
 * snapshots this value at order time so historical orders aren't affected by
 * later cost edits.
 */
const FinanzasProductCost = model.define("finanzas_product_cost", {
  id: model.id().primaryKey(),
  variant_id: model.text().unique(),
  product_id: model.text().nullable(),
  product_handle: model.text().nullable(),
  variant_title: model.text().nullable(),
  unit_cost_eur: model.number(),
  notes: model.text().nullable(),
})

export default FinanzasProductCost
