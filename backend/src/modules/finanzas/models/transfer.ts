import { model } from "@medusajs/framework/utils"

/**
 * Internal wallet-to-wallet transfer. Mostly metadata — the actual balance
 * change happens via a pair of finanzas_wallet_entry rows linked by
 * source_id = transfer.id.
 */
const FinanzasTransfer = model.define("finanzas_transfer", {
  id: model.id().primaryKey(),
  from_wallet_id: model.text(),
  to_wallet_id: model.text(),
  amount: model.number(),
  currency: model.text(),
  // Optional FX info for cross-currency transfers (e.g. Bs → USDT)
  rate: model.number().nullable(),
  amount_received: model.number().nullable(),
  note: model.text().nullable(),
  transferred_at: model.dateTime(),
})

export default FinanzasTransfer
