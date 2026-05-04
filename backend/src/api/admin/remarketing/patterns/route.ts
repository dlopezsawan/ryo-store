/**
 * GET /admin/remarketing/patterns
 *   ?force=1   bypass the 60s cache
 *
 * Returns aggregated patterns across the entire user base —
 * see `PatternsSummary` for shape.
 */

import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { getPatternsSummary } from "../../../../lib/remarketing-patterns"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const force = req.query.force === "1"
    const summary = await getPatternsSummary(force)
    res.json(summary)
  } catch (err) {
    console.error("[patterns GET] error:", err)
    res.status(500).json({ error: (err as Error).message })
  }
}
