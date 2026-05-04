/**
 * Cron job: snapshot BCV / CADIVI / parallel exchange rates.
 *
 * Captures the current EUR/USD/Bs rates from upstream sources and persists
 * a row in `finanzas_rate_snapshot` so reports and the recommender can
 * historize the spread over time.
 *
 * NOTE: this is a placeholder restored after the file was lost during the
 * initial GitHub-flow migration (PR #1). The implementation should be
 * rebuilt from the existing rate-fetching helpers in `lib/fx-rates.ts`,
 * which already know how to query BCV / CADIVI / paralelo. Until then,
 * the job logs and exits cleanly so the cron registry doesn't crash.
 *
 * TODO: wire to lib/fx-rates.ts and persist via the finanzas service
 * (FinanzasService.createRateSnapshots).
 */

import { ExecArgs } from "@medusajs/framework/types"

export default async function finanzasRateSnapshotJob(_args: ExecArgs) {
  console.log("[finanzas-rate-snapshot] job triggered (stub — needs reimplementation)")
  return { ok: true, stub: true }
}

export const config = {
  name: "finanzas-rate-snapshot",
  // Every 4 hours during day-time UTC (covers VE business hours).
  // Reduce frequency once the implementation lands and we can size cost.
  schedule: "0 */4 * * *",
}
