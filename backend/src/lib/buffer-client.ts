/**
 * Thin wrapper over Buffer's GraphQL API (api.buffer.com/graphql).
 *
 * We don't need a full GraphQL client — just one helper that POSTs a query
 * with our bearer token and throws on errors. Kept framework-agnostic so
 * both the Medusa backend routes and ad-hoc scripts can reuse it.
 *
 * Config:
 *   BUFFER_API_TOKEN      — personal access token
 *   BUFFER_IG_CHANNEL_ID  — channel id for @enrola.shop (connected in Buffer UI)
 *   BUFFER_ORG_ID         — organization id (informational, not strictly needed)
 */

const ENDPOINT = "https://api.buffer.com/graphql"

export class BufferError extends Error {
  constructor(message: string, public details?: unknown) {
    super(message)
    this.name = "BufferError"
  }
}

import {
  requireQuota,
  recordCall,
  QuotaExceededError,
} from "./buffer-quota"

export { QuotaExceededError }

/**
 * Centralized Buffer GraphQL caller.
 *
 * Flow: requireQuota → fetch → parse → recordCall (success OR 429 with
 * retry-after). Every outbound request to api.buffer.com goes through here,
 * so the 24h call budget is enforced globally — nothing bypasses it.
 *
 * If quota is exhausted, we throw BEFORE hitting Buffer. That preserves
 * our real quota and gives the UI a clean error to show ("try again in
 * HH:MM") instead of letting Buffer itself rate-limit us.
 */
async function gql<T = unknown>(
  query: string,
  variables?: Record<string, unknown>,
  meta: { caller?: string; endpoint?: string; note?: string } = {}
): Promise<T> {
  const token = process.env.BUFFER_API_TOKEN
  if (!token) throw new BufferError("BUFFER_API_TOKEN not set in environment")

  // ── Preflight: budget + rate-limit guard ─────────────────────────
  const caller = meta.caller ?? "unknown"
  const endpointTag = meta.endpoint ?? "unknown"
  try {
    await requireQuota(caller)
  } catch (e) {
    // Log the preflight rejection too so it shows in the audit trail —
    // makes it obvious WHY a cron skipped ("budget reached")
    await recordCall({
      endpoint: `${endpointTag}:preflight-skip`,
      ok: false,
      caller,
      note: (e as Error).message,
    })
    throw e
  }

  let httpStatus: number | undefined
  let rateLimitedRetryAfterS: number | undefined
  let okFlag = false

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ query, variables }),
    })
    httpStatus = res.status

    // Detect 429 via status OR via the retry-after header (Buffer's stable path)
    if (res.status === 429) {
      const retryHeader = res.headers.get("retry-after") || ""
      const retrySec = parseInt(retryHeader, 10)
      rateLimitedRetryAfterS = isFinite(retrySec) && retrySec > 0 ? retrySec : 900
    }

    const json = (await res.json()) as {
      data?: T
      errors?: Array<{ message: string; extensions?: Record<string, unknown> }>
    }

    // GraphQL-level rate limit (RATE_LIMIT_EXCEEDED extension) — also honor
    if (json.errors && json.errors.length > 0) {
      const first = json.errors[0]
      const ext = (first.extensions ?? {}) as { code?: string }
      if (ext.code === "RATE_LIMIT_EXCEEDED" && !rateLimitedRetryAfterS) {
        // GraphQL error doesn't expose retry-after; use header or fall back
        const retryHeader = res.headers.get("retry-after") || ""
        const retrySec = parseInt(retryHeader, 10)
        rateLimitedRetryAfterS = isFinite(retrySec) && retrySec > 0 ? retrySec : 3600
      }
      throw new BufferError(first.message, json.errors)
    }
    if (!json.data) throw new BufferError("empty response from Buffer", json)

    okFlag = true
    return json.data
  } finally {
    // ALWAYS record — whether success, GraphQL error, rate-limit, or network
    void recordCall({
      endpoint: endpointTag,
      httpStatus,
      ok: okFlag,
      rateLimitedRetryAfterS,
      caller,
      note: meta.note,
    })
  }
}

// ── Types ─────────────────────────────────────────────────────────
export type BufferPostType = "post" | "reel" | "story" | "carousel"

/**
 * Buffer's two enums here are named in a way that suggests the opposite of
 * what they actually mean, so it's worth spelling it out:
 *
 *   schedulingType  → how Buffer will publish to IG when the time comes
 *                     "automatic"   = Buffer posts it for you
 *                     "notification"= Buffer pings your phone to post manually
 *                     (used for link stickers, music, etc. that IG's API can't auto-publish)
 *
 *   mode            → when / how the post is shared
 *                     "customScheduled" = at a specific dueAt
 *                     "shareNow"        = immediate
 *                     "addToQueue"      = next slot in the channel's queue
 *                     "shareNext"       = top of queue
 *                     "recommendedTime" = Buffer picks a good time
 */
