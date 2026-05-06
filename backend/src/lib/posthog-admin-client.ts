/**
 * PostHog Admin API client (server-side).
 *
 * Uses the Personal API Key (phx_...) with scope `read` on all resources.
 * Needed for querying data beyond what the public /capture/ endpoint provides:
 *   - Feature flags (list + update active/rollout)
 *   - Error tracking issues
 *   - Events via HogQL
 *   - Experiments
 *   - Surveys
 *
 * Never expose the Personal API Key to the browser — these endpoints only
 * run server-side in /admin/dev/posthog/*.
 */

const API_HOST = process.env.POSTHOG_HOST || "https://us.i.posthog.com"
const PROJECT_ID = process.env.POSTHOG_PROJECT_ID || ""
const PERSONAL_KEY = process.env.POSTHOG_PERSONAL_API_KEY || ""

export function isAdminConfigured(): boolean {
  return !!PROJECT_ID && !!PERSONAL_KEY
}

async function phAdminFetch<T = any>(
  path: string,
  init: RequestInit = {}
): Promise<T | null> {
  if (!isAdminConfigured()) {
    console.warn("[posthog-admin] not configured — skipping call to", path)
    return null
  }
  try {
    const res = await fetch(`${API_HOST}${path}`, {
      ...init,
      headers: {
        authorization: `Bearer ${PERSONAL_KEY}`,
        "content-type": "application/json",
        ...(init.headers || {}),
      },
    })
    if (!res.ok) {
      console.error(`[posthog-admin] ${init.method || "GET"} ${path} → ${res.status}`, await res.text().catch(() => ""))
      return null
    }
    return (await res.json()) as T
  } catch (err) {
    console.error(`[posthog-admin] fetch error ${path}:`, (err as Error).message)
    return null
  }
}

// ─── Feature Flags ──────────────────────────────────────────────────────────

export type FeatureFlag = {
  id: number
  key: string
  name?: string
  filters?: Record<string, unknown>
  active: boolean
  rollout_percentage?: number | null
  created_at: string
  created_by?: { email?: string } | null
  is_simple_flag?: boolean
  performed_rollback?: boolean
}

export async function listFeatureFlags(): Promise<FeatureFlag[]> {
  const r = await phAdminFetch<{ results: FeatureFlag[] }>(
    `/api/projects/${PROJECT_ID}/feature_flags/?limit=100`
  )
  return r?.results || []
}

export async function toggleFeatureFlag(id: number, active: boolean): Promise<boolean> {
  const r = await phAdminFetch(
    `/api/projects/${PROJECT_ID}/feature_flags/${id}/`,
    {
      method: "PATCH",
      body: JSON.stringify({ active }),
    }
  )
  return r != null
}

export async function updateFeatureFlagRollout(id: number, rolloutPct: number): Promise<boolean> {
  // For a simple boolean flag, we need to update filters.groups[0].rollout_percentage
  const flag = await phAdminFetch<FeatureFlag>(`/api/projects/${PROJECT_ID}/feature_flags/${id}/`)
  if (!flag) return false
  const filters = (flag.filters || {}) as any
  if (!filters.groups || !filters.groups.length) {
    filters.groups = [{ properties: [], rollout_percentage: rolloutPct }]
  } else {
    filters.groups[0].rollout_percentage = rolloutPct
  }
  const r = await phAdminFetch(
    `/api/projects/${PROJECT_ID}/feature_flags/${id}/`,
    { method: "PATCH", body: JSON.stringify({ filters }) }
  )
  return r != null
}

// ─── HogQL query helper ─────────────────────────────────────────────────────

export async function hogqlQuery(sql: string): Promise<{ columns: string[]; results: any[][] } | null> {
  const r = await phAdminFetch<{ columns: string[]; results: any[][] }>(
    `/api/projects/${PROJECT_ID}/query/`,
    {
      method: "POST",
      body: JSON.stringify({ query: { kind: "HogQLQuery", query: sql } }),
    }
  )
  if (!r) return null
  return { columns: r.columns || [], results: r.results || [] }
}

// ─── Events summary ─────────────────────────────────────────────────────────

