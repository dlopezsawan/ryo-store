/**
 * Cron job: snapshot BCV / parallel exchange rates.
 *
 * Captures the current EUR/USD/USDT rates from upstream sources (alcambio.app
 * for BCV official + Binance P2P sell average) and persists a row in
 * `finanzas_rate_snapshot` so reports and the recommender can historize
 * the spread over time.
 *
 * Used by:
 * - Finanzas dashboard charts (BCV vs paralelo over the month)
 * - The recommender (decide WHEN to convert pending Bs balances based on
 *   recent paralelo trend)
 * - Back-computing "what was rate X at timestamp T?" for past pago_movils
 *
 * Schedule: every 4 hours (rates change a few times a day in VE; 4h gives
 * enough resolution without burning the alcambio API quota).
 */

import { ExecArgs } from "@medusajs/framework/types"
import FinanzasModuleService from "../modules/finanzas/service"
import { FINANZAS_MODULE } from "../modules/finanzas"
import { getFxRates } from "../lib/fx-rates"

export default async function finanzasRateSnapshotJob({ container }: ExecArgs) {
  const log = (msg: string) => console.log(`[finanzas-rate-snapshot] ${msg}`)

  let rates
  try {
    // getFxRates() has a 10-minute in-memory cache; force-bypass via
    // direct fetch logic isn't exposed yet, but at the cron's 4h cadence
    // every call will be a fresh fetch (cache long-expired).
    rates = await getFxRates()
  } catch (err) {
    log(`failed to fetch rates from alcambio: ${(err as Error).message}`)
    // Return without persisting — better an absent sample than a fake one
    // that would distort the spread chart.
    return { ok: false, reason: "fetch_failed", error: (err as Error).message }
  }

  // spread_ratio = paralelo / BCV. Values around 1.0 mean tight spread;
  // 1.10+ means the parallel rate is 10%+ over BCV (typical pre-2025);
  // 1.00 or below means BCV caught up (rare). We store as a number so
  // the dashboard can chart it without re-deriving.
  const spread =
    rates.eur_to_bs > 0 && rates.usdt_to_bs > 0
      ? rates.usdt_to_bs / rates.eur_to_bs
      : null

  const fin = container.resolve(FINANZAS_MODULE) as FinanzasModuleService

  const created = await fin.createFinanzasRateSnapshots({
    taken_at: new Date(),
    bcv_eur_to_bs: rates.eur_to_bs,
    bcv_usd_to_bs: rates.usd_to_bs,
    paralelo_usdt_to_bs: rates.usdt_to_bs,
    spread_ratio: spread !== null ? Math.round(spread * 10000) / 10000 : null,
    source: {
      provider: rates.source,
      fetched_at: rates.fetched_at,
    },
  })

  const row = Array.isArray(created) ? created[0] : created
  log(
    `✓ snapshot saved (id=${row?.id}) — EUR=${rates.eur_to_bs} BCV, ` +
      `USDT=${rates.usdt_to_bs} paralelo, spread=${spread?.toFixed(4) ?? "n/a"}`
  )

  return {
    ok: true,
    snapshot_id: row?.id,
    eur_to_bs: rates.eur_to_bs,
    usdt_to_bs: rates.usdt_to_bs,
    spread_ratio: spread,
  }
}

export const config = {
  name: "finanzas-rate-snapshot",
  // Every 4 hours UTC — covers VE morning/midday/evening + overnight
  schedule: "0 */4 * * *",
}
