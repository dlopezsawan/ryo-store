/**
 * Umami API client.
 *
 * Auth via username/password (Umami v2 issues JWT). Token cached in-memory
 * until ~1h before expiry.
 *
 * Env vars:
 *   UMAMI_URL           https://analytics.enrola.shop
 *   UMAMI_USERNAME      admin
 *   UMAMI_PASSWORD      umami (default — change it!)
 *   UMAMI_WEBSITE_ID    uuid from /api/websites
 */

const URL_BASE = process.env.UMAMI_URL || "https://analytics.enrola.shop"
const WEBSITE_ID = process.env.UMAMI_WEBSITE_ID || ""

let cachedToken: { token: string; expiresAt: number } | null = null

async function login(): Promise<string | null> {
  const username = process.env.UMAMI_USERNAME || "admin"
  const password = process.env.UMAMI_PASSWORD || "umami"
  try {
    const res = await fetch(`${URL_BASE}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username, password }),
    })
    if (!res.ok) {
      console.error("[umami] login failed:", res.status)
      return null
    }
    const data = (await res.json()) as { token: string }
    return data.token
  } catch (err) {
    console.error("[umami] login error:", err)
    return null
  }
}

async function getToken(): Promise<string | null> {
  const now = Date.now()
  if (cachedToken && cachedToken.expiresAt > now + 60_000) return cachedToken.token
  const tok = await login()
  if (!tok) return null
  // Umami tokens last ~24h; cache for 23h
  cachedToken = { token: tok, expiresAt: now + 23 * 3600_000 }
  return tok
}

async function umamiRequest<T>(path: string): Promise<T | null> {
  if (!WEBSITE_ID) {
    console.warn("[umami] UMAMI_WEBSITE_ID not configured")
    return null
  }
  const token = await getToken()
  if (!token) return null

  const res = await fetch(`${URL_BASE}${path}`, {
    headers: { authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    // Token may have expired — force re-login once
    if (res.status === 401) {
      cachedToken = null
      const tok2 = await getToken()
      if (!tok2) return null
      const retry = await fetch(`${URL_BASE}${path}`, {
        headers: { authorization: `Bearer ${tok2}` },
      })
      if (!retry.ok) {
        console.error("[umami]", path, retry.status)
        return null
      }
      return (await retry.json()) as T
    }
    console.error("[umami]", path, res.status, await res.text())
    return null
  }
  return (await res.json()) as T
}

// Time window helper — returns [startAt, endAt] in ms
export function getWindow(days: number): { startAt: number; endAt: number } {
  const endAt = Date.now()
  const startAt = endAt - days * 86400_000
  return { startAt, endAt }
}

// ── API surface ──────────────────────────────────────────────────────────────

// Umami v3 flat format + `comparison` object (prev period)
type RawStatsV3 = {
  pageviews: number
  visitors: number
  visits: number
  bounces: number
  totaltime: number
  comparison?: {
    pageviews: number
    visitors: number
    visits: number
    bounces: number
    totaltime: number
  }
}

export type UmamiStats = {
  pageviews: { value: number; prev: number }
  visitors: { value: number; prev: number }
  visits: { value: number; prev: number }
  bounces: { value: number; prev: number }
  totaltime: { value: number; prev: number }
}

export async function getStats(days: number): Promise<UmamiStats | null> {
  const { startAt, endAt } = getWindow(days)
  const raw = await umamiRequest<RawStatsV3>(
    `/api/websites/${WEBSITE_ID}/stats?startAt=${startAt}&endAt=${endAt}`
  )
  if (!raw) return null
  const cmp = raw.comparison || { pageviews: 0, visitors: 0, visits: 0, bounces: 0, totaltime: 0 }
  return {
    pageviews: { value: raw.pageviews || 0, prev: cmp.pageviews || 0 },
    visitors: { value: raw.visitors || 0, prev: cmp.visitors || 0 },
    visits: { value: raw.visits || 0, prev: cmp.visits || 0 },
    bounces: { value: raw.bounces || 0, prev: cmp.bounces || 0 },
    totaltime: { value: raw.totaltime || 0, prev: cmp.totaltime || 0 },
  }
}

export type UmamiActive = { visitors: number }

export async function getActive(): Promise<UmamiActive | null> {
  return umamiRequest<UmamiActive>(`/api/websites/${WEBSITE_ID}/active`)
}

export type UmamiTimeSeriesPoint = { x: string; y: number }

export async function getPageviewsSeries(days: number): Promise<{
  pageviews: UmamiTimeSeriesPoint[]
  sessions: UmamiTimeSeriesPoint[]
} | null> {
  const { startAt, endAt } = getWindow(days)
  const unit = days <= 2 ? "hour" : "day"
  return umamiRequest(
    `/api/websites/${WEBSITE_ID}/pageviews?startAt=${startAt}&endAt=${endAt}&unit=${unit}&timezone=UTC`
  )
}

export type UmamiMetric = { x: string; y: number }

export async function getMetric(
  days: number,
  // Umami v3 type values (`url` was renamed to `path`)
  type: "path" | "referrer" | "browser" | "os" | "device" | "country" | "region" | "city" | "language" | "screen" | "title" | "event" | "tag",
  limit = 20
): Promise<UmamiMetric[] | null> {
  const { startAt, endAt } = getWindow(days)
  return umamiRequest<UmamiMetric[]>(
    `/api/websites/${WEBSITE_ID}/metrics?startAt=${startAt}&endAt=${endAt}&type=${type}&limit=${limit}`
  )
}

export function isConfigured(): boolean {
  return !!process.env.UMAMI_URL && !!process.env.UMAMI_WEBSITE_ID
}