export async function getRecentEventCounts(days = 7): Promise<Array<{ event: string; count: number }>> {
  const res = await hogqlQuery(
    `SELECT event, count() FROM events WHERE timestamp >= now() - INTERVAL ${days} DAY GROUP BY event ORDER BY count() DESC LIMIT 50`
  )
  if (!res) return []
  return res.results.map((r) => ({ event: String(r[0]), count: Number(r[1]) }))
}

export async function getTotalEventsCount(days = 7): Promise<number> {
  const res = await hogqlQuery(
    `SELECT count() FROM events WHERE timestamp >= now() - INTERVAL ${days} DAY`
  )
  return Number(res?.results?.[0]?.[0] || 0)
}

export async function getUniqueUsersCount(days = 7): Promise<number> {
  const res = await hogqlQuery(
    `SELECT count(DISTINCT distinct_id) FROM events WHERE timestamp >= now() - INTERVAL ${days} DAY`
  )
  return Number(res?.results?.[0]?.[0] || 0)
}

// ─── Error Tracking ─────────────────────────────────────────────────────────

export type ErrorIssue = {
  event: string
  message?: string
  type?: string
  url?: string
  count: number
  last_seen: string
  distinct_id?: string
}

export async function getRecentErrors(days = 7, limit = 30): Promise<ErrorIssue[]> {
  const res = await hogqlQuery(`
    SELECT
      properties.$exception_type AS type,
      properties.$exception_message AS message,
      properties.$current_url AS url,
      count() AS n,
      max(timestamp) AS last_seen,
      any(distinct_id) AS any_distinct_id
    FROM events
    WHERE event = '$exception'
      AND timestamp >= now() - INTERVAL ${days} DAY
    GROUP BY type, message, url
    ORDER BY n DESC
    LIMIT ${limit}
  `)
  if (!res) return []
  return res.results.map((r) => ({
    event: "$exception",
    type: r[0] ? String(r[0]) : undefined,
    message: r[1] ? String(r[1]) : undefined,
    url: r[2] ? String(r[2]) : undefined,
    count: Number(r[3]),
    last_seen: String(r[4]),
    distinct_id: r[5] ? String(r[5]) : undefined,
  }))
}

// ─── Persons count (tolerates ClickHouse warmup where events table may be empty) ──

export async function getPersonsCount(): Promise<number> {
  const r = await phAdminFetch<{ count: number; results: unknown[] }>(
    `/api/projects/${PROJECT_ID}/persons/?limit=1`
  )
  return Number(r?.count || 0)
}

// ─── Experiments ────────────────────────────────────────────────────────────

export async function listExperiments(): Promise<any[]> {
  const r = await phAdminFetch<{ results: any[] }>(
    `/api/projects/${PROJECT_ID}/experiments/`
  )
  return r?.results || []
}

// ─── Surveys ────────────────────────────────────────────────────────────────

export async function getSurveyResponsesCount(): Promise<number> {
  const r = await phAdminFetch<{ count: number }>(
    `/api/projects/${PROJECT_ID}/surveys/responses_count/`
  )
  return Number(r?.count || 0)
}

export function getPosthogProjectUrl(): string {
  const host = API_HOST.replace("i.posthog.com", "posthog.com")
  return `${host}/project/${PROJECT_ID}`
}

// ─── Person-level queries (for User 360) ────────────────────────────────────

export type PostHogPerson = {
  id: string
  uuid: string
  distinct_ids: string[]
  properties: Record<string, any>
  created_at: string
}

export async function findPersonByEmail(email: string): Promise<PostHogPerson | null> {
  const r = await phAdminFetch<{ results: PostHogPerson[] }>(
    `/api/projects/${PROJECT_ID}/persons/?search=${encodeURIComponent(email)}&limit=10`
  )
  if (!r?.results?.length) return null
  // Prefer exact email match
  const exact = r.results.find((p) => (p.properties?.email || "").toLowerCase() === email.toLowerCase())
  return exact || r.results[0]
}

export async function findPersonByDistinctId(distinctId: string): Promise<PostHogPerson | null> {
  const r = await phAdminFetch<{ results: PostHogPerson[] }>(
    `/api/projects/${PROJECT_ID}/persons/?distinct_id=${encodeURIComponent(distinctId)}&limit=5`
  )
  return r?.results?.[0] || null
}

