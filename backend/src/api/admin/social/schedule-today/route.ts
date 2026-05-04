import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { SOCIAL_MODULE } from "../../../../modules/social"
import SocialModuleService from "../../../../modules/social/service"
import {
  createPost as bufferCreatePost,
  checkAvailableSlots,
  pickSchedulingType,
  type BufferPostType,
  type CreatePostInput,
  type ImageAssetInput,
  type VideoAssetInput,
} from "../../../../lib/buffer-client"
import { lastCallFrom } from "../../../../lib/buffer-quota"

/** Minimum gap between manual runs. Prevents double-click burns. */
const MANUAL_DEBOUNCE_MS = 10 * 60 * 1000  // 10 min

/**
 * POST /admin/social/schedule-today  body: { date?: "YYYY-MM-DD", limit?: number }
 *
 * Same logic as the daily cron, but firable on-demand from the admin UI so
 * the user can preview and kick it manually when needed (e.g. first day of
 * the month, or when they just approved more and don't want to wait for 06:00).
 *
 *   - date: VE date to schedule. Defaults to today in VE.
 *   - limit: cap on items pushed (default 10, matching Buffer Free tier).
 *
 * Returns a breakdown of { ok, failed, deferred }.
 */

const VE_OFFSET_HOURS = -4
const ASSET_BASE = process.env.BACKEND_PUBLIC_URL || "https://api.enrola.shop"

function absMedia(u: string): string {
  if (!u) return u
  if (u.startsWith("http://") || u.startsWith("https://")) return u
  return `${ASSET_BASE}${u.startsWith("/") ? "" : "/"}${u}`
}

function postTypeForPost(format: string, nMedia: number): BufferPostType {
  const f = (format || "").toLowerCase()
  if (f === "reel") return "reel"
  if (f.startsWith("carr") || nMedia > 1) return "carousel"
  return "post"
}

/** VE-local [start, end) for a given VE calendar date (YYYY-MM-DD). */
function veDayWindow(dateStr: string): { start: Date; end: Date } {
  const [y, m, d] = dateStr.split("-").map((n) => parseInt(n, 10))
  const startUtc = Date.UTC(y, m - 1, d, 0, 0, 0) - VE_OFFSET_HOURS * 3600 * 1000
  return { start: new Date(startUtc), end: new Date(startUtc + 24 * 3600 * 1000) }
}

