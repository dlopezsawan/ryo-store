import { model } from "@medusajs/framework/utils"

/**
 * Destination wallets where money lives. We start with two:
 *   - "Daniel Bs"  (currency: bs)   — Pago Móvil incoming
 *   - "Daniel USDT" (currency: usdt) — after we swap the bs to usdt
 *
 * Balance is *derived* from transactions, not stored on the row.
 */
const FinanzasWallet = model.define("finanzas_wallet", {
  id: model.id().primaryKey(),
  name: model.text(),
  currency: model.text(), // "bs" | "usdt" | "eur" | "usd"
  description: model.text().nullable(),
  is_active: model.boolean().default(true),
  sort_order: model.number().default(0),
})

export default FinanzasWallet