/**
 * Get events for a person's distinct_ids. Uses HogQL to avoid the legacy
 * /persons/:id/events endpoint deprecated in newer PostHog versions.
 */
export async function getEventsForDistinctIds(
  distinctIds: string[],
  limit = 200
): Promise<Array<{
  timestamp: string
  event: string
  properties: Record<string, any>
  distinct_id: string
}>> {
  if (!distinctIds.length) return []
  // HogQL needs string-quoted array literals; sanitize minimally
  const safe = distinctIds.map((d) => `'${d.replace(/'/g, "''")}'`).join(",")
  const r = await phAdminFetch<{ results: any[][] }>(
    `/api/projects/${PROJECT_ID}/query/`,
    {
      method: "POST",
      body: JSON.stringify({
        query: {
          kind: "HogQLQuery",
          query: `
            SELECT timestamp, event, properties, distinct_id
            FROM events
            WHERE distinct_id IN (${safe})
            ORDER BY timestamp DESC
            LIMIT ${limit}
          `,
        },
      }),
    }
  )
  if (!r?.results) return []
  return r.results.map((row) => ({
    timestamp: String(row[0]),
    event: String(row[1]),
    properties: typeof row[2] === "string" ? safeJson(row[2]) : row[2] || {},
    distinct_id: String(row[3]),
  }))
}

function safeJson(s: string): any {
  try { return JSON.parse(s) } catch { return {} }
}

/**
 * Aggregate behavioral metrics for a set of distinct_ids.
 */
export async function getBehaviorForDistinctIds(
  distinctIds: string[],
  days = 30
): Promise<{
  sessions: number
  pageviews: number
  product_views: number
  cart_events: number
  checkout_starts: number
  orders: number
  add_to_carts: number
  whatsapp_clicks: number
  first_seen_at: string | null
  last_seen_at: string | null
  top_pages: Array<{ url: string; views: number }>
  top_products_viewed: Array<{ product_id: string; title: string; views: number; last_viewed_at: string }>
}> {
  const empty = {
    sessions: 0, pageviews: 0, product_views: 0, cart_events: 0,
    checkout_starts: 0, orders: 0, add_to_carts: 0, whatsapp_clicks: 0,
    first_seen_at: null as string | null, last_seen_at: null as string | null,
    top_pages: [], top_products_viewed: [],
  }
  if (!distinctIds.length) return empty

  const safe = distinctIds.map((d) => `'${d.replace(/'/g, "''")}'`).join(",")

  // Metrics aggregate
  const metrics = await phAdminFetch<{ results: any[][] }>(
    `/api/projects/${PROJECT_ID}/query/`,
    {
      method: "POST",
      body: JSON.stringify({
        query: {
          kind: "HogQLQuery",
          query: `
            SELECT
              count(DISTINCT properties.$session_id) AS sessions,
              countIf(event = '$pageview') AS pageviews,
              countIf(event = 'product_viewed') AS product_views,
              countIf(event IN ('cart_viewed', 'add_to_cart', 'product_removed_from_cart')) AS cart_events,
              countIf(event = 'checkout_started') AS checkout_starts,
              countIf(event = 'order_placed') AS orders,
              countIf(event = 'add_to_cart') AS add_to_carts,
              countIf(event = 'whatsapp_clicked') AS whatsapp_clicks,
              min(timestamp) AS first_seen,
              max(timestamp) AS last_seen
            FROM events
            WHERE distinct_id IN (${safe})
              AND timestamp >= now() - INTERVAL ${days} DAY
          `,
        },
      }),
    }
  )
  const m = metrics?.results?.[0] || []

  // Top pages
  const pagesRes = await phAdminFetch<{ results: any[][] }>(
    `/api/projects/${PROJECT_ID}/query/`,
    {
      method: "POST",
      body: JSON.stringify({
        query: {
          kind: "HogQLQuery",
          query: `
            SELECT properties.$current_url AS url, count() AS n
            FROM events
            WHERE distinct_id IN (${safe})
              AND event = '$pageview'
              AND timestamp >= now() - INTERVAL ${days} DAY
            GROUP BY url
            ORDER BY n DESC
            LIMIT 10
          `,
        },
      }),
    }
  )
  const topPages = (pagesRes?.results || []).map((r) => ({
    url: String(r[0] || ""),
    views: Number(r[1]),
  }))

  // Top products viewed
  const productsRes = await phAdminFetch<{ results: any[][] }>(
    `/api/projects/${PROJECT_ID}/query/`,
    {
      method: "POST",
      body: JSON.stringify({
        query: {
          kind: "HogQLQuery",
          query: `
            SELECT
              properties.product_id AS pid,
              any(properties.title) AS title,
              count() AS views,
              max(timestamp) AS last_viewed
            FROM events
            WHERE distinct_id IN (${safe})
              AND event = 'product_viewed'
              AND timestamp >= now() - INTERVAL ${days} DAY
            GROUP BY pid
            ORDER BY views DESC
            LIMIT 15
          `,
        },
      }),
    }
  )
  const topProducts = (productsRes?.results || []).map((r) => ({
    product_id: String(r[0] || ""),
    title: String(r[1] || ""),
    views: Number(r[2]),
    last_viewed_at: String(r[3]),
  }))

  return {
    sessions: Number(m[0] || 0),
    pageviews: Number(m[1] || 0),
    product_views: Number(m[2] || 0),
    cart_events: Number(m[3] || 0),
    checkout_starts: Number(m[4] || 0),
    orders: Number(m[5] || 0),
    add_to_carts: Number(m[6] || 0),
    whatsapp_clicks: Number(m[7] || 0),
    first_seen_at: m[8] ? String(m[8]) : null,
    last_seen_at: m[9] ? String(m[9]) : null,
    top_pages: topPages,
    top_products_viewed: topProducts,
  }
}

