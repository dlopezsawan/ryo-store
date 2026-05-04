import { model } from "@medusajs/framework/utils"

/**
 * Historical FX rate samples. Captured hourly by the rate-snapshot job so
 * we can:
 *   - chart spread BCV vs paralelo over time
 *   - back-compute "what would Bs X have been at any past timestamp"
 *   - feed the conversion recommender
 */
const FinanzasRateSnapshot = model.define("finanzas_rate_snapshot", {
  id: model.id().primaryKey(),
  taken_at: model.dateTime(),
  // Bs per 1 EUR (BCV) — primary rate used by the storefront
  bcv_eur_to_bs: model.number().nullable(),
  // Bs per 1 USD (BCV)
  bcv_usd_to_bs: model.number().nullable(),
  // Bs per 1 USDT (paralelo / Binance P2P)
  paralelo_usdt_to_bs: model.number().nullable(),
  // Spread paralelo / BCV ratio (e.g. 1.13 = +13% over BCV) — convenience
  spread_ratio: model.number().nullable(),
  // free-form: which API answered which field
  source: model.json().nullable(),
})

export default FinanzasRateSnapshot
