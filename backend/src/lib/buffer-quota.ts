/**
 * Buffer API quota guard.
 *
 * Every call to api.buffer.com goes through this module. It:
 *   - Blocks calls preemptively when we're over our self-imposed budget
 *     (default 60 calls/24h, well under Buffer Free's ~400)
 *   - Blocks calls while we know we're rate-limited (429 honored)
 *   - Logs every call to `social_buffer_call` so we can audit usage
 *   - Caches short-lived in-memory hints for fast gating on hot paths
 *
 * The web admin + cron are "buffered" against Buffer itself — they batch
 * and consolidate calls, rather than spamming. When a legit call would
 * exceed quota, we throw so the caller can surface a clear "wait X min"
 * message to the user instead of getting a generic 429 from Buffer.
 */
import { Client, Pool } from "pg"

export const BUFFER_DAILY_CAP = parseInt(process.env.BUFFER_DAILY_CAP || "60", 10)
export const BUFFER_WINDOW_MS = 24 * 3600 * 1000
/** We wake up 30min after the stated retry-after (no earlier) to avoid racing. */
const RATE_LIMIT_PADDING_MS = 30 * 60 * 1000

/** Parsed retry-after window. null if not rate limited. */
let rateLimitedUntilMs: number | null = null

function pool(): Pool {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL not set")
  return new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
}

export class QuotaExceededError extends Error {
  constructor(
    message: string,
    public readonly kind: "daily_budget" | "rate_limited",
    public readonly retryAtMs?: number,
    public readonly used?: number
  ) {
    super(message)
    this.name = "QuotaExceededError"
  }
}

/**
 * Ask the DB: how many Buffer calls have we made in the last 24h?
 */
export async function countCallsInLast24h(): Promise<number> {
  const p = pool()
  try {
    const { rows } = await p.query(
      `SELECT count(*)::int AS n FROM social_buffer_call WHERE called_at >= now() - INTERVAL '24 hours'`
    )
    return rows[0]?.n ?? 0
  } finally {
    await p.end()
  }
}

/**
 * DB + in-memory hint for "we're rate limited until…". Uses whichever is
 * most restrictive (later timestamp wins).
 */
export async function getActiveRateLimitUntil(): Promise<number | null> {
  const p = pool()
  try {
    const { rows } = await p.query(
      `SELECT called_at, rate_limited_retry_after_s
         FROM social_buffer_call
        WHERE rate_limited_retry_after_s IS NOT NULL
          AND called_at + (rate_limited_retry_after_s * INTERVAL '1 second') > now()
        ORDER BY called_at DESC LIMIT 1`
    )
    const dbUntil = rows[0]
      ? new Date(rows[0].called_at).getTime() +
        rows[0].rate_limited_retry_after_s * 1000 +
        RATE_LIMIT_PADDING_MS
      : null
    const inMem = rateLimitedUntilMs
    if (dbUntil && inMem) return Math.max(dbUntil, inMem)
    return dbUntil ?? inMem
  } finally {
    await p.end()
  }
}

/**
 * Pre-flight — call this BEFORE hitting Buffer. Throws if we'd bust quota.
 *
 * The idea: the only way to call Buffer is via the wrapped gql() in
 * buffer-client.ts, which invokes this first. Any new code that forgets
 * will get a "quota used ?/?" log but still be subject to Buffer's own
 * hard limit as a final safety net.
 */
export async function requireQuota(caller: string): Promise<{
  used: number
  remaining: number
}> {
  // Check rate-limit first — cheaper than counting
  const until = await getActiveRateLimitUntil()
  if (until && Date.now() < until) {
    const mins = Math.ceil((until - Date.now()) / 60000)
    throw new QuotaExceededError(
      `Buffer rate-limited. Retry after ${new Date(until).toISOString()} (~${mins} min).`,
      "rate_limited",
      until
    )
  }

  // Then check daily cap
  const used = await countCallsInLast24h()
  if (used >= BUFFER_DAILY_CAP) {
    throw new QuotaExceededError(
      `Daily self-imposed Buffer budget reached (${used}/${BUFFER_DAILY_CAP} en 24h). Esperá al reset.`,
      "daily_budget",
      undefined,
      used
    )
  }

  console.log(`[buffer-quota] ok · ${used + 1}/${BUFFER_DAILY_CAP} · caller=${caller}`)
  return { used, remaining: BUFFER_DAILY_CAP - used }
}

