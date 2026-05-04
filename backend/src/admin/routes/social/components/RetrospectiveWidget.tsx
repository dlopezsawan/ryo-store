import { useCallback, useEffect, useMemo, useState } from "react"
import { Badge, Container, Text } from "@medusajs/ui"
import type { SocialPost, SocialTrendBrief } from "../types"

const API = "https://api.enrola.shop"

/**
 * Retrospective widget — shown at the top of Lista view.
 *
 * Pulls the latest weekly brief from /admin/social/trends and compares its
 * "themes" and "content_ideas" to what was actually published / scheduled
 * in the last 14 days. The idea is to surface blind spots quickly:
 *
 *   "El brief sugirió 'colaboraciones con artistas locales' y no
 *    publicaste nada de eso."
 *
 * This is heuristic — we don't run another AI pass — just a keyword match
 * between theme titles and post titles/captions. Good enough to prompt a
 * reflection; cheap enough to run client-side.
 */
export function RetrospectiveWidget({ posts }: { posts: SocialPost[] }) {
  const [brief, setBrief] = useState<SocialTrendBrief | null>(null)
  const [collapsed, setCollapsed] = useState(true)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API}/admin/social/trends?limit=1`, {
        credentials: "include",
        cache: "no-store",
      }).then((r) => r.json())
      setBrief(res.brief ?? null)
    } catch {
      /* no-op */
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  // Posts from the last 14 days (published or scheduled) — those are what we
  // compare the brief's themes against.
  const recent = useMemo(() => {
    const since = Date.now() - 14 * 86400000
    return posts.filter((p) => {
      const t = p.date_planned ? new Date(p.date_planned).getTime() : 0
      return t >= since
    })
  }, [posts])

  const coverage = useMemo(() => {
    if (!brief?.content.themes) return []
    const allText = recent
      .map((p) => `${p.title} ${p.pillar ?? ""} ${p.caption ?? ""}`.toLowerCase())
      .join(" | ")
    return brief.content.themes.map((theme) => {
      // Extract the few most distinctive words from the theme title (length > 4)
      const words = theme.title
        .toLowerCase()
        .split(/[^a-zñáéíóú0-9]+/)
        .filter((w) => w.length > 4)
        .slice(0, 3)
      const covered = words.some((w) => allText.includes(w))
      return { title: theme.title, why: theme.why, covered }
    })
  }, [brief, recent])

  if (!brief || coverage.length === 0) return null

  const coveredCount = coverage.filter((c) => c.covered).length

  return (
    <Container className="p-3">
      <button
        onClick={() => setCollapsed((v) => !v)}
        className="w-full flex items-center justify-between gap-2 text-left"
      >
        <div className="flex items-center gap-2">
          <span aria-hidden>🧠</span>
          <Text size="small" weight="plus" className="text-ui-fg-base">
            Brief vs publicado · últimos 14 días
          </Text>
          <Badge size="2xsmall" color={coveredCount === coverage.length ? "green" : coveredCount === 0 ? "red" : "orange"}>
            {coveredCount}/{coverage.length} temas cubiertos
          </Badge>
        </div>
        <Text size="xsmall" className="text-ui-fg-muted">
          {collapsed ? "Ver detalle ▾" : "Ocultar ▴"}
        </Text>
      </button>

      {!collapsed && (
        <div className="mt-3 flex flex-col gap-2">
          {coverage.map((c, i) => (
            <div
              key={i}
              className={`flex items-start gap-2 rounded-md border p-2 text-sm ${
                c.covered
                  ? "border-ui-tag-green-border bg-ui-tag-green-bg"
                  : "border-ui-tag-orange-border bg-ui-tag-orange-bg"
              }`}
            >
              <span aria-hidden className="shrink-0">
                {c.covered ? "✓" : "✗"}
              </span>
              <div className="flex-1 min-w-0">
                <div className={c.covered ? "text-ui-tag-green-text font-medium" : "text-ui-tag-orange-text font-medium"}>
                  {c.title}
                </div>
                <div className={c.covered ? "text-ui-tag-green-text/80 text-xs mt-0.5" : "text-ui-tag-orange-text/80 text-xs mt-0.5"}>
                  {c.why}
                </div>
              </div>
            </div>
          ))}
          <Text size="xsmall" className="text-ui-fg-muted italic">
            Heurística: buscamos palabras del título del tema en los captions y títulos de los posts de los últimos 14 días. Match aproximado — úsalo como gut-check, no verdad absoluta.
          </Text>
        </div>
      )}
    </Container>
  )
}
