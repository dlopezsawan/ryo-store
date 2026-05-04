/**
 * Deploy / runtime info — DEV tab.
 *
 * What we can surface safely (no docker.sock mount):
 *   - Node.js process memory + uptime
 *   - Node + OS version
 *   - Env vars: NODE_ENV, GIT_SHA, IMAGE_TAG, BUILD_DATE (if injected at build)
 *   - DB connection stats
 *   - Package versions of key deps
 */
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Pool } from "pg"
import * as os from "os"
import * as fs from "fs"
import * as path from "path"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`
}

export async function GET(_req: MedusaRequest, res: MedusaResponse) {
  // Node.js process info
  const mem = process.memoryUsage()
  const uptime = process.uptime() // seconds

  // Key dep versions from package.json
  let deps: Record<string, string> = {}
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8"))
    const all = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) }
    const keys = [
      "@medusajs/medusa",
      "@medusajs/framework",
      "@medusajs/admin-sdk",
      "next",
      "react",
      "pg",
      "posthog-node",
    ]
    keys.forEach((k) => { if (all[k]) deps[k] = all[k] })
  } catch {
    /* ignore */
  }

  // DB connection check
  let dbOk = false
  let dbLatency = 0
  let dbSize = "?"
  try {
    const t = Date.now()
    const r = await pool.query(`SELECT pg_size_pretty(pg_database_size(current_database())) AS size, current_database() AS db, version() AS version`)
    dbLatency = Date.now() - t
    dbOk = true
    dbSize = r.rows[0]?.size || "?"
  } catch {
    /* noop */
  }

  // Table sizes (top 10)
  let tableSizes: Array<{ table: string; size: string; rows: number | null }> = []
  try {
    const r = await pool.query(`
      SELECT
        c.relname AS table,
        pg_size_pretty(pg_total_relation_size(c.oid)) AS size,
        c.reltuples::bigint AS rows
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relkind = 'r' AND n.nspname = 'public'
      ORDER BY pg_total_relation_size(c.oid) DESC
      LIMIT 15
    `)
    tableSizes = r.rows.map((x: any) => ({ table: x.table, size: x.size, rows: Number(x.rows) || null }))
  } catch {}

  res.json({
    process: {
      node_version: process.version,
      uptime_seconds: Math.round(uptime),
      uptime_human: fmtUptime(uptime),
      pid: process.pid,
      platform: process.platform,
      arch: process.arch,
    },
    memory: {
      rss: fmtBytes(mem.rss),
      rss_bytes: mem.rss,
      heap_used: fmtBytes(mem.heapUsed),
      heap_total: fmtBytes(mem.heapTotal),
      external: fmtBytes(mem.external),
    },
    system: {
      hostname: os.hostname(),
      cpus: os.cpus().length,
      total_memory: fmtBytes(os.totalmem()),
      free_memory: fmtBytes(os.freemem()),
      load_avg: os.loadavg().map((x) => x.toFixed(2)),
    },
    build: {
      node_env: process.env.NODE_ENV || "unknown",
      git_sha: process.env.GIT_SHA || null,
      image_tag: process.env.IMAGE_TAG || null,
      build_date: process.env.BUILD_DATE || null,
    },
    db: {
      connected: dbOk,
      latency_ms: dbLatency,
      size: dbSize,
    },
    top_tables: tableSizes,
    key_deps: deps,
    checked_at: new Date().toISOString(),
  })
}

function fmtUptime(sec: number): string {
  const d = Math.floor(sec / 86400)
  const h = Math.floor((sec % 86400) / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.floor(sec % 60)
  if (d > 0) return `${d}d ${h}h ${m}m`
  if (h > 0) return `${h}h ${m}m ${s}s`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}
