/**
 * Remarketing Engine Job — runs every 15 minutes.
 *
 * Scans candidates from PostHog (last 72h) and Medusa customers (last 180d),
 * computes signals, matches enabled rules, dispatches via email / WhatsApp,
 * and logs each fire for observability + conversion attribution.
 *
 * Controlled by `remarketing_settings.engine_enabled` (defaults to false).
 * Individual rules default to disabled — nothing goes out until the operator
 * enables them from the admin UI.
 */

import { MedusaContainer } from "@medusajs/framework"
import { runEngine } from "../lib/remarketing-engine"
import { getSetting } from "../lib/remarketing-db"
import { wrapJob } from "../lib/job-runner"

async function remarketingEngineJob(_container: MedusaContainer) {
  const globalSetting = await getSetting("engine_enabled")
  const enabled = (globalSetting?.enabled as boolean) !== false // default ON (but rules start OFF)
  if (!enabled) {
    console.log("[remarketing-engine] Disabled via settings, skipping")
    return { skipped: true }
  }

  const dryRun = (globalSetting?.dry_run as boolean) === true

  console.log(`[remarketing-engine] Running${dryRun ? " (dry-run)" : ""}…`)
  const result = await runEngine({
    dryRun,
    maxCandidates: (globalSetting?.max_candidates as number) || 500,
    lookbackHours: (globalSetting?.lookback_hours as number) || 72,
  })

  console.log(
    `[remarketing-engine] done in ${result.duration_ms}ms — ` +
    `candidates=${result.candidates_scanned}, signals=${result.signals_detected}, ` +
    `matched=${result.rules_matched}, sent=${result.fires_sent}, ` +
    `skipped=${result.fires_skipped}, failed=${result.fires_failed}`
  )

  return {
    meta: {
      dry_run: result.dry_run,
      candidates_scanned: result.candidates_scanned,
      signals_detected: result.signals_detected,
      fires_sent: result.fires_sent,
      fires_skipped: result.fires_skipped,
      fires_failed: result.fires_failed,
      by_rule: result.by_rule,
    },
  }
}

export default wrapJob("remarketing-engine", remarketingEngineJob)

export const config = {
  name: "remarketing-engine",
  schedule: "*/15 * * * *", // every 15 minutes
}