function todayVe(): string {
  const now = new Date()
  const ve = new Date(now.getTime() + VE_OFFSET_HOURS * 3600 * 1000)
  return `${ve.getUTCFullYear()}-${String(ve.getUTCMonth() + 1).padStart(2, "0")}-${String(ve.getUTCDate()).padStart(2, "0")}`
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const svc: SocialModuleService = req.scope.resolve(SOCIAL_MODULE)
  const body = (req.body ?? {}) as { date?: string; limit?: number }

  const channelId = process.env.BUFFER_IG_CHANNEL_ID
  if (!channelId) return res.status(500).json({ message: "BUFFER_IG_CHANNEL_ID not set" })

  const dateStr = body.date && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : todayVe()
  const requestedLimit = Math.max(1, Math.min(50, body.limit ?? 10))
  const { start, end } = veDayWindow(dateStr)

  // ── Debounce · refuse back-to-back clicks ─────────────────────────
  // Protects against the user smashing the button when it's slow to respond.
  // The cron has its own cadence (once/day) so this only hits manual callers.
  const lastManual = await lastCallFrom("schedule-today", MANUAL_DEBOUNCE_MS)
  if (lastManual) {
    const ageSec = Math.floor((Date.now() - lastManual.getTime()) / 1000)
    const waitSec = Math.ceil(MANUAL_DEBOUNCE_MS / 1000) - ageSec
    return res.status(429).json({
      ok: false,
      reason: "debounced",
      message: `Ya corriste "Programar hoy" hace ${Math.floor(ageSec / 60)} min. Esperá ${Math.ceil(waitSec / 60)} min más para evitar quemar quota.`,
    })
  }

  // ── Step 1 · Check Buffer availability before we push anything.
  // If they report isAtLimit, we abort the whole run — no partial state.
  let slotInfo: {
    sent: number
    scheduled: number
    limit: number | null
    available: number | null
    isAtLimit: boolean
  } | null = null
  try {
    slotInfo = await checkAvailableSlots({
      channelId,
      date: dateStr,
      caller: "schedule-today",
    })
  } catch (e) {
    console.warn(`[schedule-today] slot check failed: ${(e as Error).message}`)
  }

  if (slotInfo?.isAtLimit) {
    return res.status(409).json({
      ok: false,
      reason: "buffer_at_limit",
      message: `Buffer ya tiene ${slotInfo.scheduled} programados + ${slotInfo.sent} enviados para ${dateStr} (límite ${slotInfo.limit}). Esperá a que haga espacio antes de pushear más.`,
      slots: slotInfo,
    })
  }

  // Effective limit = the tighter of (what user asked) and (what Buffer has free)
  const limit =
    slotInfo?.available != null
      ? Math.max(0, Math.min(requestedLimit, slotInfo.available))
      : requestedLimit

  const posts = await svc.listSocialPosts(
    {
      status: "approved",
      scheduled_at: { $gte: start, $lt: end },
    } as never,
    { order: { scheduled_at: "ASC" } } as never
  )
  const stories = await svc.listSocialStories(
    {
      status: "approved",
      scheduled_at: { $gte: start, $lt: end },
    } as never,
    { order: { scheduled_at: "ASC" } } as never
  )

  type P = {
    id: string; external_id: string; format: string; caption: string | null;
    cover_url: string | null; media_urls: string[] | null; scheduled_at: Date | null;
  }
  type S = {
    id: string; external_id: string; media_url: string | null; link_url: string | null;
    scheduled_at: Date | null;
  }

  type Cand =
    | { kind: "post"; row: P; ts: number }
    | { kind: "story"; row: S; ts: number }
  const queue: Cand[] = [
    ...(posts as unknown as P[]).map<Cand>((p) => ({ kind: "post", row: p, ts: p.scheduled_at?.getTime() ?? 0 })),
    ...(stories as unknown as S[]).map<Cand>((s) => ({ kind: "story", row: s, ts: s.scheduled_at?.getTime() ?? 0 })),
  ].sort((a, b) => a.ts - b.ts)

  const batch = queue.slice(0, limit)
  const deferred = queue.slice(limit).map((c) => `${c.kind}:${c.row.external_id}`)

  const failures: Array<{ id: string; reason: string }> = []
  let ok = 0
  let rateLimited = false

  for (const item of batch) {
    // If Buffer already told us we're rate-limited, stop burning attempts.
    // Leave remaining items in `approved` — they'll be retried by the cron
    // or next manual click once the limit lifts (~15-30 min).
    if (rateLimited) {
      failures.push({ id: item.row.external_id, reason: "deferred (rate-limited)" })
      continue
    }
    try {
      if (item.kind === "post") {
        const p = item.row
        const mediaUrls = Array.isArray(p.media_urls) ? p.media_urls : []
        if (mediaUrls.length === 0 && !p.cover_url) throw new Error("no media")
        const type = postTypeForPost(p.format, mediaUrls.length)
        const assets: CreatePostInput["assets"] = {}
        if (type === "reel") {
          const videoUrl = mediaUrls.find((u) => /\.(mp4|mov|m4v)$/i.test(u)) ?? mediaUrls[0] ?? p.cover_url!
          const video: VideoAssetInput = {
            url: absMedia(videoUrl),
            thumbnailUrl: p.cover_url ? absMedia(p.cover_url) : undefined,
          }
          assets.videos = [video]
        } else {
          const sources = mediaUrls.length > 0 ? mediaUrls : [p.cover_url!]
          assets.images = sources.map<ImageAssetInput>((u) => ({ url: absMedia(u) }))
        }
        const input: CreatePostInput = {
          channelId,
          schedulingType: pickSchedulingType({ type, link: null }),
          mode: "customScheduled",
          dueAt: (p.scheduled_at ?? new Date(Date.now() + 60_000)).toISOString(),
          text: p.caption ?? undefined,
          assets,
          instagram: { type, shouldShareToFeed: true },
        }
        const { bufferPostId } = await bufferCreatePost(input, {
          caller: "schedule-today",
          entityExternalId: item.row.external_id,
        })
        await svc.updateSocialPosts({
          id: p.id,
          status: "scheduled",
          buffer_post_id: bufferPostId,
          failure_reason: null,
        } as never)
      } else {
        const s = item.row
        if (!s.media_url) throw new Error("no media")
        const isVideo = /\.(mp4|mov|m4v)$/i.test(s.media_url)
        const assets: CreatePostInput["assets"] = isVideo
          ? { videos: [{ url: absMedia(s.media_url) }] }
          : { images: [{ url: absMedia(s.media_url) }] }
        const input: CreatePostInput = {
          channelId,
          schedulingType: pickSchedulingType({ type: "story", link: s.link_url }),
          mode: "customScheduled",
          dueAt: (s.scheduled_at ?? new Date(Date.now() + 60_000)).toISOString(),
          assets,
          instagram: { type: "story", link: s.link_url ?? null, shouldShareToFeed: false },
        }
        const { bufferPostId } = await bufferCreatePost(input, {
          caller: "schedule-today",
          entityExternalId: item.row.external_id,
        })
        await svc.updateSocialStories({
          id: s.id,
          status: "scheduled",
          buffer_post_id: bufferPostId,
          failure_reason: null,
        } as never)
      }
      ok++
      await new Promise((r) => setTimeout(r, 500))
    } catch (e) {
      const msg = (e as Error).message
      const isRateLimit = /too many requests|rate.?limit|429/i.test(msg)
      failures.push({ id: item.row.external_id, reason: msg })

      if (isRateLimit) {
        // Buffer cut us off for ~15-30 min. Don't poison DB state — leave
        // the items in `approved` so the cron or next manual run picks them
        // up cleanly once the window resets.
        rateLimited = true
      } else {
        // Real per-item failure (bad media, missing caption, etc.) → mark failed
        // so the user sees it in the UI and can fix that specific item.
        try {
          const patch = { id: item.row.id, status: "failed", failure_reason: msg.slice(0, 1000) } as never
          if (item.kind === "post") await svc.updateSocialPosts(patch)
          else await svc.updateSocialStories(patch)
        } catch {
          /* ignore */
        }
      }
    }
  }

  return res.json({
    ok: true,
    date: dateStr,
    candidates: queue.length,
    scheduled: ok,
    failed: failures,
    deferred,
    limit,
    buffer_slots: slotInfo,
    rate_limited: rateLimited,
  })
}
