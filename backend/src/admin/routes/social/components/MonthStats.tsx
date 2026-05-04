import { useMemo } from "react"
import { Container, Text } from "@medusajs/ui"
import type { SocialPost, SocialStory } from "../types"

/**
 * Top-of-Lista compact stats bar.
 *
 * Shows progress on the current month's content plan at a glance:
 *   - What's pending feedback
 *   - What's approved & waiting to be scheduled
 *   - What's scheduled upcoming (next 7 days)
 *   - What's live
 *   - What failed (so the user never forgets a post that didn't go out)
 *
 * Deliberately tiny — one row of numbers. Deeper analytics live elsewhere.
 */
export function MonthStats({
  posts,
  stories,
}: {
  posts: SocialPost[]
  stories: SocialStory[]
}) {
  const s = useMemo(() => {
    const now = Date.now()
    const in7d = now + 7 * 86400000

    const all = [
      ...posts.map((p) => ({
        status: p.status,
        scheduled_at: p.scheduled_at,
      })),
      ...stories.map((st) => ({
        status: st.status,
        scheduled_at: st.scheduled_at,
      })),
    ]

    let pending = 0, approved = 0, scheduled = 0, publishing = 0, published = 0, failed = 0
    let upcoming7d = 0
    let nextAt: number | null = null

    for (const item of all) {
      switch (item.status) {
        case "draft":
        case "in_review":
          pending++
          break
        case "approved":
          approved++
          break
        case "scheduled": {
          scheduled++
          if (item.scheduled_at) {
            const t = new Date(item.scheduled_at).getTime()
            if (t >= now && t <= in7d) upcoming7d++
            if (t >= now && (nextAt == null || t < nextAt)) nextAt = t
          }
          break
        }
        case "publishing":
          publishing++
          break
        case "published":
          published++
          break
        case "failed":
          failed++
          break
      }
    }

    return {
      pending, approved, scheduled, publishing, published, failed,
      upcoming7d, nextAt,
      total: all.length,
    }
  }, [posts, stories])

  const nextLabel = s.nextAt
    ? new Date(s.nextAt).toLocaleString("es-VE", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null

  return (
    <Container className="p-3 flex items-center gap-4 flex-wrap">
      <Stat label="Pendientes" value={s.pending} color="text-ui-fg-subtle" />
      <Sep />
      <Stat label="Aprobados" value={s.approved} color="text-ui-tag-purple-text" />
      <Sep />
      <Stat label="Programados" value={s.scheduled} color="text-ui-tag-blue-text" />
      {s.publishing > 0 && (
        <>
          <Sep />
          <Stat label="Publicando" value={s.publishing} color="text-ui-tag-blue-text" />
        </>
      )}
      <Sep />
      <Stat label="Publicados" value={s.published} color="text-ui-tag-green-text" />
      {s.failed > 0 && (
        <>
          <Sep />
          <Stat label="Fallaron" value={s.failed} color="text-ui-tag-red-text" />
        </>
      )}

      {nextLabel && (
        <>
          <Sep />
          <div className="flex flex-col text-right ml-auto">
            <Text size="xsmall" className="text-ui-fg-muted uppercase tracking-wide">
              Próximo a publicar
            </Text>
            <Text size="small" weight="plus" className="text-ui-fg-base">
              {nextLabel}
              {s.upcoming7d > 1 && (
                <span className="text-ui-fg-muted font-normal"> · +{s.upcoming7d - 1} en 7 días</span>
              )}
            </Text>
          </div>
        </>
      )}
    </Container>
  )
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex flex-col">
      <span className={`text-xl font-semibold tabular-nums ${color}`}>{value}</span>
      <Text size="xsmall" className="text-ui-fg-muted uppercase tracking-wide">
        {label}
      </Text>
    </div>
  )
}

function Sep() {
  return <span aria-hidden className="h-8 w-px bg-ui-border-base" />
}