export type BufferSchedulingType = "automatic" | "notification"
export type BufferShareMode =
  | "customScheduled"
  | "shareNow"
  | "addToQueue"
  | "shareNext"
  | "recommendedTime"

export interface ImageAssetInput {
  url: string
  thumbnailUrl?: string
}
export interface VideoAssetInput {
  url: string
  thumbnailUrl?: string
}

export interface CreatePostInput {
  channelId: string
  schedulingType: BufferSchedulingType  // automatic | notification
  mode: BufferShareMode                 // customScheduled | shareNow | ...
  dueAt?: string                         // ISO 8601 — required when mode=customScheduled
  text?: string
  assets: {
    images?: ImageAssetInput[]
    videos?: VideoAssetInput[]
  }
  instagram: {
    type: BufferPostType
    firstComment?: string | null
    link?: string | null                 // story link sticker URL
    shouldShareToFeed: boolean
  }
}

// ── Helpers ───────────────────────────────────────────────────────
/**
 * Decide whether a given payload can be auto-published or has to be in
 * Buffer's "Notify Me" mode (pushes a notification to the user's phone
 * to complete the post manually in IG).
 *
 *   - Story with link sticker → notification (IG API can't place stickers)
 *   - Everything else → automatic
 *
 * Mirrors Buffer's own fallback logic so we don't get a "publish failed"
 * surprise at schedule time.
 */
export function pickSchedulingType(input: {
  type: BufferPostType
  link?: string | null
}): BufferSchedulingType {
  if (input.type === "story" && input.link) return "notification"
  return "automatic"
}

/** @deprecated use pickSchedulingType — kept for back-compat during refactor */
export const pickMode = pickSchedulingType

// ── Mutations ─────────────────────────────────────────────────────
/**
 * Create (and schedule) a post on Buffer.
 *
 * Note about the returned payload shape: Buffer's `createPost` returns a
 * union type (PostCreated | ValidationError | Disconnected …). We select a
 * minimal common subset. At runtime, if `__typename !== "PostCreated"` we
 * surface the error.
 */
export async function createPost(
  input: CreatePostInput,
  meta: { caller?: string; entityExternalId?: string } = {}
): Promise<{
  bufferPostId: string
  /** Mirrors what we sent; useful so the caller can show "auto" vs "notif" in the UI */
  schedulingType: BufferSchedulingType
}> {
  // Schema members (introspected): PostActionSuccess | NotFoundError
  // | UnauthorizedError | UnexpectedError | RestProxyError | LimitReachedError
  // | InvalidInputError. Include a fallback for any new variants Buffer adds.
  const mutation = /* GraphQL */ `
    mutation CreatePost($input: CreatePostInput!) {
      createPost(input: $input) {
        __typename
        ... on PostActionSuccess { post { id status dueAt } }
        ... on NotFoundError       { message }
        ... on UnauthorizedError   { message }
        ... on UnexpectedError     { message }
        ... on RestProxyError      { message link code }
        ... on LimitReachedError   { message }
        ... on InvalidInputError   { message }
      }
    }
  `

  const data = await gql<{
    createPost:
      | { __typename: "PostActionSuccess"; post: { id: string; status: string; dueAt?: string } }
      | { __typename: string; message?: string; link?: string; code?: string }
  }>(mutation, {
    input: {
      channelId: input.channelId,
      schedulingType: input.schedulingType,
      mode: input.mode,
      dueAt: input.dueAt,
      text: input.text,
      assets: input.assets,
      metadata: { instagram: input.instagram },
    },
  }, {
    caller: meta.caller,
    endpoint: "createPost",
    note: meta.entityExternalId ? `entity=${meta.entityExternalId}` : undefined,
  })

  const r = data.createPost
  if (r.__typename !== "PostActionSuccess") {
    const err = r as { __typename: string; message?: string; link?: string }
    const bits = [err.__typename]
    if (err.message) bits.push(err.message)
    if (err.link) bits.push(`see ${err.link}`)
    throw new BufferError(`Buffer rejected: ${bits.join(" — ")}`, r)
  }
  const ok = r as { post: { id: string } }
  return { bufferPostId: ok.post.id, schedulingType: input.schedulingType }
}

/**
 * Delete a scheduled Buffer post (used for "Cancelar programación").
 *
 * Return type is `DeletePostPayload` — union of { DeletePostSuccess, VoidMutationError }.
 * Distinct from the `PostActionPayload` that create/edit return; Buffer's
 * schema split these so delete can convey a "gone" signal via message.
 */