// ─── Session Recordings (replays) ───────────────────────────────────────────

export type SessionRecording = {
  id: string
  distinct_id: string
  start_time: string
  end_time: string
  duration: number
  click_count?: number
  keypress_count?: number
  console_error_count?: number
  start_url?: string
  person_email: string | null
  person_name: string | null
  url: string
}

/**
 * List session recordings via the PostHog Recordings API.
 *
 * Filters:
 *   - distinct_id: scope to one user (used by User 360)
 *   - search: free-text — passed to PostHog `search` param which
 *     matches across distinct_ids + URLs
 *   - days: how far back (default 7)
 *
 * The PostHog endpoint is `/api/environments/:project_id/session_recordings/`
 * for newer projects; older projects still use `/api/projects/:id/session_recordings/`.
 * We try the newer one first and fall back. Both accept the same query
 * shape — if PostHog rolls them under one alias later, both stop working
 * and we'll need to refresh — but today both are live.
 */
export async function listSessionRecordings(args: {
  distinctId?: string
  search?: string
  days?: number
  limit?: number
}): Promise<SessionRecording[]> {
  if (!isAdminConfigured()) return []
  const days = args.days ?? 7
  const limit = Math.min(Math.max(1, args.limit ?? 30), 100)

  const since = new Date(Date.now() - days * 86_400_000).toISOString()
  const params = new URLSearchParams()
  params.set("limit", String(limit))
  params.set("date_from", since)
  if (args.distinctId) params.set("distinct_id", args.distinctId)
  if (args.search) params.set("search", args.search)

  // Try newer "environments" path first, fall back to "projects".
  const tryPaths = [
    `/api/environments/${PROJECT_ID}/session_recordings/?${params}`,
    `/api/projects/${PROJECT_ID}/session_recordings/?${params}`,
  ]
  let raw: { results?: PostHogRawRecording[] } | null = null
  for (const p of tryPaths) {
    raw = await phAdminFetch<{ results?: PostHogRawRecording[] }>(p)
    if (raw?.results) break
  }
  if (!raw?.results) return []

  const projectUrl = getPosthogProjectUrl()
  return raw.results.map((r) => ({
    id: r.id,
    distinct_id: r.distinct_id || r.person?.distinct_ids?.[0] || "",
    start_time: r.start_time,
    end_time: r.end_time,
    duration: Number(r.recording_duration || 0),
    click_count: r.click_count,
    keypress_count: r.keypress_count,
    console_error_count: r.console_error_count,
    start_url: r.start_url || undefined,
    person_email: (r.person?.properties?.email as string) || null,
    person_name:
      [r.person?.properties?.first_name, r.person?.properties?.last_name].filter(Boolean).join(" ") ||
      null,
    url: `${projectUrl}/replay/${r.id}`,
  }))
}

