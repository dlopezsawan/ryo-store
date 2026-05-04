/**
 * POST /admin/social/suggestions/import-from-trends
 *
 * Convert the AI weekly brief's themes + content ideas into actionable
 * suggestions, one per item. Dedup by `source_ref` (brief week + index)
 * so re-running is idempotent.
 *
 * Why brief, not raw signals: the brief is already the AI's distillation
 * of the noisy raw feed (180 Reddit posts, etc.) into 3-5 strategic
 * themes + 5-8 concrete content ideas. That's the layer the user actually
 * acts on. Importing 180 raw Reddit titles as suggestions would be noise.
 *
 * If no brief exists yet (cron hasn't run / first time), fall back to
 * importing the top raw signals as before. That keeps the button useful
 * during cold-start.
 *
 * Body (all optional):
 *   {
 *     includeThemes?: boolean   // default true   — strategic angles
 *     includeIdeas?:  boolean   // default true   — concrete content ideas
 *     fallbackRawLimit?: number // default 10     — used only when no brief
 *     kind?: "post" | "story"   // default "post"
 *   }
 *
 * Response:
 *   {
 *     imported: number,
 *     skipped: number,
 *     considered: number,
 *     source: "brief" | "raw",   // which path we took
 *     created: SocialSuggestion[]
 *   }
 */
import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { SOCIAL_MODULE } from "../../../../../modules/social"
import SocialModuleService from "../../../../../modules/social/service"
import { actorFromReq } from "../../_shared"

interface BriefTheme {
  title: string
  why: string
  sources?: string[]
}
interface BriefContent {
  themes?: BriefTheme[]
  content_ideas?: string[]
  hashtag_watch?: string[]
  model?: string
}

const KIND_LABEL: Record<string, string> = {
  reddit_post: "Reddit",
  youtube_video: "YouTube",
  google_term: "Google Trends",
  instagram_post: "Instagram",
  tiktok_video: "TikTok",
}

function inferPillar(text: string): string | null {
  const t = text.toLowerCase()
  if (/(c[óo]mo|tutorial|gu[ií]a|tip|trick|paso a paso|how to|educar|dato)/i.test(t)) return "Educational"
  if (/(behind|bts|detr[áa]s|story|stories|d[íi]a|maker|hand|cocina|recet)/i.test(t)) return "BTS"
  if (/(combo|paquete|kit|bundle|colab|edici[óo]n|premium|precio|edition)/i.test(t)) return "Promocional"
  if (/(comunidad|community|user|q\&a|p[aá]g[ií]nemos|vota|encuesta|debate|discut)/i.test(t)) return "Comunidad"
  if (/(flor|aroma|relax|moment|chill|vibe|aesthetic|estilo|lifestyle)/i.test(t)) return "Flores · Lifestyle"
  return null
}

