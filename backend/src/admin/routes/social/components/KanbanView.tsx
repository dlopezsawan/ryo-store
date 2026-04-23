import { useMemo } from "react"
import { Container, Heading, Text, Badge } from "@medusajs/ui"
import type { SocialPost, SocialStatus } from "../types"
import { STATUS_LABELS } from "../types"

const COLUMNS: SocialStatus[] = ["draft", "in_review", "approved", "scheduled", "published", "failed"]

export function KanbanView({
  posts,
}: {
  posts: SocialPost[]
  onUpdate: () => void
}) {
  const byStatus = useMemo(() => {
    const map: Record<SocialStatus, SocialPost[]> = {
      draft: [],
      in_review: [],
      approved: [],
      scheduled: [],
      published: [],
      failed: [],
    }
    for (const p of posts) {
      ;(map[p.status] ?? map.draft).push(p)
    }
    return map
  }, [posts])

  return (
    <div>
      <Container className="p-3 bg-ui-bg-subtle mb-4">
        <Text size="small" className="text-ui-fg-subtle">
          🗂️ Kanban read-only. En <strong>Batch 2</strong> se agrega drag &amp; drop entre columnas con
          gates por role (editor comenta, admin aprueba).
        </Text>
      </Container>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {COLUMNS.map((col) => (
          <Container key={col} className="p-3 flex flex-col gap-2 min-h-[200px]">
            <div className="flex items-center justify-between">
              <Heading level="h3" className="capitalize text-sm">
                {STATUS_LABELS[col]}
              </Heading>
              <Badge size="2xsmall" color="grey">{byStatus[col].length}</Badge>
            </div>
            <div className="flex flex-col gap-1.5">
              {byStatus[col].map((p) => (
                <div
                  key={p.id}
                  className="text-xs bg-ui-bg-base border border-ui-border-base rounded-md p-2"
                >
                  <div className="font-medium truncate">#{p.number}</div>
                  <div className="text-ui-fg-subtle truncate">
                    {p.title.replace(/^Post\s+\d+\s*·\s*/, "").replace(/^F\d+\s*·\s*/, "")}
                  </div>
                </div>
              ))}
              {byStatus[col].length === 0 && (
                <Text size="xsmall" className="text-ui-fg-muted italic">vacío</Text>
              )}
            </div>
          </Container>
        ))}
      </div>
    </div>
  )
}
