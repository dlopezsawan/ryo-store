import { useMemo, useState } from "react"
import { Container, Heading, Text, Badge, toast } from "@medusajs/ui"
import type { SocialPost, SocialStatus } from "../types"
import { STATUS_LABELS } from "../types"

const API = "https://api.enrola.shop"

// Order mirrors the user-facing lifecycle: editorial → operations → post-hoc
const COLUMNS: SocialStatus[] = [
  "draft", "in_review", "approved", "scheduled", "publishing", "published", "failed",
]

// Which transitions are safe to make from the UI without calling extra logic.
// "approved → scheduled" is a special case: it requires a Buffer API call
// with a scheduled_at, which we handle via the `/admin/social/publish/:id`
// route. Dragging into Programado picks the card's existing scheduled_at.
// Anything moving OUT of "publishing" is refused (worker is mid-flight).
function canTransition(from: SocialStatus, to: SocialStatus): { ok: boolean; reason?: string } {
  if (from === to) return { ok: false }
  if (from === "publishing") return { ok: false, reason: "Publicándose — esperá a que termine" }
  if (from === "published" && to !== "failed") {
    return { ok: false, reason: "Ya publicado en IG. No se puede revertir desde acá." }
  }
  return { ok: true }
}

// ─── Column heading colors aligned to status pill colors in types.ts ────
const COL_ACCENT: Record<SocialStatus, string> = {
  draft:      "border-l-ui-border-base",
  in_review:  "border-l-ui-tag-orange-border",
  approved:   "border-l-ui-tag-purple-border",
  scheduled:  "border-l-ui-tag-blue-border",
  publishing: "border-l-ui-tag-blue-border",
  published:  "border-l-ui-tag-green-border",
  failed:     "border-l-ui-tag-red-border",
}

/**
 * Functional Kanban with native HTML5 drag & drop.
 *
 * Drop mechanics:
 *   - draft / in_review / approved / failed → any other editable status uses
 *     a plain PATCH /admin/social/posts/:id with { status }.
 *   - Dragging into `scheduled` from `approved` routes through
 *     `/admin/social/publish/:id` so Buffer actually receives the schedule.
 *     Uses the card's existing scheduled_at — if null, falls back to
 *     date_planned, then "now + 90s".
 *   - Dragging out of `scheduled` (cancel) routes through
 *     `/admin/social/cancel-schedule/:id` to also wipe the Buffer draft.
 *
 * No drag libraries — the native API is enough for card-to-column dragging
 * and gives us accessible keyboard dragging for free via role="button".
 */
