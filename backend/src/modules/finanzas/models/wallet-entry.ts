import { model } from "@medusajs/framework/utils"

/**
 * Append-only ledger of every money movement on every wallet.
 *
 * One row = one balance change. Wallet balance is `SUM(amount)` over this
 * table for the wallet, so audits / time-travel reports are trivial.
 *
 * `source_type` discriminates:
 *   - "pago_movil"      — Bs that came in from an order (signed +)
 *   - "conversion_out"  — Bs leaving a Bs wallet during a swap (-)
 *   - "conversion_in"   — USDT entering a USDT wallet during a swap (+)
 *   - "expense"         — money paid out to a vendor (-)
 *   - "transfer_out"    — sent to another internal wallet (-)
 *   - "transfer_in"     — received from another internal wallet (+)
 *   - "adjustment"      — manual correction (signed)
 *
 * `source_id` references the originating row (pago_movil id, conversion id…).
 * `reconciled_at` is for future bank reconciliation use cases.
 */
const FinanzasWalletEntry = model.define("finanzas_wallet_entry", {
  id: model.id().primaryKey(),
  wallet_id: model.text(),
  amount: model.number(),       // signed: + inflow / − outflow
  currency: model.text(),
  source_type: model.text(),
  source_id: model.text().nullable(),
  note: model.text().nullable(),
  entry_at: model.dateTime(),
  reconciled_at: model.dateTime().nullable(),
})

export default FinanzasWalletEntry
