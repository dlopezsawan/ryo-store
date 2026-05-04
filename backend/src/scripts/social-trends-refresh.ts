/**
 * CLI-triggered refresh of the Social Trends feed.
 *
 *   docker exec ryo-store-medusa-1 npx medusa exec ./src/scripts/social-trends-refresh.ts
 *
 * Does the same work as the admin endpoint: runs collectors and upserts into
 * social_trend_source. Useful for seeding the DB after first deploy (before
 * the cron has a chance to fire) and for ad-hoc manual refreshes.
 */
import type { ExecArgs } from "@medusajs/framework/types"
import { SOCIAL_MODULE } from "../modules/social"
import type SocialModuleService from "../modules/social/service"
import {
  collectReddit,
  collectYouTube,
  type NormalizedSignal,
} from "../lib/trends-collectors"
import { generateWeeklyBrief } from "../lib/trends-brief"

export default async function trendsRefresh({ container, args }: ExecArgs) {
  const svc = container.resolve(SOCIAL_MODULE) as SocialModuleService
  const doBrief = args.includes("--brief")

  console.log("→ collecting…")
  const [reddit, youtube] = await Promise.all([
    collectReddit({ limit: 15 }).catch((e) => { console.warn("reddit:", e); return [] as NormalizedSignal[] }),
    collectYouTube({ maxPerQuery: 5 }).catch((e) => { console.warn("yt:", e); return [] as NormalizedSignal[] }),
  ])
  console.log(`  reddit=${reddit.length} youtube=${youtube.length}`)

  let created = 0, updated = 0
  for (const sig of [...reddit, ...youtube]) {
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
  console.log(`✓ upsert · created=${created} updated=${updated}`)

  if (doBrief) {
    console.log("→ generating brief…")
    const b = await generateWeeklyBrief(svc)
    console.log(`  week=${b.week} sources=${b.source_count} model=${b.model ?? "fallback"}`)
  }
}