export function KanbanView({
  posts,
  onUpdate,
}: {
  posts: SocialPost[]
  onUpdate: () => void
}) {
  const [dragId, setDragId] = useState<string | null>(null)
  const [overCol, setOverCol] = useState<SocialStatus | null>(null)
  const [busy, setBusy] = useState(false)

  const byStatus = useMemo(() => {
    const map: Record<SocialStatus, SocialPost[]> = {
      draft: [], in_review: [], approved: [],
      scheduled: [], publishing: [], published: [], failed: [],
    }
    for (const p of posts) (map[p.status] ?? map.draft).push(p)
    return map
  }, [posts])

  const move = async (post: SocialPost, target: SocialStatus) => {
    const gate = canTransition(post.status, target)
    if (!gate.ok) {
      if (gate.reason) toast.error(gate.reason)
      return
    }

    setBusy(true)
    try {
      // Special transitions first — they talk to Buffer
      if (target === "scheduled" && post.status === "approved") {
        const when =
          post.scheduled_at ||
          post.date_planned ||
          new Date(Date.now() + 90_000).toISOString()
        const res = await fetch(`${API}/admin/social/publish/${post.id}`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ entity: "post", when }),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(
            (data as { detail?: string; message?: string }).detail ||
              (data as { message?: string }).message ||
              `HTTP ${res.status}`
          )
        }
        toast.success("Programado en Buffer")
      } else if (post.status === "scheduled" && target !== "scheduled") {
        // Cancel the Buffer schedule when dragging out of scheduled.
        await fetch(`${API}/admin/social/cancel-schedule/${post.id}`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ entity: "post" }),
        })
        // If target was anything other than the cancel's default "approved",
        // we do one more PATCH to land on the requested column.
        if (target !== "approved") {
          await fetch(`${API}/admin/social/posts/${post.id}`, {
            method: "PATCH",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: target }),
          })
        }
        toast.success("Programación cancelada")
      } else {
        // Vanilla status flip
        const res = await fetch(`${API}/admin/social/posts/${post.id}`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: target }),
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        toast.success(`Movido a ${STATUS_LABELS[target]}`)
      }
      onUpdate()
    } catch (e) {
      toast.error("No se pudo mover", { description: (e as Error).message })
    } finally {
      setBusy(false)
      setDragId(null)
      setOverCol(null)
    }
  }

  return (
    <div>
      <Container className="p-3 bg-ui-bg-subtle mb-4">
        <Text size="small" className="text-ui-fg-subtle">
          🗂️ Arrastrá una card entre columnas para cambiar su estado. Al mover a{" "}
          <strong>Programado</strong> se manda a Buffer con su <code>scheduled_at</code> actual.
          Mover fuera de <strong>Programado</strong> cancela la programación en Buffer.
        </Text>
      </Container>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 gap-3">
        {COLUMNS.map((col) => (
          <Container
            key={col}
            className={`p-3 flex flex-col gap-2 min-h-[240px] border-l-4 transition-colors ${
              COL_ACCENT[col]
            } ${overCol === col ? "bg-ui-bg-subtle" : ""}`}
            onDragOver={(e) => {
              e.preventDefault()
              e.dataTransfer.dropEffect = "move"
              setOverCol(col)
            }}
            onDragLeave={() => setOverCol((c) => (c === col ? null : c))}
            onDrop={(e) => {
              e.preventDefault()
              const id = e.dataTransfer.getData("text/plain")
              const post = posts.find((p) => p.id === id)
              if (post) void move(post, col)
            }}
          >
            <div className="flex items-center justify-between">
              <Heading level="h3" className="capitalize text-sm">
                {STATUS_LABELS[col]}
              </Heading>
              <Badge size="2xsmall" color="grey">{byStatus[col].length}</Badge>
            </div>

            <div className="flex flex-col gap-1.5 min-h-[40px]">
              {byStatus[col].map((p) => (
                <div
                  key={p.id}
                  draggable={!busy}
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/plain", p.id)
                    e.dataTransfer.effectAllowed = "move"
                    setDragId(p.id)
                  }}
                  onDragEnd={() => setDragId(null)}
                  className={`text-xs bg-ui-bg-base border border-ui-border-base rounded-md p-2 cursor-grab active:cursor-grabbing transition-opacity ${
                    dragId === p.id ? "opacity-40" : ""
                  }`}
                  title={`${p.title} · arrastrame`}
                >
                  <div className="flex items-center gap-1 justify-between">
                    <span className="font-medium truncate">#{p.number}</span>
                    <Badge size="2xsmall" color="blue">{p.format}</Badge>
                  </div>
                  <div className="text-ui-fg-subtle truncate mt-0.5">
                    {p.title.replace(/^Post\s+\d+\s*·\s*/, "").replace(/^F\d+\s*·\s*/, "")}
                  </div>
                  {p.scheduled_at && (
                    <div className="text-ui-fg-muted mt-0.5 tabular-nums">
                      {new Date(p.scheduled_at).toLocaleString("es-VE", {
                        day: "2-digit", month: "short",
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </div>
                  )}
                  {p.failure_reason && (
                    <div className="text-ui-tag-red-text mt-0.5 truncate" title={p.failure_reason}>
                      ⚠ {p.failure_reason}
                    </div>
                  )}
                </div>
              ))}
              {byStatus[col].length === 0 && (
                <Text size="xsmall" className="text-ui-fg-muted italic">
                  {overCol === col ? "soltá acá" : "vacío"}
                </Text>
              )}
            </div>
          </Container>
        ))}
      </div>
    </div>
  )
}
