/**
 * POST /admin/finanzas/jobs/:name/run
 *   Manually trigger a finanzas job. Useful for first-run smoke tests and
 *   for forcing an immediate snapshot/recurring-generation without waiting
 *   for the next cron firing.
 *
 * Allowed names:
 *   - "rate-snapshot"
 *   - "recurring-expenses"
 */

import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import rateSnapshotJob from "../../../../../../jobs/finanzas-rate-snapshot"
import recurringExpensesJob from "../../../../../../jobs/finanzas-recurring-expenses"

const JOBS: Record<string, (container: unknown) => Promise<unknown>> = {
  "rate-snapshot": rateSnapshotJob as unknown as (c: unknown) => Promise<unknown>,
  "recurring-expenses": recurringExpensesJob as unknown as (c: unknown) => Promise<unknown>,
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const name = req.params.name
  const job = JOBS[name]
  if (!job) {
    return res
      .status(404)
      .json({ error: `unknown job ${name}. Allowed: ${Object.keys(JOBS).join(", ")}` })
  }
  try {
    const result = await job(req.scope)
    res.json({ ran: name, result })
  } catch (err) {
    res
      .status(500)
      .json({ error: (err as Error).message, stack: (err as Error).stack })
  }
}
