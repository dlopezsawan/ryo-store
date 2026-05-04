/**
 * Cedula cache — local fallback for the cedula.com.ve validator.
 *
 * Whenever the primary API returns a successful lookup, we mirror the result
 * here. When the primary is rate-limited or down, the storefront falls back
 * to this table — same answer, zero external dependencies, no rate limit.
 *
 * The cache has no eviction; CNE-registered names rarely change. We track
 * `fetched_at` so we could implement TTL refreshing later if we ever care.
 */

import { Pool } from "pg"

let pool: Pool | null = null
function getPool(): Pool {
  if (!pool) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL })
  }
  return pool
}

let tableEnsured = false
async function ensureTable(): Promise<void> {
  if (tableEnsured) return
  await getPool().query(`
    CREATE TABLE IF NOT EXISTS cedula_cache (
      cedula        VARCHAR(12)  PRIMARY KEY,
      nationality   CHAR(1)      NOT NULL DEFAULT 'V',
      full_name     TEXT         NOT NULL,
      place         TEXT,
      source        VARCHAR(40)  NOT NULL DEFAULT 'cedula.com.ve',
      fetched_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      last_used_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      hit_count     INT          NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_cedula_cache_last_used ON cedula_cache(last_used_at DESC);
  `)
  tableEnsured = true
}

export interface CachedCedula {
  cedula: string
  nationality: string
  full_name: string
  place: string | null
  source: string
  fetched_at: string
  last_used_at: string
  hit_count: number
}

export async function getCachedCedula(cedula: string): Promise<CachedCedula | null> {
  await ensureTable()
  const cleaned = cedula.replace(/\D/g, "")
  if (!cleaned) return null
  const r = await getPool().query(
    `UPDATE cedula_cache
     SET last_used_at = NOW(), hit_count = hit_count + 1
     WHERE cedula = $1
     RETURNING cedula, nationality, full_name, place, source, fetched_at, last_used_at, hit_count`,
    [cleaned]
  )
  return (r.rows[0] as CachedCedula) || null
}

export async function setCachedCedula(data: {
  cedula: string
  nationality: string
  full_name: string
  place?: string | null
  source?: string
}): Promise<void> {
  await ensureTable()
  const cleaned = data.cedula.replace(/\D/g, "")
  if (!cleaned || !data.full_name) return
  await getPool().query(
    `INSERT INTO cedula_cache (cedula, nationality, full_name, place, source, fetched_at, last_used_at)
     VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
     ON CONFLICT (cedula) DO UPDATE SET
       full_name = EXCLUDED.full_name,
       place     = EXCLUDED.place,
       source    = EXCLUDED.source,
       fetched_at = NOW()`,
    [cleaned, data.nationality.toUpperCase(), data.full_name, data.place ?? null, data.source ?? "cedula.com.ve"]
  )
}

export async function getCacheStats(): Promise<{
  total: number
  hits_last_30d: number
  added_last_30d: number
}> {
  await ensureTable()
  const r = await getPool().query(`
    SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE last_used_at > NOW() - INTERVAL '30 days') AS hits_last_30d,
      COUNT(*) FILTER (WHERE fetched_at > NOW() - INTERVAL '30 days')   AS added_last_30d
    FROM cedula_cache
  `)
  const row = r.rows[0] || {}
  return {
    total: Number(row.total || 0),
    hits_last_30d: Number(row.hits_last_30d || 0),
    added_last_30d: Number(row.added_last_30d || 0),
  }
}
