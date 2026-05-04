import { model } from "@medusajs/framework/utils"

/**
 * A real Bs → USDT swap. Multiple conversions can chip away at one pago_movil
 * (parciales). The service updates the parent's `bs_converted_total` and
 * `status` on each insert/delete.
 */
const FinanzasConversion = model.define("finanzas_conversion", {
  id: model.id().primaryKey(),
  pago_movil_id: model.text(),

  amount_bs: model.number(),              // Bs being converted out of pago_movil
  amount_usdt: model.number(),            // actual USDT received
  rate_bs_per_usdt: model.number(),       // = amount_bs / amount_usdt

  source_wallet_id: model.text().nullable(), // Bs wallet
  dest_wallet_id: model.text().nullable(),   // USDT wallet
  note: model.text().nullable(),
  converted_at: model.dateTime(),
})

export default FinanzasConversion
