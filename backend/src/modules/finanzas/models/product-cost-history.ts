import { model } from "@medusajs/framework/utils"

/**
 * Versioned cost trail per variant. Whenever the live `finanzas_product_cost`
 * row is updated, the previous version is closed (`valid_to=now`) and a new
 * version is opened. The currently-active version has `valid_to=null`.
 *
 * This lets us answer: "what cost did we book against order #5 at the time it
 * was placed?" without depending on the snapshot stored on
 * `finanzas_pago_movil_line` (which is the actual booked cost — this table
 * is the timeline of what we *thought* the cost was).
 */
const FinanzasProductCostHistory = model.define("finanzas_product_cost_history", {
  id: model.id().primaryKey(),
  variant_id: model.text(),
  unit_cost_eur: model.number(),
  valid_from: model.dateTime(),
  valid_to: model.dateTime().nullable(),
  changed_by: model.text().nullable(),
  note: model.text().nullable(),
})

export default FinanzasProductCostHistory
