import { model } from "@medusajs/framework/utils"

/**
 * A real Bs → USDT swap. Two flavors:
 *
 * 1. Linked to a pago_movil (pago_movil_id IS NOT NULL):
 *    Multiple conversions can chip away at one pago_movil (parciales).
 *    The service updates the parent's `bs_converted_total` and `status`
 *    on each insert/delete.
 *
 * 2. Standalone (pago_movil_id IS NULL):
 *    Operator converted Bs from the business's own balance — not tied
 *    to a customer payment. Used when there's surplus Bs in the wallet
 *    from manual sales, refunds, accumulated change, etc. Just records
 *    the swap in the ledger; no pago_movil to update.
 */
const FinanzasConversion = model.define("finanzas_conversion", {
  id: model.id().primaryKey(),
  // Nullable to support standalone conversions (case 2 above). Used to
  // be required, which silently broke the panel's "Nueva conversión"
  // modal — every submit returned 400.
  pago_movil_id: model.text().nullable(),

  amount_bs: model.number(),              // Bs being converted
  amount_usdt: model.number(),            // actual USDT received
  rate_bs_per_usdt: model.number(),       // = amount_bs / amount_usdt

  source_wallet_id: model.text().nullable(), // Bs wallet
  dest_wallet_id: model.text().nullable(),   // USDT wallet
  note: model.text().nullable(),
  converted_at: model.dateTime(),
})

export default FinanzasConversion