export async function deletePost(
  bufferPostId: string,
  meta: { caller?: string } = {}
): Promise<void> {
  const mutation = /* GraphQL */ `
    mutation DeletePost($id: PostId!) {
      deletePost(input: { id: $id }) {
        __typename
        ... on DeletePostSuccess { id }
        ... on VoidMutationError { message }
      }
    }
  `
  const data = await gql<{
    deletePost: { __typename: string; id?: string; message?: string }
  }>(mutation, { id: bufferPostId }, {
    caller: meta.caller,
    endpoint: "deletePost",
    note: `bufferPostId=${bufferPostId}`,
  })

  const r = data.deletePost
  if (r.__typename === "DeletePostSuccess") return
  // A "not found" error here is benign (post already gone).
  const msg = (r.message || "").toLowerCase()
  if (msg.includes("not found") || msg.includes("no longer")) return
  throw new BufferError(
    `Buffer delete rejected: ${r.__typename} — ${r.message ?? "unknown"}`,
    r
  )
}

/**
 * Check how many slots are free for a given channel on a given VE date.
 *
 * Buffer exposes `dailyPostingLimits` which returns { sent, scheduled, limit,
 * isAtLimit } per channel — the authoritative way to know "how many more can
 * I schedule today before Buffer rejects me". Free plan = limit 10.
 *
 * date defaults to today in VE. Returns null if Buffer doesn't have a daily
 * limit configured for this channel (paid plans often don't), in which case
 * the caller should trust their own cap.
 */
import { getCachedSlots, setCachedSlots } from "./buffer-quota"

type SlotResult = {
  sent: number
  scheduled: number
  limit: number | null
  available: number | null
  isAtLimit: boolean
}

export async function checkAvailableSlots(args: {
  channelId: string
  date?: string                    // YYYY-MM-DD, defaults to today VE
  caller?: string                  // for quota audit
  bypassCache?: boolean            // force-refresh (rarely needed)
}): Promise<SlotResult> {
  const date = args.date ?? todayVeIso()
  const cacheKey = `slots:${args.channelId}:${date}`

  // In-memory cache (1 hour) — cuts the most common source of churn
  // (cron + button both calling this back-to-back).
  if (!args.bypassCache) {
    const hit = getCachedSlots<SlotResult>(cacheKey)
    if (hit) {
      console.log(`[buffer-client] slot-check cache hit for ${cacheKey}`)
      return hit
    }
  }

  const [y, m, d] = date.split("-").map((n) => parseInt(n, 10))
  const dateIso = new Date(Date.UTC(y, m - 1, d, 12, 0, 0)).toISOString()

  const query = /* GraphQL */ `
    query ChannelLimits($input: DailyPostingLimitsInput!) {
      dailyPostingLimits(input: $input) {
        channelId
        sent
        scheduled
        limit
        isAtLimit
      }
    }
  `
  const data = await gql<{
    dailyPostingLimits: Array<{
      channelId: string
      sent: number
      scheduled: number
      limit: number | null
      isAtLimit: boolean
    }>
  }>(query, { input: { channelIds: [args.channelId], date: dateIso } }, {
    caller: args.caller ?? "slot-check",
    endpoint: "dailyPostingLimits",
    note: `date=${date}`,
  })

  const row = data.dailyPostingLimits.find((r) => r.channelId === args.channelId)
  const result: SlotResult = row
    ? {
        sent: row.sent,
        scheduled: row.scheduled,
        limit: row.limit,
        available:
          row.limit != null ? Math.max(0, row.limit - row.sent - row.scheduled) : null,
        isAtLimit: row.isAtLimit,
      }
    : { sent: 0, scheduled: 0, limit: null, available: null, isAtLimit: false }

  setCachedSlots(cacheKey, result, 60 * 60 * 1000) // 1h
  return result
}

function todayVeIso(): string {
  const now = new Date()
  const ve = new Date(now.getTime() - 4 * 3600 * 1000)
  return `${ve.getUTCFullYear()}-${String(ve.getUTCMonth() + 1).padStart(2, "0")}-${String(ve.getUTCDate()).padStart(2, "0")}`
}

/** Fetch the current state of a Buffer post — used by status polling. */
export async function getPost(
  bufferPostId: string,
  meta: { caller?: string } = {}
): Promise<{
  id: string
  status: string   // scheduled | sent | sending | failed | draft
  dueAt?: string
  serviceLink?: string   // filled in once Buffer publishes to IG
  error?: string
} | null> {
  const query = /* GraphQL */ `
    query Post($id: PostId!) {
      post(id: $id) {
        id status dueAt serviceLink error
      }
    }
  `
  try {
    const data = await gql<{
      post:
        | { id: string; status: string; dueAt?: string; serviceLink?: string; error?: string }
        | null
    }>(query, { id: bufferPostId }, {
      caller: meta.caller,
      endpoint: "getPost",
      note: `bufferPostId=${bufferPostId}`,
    })
    return data.post
  } catch (e) {
    // Treat "not found" as null rather than re-throwing.
    if ((e as BufferError).message.toLowerCase().includes("not found")) return null
    throw e
  }
}
