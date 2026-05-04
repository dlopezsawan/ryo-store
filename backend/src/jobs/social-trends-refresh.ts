/**
 * Social Trends — periodic refresh.
 *
 * Every 4 hours: pull the latest Reddit + YouTube signals and upsert.
 * On Monday 06:00 UTC: also regenerate the weekly AI brief.
 *
 * Runs via Medusa's built-in scheduled jobs infrastructure.
 */
import { MedusaContainer } from "@medusajs/framework"
import { SOCIAL_MODULE } from "../modules/social"
import type SocialModuleService from "../modules/social/service"
import {
  collectReddit,
  collectYouTube,
  collectYouTubeRSS,
  collectGoogleTrends,
  collectTikTok,
  type NormalizedSignal,
  type YouTubeRssSubscription,
} from "../lib/trends-collectors"
import { generateWeeklyBrief } from "../lib/trends-brief"
import { wrapJob } from "../lib/job-runner"

async function socialTrendsRefreshJob(container: MedusaContainer) {
  if (process.env.TRENDS_ENABLED === "false") return

  const svc: SocialModuleService = container.resolve(SOCIAL_MODULE) as SocialModuleService
  const t0 = Date.now()

  // Resolver for YouTube RSS subscriptions — reads from the
  // social_trend_subscription table. Runs once per cron tick; collector
  // gets a fresh list each cycle so adds/removes show up immediately.
  const loadYouTubeSubs = async (): Promise<YouTubeRssSubscription[]> => {
    const rows = (await svc.listSocialTrendSubscriptions(
      { kind: "youtube_channel", active: true } as never,
    )) as unknown as Array<{ id: string; source_id: string; label: string }>
    return rows.map((r) => ({ id: r.id, source_id: r.source_id, label: r.label }))
  }
  // Bookkeeping callback — record fetch outcome on each subscription so
  // the admin UI can show last-fetched / error state.
  const onSubFetched = async (
    sub: YouTubeRssSubscription,
    error: string | null,
  ): Promise<void> => {
    const patch: Record<string, unknown> = {
      id: sub.id,
      last_fetched_at: new Date(),
      last_error: error,
    }
    if (error) {
      // Increment counter — read current value first since updateXxx replaces.
      const existing = (await svc.retrieveSocialTrendSubscription(sub.id)
        .catch(() => null)) as { fetch_error_count?: number } | null
      patch.fetch_error_count = (existing?.fetch_error_count ?? 0) + 1
    } else {
      patch.fetch_error_count = 0
    }
    await svc.updateSocialTrendSubscriptions(patch as never).catch(() => {})
  }

  // Run all collectors in parallel — each one isolated by its own catch
  // so a failing source (rate limit, schema change, network blip) just
  // contributes 0 signals instead of tanking the cron run.
  const [reddit, youtube, ytRss, googleTrends, tiktok] = await Promise.all([
    collectReddit({ limit: 15 }).catch((e) => {
      console.warn("[trends-cron] reddit failed:", e)
      return [] as NormalizedSignal[]
    }),
    collectYouTube({ maxPerQuery: 5 }).catch((e) => {
      console.warn("[trends-cron] youtube failed:", e)
      return [] as NormalizedSignal[]
    }),
    collectYouTubeRSS(loadYouTubeSubs, onSubFetched).catch((e) => {
      console.warn("[trends-cron] yt-rss failed:", e)
      return [] as NormalizedSignal[]
    }),
    collectGoogleTrends({ geo: "VE" }).catch((e) => {
      console.warn("[trends-cron] google-trends failed:", e)
      return [] as NormalizedSignal[]
    }),
    collectTikTok({ perKeyword: 5 }).catch((e) => {
      console.warn("[trends-cron] tiktok failed:", e)
      return [] as NormalizedSignal[]
    }),
  ])
  const all = [...reddit, ...youtube, ...ytRss, ...googleTrends, ...tiktok]
  console.log(
    `[trends-cron] sources: reddit=${reddit.length} yt=${youtube.length} ` +
      `yt-rss=${ytRss.length} gt=${googleTrends.length} tiktok=${tiktok.length}`,
  )

  let created = 0, updated = 0
  for (const sig of all) {
    const existing = await svc.listSocialTrendSources(
      { kind: sig.kind, source_id: sig.source_id } as never
    )
    const payload = {
      kind: sig.kind,
      source_id: sig.source_id,
      source_url: sig.source_url ?? null,
      title: sig.title,
      author: sig.author ?? null,
      summary: sig.summary ?? null,
      media_url: sig.media_url ?? null,
      permalink: sig.permalink ?? null,
      score: sig.score,
      comments: sig.comments,
      keywords: sig.keywords ?? null,
      region: sig.region ?? null,
      posted_at: sig.posted_at ?? null,
      fetched_at: new Date(),
    }
    if (existing.length > 0) {
      await svc.updateSocialTrendSources({
        id: (existing[0] as { id: string }).id,
        ...payload,
      } as never)
      updated++
    } else {
      await svc.createSocialTrendSources(payload as never)
      created++
    }
  }

  // Monday mornings: also regenerate the weekly brief so Monday morning
  // the user opens the admin and has fresh context.
  const now = new Date()
  const isMondayMorning = now.getUTCDay() === 1 && now.getUTCHours() === 6
  if (isMondayMorning) {
    try {
      await generateWeeklyBrief(svc)
      console.log("[trends-cron] weekly brief regenerated")
    } catch (e) {
      console.warn("[trends-cron] brief failed:", (e as Error).message)
    }
  }

  console.log(
    `[trends-cron] ${Date.now() - t0}ms · collected r=${reddit.length} yt=${youtube.length} · created=${created} updated=${updated}`
  )
}

export default wrapJob("social-trends-refresh", socialTrendsRefreshJob)

export const config = {
  name: "social-trends-refresh",
  // Every 4 hours — matches our typical content planning cadence without
  // burning YT quota (6 queries × 6 runs/day = 3600 units, well under 10k)
  schedule: "0 */4 * * *",
}