/**
 * Record a completed call. Always call this after hitting Buffer, success
 * or not, so the count is accurate.
 *
 * If the call was rate-limited (429), pass retryAfterSeconds so we honor
 * it on subsequent requireQuota() checks.
 */
export async function recordCall(args: {
  endpoint: string
  httpStatus?: number
  ok: boolean
  rateLimitedRetryAfterS?: number
  caller?: string
  note?: string
}): Promise<void> {
  if (args.rateLimitedRetryAfterS != null) {
    rateLimitedUntilMs =
      Date.now() + args.rateLimitedRetryAfterS * 1000 + RATE_LIMIT_PADDING_MS
  }

  const id = `bufc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const p = pool()
  try {
    await p.query(
      `INSERT INTO social_buffer_call
         (id, endpoint, http_status, ok, rate_limited_retry_after_s, caller, note)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        id,
        args.endpoint,
        args.httpStatus ?? null,
        args.ok,
        args.rateLimitedRetryAfterS ?? null,
        args.caller ?? null,
        args.note?.slice(0, 500) ?? null,
      ]
    )
  } catch (e) {
    // Don't let logging failures break the caller — just warn
    console.warn("[buffer-quota] recordCall failed:", (e as Error).message)
  } finally {
    await p.end()
  }
}

/** Status snapshot for the admin UI / health check. */
export async function status(): Promise<{
  used_24h: number
  cap: number
  remaining: number
  rate_limited_until: string | null
  reset_at: string
  window_hours: number
}> {
  const used = await countCallsInLast24h()
  const until = await getActiveRateLimitUntil()

  // "reset_at" = the moment the oldest call in-window ages out. If 0 calls,
  // there's nothing to reset, so we return now.
  const p = pool()
  let resetAt = new Date()
  try {
    const { rows } = await p.query(
      `SELECT called_at FROM social_buffer_call
        WHERE called_at >= now() - INTERVAL '24 hours'
        ORDER BY called_at ASC LIMIT 1`
    )
    if (rows[0]?.called_at) {
      resetAt = new Date(new Date(rows[0].called_at).getTime() + BUFFER_WINDOW_MS)
    }
  } finally {
    await p.end()
  }

  return {
    used_24h: used,
    cap: BUFFER_DAILY_CAP,
    remaining: Math.max(0, BUFFER_DAILY_CAP - used),
    rate_limited_until: until ? new Date(until).toISOString() : null,
    reset_at: resetAt.toISOString(),
    window_hours: 24,
  }
}

// ─── Short-lived caches ─────────────────────────────────────────────
// These are in-memory (per-process). A restart wipes them; worst case we
// make 1 extra call. Good trade-off for simplicity vs Redis dependency.

const slotCache: {
  key: string
  expiresAt: number
  value: unknown
} = { key: "", expiresAt: 0, value: null }

export function getCachedSlots<T>(key: string): T | null {
  if (slotCache.key !== key) return null
  if (Date.now() >= slotCache.expiresAt) return null
  return slotCache.value as T
}

export function setCachedSlots<T>(key: string, value: T, ttlMs: number): void {
  slotCache.key = key
  slotCache.expiresAt = Date.now() + ttlMs
  slotCache.value = value
}

// ─── Debounce for manual endpoints ──────────────────────────────────
/**
 * Returns the timestamp of the last successful call from this caller tag
 * in the last `windowMs`, or null. Lets the schedule-today endpoint refuse
 * double-fires in quick succession.
 */
export async function lastCallFrom(
  caller: string,
  windowMs: number
): Promise<Date | null> {
  const p = pool()
  try {
    const { rows } = await p.query(
      `SELECT called_at FROM social_buffer_call
        WHERE caller = $1
          AND called_at >= now() - make_interval(secs => $2)
        ORDER BY called_at DESC LIMIT 1`,
      [caller, Math.ceil(windowMs / 1000)]
    )
    return rows[0]?.called_at ? new Date(rows[0].called_at) : null
  } finally {
    await p.end()
  }
}
