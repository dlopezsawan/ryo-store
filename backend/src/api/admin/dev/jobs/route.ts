/**
 * DEV tab — cron jobs monitor.
 *
 * Returns every job from the registry, merged with its execution history.
 * Fields per job:
 *   - name, schedule, description, category, gated_by
 *   - last_run (timestamp, status, duration_ms, error_message)
 *   - last_success (timestamp)
 *   - last_error (timestamp, message)
 *   - runs_7d (counts by status)
 *   - success_rate_7d
 *   - health_status: "healthy" | "warn" | "error" | "never_ran"
 */
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Pool } from "pg"
import { JOB_REGISTRY } from "../../../../lib/job-registry"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

/**
 * Very small cron-next-run calculator. Supports star, numeric, step (slash-N),
 * and simple ranges. Not a full cron parser — good enough for our use.
 */
function nextRunFromCron(expr: string): Date | null {
  const parts = expr.trim().split(/\s+/)
  if (parts.length !== 5) return null
  const [minPart, hourPart, domPart, monPart, dowPart] = parts

  function parseField(p: string, min: number, max: number): number[] {
    if (p === "*") return Array.from({ length: max - min + 1 }, (_, i) => i + min)
    if (p.startsWith("*/")) {
      const step = parseInt(p.slice(2), 10)
      if (!Number.isFinite(step) || step <= 0) return []
      const arr: number[] = []
      for (let v = min; v <= max; v += step) arr.push(v)
      return arr
    }
    return p.split(",")
      .map((x) => parseInt(x, 10))
      .filter((n) => Number.isFinite(n) && n >= min && n <= max)
  }

  const mins = parseField(minPart, 0, 59)
  const hours = parseField(hourPart, 0, 23)
  const doms = parseField(domPart, 1, 31)
  const mons = parseField(monPart, 1, 12)
  const dows = parseField(dowPart, 0, 6)
  if (!mins.length || !hours.length || !doms.length || !mons.length || !dows.length) return null

  const now = new Date()
  for (let d = 0; d < 8; d++) {
    const cand = new Date(now)
    cand.setUTCDate(now.getUTCDate() + d)
    for (const h of hours) {
      for (const m of mins) {
        cand.setUTCHours(h, m, 0, 0)
        if (cand > now &&
          doms.includes(cand.getUTCDate()) &&
          mons.includes(cand.getUTCMonth() + 1) &&
          dows.includes(cand.getUTCDay())
        ) {
          return cand
        }
      }
    }
  }
  return null
}

function healthFor(lastRun: any, runs7d: { success: number; error: number; total: number }): "healthy" | "warn" | "error" | "never_ran" {
  if (!lastRun) return "never_ran"
  if (lastRun.status === "error") return "error"
  if (runs7d.total > 0 && runs7d.error / runs7d.total >= 0.3) return "warn"
  return "healthy"
}

export async function GET(_req: MedusaRequest, res: MedusaResponse) {
  // Pull per-job latest run + 7d stats
  const latestRes = await pool.query(`
    SELECT DISTINCT ON (job_name) job_name, started_at, finished_at, status, duration_ms, error_message
    FROM job_run
    WHERE deleted_at IS NULL
    ORDER BY job_name, started_at DESC
  `)
  const latestMap = new Map<string, any>()
  latestRes.rows.forEach((r: any) => latestMap.set(r.job_name, r))

  const lastSuccessRes = await pool.query(`
    SELECT DISTINCT ON (job_name) job_name, started_at
    FROM job_run
    WHERE deleted_at IS NULL AND status = 'success'
    ORDER BY job_name, started_at DESC
  `)
  const lastSuccessMap = new Map<string, string>()
  lastSuccessRes.rows.forEach((r: any) => lastSuccessMap.set(r.job_name, r.started_at))

  const lastErrorRes = await pool.query(`
    SELECT DISTINCT ON (job_name) job_name, started_at, error_message
    FROM job_run
    WHERE deleted_at IS NULL AND status = 'error'
    ORDER BY job_name, started_at DESC
  `)
  const lastErrorMap = new Map<string, any>()
  lastErrorRes.rows.forEach((r: any) => lastErrorMap.set(r.job_name, r))

  const statsRes = await pool.query(`
    SELECT job_name,
      COUNT(*) FILTER (WHERE status = 'success')::int AS success,
      COUNT(*) FILTER (WHERE status = 'error')::int AS error,
      COUNT(*) FILTER (WHERE status = 'skipped')::int AS skipped,
      COUNT(*)::int AS total,
      AVG(duration_ms)::int AS avg_duration_ms
    FROM job_run
    WHERE deleted_at IS NULL AND started_at >= NOW() - INTERVAL '7 days'
    GROUP BY job_name
  `)
  const statsMap = new Map<string, any>()
  statsRes.rows.forEach((r: any) => statsMap.set(r.job_name, r))

  // Build response: registry ∪ observed (in case a job was retired but history remains)
  const seenNames = new Set(JOB_REGISTRY.map((j) => j.name))
  const orphanNames = Array.from(latestMap.keys()).filter((n) => !seenNames.has(n))

  const items = [
    ...JOB_REGISTRY.map((j) => ({
      name: j.name,
      schedule: j.schedule,
      description: j.description,
      category: j.category,
      gated_by: j.gatedBy || null,
      in_registry: true,
      last_run: latestMap.get(j.name) || null,
      last_success_at: lastSuccessMap.get(j.name) || null,
      last_error: lastErrorMap.get(j.name) || null,
      stats_7d: statsMap.get(j.name) || { success: 0, error: 0, skipped: 0, total: 0, avg_duration_ms: null },
      next_run_utc: nextRunFromCron(j.schedule)?.toISOString() || null,
    })),
    ...orphanNames.map((n) => ({
      name: n,
      schedule: null,
      description: "(huérfano — no en registry)",
      category: "system",
      gated_by: null,
      in_registry: false,
      last_run: latestMap.get(n),
      last_success_at: lastSuccessMap.get(n) || null,
      last_error: lastErrorMap.get(n) || null,
      stats_7d: statsMap.get(n) || { success: 0, error: 0, skipped: 0, total: 0, avg_duration_ms: null },
      next_run_utc: null,
    })),
  ].map((it: any) => ({
    ...it,
    health: healthFor(it.last_run, it.stats_7d),
  }))

  // Summary counts
  const summary = items.reduce(
    (acc: any, it) => {
      acc[it.health]++
      return acc
    },
    { healthy: 0, warn: 0, error: 0, never_ran: 0 }
  )

  res.json({
    total: items.length,
    summary,
    jobs: items,
  })
}
