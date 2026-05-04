import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { SOCIAL_MODULE } from "../../../../../modules/social"
import SocialModuleService from "../../../../../modules/social/service"
import {
  collectReddit,
  collectYouTube,
  collectYouTubeRSS,
  collectGoogleTrends,
  collectTikTok,
  type NormalizedSignal,
  type YouTubeRssSubscription,
} from "../../../../../lib/trends-collectors"
import { generateWeeklyBrief } from "../../../../../lib/trends-brief"

/**
 * POST /admin/social/trends/refresh
 *   body: { brief?: boolean }   // also regenerate the weekly brief
 *
 * Runs the collectors, upserts into social_trend_source (by kind+source_id),
 * and optionally regenerates the weekly AI brief.
 *
 * Safe to call repeatedly — upsert key prevents duplicates.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const svc: SocialModuleService = req.scope.resolve(SOCIAL_MODULE)
  const body = (req.body ?? {}) as { brief?: boolean }

  const t0 = Date.now()

  // Subscription resolver for YouTube RSS — same as the cron path. Reads
  // active rows from social_trend_subscription each call so the user's
  // additions/removals show up the next refresh.
  const loadYouTubeSubs = async (): Promise<YouTubeRssSubscription[]> => {
    const rows = (await svc.listSocialTrendSubscriptions(
      { kind: "youtube_channel", active: true } as never,
    )) as unknown as Array<{ id: string; source_id: string; label: string }>
    return rows.map((r) => ({ id: r.id, source_id: r.source_id, label: r.label }))
  }
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
      const existing = (await svc.retrieveSocialTrendSubscription(sub.id)
        .catch(() => null)) as { fetch_error_count?: number } | null
      patch.fetch_error_count = (existing?.fetch_error_count ?? 0) + 1
    } else {
      patch.fetch_error_count = 0
    }
    await svc.updateSocialTrendSubscriptions(patch as never).catch(() => {})
  }

  // Run collectors in parallel — they don't share state
  const [reddit, youtube, ytRss, googleTrends, tiktok] = await Promise.all([
    collectReddit({ limit: 15 }).catch((e) => {
      console.warn("[trends/refresh] reddit failed:", e)
      return [] as NormalizedSignal[]
    }),
    collectYouTube({ maxPerQuery: 5 }).catch((e) => {
      console.warn("[trends/refresh] youtube failed:", e)
      return [] as NormalizedSignal[]
    }),
    collectYouTubeRSS(loadYouTubeSubs, onSubFetched).catch((e) => {
      console.warn("[trends/refresh] yt-rss failed:", e)
      return [] as NormalizedSignal[]
    }),
    collectGoogleTrends({ geo: "VE" }).catch((e) => {
      console.warn("[trends/refresh] google-trends failed:", e)
      return [] as NormalizedSignal[]
    }),
    collectTikTok({ perKeyword: 5 }).catch((e) => {
      console.warn("[trends/refresh] tiktok failed:", e)
      return [] as NormalizedSignal[]
    }),
  ])

  const all = [...reddit, ...youtube, ...ytRss, ...googleTrends, ...tiktok]

  // Upsert loop. Medusa's MedusaService doesn't offer a bulk upsert shortcut
  // so we do it manually via retrieveBy + update/create. Slow but N<~200.
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

  let briefResult: { week: string; source_count: number; model?: string } | null = null
  if (body.brief) {
    try {
      briefResult = await generateWeeklyBrief(svc)
    } catch (e) {
      console.warn("[trends/refresh] brief generation failed:", (e as Error).message)
    }
  }

  return res.json({
    ok: true,
    duration_ms: Date.now() - t0,
    collected: {
      reddit: reddit.length,
      youtube: youtube.length,
      yt_rss: ytRss.length,
      google_trends: googleTrends.length,
      tiktok: tiktok.length,
      total: all.length,
    },
    upsert: { created, updated },
    brief: briefResult,
  })
}