/** Heuristic format hint based on the idea wording. */
function inferFormat(text: string): string | null {
  const t = text.toLowerCase()
  if (/^reel:|reel\s|video|tutorial.*30/i.test(t)) return "Reel"
  if (/^story:|encuesta|interactiva|sticker|stories/i.test(t)) return "Story"
  if (/^post:|carrusel|carousel|comparativa.*visual|3\s+razones/i.test(t)) return "Carrusel"
  return null
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const svc: SocialModuleService = req.scope.resolve(SOCIAL_MODULE)
  const body = (req.body ?? {}) as {
    includeThemes?: boolean
    includeIdeas?: boolean
    fallbackRawLimit?: number
    kind?: "post" | "story"
  }
  const includeThemes = body.includeThemes ?? true
  const includeIdeas = body.includeIdeas ?? true
  const fallbackRawLimit = Math.max(1, Math.min(50, body.fallbackRawLimit ?? 10))
  const defaultKind = body.kind === "story" ? "story" : "post"
  const actor = actorFromReq(req)

  // Existing trend-sourced suggestions for dedup. We dedupe across both the
  // brief path and the raw path with the same source_ref namespace.
  const existing = (await svc.listSocialSuggestions(
    { source: "trend" } as never,
  )) as unknown as Array<{ source_ref: string | null }>
  const seen = new Set(existing.map((s) => s.source_ref).filter(Boolean) as string[])

  // 1. Try the brief path first.
  const briefs = (await svc.listSocialTrendBriefs(
    {} as never,
    { order: { generated_at: "DESC" } } as never,
  )) as unknown as Array<{ week_start: string; content: BriefContent }>

  if (briefs.length > 0) {
    const brief = briefs[0]
    const c = brief.content ?? {}
    const created: unknown[] = []
    let imported = 0
    let skipped = 0
    let considered = 0

    if (includeThemes && Array.isArray(c.themes)) {
      for (let i = 0; i < c.themes.length; i++) {
        const theme = c.themes[i]
        if (!theme?.title) continue
        considered++
        const ref = `brief:${brief.week_start}:theme:${i}`
        if (seen.has(ref)) { skipped++; continue }
        const sourcesText = (theme.sources ?? []).slice(0, 5).map((s) => `• ${s}`).join("\n")
        const sug = await svc.createSocialSuggestions({
          kind: defaultKind,
          title: theme.title,
          body:
            (theme.why ?? "") +
            (sourcesText ? `\n\nSeñales relacionadas:\n${sourcesText}` : "") +
            `\n\n— Tema estratégico del brief semana ${brief.week_start}`,
          pillar: inferPillar(`${theme.title} ${theme.why ?? ""}`),
          format: null,            // strategic theme → user picks format on refinement
          suggested_date: null,
          source: "trend",
          source_ref: ref,
          status: "idea",
          created_by: actor.id,
        } as never)
        created.push(sug)
        imported++
      }
    }

    if (includeIdeas && Array.isArray(c.content_ideas)) {
      for (let i = 0; i < c.content_ideas.length; i++) {
        const idea = c.content_ideas[i]
        if (!idea || typeof idea !== "string") continue
        considered++
        const ref = `brief:${brief.week_start}:idea:${i}`
        if (seen.has(ref)) { skipped++; continue }
        const trimmedTitle = idea.length > 140 ? idea.slice(0, 137) + "…" : idea
        const sug = await svc.createSocialSuggestions({
          kind: defaultKind,
          title: trimmedTitle,
          body: idea + `\n\n— Idea concreta del brief semana ${brief.week_start}`,
          pillar: inferPillar(idea),
          format: inferFormat(idea),
          suggested_date: null,
          source: "trend",
          source_ref: ref,
          status: "idea",
          created_by: actor.id,
        } as never)
        created.push(sug)
        imported++
      }
    }

    return res.json({ imported, skipped, considered, source: "brief", created })
  }

  // 2. Fallback: no brief yet, import top raw signals so the button still
  //    does something useful on a fresh install.
  type RawSignal = {
    kind: keyof typeof KIND_LABEL | string
    source_id: string
    title: string
    summary: string | null
    permalink: string | null
    score: number
    comments: number
    keywords: string[] | null
    posted_at: Date | null
    author: string | null
  }
  const trends = (await svc.listSocialTrendSources(
    {} as never,
    { order: { score: "DESC" } } as never,
  )) as unknown as RawSignal[]

  let imported = 0, skipped = 0, considered = 0
  const created: unknown[] = []
  for (const t of trends) {
    if (imported >= fallbackRawLimit) break
    considered++
    const ref = `${t.kind}:${t.source_id}`
    if (seen.has(ref)) { skipped++; continue }
    const trimmedTitle = t.title.length > 140 ? t.title.slice(0, 137) + "…" : t.title
    const label = KIND_LABEL[t.kind as string] ?? "Trend"
    const sug = await svc.createSocialSuggestions({
      kind: defaultKind,
      title: `${label}: ${trimmedTitle}`,
      body: [
        t.summary,
        `Fuente: ${label}`,
        t.author ? `Autor: ${t.author}` : null,
        `Engagement: ${t.score} score · ${t.comments} comentarios`,
        t.keywords?.length ? `Keywords: ${t.keywords.join(", ")}` : null,
        t.permalink ? `Link: ${t.permalink}` : null,
      ].filter(Boolean).join("\n"),
      pillar: inferPillar(`${t.title} ${t.summary ?? ""}`),
      format: null,
      suggested_date: null,
      source: "trend",
      source_ref: ref,
      status: "idea",
      created_by: actor.id,
    } as never)
    created.push(sug)
    imported++
  }

  return res.json({ imported, skipped, considered, source: "raw", created })
}
