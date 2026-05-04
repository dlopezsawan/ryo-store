import { PageHeader, PageWatermark } from "@/components/layout/PageHeader"
import {
  listSocialPosts, listSocialStories,
  listSocialTrends, listTrendSubscriptions, listSocialSuggestions,
  MedusaError,
  type SocialPost, type SocialStory,
  type SocialTrendSource, type SocialTrendBrief, type SocialTrendSubscription, type SocialSuggestion,
} from "@/lib/medusa"
import { getSession } from "@/lib/auth"
import { SocialClient } from "./SocialClient"
import { PostEditor } from "./PostEditor"
import { SyncButton } from "./SyncButton"

export default async function SocialPage() {
  const session = await getSession()
  let posts: SocialPost[] = []
  let stories: SocialStory[] = []
  let trendSources: SocialTrendSource[] = []
  let trendBrief: SocialTrendBrief | null = null
  let trendSubs: SocialTrendSubscription[] = []
  let suggestions: SocialSuggestion[] = []
  let errorMsg: string | null = null

  const [postsR, storiesR, trendsR, subsR, sugR] = await Promise.allSettled([
    listSocialPosts(),
    listSocialStories(),
    listSocialTrends({ days: 14, limit: 100 }),
    listTrendSubscriptions(),
    listSocialSuggestions(),
  ])

  if (postsR.status === "fulfilled") posts = postsR.value.posts
  if (storiesR.status === "fulfilled") stories = storiesR.value.stories
  if (trendsR.status === "fulfilled") {
    trendSources = trendsR.value.sources
    trendBrief = trendsR.value.brief
  }
  if (subsR.status === "fulfilled") trendSubs = subsR.value.subscriptions
  if (sugR.status === "fulfilled") suggestions = sugR.value.suggestions

  for (const r of [postsR, storiesR]) {
    if (r.status === "rejected" && r.reason instanceof MedusaError) {
      if (r.reason.status === 401) errorMsg = "Sesión expirada. Recarga la página."
      else if (!errorMsg) errorMsg = `No se pudo cargar contenido social: ${r.reason.message}`
    }
  }

  // KPIs globales (todos los estados)
  const total = posts.length
  const published = posts.filter((p) => p.status === "published").length
  const scheduled = posts.filter((p) => p.status === "scheduled" || p.status === "approved").length
  const review = posts.filter((p) => p.status === "in_review" || p.status === "draft").length
  const failed = posts.filter((p) => p.status === "failed").length

  // Engagement total (suma de likes/comments/saves de todos los publicados)
  let totalLikes = 0, totalComments = 0, totalReach = 0
  for (const p of posts) {
    const meta = (p as { metadata?: Record<string, unknown> }).metadata
    const m = (meta?.metrics as { reach?: number; likes?: number; comments?: number } | undefined) ?? p.metrics ?? null
    if (m) {
      totalLikes += m.likes ?? 0
      totalComments += m.comments ?? 0
      totalReach += m.reach ?? 0
    }
  }

  return (
    <div className="p-7 space-y-5 relative">
      <PageWatermark char="@" />

      <PageHeader
        title="SOCIAL"
        stamp={<span>{total} POSTS · {stories.length} STORIES</span>}
        stampTone="orange"
        description={`${published} publicados · ${scheduled} programados · ${review} en review${failed > 0 ? ` · ${failed} fallaron` : ""} · ${stories.length} stories`}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <SyncButton />
            <PostEditor />
          </div>
        }
      />

      {errorMsg && (
        <div className="stamp-card p-4 bg-primary/5" style={{ borderColor: "#BB3B2E" }}>
          <p className="text-[13px] font-medium text-primary">{errorMsg}</p>
        </div>
      )}

      {/* KPI strip */}
      <div className="grid grid-cols-4 gap-5">
        <Kpi label="Total posts"      value={String(total)}                    sub={`${published} publicados`}      tone="secondary" />
        <Kpi label="Programados"      value={String(scheduled)}                sub="aprobados + scheduled"           tone="orange" />
        <Kpi label="Pendientes review" value={String(review)}                  sub="drafts + in_review" />
        <Kpi label="Engagement total"  value={fmtCompact(totalLikes + totalComments)} sub={`${fmtCompact(totalReach)} reach`} tone="secondary" />
      </div>

      <SocialClient
        posts={posts}
        stories={stories}
        trendSources={trendSources}
        trendBrief={trendBrief}
        trendSubs={trendSubs}
        suggestions={suggestions}
        currentUserEmail={session?.email ?? "tú"}
      />
    </div>
  )
}

function fmtCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: "orange" | "secondary" }) {
  const bg = tone === "orange" ? "bg-orange/5" : tone === "secondary" ? "bg-secondary/5" : ""
  const labelCls = tone === "orange" ? "text-orange" : tone === "secondary" ? "text-secondary" : "text-ink-3"
  const valueCls = tone === "orange" ? "text-orange" : tone === "secondary" ? "text-secondary" : ""
  return (
    <div className={`stamp-card p-4 ${bg}`}>
      <div className={`text-[9px] font-display font-bold uppercase tracking-[0.18em] ${labelCls}`}>{label}</div>
      <div className={`stat-display text-[28px] mt-2 num ${valueCls}`}>{value}</div>
      <div className="text-[10px] mt-1 text-ink-3 font-mono">{sub}</div>
    </div>
  )
}
