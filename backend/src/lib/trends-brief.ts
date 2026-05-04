/**
 * Weekly trends brief generator.
 *
 * Takes the last 7 days of trend_source rows and asks an LLM to produce a
 * compact JSON summary the admin can render:
 *
 *   {
 *     "themes":         [{ title, why, sources: [source_id] }],
 *     "content_ideas":  ["…", "…"],
 *     "hashtag_watch":  ["#...", …]
 *   }
 *
 * Provider priority (first available wins):
 *   1. DeepSeek (DEEPSEEK_API_KEY)  — OpenAI-compatible, very cheap (~$0.14/1M in)
 *   2. Anthropic (ANTHROPIC_API_KEY)
 *   3. Heuristic fallback (no API needed — groups signals by kind and keywords)
 *
 * Prefer DeepSeek at this price/quality point: a weekly brief for Enrola is
 * ~12k input tokens → ~$0.002/week. Negligible.
 */

import type SocialModuleService from "../modules/social/service"

export interface BriefContent {
  themes: Array<{ title: string; why: string; sources: string[] }>
  content_ideas: string[]
  hashtag_watch: string[]
  model?: string
  input_tokens?: number
  output_tokens?: number
}

/** Return the current ISO week key: "2026-W17" */
export function currentIsoWeek(d: Date = new Date()): string {
  // Copy so we don't mutate the caller's date
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  // Thursday of this week determines the ISO year
  const day = t.getUTCDay() || 7
  t.setUTCDate(t.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((+t - +yearStart) / 86400000 + 1) / 7)
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, "0")}`
}

/**
 * Build the prompt from the raw trend rows + a naive fallback summary
 * in case the AI call fails.
 */
function buildPrompt(rows: Array<Record<string, unknown>>): string {
  const stripped = rows
    .slice(0, 60)  // cap context size
    .map((r) => ({
      kind: r.kind,
      title: r.title,
      summary: String(r.summary || "").slice(0, 200),
      score: r.score,
      author: r.author,
      keywords: r.keywords,
      posted_at: r.posted_at,
    }))

  return `Eres un estratega de contenido para una tienda de paraphernalia (papers, grinders, filtros, bongs) en Venezuela llamada Enrola Shop. Análisa estas señales de tendencia de los últimos 7 días (Reddit + YouTube) y dame:

1. Máximo 4 temas que están ganando tracción ("themes") — con título corto y por qué importa para la tienda.
2. 5-7 ideas concretas de contenido que podrían publicar esta semana ("content_ideas") — posts, reels o stories específicos, no genéricos.
3. 5-8 hashtags o palabras clave a vigilar ("hashtag_watch") — mezcla inglés/español.

Enrola vende: papers Alien Puff, Rolling Paper marrón unbleached, conos hemp, filtros cartón/carbón activo, grinders plásticos y rellenadores. Audiencia: 18-35, Venezuela/Valencia, estética editorial minimalista.

Devolvé SOLO un JSON válido con la estructura:
{"themes":[{"title":"","why":"","sources":[]}],"content_ideas":[],"hashtag_watch":[]}

Datos:
${JSON.stringify(stripped, null, 2)}`
}

/**
 * Parse a JSON answer that may be wrapped in ```json fences or leading prose.
 * Be defensive — LLMs routinely add a preamble even when told not to.
 */
function extractJson(text: string): string {
  const jsonStart = text.indexOf("{")
  const jsonEnd = text.lastIndexOf("}")
  if (jsonStart < 0 || jsonEnd < 0) throw new Error("no JSON in LLM response")
  return text.slice(jsonStart, jsonEnd + 1)
}

/**
 * Call DeepSeek (OpenAI-compatible) and parse the response.
 */
async function callDeepSeek(prompt: string): Promise<BriefContent> {
  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) throw new Error("DEEPSEEK_API_KEY not set")

  const res = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [
        {
          role: "system",
          content:
            "Sos un estratega de contenido experto en paraphernalia/smoke shops para Venezuela. Respondés siempre con JSON válido, sin texto extra antes o después.",
        },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.4,
      max_tokens: 1600,
    }),
  })
  if (!res.ok) {
    throw new Error(`DeepSeek ${res.status}: ${(await res.text()).slice(0, 200)}`)
  }
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>
    usage?: { prompt_tokens?: number; completion_tokens?: number }
    model?: string
  }
  const text = data.choices?.[0]?.message?.content ?? ""
  const parsed = JSON.parse(extractJson(text)) as BriefContent
  parsed.model = data.model ?? "deepseek-chat"
  parsed.input_tokens = data.usage?.prompt_tokens
  parsed.output_tokens = data.usage?.completion_tokens
  return parsed
}

