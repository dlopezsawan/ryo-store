/**
 * POST /admin/remarketing/engine/run
 *   body: { dry_run?: boolean, max_candidates?: number, lookback_hours?: number }
 *
 * Manually triggers the remarketing engine. Useful for:
 *   - Dry-run: evaluate what WOULD fire without actually dispatching
 *   - Testing a new rule end-to-end without waiting for the 15-min cron
 */

import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { runEngine } from "../../../../../lib/remarketing-engine"

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const body = (req.body as any) || {}
    const result = await runEngine({
      dryRun: body.dry_run === true,
      maxCandidates: body.max_candidates,
      lookbackHours: body.lookback_hours,
    })
    res.json(result)
  } catch (err) {
    console.error("[engine/run POST] error:", err)
    res.status(500).json({ error: (err as Error).message })
  }
}