type PostHogRawRecording = {
  id: string
  distinct_id?: string
  start_time: string
  end_time: string
  recording_duration?: number
  click_count?: number
  keypress_count?: number
  console_error_count?: number
  start_url?: string | null
  person?: {
    distinct_ids?: string[]
    properties?: Record<string, unknown>
  } | null
}

// ─── Heatmap (autocapture click aggregations) ───────────────────────────────

export type HeatmapClick = {
  page: string
  selector: string
  text: string
  click_count: number
  rage_count: number
  dead_count: number
  unique_users: number
}

/**
 * Heatmap data via HogQL — PostHog doesn't have a clean public REST
 * endpoint for heatmap aggregations, but $autocapture click events
 * carry everything we need (selector, $el_text, $current_url) and the
 * `rageclick` / `dead_click` events are emitted separately.
 *
 * The `page` filter, when provided, scopes by exact URL match. When
 * empty we aggregate across all pages — useful for the "top elements
 * site-wide" view in the panel.
 */
export async function getHeatmapClicks(args: {
  page?: string
  days?: number
  limit?: number
}): Promise<{ clicks: HeatmapClick[]; pages: Array<{ page: string; views: number; users: number }> }> {
  if (!isAdminConfigured()) return { clicks: [], pages: [] }
  const days = args.days ?? 7
  const limit = Math.min(Math.max(1, args.limit ?? 30), 100)
  const pageFilter = args.page ? `AND properties.$current_url = '${args.page.replace(/'/g, "''")}'` : ""

  // Top click targets — only from $autocapture clicks, joined with rage/dead
  // counts via subqueries so the main scan stays cheap.
  const clicksQ = await phAdminFetch<{ results: unknown[][] }>(
    `/api/projects/${PROJECT_ID}/query/`,
    {
      method: "POST",
      body: JSON.stringify({
        query: {
          kind: "HogQLQuery",
          query: `
            SELECT
              properties.$current_url AS page,
              properties.$el_text AS text,
              properties.$ce_version AS selector,
              count() AS click_count,
              countIf(event = '$rageclick') AS rage_count,
              countIf(event = '$dead_click') AS dead_count,
              count(DISTINCT distinct_id) AS unique_users
            FROM events
            WHERE event IN ('$autocapture', '$rageclick', '$dead_click')
              AND properties.$event_type = 'click'
              ${pageFilter}
              AND timestamp >= now() - INTERVAL ${days} DAY
            GROUP BY page, text, selector
            ORDER BY click_count DESC
            LIMIT ${limit}
          `,
        },
      }),
    }
  )
  const clicks: HeatmapClick[] = (clicksQ?.results || []).map((r) => ({
    page: String(r[0] || ""),
    text: String(r[1] || "").slice(0, 80),
    selector: String(r[2] || ""),
    click_count: Number(r[3] || 0),
    rage_count: Number(r[4] || 0),
    dead_count: Number(r[5] || 0),
    unique_users: Number(r[6] || 0),
  }))

  // List of pages with traffic — feeds the "Todas las páginas" select
  // in the panel so the operator can pick a specific page to drill into.
  const pagesQ = await phAdminFetch<{ results: unknown[][] }>(
    `/api/projects/${PROJECT_ID}/query/`,
    {
      method: "POST",
      body: JSON.stringify({
        query: {
          kind: "HogQLQuery",
          query: `
            SELECT properties.$current_url AS page,
                   count() AS views,
                   count(DISTINCT distinct_id) AS users
            FROM events
            WHERE event = '$pageview'
              AND timestamp >= now() - INTERVAL ${days} DAY
              AND properties.$current_url IS NOT NULL
            GROUP BY page
            ORDER BY views DESC
            LIMIT 50
          `,
        },
      }),
    }
  )
  const pages = (pagesQ?.results || []).map((r) => ({
    page: String(r[0] || ""),
    views: Number(r[1] || 0),
    users: Number(r[2] || 0),
  }))

  return { clicks, pages }
}
