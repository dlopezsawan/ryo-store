/**
 * Daily Buffer scheduler — runs every morning at 06:00 Venezuela time.
 *
 * Picks up to `DAILY_BUFFER_LIMIT` (default 10, matching Buffer's Free-tier
 * per-channel queue limit) of today's approved posts+stories and pushes
 * them to Buffer with their existing `scheduled_at`.
 *
 * Why this design:
 *   - Buffer Free only allows 10 scheduled items per channel at any moment.
 *     If we bulk-dump the whole month the 11th onwards get rejected.
 *   - Publishing a day at a time keeps us inside the quota every day —
 *     yesterday's 10 have already fired by 06:00 today, freeing the queue.
 *   - Morning run means the user has a chance to see the day's plan in the
 *     admin + adjust before the first 14:20 VE publication.
 *
 * Selection:
 *   - status = "approved"
 *   - scheduled_at BETWEEN today 00:00 VE AND tomorrow 00:00 VE
 *   - ordered by scheduled_at ASC
 *   - first N (default 10)
 */
import { MedusaContainer } from "@medusajs/framework"
import { SOCIAL_MODULE } from "../modules/social"
import type SocialModuleService from "../modules/social/service"
import {
  createPost as bufferCreatePost,
  checkAvailableSlots,
  pickSchedulingType,
  type BufferPostType,
  type CreatePostInput,
  type ImageAssetInput,
  type VideoAssetInput,
} from "../lib/buffer-client"
import { wrapJob } from "../lib/job-runner"

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

/**
 * VE "today" window in UTC: [VE-midnight-today, VE-midnight-tomorrow).
 * VE is UTC-4 year-round so this is deterministic.
 */
