import { useMemo } from "react"
import { Container, Heading, Text, Badge } from "@medusajs/ui"
import type { SocialPost, SocialStory } from "../types"
import { StatusBadge } from "./StatusBadge"

/**
 * Batch 1 — placeholder calendar: agrupa posts + stories por día en una lista
 * cronológica. Batch 3 lo reemplaza por react-big-calendar con drag & drop.
 */
export function CalendarView({
  posts,
  stories,
}: {
  posts: SocialPost[]
  stories: SocialStory[]
  onUpdate: () => void
}) {
  const grouped = useMemo(() => {
    const map: Record<string, { posts: SocialPost[]; stories: SocialStory[] }> = {}
    for (const p of posts) {
      const key = p.date_planned ? new Date(p.date_planned).toISOString().slice(0, 10) : "sin-fecha"
      ;(map[key] = map[key] ?? { posts: [], stories: [] }).posts.push(p)
    }
    for (const s of stories) {
      ;(map[s.date] = map[s.date] ?? { posts: [], stories: [] }).stories.push(s)
    }
    return map
  }, [posts, stories])

  const sortedDates = useMemo(
    () =>
      Object.keys(grouped).sort((a, b) => {
        if (a === "sin-fecha") return 1
        if (b === "sin-fecha") return -1
        return a.localeCompare(b)
      }),
    [grouped]
  )

  return (
    <div className="flex flex-col gap-4">
      <Container className="p-3 bg-ui-bg-subtle">
        <Text size="small" className="text-ui-fg-subtle">
          🗓️ Vista cronológica lineal. En <strong>Batch 3</strong> se convierte en calendario mensual
          con drag &amp; drop.
        </Text>
      </Container>

      {sortedDates.map((date) => (
        <Container key={date} className="p-4">
          <Heading level="h3">
            {date === "sin-fecha" ? "Sin fecha" : date}
            <Badge size="2xsmall" color="grey" className="ml-2">
              {grouped[date].posts.length + grouped[date].stories.length}
            </Badge>
          </Heading>

          {grouped[date].posts.length > 0 && (
            <div className="mt-3">
              <Text size="xsmall" weight="plus" className="text-ui-fg-subtle uppercase tracking-wide mb-1">
                Posts
              </Text>
              <ul className="flex flex-col gap-1.5">
                {grouped[date].posts.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate">
                      #{p.number} · {p.title.replace(/^Post\s+\d+\s*·\s*/, "")}
                    </span>
                    <div className="flex gap-1 shrink-0">
                      <Badge size="2xsmall" color="blue">{p.format}</Badge>
                      <StatusBadge status={p.status} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {grouped[date].stories.length > 0 && (
            <div className="mt-3">
              <Text size="xsmall" weight="plus" className="text-ui-fg-subtle uppercase tracking-wide mb-1">
                Stories · {grouped[date].stories.length}
              </Text>
              <div className="flex gap-1.5 flex-wrap">
                {grouped[date].stories.map((s) => (
                  <Badge key={s.id} size="2xsmall" color="grey">
                    {s.slot}. {s.type}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </Container>
      ))}
    </div>
  )
}
