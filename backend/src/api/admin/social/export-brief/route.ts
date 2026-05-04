import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { SOCIAL_MODULE } from "../../../../modules/social"
import SocialModuleService from "../../../../modules/social/service"

/**
 * GET /admin/social/export-brief
 *
 * Compiles everything a Claude design session needs into one Markdown file:
 *
 *   - Brand context (audience, tone, product lineup)
 *   - Latest AI trend brief (themes + content ideas + hashtags)
 *   - Open suggestions grouped by status
 *   - Unresolved feedback grouped by post/story
 *   - Recent published posts (last 14d) for continuity reference
 *
 * Returns text/markdown so the browser can save it directly as `.md`.
 *
 * The output is human-readable AND Claude-readable: structured headings,
 * no cruft, every entity has a stable ID for cross-reference.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const svc: SocialModuleService = req.scope.resolve(SOCIAL_MODULE)

  const [posts, stories, suggestions, feedback, briefs] = await Promise.all([
    svc.listSocialPosts({}, { order: { date_planned: "ASC" } } as never),
    svc.listSocialStories({}, { order: { date: "ASC" } } as never),
    svc.listSocialSuggestions({}, { order: { created_at: "DESC" } } as never),
    svc.listSocialFeedbacks({ resolved: false } as never, { order: { created_at: "DESC" } } as never),
    svc.listSocialTrendBriefs({}, { order: { generated_at: "DESC" }, take: 1 } as never),
  ])

  const brief = briefs[0] as
    | { week_start: string; content: Record<string, unknown>; model_name?: string }
    | undefined

  // Index feedback by entity for the "open threads" section
  const fbByEntity = new Map<string, typeof feedback>()
  for (const f of feedback) {
    const key = `${(f as { entity_type: string }).entity_type}:${(f as { entity_id: string }).entity_id}`
    const arr = fbByEntity.get(key) ?? []
    arr.push(f)
    fbByEntity.set(key, arr)
  }

  const now = new Date()
  const recent14d = new Date(now.getTime() - 14 * 86400000)
  const recentPublished = (posts as Array<{
    status: string; published_at?: string | Date | null; title: string; number: string;
    format: string; caption?: string | null; ig_post_id?: string | null;
  }>)
    .filter((p) => p.status === "published" && p.published_at && new Date(p.published_at) >= recent14d)
    .slice(0, 10)

  // ─── Build markdown ────────────────────────────────────────────
  const lines: string[] = []
  const L = (s = "") => lines.push(s)

  L(`# Enrola Social — Brief de diseño`)
  L(`_Generado: ${now.toISOString()} · ${(posts.length)} posts · ${(stories.length)} stories · ${(suggestions.length)} sugerencias_`)
  L()

  // Brand context — static, always the same, helps Claude anchor
  L(`## Contexto de marca`)
  L()
  L(`- **Handle**: @enrola.shop`)
  L(`- **Mercado**: Venezuela (Valencia principalmente)`)
  L(`- **Audiencia**: 18-35, interés en paraphernalia legal, estética editorial`)
  L(`- **Tono**: editorial minimalista, en español venezolano, honesto, sin jerga gringa`)
  L(`- **Productos principales**: Rolling Paper Alien Puff (sabores + celulosa), Rolling Paper Marrón unbleached, conos (hemp natural + celulosa + saborizados), filtros (cartón Puff Man + carbón activo), grinders (plástico básico + rellenador con portaconos)`)
  L(`- **Colores**: cream #F5F2E8 · crimson #BB3B2E · orange #FF3B27 · dark #1A1A1A · olive #4D5431`)
  L(`- **Tipografía**: Kanit (900/700 para display, 500 para cuerpo)`)
  L(`- **Dimensiones**: Posts 4:5 (1080×1350) · Reels 9:16 (1080×1920) · Stories 9:16 con safe zones top 280px y bottom 250px`)
  L()

  // Trend brief
  if (brief?.content) {
    const c = brief.content as {
      themes?: Array<{ title: string; why: string }>
      content_ideas?: string[]
      hashtag_watch?: string[]
    }
    L(`## Trending — brief ${brief.week_start}${brief.model_name ? ` · ${brief.model_name}` : ""}`)
    L()
    if (c.themes && c.themes.length > 0) {
      L(`### Temas ganando tracción`)
      for (const t of c.themes) L(`- **${t.title}** — ${t.why}`)
      L()
    }
    if (c.content_ideas && c.content_ideas.length > 0) {
      L(`### Ideas sugeridas por la IA`)
      for (const idea of c.content_ideas) L(`- ${idea}`)
      L()
    }
    if (c.hashtag_watch && c.hashtag_watch.length > 0) {
      L(`### Hashtags a vigilar`)
      L(c.hashtag_watch.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" · "))
      L()
    }
  }

  // Suggestions grouped by status
  L(`## Sugerencias de contenido abiertas`)
  L()
  const openSuggestions = (suggestions as Array<{
    id: string; kind: string; title: string; body?: string | null;
    pillar?: string | null; format?: string | null;
    suggested_date?: string | Date | null; source: string; status: string;
  }>).filter((s) => s.status === "idea" || s.status === "in_design")

  if (openSuggestions.length === 0) {
    L(`_No hay sugerencias abiertas actualmente._`)
  } else {
    for (const s of openSuggestions) {
      L(`### 💡 ${s.kind === "story" ? "Story" : "Post"}: ${s.title}`)
      L(`_id: \`${s.id}\` · source: \`${s.source}\` · status: \`${s.status}\`${s.pillar ? ` · pillar: ${s.pillar}` : ""}${s.format ? ` · format: ${s.format}` : ""}${s.suggested_date ? ` · sugerido para: ${new Date(s.suggested_date).toISOString().slice(0, 10)}` : ""}_`)
      if (s.body) { L(); L(s.body) }
      L()
    }
  }
  L()

  // Unresolved feedback — actionable design changes requested on existing content
  if (fbByEntity.size > 0) {
    L(`## Feedback abierto en posts/stories ya diseñados`)
    L()
    const postsById = new Map(
      (posts as Array<{ id: string; number: string; title: string }>).map((p) => [p.id, p])
    )
    const storiesById = new Map(
      (stories as Array<{ id: string; date: string; slot: number; type: string }>).map((s) => [s.id, s])
    )

    for (const [key, items] of fbByEntity) {
      const [type, id] = key.split(":") as ["post" | "story", string]
      let heading = `${type} · ${id}`
      if (type === "post") {
        const p = postsById.get(id)
        if (p) heading = `Post #${p.number} · ${p.title.replace(/^Post\s+\d+\s*·\s*/, "").replace(/^F\d+\s*·\s*/, "")}`
      } else {
        const s = storiesById.get(id)
        if (s) heading = `Story ${s.date} · slot ${s.slot} (${s.type})`
      }
      L(`### ${heading}`)
      const sorted = [...items].sort(
        (a, b) =>
          new Date((a as unknown as { created_at: string }).created_at).getTime() -
          new Date((b as unknown as { created_at: string }).created_at).getTime()
      )
      for (const f of sorted) {
        const ff = f as unknown as {
          text: string
          timestamp_ms?: number | null
          author_id?: string | null
          created_at: string
        }
        const ts = ff.timestamp_ms != null
          ? ` @ ${Math.floor(ff.timestamp_ms / 1000)}s`
          : ""
        L(`- ${ff.text.replace(/\n/g, " ⏎ ")}${ts} _· ${new Date(ff.created_at).toISOString().slice(0, 10)}${ff.author_id ? ` · ${ff.author_id.slice(0, 8)}` : ""}_`)
      }
      L()
    }
  }

  // Recent published context
  if (recentPublished.length > 0) {
    L(`## Publicados recientes (contexto de continuidad)`)
    L()
    for (const p of recentPublished) {
      L(`- **#${p.number} · ${p.title.replace(/^Post\s+\d+\s*·\s*/, "").replace(/^F\d+\s*·\s*/, "")}** · ${p.format}${p.ig_post_id ? ` · [ver en IG](https://www.instagram.com/p/${p.ig_post_id}/)` : ""}`)
      if (p.caption) {
        L(`  > ${p.caption.slice(0, 200).replace(/\n/g, " ⏎ ")}${p.caption.length > 200 ? "…" : ""}`)
      }
    }
    L()
  }

  // Footer — how Claude should consume this
  L(`---`)
  L(`### Cómo usar este documento`)
  L(`1. Las **sugerencias abiertas** son lo que hay que diseñar — cada una con su \`id\` para referenciar`)
  L(`2. El **feedback abierto** son cambios específicos sobre diseños que ya existen — priorizalos antes de nuevas sugerencias`)
  L(`3. El **trending** es el norte editorial de la semana — las sugerencias y diseños deberían hablarle a esos temas`)
  L(`4. Los **publicados recientes** son para no repetir ángulos — mirá qué salió ya`)
  L()

  const body = lines.join("\n")

  const filename = `enrola-social-brief-${now.toISOString().slice(0, 10)}.md`
  res.setHeader("Content-Type", "text/markdown; charset=utf-8")
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`)
  return res.send(body)
}
