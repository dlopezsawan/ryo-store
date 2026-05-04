import { model } from "@medusajs/framework/utils"

/**
 * One row per line item in an order. Carries the cost snapshot so historical
 * margin reports stay accurate even if costs change later.
 */
const FinanzasPagoMovilLine = model.define("finanzas_pago_movil_line", {
  id: model.id().primaryKey(),
  pago_movil_id: model.text(),
  order_line_item_id: model.text().nullable(),

  product_id: model.text().nullable(),
  variant_id: model.text().nullable(),
  product_handle: model.text().nullable(),
  title: model.text(),

  quantity: model.number(),

  // Pricing snapshot
  unit_price_eur: model.number(),                   // list price per unit
  line_subtotal_eur: model.number(),                 // = unit × qty (pre-discount allocation)
  line_discount_eur: model.number().default(0),      // proportional share of order discount
  line_revenue_eur: model.number(),                  // = subtotal - discount (what cust paid for this line)

  // Cost snapshot
  unit_cost_eur: model.number().nullable(),          // null = no cost on file → cogs_complete=false
  line_cost_eur: model.number().nullable(),
  line_margin_eur: model.number().nullable(),
})

export default FinanzasPagoMovilLine
