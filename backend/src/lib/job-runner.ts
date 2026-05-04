/**
 * Job runner wrapper.
 *
 * Wraps any Medusa scheduled job's default export so every execution is
 * persisted to `job_run` table for observability:
 *   - run id
 *   - start/finish timestamps
 *   - status (running/success/error/skipped)
 *   - duration_ms
 *   - error_message (on exception)
 *   - meta (optional return value)
 *
 * Usage:
 *   import { wrapJob } from "../lib/job-runner"
 *   export default wrapJob("my-job-name", async (container) => {...})
 */

import { MedusaContainer } from "@medusajs/framework"
import { Pool } from "pg"
import { randomUUID } from "crypto"

type JobHandler = (container: MedusaContainer) => Promise<any>

let sharedPool: Pool | null = null
function pool(): Pool {
  if (!sharedPool) {
    sharedPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 2,
    })
  }
  return sharedPool
}

async function safeInsert(runId: string, jobName: string): Promise<boolean> {
  try {
    await pool().query(
      `INSERT INTO job_run (id, job_name, started_at, status) VALUES ($1, $2, NOW(), 'running')`,
      [runId, jobName]
    )
    return true
  } catch (err) {
    // Table may not exist yet (pre-migration). Don't break the job.
    console.warn(`[job-runner] Could not log start for ${jobName}:`, (err as Error).message)
    return false
  }
}

async function safeUpdate(
  runId: string,
  status: "success" | "error" | "skipped",
  durationMs: number,
  errorMessage?: string,
  meta?: any
): Promise<void> {
  try {
    await pool().query(
      `UPDATE job_run SET finished_at = NOW(), status = $1, duration_ms = $2, error_message = $3, meta = $4::jsonb, updated_at = NOW() WHERE id = $5`,
      [status, durationMs, errorMessage || null, meta ? JSON.stringify(meta) : null, runId]
    )
  } catch (err) {
    console.warn(`[job-runner] Could not update run ${runId}:`, (err as Error).message)
  }
}

export function wrapJob(jobName: string, handler: JobHandler): JobHandler {
  return async (container: MedusaContainer) => {
    const runId = randomUUID()
    const startedAt = Date.now()
    const logged = await safeInsert(runId, jobName)

    try {
      const result = await handler(container)
      const duration = Date.now() - startedAt
      const status: "success" | "skipped" =
        result && typeof result === "object" && result.skipped === true ? "skipped" : "success"
      if (logged) await safeUpdate(runId, status, duration, undefined, result?.meta)
      return result
    } catch (err: any) {
      const duration = Date.now() - startedAt
      const msg = String(err?.message || err)
      if (logged) await safeUpdate(runId, "error", duration, msg)
      throw err
    }
  }
}

/**
 * Fire-and-forget helper for disabled jobs that want to log they ran but
 * skipped (e.g. SEO_SYNC_ENABLED=false). Don't need to wrap; just call this.
 */
export async function logSkippedRun(jobName: string, reason?: string): Promise<void> {
  const runId = randomUUID()
  try {
    await pool().query(
      `INSERT INTO job_run (id, job_name, started_at, finished_at, status, duration_ms, meta)
       VALUES ($1, $2, NOW(), NOW(), 'skipped', 0, $3::jsonb)`,
      [runId, jobName, JSON.stringify({ reason })]
    )
  } catch (err) {
    console.warn(`[job-runner] skip log failed for ${jobName}:`, (err as Error).message)
  }
}