/**
 * Anthropic fallback — kept because the project already uses Claude for
 * other things, so if someone rotates DEEPSEEK_API_KEY out we still have
 * coverage.
 */
async function callClaude(prompt: string): Promise<BriefContent> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set")

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5",
      max_tokens: 1600,
      messages: [{ role: "user", content: prompt }],
    }),
  })
  if (!res.ok) {
    throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 200)}`)
  }
  const data = (await res.json()) as {
    content: Array<{ type: string; text?: string }>
    usage?: { input_tokens?: number; output_tokens?: number }
    model?: string
  }
  const text = data.content.find((c) => c.type === "text")?.text ?? ""
  const parsed = JSON.parse(extractJson(text)) as BriefContent
  parsed.model = data.model
  parsed.input_tokens = data.usage?.input_tokens
  parsed.output_tokens = data.usage?.output_tokens
  return parsed
}

function fallbackBrief(rows: Array<Record<string, unknown>>): BriefContent {
  // Group by kind for the themes, top keywords for the watchlist.
  const byKind: Record<string, number> = {}
  const kwHits: Record<string, number> = {}
  for (const r of rows) {
    byKind[r.kind as string] = (byKind[r.kind as string] ?? 0) + 1
    for (const k of ((r.keywords as string[]) ?? [])) {
      kwHits[k] = (kwHits[k] ?? 0) + 1
    }
  }
  const topKw = Object.entries(kwHits)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 6)
    .map(([k]) => k)

  return {
    themes: [
      {
        title: "Señales recientes en paraphernalia",
        why: "Resumen auto-generado (AI brief no disponible — configurá ANTHROPIC_API_KEY para uno mejor).",
        sources: [],
      },
    ],
    content_ideas: [
      "Revisá el feed de Trends para inspiración específica",
    ],
    hashtag_watch: topKw.length > 0 ? topKw : ["rolling paper", "grinder", "smoke shop"],
  }
}

/**
 * Pull the last 7 days of trend signals, ask Claude to summarize, upsert
 * into social_trend_brief keyed by ISO week. Safe to call multiple times
 * in a week — will overwrite the in-progress brief for the current week.
 */
export async function generateWeeklyBrief(svc: SocialModuleService): Promise<{
  week: string
  source_count: number
  model?: string
}> {
  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000)
  const rows = await svc.listSocialTrendSources(
    { fetched_at: { $gte: since } } as never,
    { order: { score: "DESC" }, take: 80 } as never
  )

  const prompt = buildPrompt(rows as Array<Record<string, unknown>>)

  let content: BriefContent | null = null
  const providers: Array<[string, () => Promise<BriefContent>]> = [
    ["deepseek", () => callDeepSeek(prompt)],
    ["anthropic", () => callClaude(prompt)],
  ]
  for (const [name, fn] of providers) {
    if (!process.env[name === "deepseek" ? "DEEPSEEK_API_KEY" : "ANTHROPIC_API_KEY"]) continue
    try {
      content = await fn()
      console.log(`[trends/brief] generated via ${name} · model=${content.model}`)
      break
    } catch (e) {
      console.warn(`[trends/brief] ${name} failed:`, (e as Error).message)
    }
  }
  if (!content) {
    console.warn("[trends/brief] no LLM provider succeeded, using heuristic fallback")
    content = fallbackBrief(rows as Array<Record<string, unknown>>)
  }

  const week = currentIsoWeek()
  const existing = await svc.listSocialTrendBriefs({ week_start: week } as never)

  if (existing.length > 0) {
    await svc.updateSocialTrendBriefs({
      id: (existing[0] as { id: string }).id,
      generated_at: new Date(),
      content: content as unknown as Record<string, unknown>,
      model_name: content.model ?? null,
    } as never)
  } else {
    await svc.createSocialTrendBriefs({
      week_start: week,
      generated_at: new Date(),
      content: content as unknown as Record<string, unknown>,
      model_name: content.model ?? null,
    } as never)
  }

  return { week, source_count: rows.length, model: content.model }
}