function veDayWindowUtc(): { start: Date; end: Date; label: string } {
  const now = new Date()
  // Shift "now" by -4h so .UTC year/month/day matches the VE calendar date
  const veNow = new Date(now.getTime() + VE_OFFSET_HOURS * 3600 * 1000)
  const y = veNow.getUTCFullYear()
  const m = veNow.getUTCMonth()
  const d = veNow.getUTCDate()
  const startUtc = Date.UTC(y, m, d, 0, 0, 0) - VE_OFFSET_HOURS * 3600 * 1000
  const endUtc = startUtc + 24 * 3600 * 1000
  return {
    start: new Date(startUtc),
    end: new Date(endUtc),
    label: `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
  }
}

type ApprovedPost = {
  id: string
  external_id: string
  number: string
  format: string
  caption: string | null
  cover_url: string | null
  media_urls: string[] | null
  scheduled_at: Date | null
  status: string
}
type ApprovedStory = {
  id: string
  external_id: string
  slot: number
  type: string
  media_url: string | null
  link_url: string | null
  scheduled_at: Date | null
  status: string
}

async function schedulePost(svc: SocialModuleService, p: ApprovedPost): Promise<void> {
  const mediaUrls = Array.isArray(p.media_urls) ? p.media_urls : []
  if (mediaUrls.length === 0 && !p.cover_url) throw new Error("no media")

  const type = postTypeForPost(p.format, mediaUrls.length)
  const assets: CreatePostInput["assets"] = {}
  if (type === "reel") {
    const videoUrl =
      mediaUrls.find((u) => /\.(mp4|mov|m4v)$/i.test(u)) ?? mediaUrls[0] ?? p.cover_url!
    const video: VideoAssetInput = {
      url: absMedia(videoUrl),
      thumbnailUrl: p.cover_url ? absMedia(p.cover_url) : undefined,
    }
    assets.videos = [video]
  } else {
    const sources = mediaUrls.length > 0 ? mediaUrls : [p.cover_url!]
    assets.images = sources.map<ImageAssetInput>((u) => ({ url: absMedia(u) }))
  }

  const schedulingType = pickSchedulingType({ type, link: null })
  const input: CreatePostInput = {
    channelId: process.env.BUFFER_IG_CHANNEL_ID!,
    schedulingType,
    mode: "customScheduled",
    dueAt: (p.scheduled_at ?? new Date(Date.now() + 60_000)).toISOString(),
    text: p.caption ?? undefined,
    assets,
    instagram: { type, shouldShareToFeed: true },
  }

  const { bufferPostId } = await bufferCreatePost(input, {
    caller: "daily-cron",
    entityExternalId: p.external_id,
  })

  await svc.updateSocialPosts({
    id: p.id,
    status: "scheduled",
    buffer_post_id: bufferPostId,
    failure_reason: null,
  } as never)
}

async function scheduleStory(svc: SocialModuleService, s: ApprovedStory): Promise<void> {
  if (!s.media_url) throw new Error("no media")
  const isVideo = /\.(mp4|mov|m4v)$/i.test(s.media_url)
  const assets: CreatePostInput["assets"] = isVideo
    ? { videos: [{ url: absMedia(s.media_url) }] }
    : { images: [{ url: absMedia(s.media_url) }] }

  const schedulingType = pickSchedulingType({ type: "story", link: s.link_url })
  const input: CreatePostInput = {
    channelId: process.env.BUFFER_IG_CHANNEL_ID!,
    schedulingType,
    mode: "customScheduled",
    dueAt: (s.scheduled_at ?? new Date(Date.now() + 60_000)).toISOString(),
    assets,
    instagram: {
      type: "story",
      link: s.link_url ?? null,
      shouldShareToFeed: false,
    },
  }

  const { bufferPostId } = await bufferCreatePost(input, {
    caller: "daily-cron",
    entityExternalId: s.external_id,
  })

  await svc.updateSocialStories({
    id: s.id,
    status: "scheduled",
    buffer_post_id: bufferPostId,
    failure_reason: null,
  } as never)
}

async function markFailed(
  svc: SocialModuleService,
  entity: "post" | "story",
  id: string,
  reason: string
) {
  const patch = { id, status: "failed", failure_reason: reason.slice(0, 1000) } as never
  if (entity === "post") await svc.updateSocialPosts(patch)
  else await svc.updateSocialStories(patch)
}

async function dailySchedulerJob(container: MedusaContainer) {
  if (process.env.DAILY_SCHEDULER_ENABLED === "false") {
    console.log("[daily-scheduler] disabled via env")
    return
  }
  if (!process.env.BUFFER_API_TOKEN || !process.env.BUFFER_IG_CHANNEL_ID) {
    console.log("[daily-scheduler] BUFFER_API_TOKEN / CHANNEL_ID missing — skip")
    return
  }

  const configuredLimit = parseInt(process.env.DAILY_BUFFER_LIMIT || "10", 10)
  const { start, end, label } = veDayWindowUtc()
  const svc = container.resolve(SOCIAL_MODULE) as SocialModuleService

  // ── Step 1 · Ask Buffer how many slots are actually free for this channel
  // Avoids slamming into Buffer's daily limit and getting rejections. If the
  // plan doesn't expose a limit (paid plans), we fall back to our configured
  // number. If Buffer says "you're at the limit", we exit early.
  let availableFromBuffer: number | null = null
  try {
    const slots = await checkAvailableSlots({
      channelId: process.env.BUFFER_IG_CHANNEL_ID!,
      date: label,
      caller: "daily-cron",
    })
    console.log(
      `[daily-scheduler] ${label} · Buffer slot check: sent=${slots.sent} scheduled=${slots.scheduled} limit=${slots.limit ?? "∞"} available=${slots.available ?? "∞"}`
    )
    if (slots.isAtLimit) {
      console.log(`[daily-scheduler] Buffer reports isAtLimit=true — skipping run`)
      return
    }
    availableFromBuffer = slots.available
  } catch (e) {
    console.warn(`[daily-scheduler] slot check failed: ${(e as Error).message} — proceeding with configured limit ${configuredLimit}`)
  }

  // Use the more restrictive of the two: what Buffer reports available vs our configured cap.
  const limit =
    availableFromBuffer != null
      ? Math.min(availableFromBuffer, configuredLimit)
      : configuredLimit

  if (limit <= 0) {
    console.log("[daily-scheduler] no slots available for today — skipping")
    return
  }

  // Pull approved items that fall inside today's VE day by scheduled_at.
  // We only consider `approved` — not `failed`, not already `scheduled`.
  const posts = (await svc.listSocialPosts(
    {
      status: "approved",
      scheduled_at: { $gte: start, $lt: end },
    } as never,
    { order: { scheduled_at: "ASC" } } as never
  )) as unknown as ApprovedPost[]

  const stories = (await svc.listSocialStories(
    {
      status: "approved",
      scheduled_at: { $gte: start, $lt: end },
    } as never,
    { order: { scheduled_at: "ASC" } } as never
  )) as unknown as ApprovedStory[]

  // Interleave by scheduled_at (so the earliest 10 win, regardless of kind)
  type Candidate =
    | { kind: "post"; row: ApprovedPost; ts: number }
    | { kind: "story"; row: ApprovedStory; ts: number }
  const queue: Candidate[] = [
    ...posts.map<Candidate>((p) => ({ kind: "post", row: p, ts: p.scheduled_at?.getTime() ?? 0 })),
    ...stories.map<Candidate>((s) => ({ kind: "story", row: s, ts: s.scheduled_at?.getTime() ?? 0 })),
  ].sort((a, b) => a.ts - b.ts)

  const batch = queue.slice(0, limit)
  const skipped = queue.length - batch.length

  console.log(
    `[daily-scheduler] ${label} VE · candidates=${queue.length} · pushing=${batch.length}` +
      (skipped > 0 ? ` · deferred=${skipped} (Buffer daily cap)` : "")
  )

  let ok = 0
  const failures: string[] = []
  for (const item of batch) {
    try {
      if (item.kind === "post") await schedulePost(svc, item.row)
      else await scheduleStory(svc, item.row)
      ok++
      // Small delay so we're not a thundering herd on Buffer's API.
      await new Promise((r) => setTimeout(r, 500))
    } catch (e) {
      const msg = (e as Error).message
      failures.push(`${item.kind}:${item.row.external_id} → ${msg}`)
      try {
        await markFailed(svc, item.kind, item.row.id, msg)
      } catch {
        /* ignore */
      }
    }
  }

  console.log(
    `[daily-scheduler] done · ok=${ok} · failed=${failures.length}` +
      (failures.length > 0 ? "\n  " + failures.join("\n  ") : "")
  )
}

export default wrapJob("social-daily-scheduler", dailySchedulerJob)

export const config = {
  name: "social-daily-scheduler",
  // 06:00 Venezuela time = 10:00 UTC (VE = UTC-4, no DST)
  schedule: "0 10 * * *",
}
