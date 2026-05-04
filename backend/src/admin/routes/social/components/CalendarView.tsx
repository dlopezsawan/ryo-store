import { useCallback, useMemo, useState } from "react"
import { Calendar, dateFnsLocalizer, Views, type View } from "react-big-calendar"
import withDragAndDrop, {
  type withDragAndDropProps,
} from "react-big-calendar/lib/addons/dragAndDrop"
import { format, parse, startOfWeek, getDay, addHours } from "date-fns"
import { es } from "date-fns/locale"
import { Button, Badge, Text, toast } from "@medusajs/ui"
import type { SocialPost, SocialStory, SocialStatus } from "../types"
import { STATUS_LABELS } from "../types"

import "react-big-calendar/lib/css/react-big-calendar.css"
import "react-big-calendar/lib/addons/dragAndDrop/styles.css"

const API = "https://api.enrola.shop"

type EventKind = "post" | "story"
type CalEvent = {
  id: string            // "post:<id>" | "story:<id>"
  entityId: string
  kind: EventKind
  title: string
  start: Date
  end: Date
  allDay: boolean
  status: SocialStatus
  resource: SocialPost | SocialStory
}

const locales = { es }
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: (date: Date) => startOfWeek(date, { weekStartsOn: 1 }),
  getDay,
  locales,
})

const DnDCalendar = withDragAndDrop<CalEvent>(
  Calendar as unknown as Parameters<typeof withDragAndDrop<CalEvent>>[0]
)

// Status → CSS color (foreground/background). Matches STATUS_COLORS intent.
// Approved is the loudest one on purpose — that's the state the user
// is looking for as they review the calendar.
const STATUS_BG: Record<SocialStatus, { bg: string; fg: string; border: string }> = {
  draft:       { bg: "#F5F2E8", fg: "#4D5431", border: "#BDB59F" },
  in_review:   { bg: "#FFE5B4", fg: "#8A4B00", border: "#E0A85D" },
  approved:    { bg: "#C3A8F0", fg: "#2A0A6B", border: "#6E3DD6" },
  scheduled:   { bg: "#9EC5E8", fg: "#0E3A63", border: "#3B7BBF" },
  published:   { bg: "#A8DDB4", fg: "#0E4016", border: "#3F9A56" },
  failed:      { bg: "#F5B3B8", fg: "#5C1217", border: "#C0464E" },
}

const STATUS_ICON: Record<SocialStatus, string> = {
  draft:     "•",
  in_review: "⧗",
  approved:  "✓",
  scheduled: "🗓",
  published: "★",
  failed:    "✕",
}

/**
 * Compact event renderer — we want the status and exact time obvious at a
 * glance without opening the detail panel.
 *
 *   ✓ 20:00 · #05 Carbón activo
 */
function EventChip({ event }: { event: CalEvent }) {
  const hm = event.start.toLocaleTimeString("es-VE", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
  return (
    <span className="flex items-center gap-1 truncate leading-tight">
      <span aria-hidden className="shrink-0 font-semibold">
        {STATUS_ICON[event.status] ?? "•"}
      </span>
      <span className="tabular-nums font-medium shrink-0">{hm}</span>
      <span className="opacity-70">·</span>
      <span className="truncate">{event.title}</span>
    </span>
  )
}

const messages = {
  allDay: "Todo el día",
  previous: "Anterior",
  next: "Siguiente",
  today: "Hoy",
  month: "Mes",
  week: "Semana",
  day: "Día",
  agenda: "Agenda",
  date: "Fecha",
  time: "Hora",
  event: "Contenido",
  noEventsInRange: "Sin publicaciones en este rango.",
  showMore: (n: number) => `+${n} más`,
}

export function CalendarView({
  posts,
  stories,
  onUpdate,
}: {
  posts: SocialPost[]
  stories: SocialStory[]
  onUpdate: () => void
}) {
  const [view, setView] = useState<View>(Views.MONTH)
  const [date, setDate] = useState<Date>(() => new Date())
  const [showPosts, setShowPosts] = useState(true)
  const [showStories, setShowStories] = useState(true)
  const [selected, setSelected] = useState<CalEvent | null>(null)

  const events = useMemo<CalEvent[]>(() => {
    const out: CalEvent[] = []

    if (showPosts) {
      for (const p of posts) {
        if (!p.date_planned) continue
        const start = new Date(p.date_planned)
        out.push({
          id: `post:${p.id}`,
          entityId: p.id,
          kind: "post",
          title: `#${p.number} · ${p.title.replace(/^Post\s+\d+\s*·\s*/, "").replace(/^F\d+\s*·\s*/, "")}`,
          start,
          end: addHours(start, 1),
          allDay: false,
          status: p.status,
          resource: p,
        })
      }
    }

    if (showStories) {
      for (const s of stories) {
        // Prefer an explicit scheduled_at (user-edited); fall back to date+slot.
        let start: Date | null = null
        if (s.scheduled_at) {
          const d = new Date(s.scheduled_at)
          if (!isNaN(d.getTime())) start = d
        }
        if (!start) {
          const [y, m, d] = s.date.split("-").map((n) => parseInt(n, 10))
          if (!y || !m || !d) continue
          start = new Date(y, m - 1, d, 8 + s.slot, 0, 0)
        }
        out.push({
          id: `story:${s.id}`,
          entityId: s.id,
          kind: "story",
          title: `Story #${s.slot} · ${s.type}`,
          start,
          end: addHours(start, 1),
          allDay: false,
          status: s.status,
          resource: s,
        })
      }
    }

    return out
  }, [posts, stories, showPosts, showStories])

  // Keep the detail panel in sync with fresh status after parent refresh:
  // if the user approves from Lista and switches here, `selected` must
  // reflect the new status (so "Aprobar" swaps to "Desaprobar" automatically
  // and colors match).
  const selectedCurrent = useMemo(() => {
    if (!selected) return null
    return events.find((e) => e.id === selected.id) ?? selected
  }, [selected, events])

  // ── Drag & drop ────────────────────────────────────────────────────
  const onEventDrop = useCallback<NonNullable<withDragAndDropProps<CalEvent>["onEventDrop"]>>(
    async ({ event, start }) => {
      const ev = event as CalEvent
      const newStart = typeof start === "string" ? new Date(start) : start
      try {
        if (ev.kind === "post") {
          const res = await fetch(`${API}/admin/social/posts/${ev.entityId}`, {
            method: "PATCH",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ date_planned: newStart.toISOString() }),
          })
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          toast.success("Fecha del post actualizada")
        } else {
          // Stories use the "date" field (YYYY-MM-DD)
          const y = newStart.getFullYear()
          const m = String(newStart.getMonth() + 1).padStart(2, "0")
          const d = String(newStart.getDate()).padStart(2, "0")
          const res = await fetch(`${API}/admin/social/stories/${ev.entityId}`, {
            method: "PATCH",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ date: `${y}-${m}-${d}` }),
          })
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          toast.success("Fecha de la story actualizada")
        }
        onUpdate()
      } catch (e) {
        toast.error("No se pudo mover", { description: (e as Error).message })
      }
    },
    [onUpdate]
  )

  const eventPropGetter = useCallback(
    (event: CalEvent) => {
      const colors = STATUS_BG[event.status] ?? STATUS_BG.draft
      return {
        style: {
          backgroundColor: colors.bg,
          color: colors.fg,
          border: `1px solid ${colors.border}`,
          borderLeft: `3px solid ${colors.border}`,
          borderRadius: 4,
          fontSize: 12,
          padding: "2px 4px",
        },
      }
    },
    []
  )

  const setSelectedStatus = useCallback(
    async (nextStatus: "approved" | "draft") => {
      if (!selected) return
      try {
        const path = selected.kind === "post" ? "posts" : "stories"
        const res = await fetch(`${API}/admin/social/${path}/${selected.entityId}`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: nextStatus }),
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        toast.success(nextStatus === "approved" ? "Aprobado" : "Desaprobado")
        setSelected(null)
        onUpdate()
      } catch (e) {
        toast.error("No se pudo actualizar", { description: (e as Error).message })
      }
    },
    [selected, onUpdate]
  )

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar filters */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Button
            size="small"
            variant={showPosts ? "primary" : "secondary"}
            onClick={() => setShowPosts((v) => !v)}
          >
            Posts ({posts.filter((p) => p.date_planned).length})
          </Button>
          <Button
            size="small"
            variant={showStories ? "primary" : "secondary"}
            onClick={() => setShowStories((v) => !v)}
          >
            Stories ({stories.length})
          </Button>
        </div>
        <Text size="xsmall" className="text-ui-fg-muted">
          Arrastrá un evento para cambiarlo de día · click para ver detalle
        </Text>
      </div>

      {/* Calendar */}
      <div
        className="bg-ui-bg-base rounded-md border border-ui-border-base p-2"
        style={{ height: 680 }}
      >
        <DnDCalendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          titleAccessor="title"
          allDayAccessor="allDay"
          view={view}
          date={date}
          onView={(v) => setView(v)}
          onNavigate={(d) => setDate(d)}
          views={[Views.MONTH, Views.WEEK, Views.DAY, Views.AGENDA]}
          messages={messages}
          culture="es"
          popup
          draggableAccessor={() => true}
          resizable={false}
          onEventDrop={onEventDrop}
          onSelectEvent={(event) => setSelected(event as CalEvent)}
          eventPropGetter={eventPropGetter}
          components={{ event: EventChip as never }}
        />
      </div>

      {/* Detail panel */}
      {selectedCurrent && (
        <DetailPanel
          event={selectedCurrent}
          onClose={() => setSelected(null)}
          onApprove={() => setSelectedStatus("approved")}
          onReopen={() => setSelectedStatus("draft")}
        />
      )}

      {/* Inject overrides to match Medusa dark theme */}
      <style>{`
        .rbc-calendar { background: transparent; color: var(--fg-base, #1a1a1a); font-family: inherit; }
        .rbc-toolbar button { color: inherit; background: transparent; border-color: var(--border-base, #e4e4e7); }
        .rbc-toolbar button:hover, .rbc-toolbar button:focus { background: var(--bg-subtle, #f4f4f5); }
        .rbc-toolbar button.rbc-active { background: var(--bg-component, #18181b); color: #fff; }
        .rbc-header { background: transparent; border-color: var(--border-base, #e4e4e7); padding: 6px 4px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; }
        .rbc-month-view, .rbc-time-view, .rbc-agenda-view { border-color: var(--border-base, #e4e4e7); }
        .rbc-day-bg, .rbc-date-cell, .rbc-month-row, .rbc-time-content > * { border-color: var(--border-base, #e4e4e7); }
        .rbc-today { background: rgba(187, 59, 46, 0.06); }
        .rbc-off-range-bg { background: rgba(128, 128, 128, 0.04); }
        .rbc-event { cursor: grab; }
        .rbc-event.rbc-selected { outline: 2px solid #1A1A1A; }
        .rbc-show-more { color: var(--fg-interactive, #3b82f6); font-weight: 600; }
      `}</style>
    </div>
  )
}

// ── Detail panel (side-drawer, lightweight) ────────────────────────
function DetailPanel({
  event,
  onClose,
  onApprove,
  onReopen,
}: {
  event: CalEvent
  onClose: () => void
  onApprove: () => void
  onReopen: () => void
}) {
  const isPost = event.kind === "post"
  const p = isPost ? (event.resource as SocialPost) : null
  const s = !isPost ? (event.resource as SocialStory) : null
  const isApproved =
    event.status === "approved" ||
    event.status === "scheduled" ||
    event.status === "published"

  return (
    <div className="fixed inset-0 z-40 flex justify-end pointer-events-none">
      <div
        className="absolute inset-0 bg-black/30 pointer-events-auto"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md h-full bg-ui-bg-base border-l border-ui-border-base shadow-xl pointer-events-auto overflow-y-auto p-5 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <Text size="xsmall" className="text-ui-fg-subtle uppercase tracking-wide">
              {event.kind === "post" ? "Post" : "Story"} · {STATUS_LABELS[event.status] ?? event.status}
            </Text>
            <h2 className="text-lg font-semibold mt-1">{event.title}</h2>
          </div>
          <button
            onClick={onClose}
            className="text-ui-fg-subtle hover:text-ui-fg-base text-xl leading-none"
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>

        <Text size="small" className="text-ui-fg-subtle">
          {format(event.start, "EEEE d 'de' MMMM · HH:mm", { locale: es })}
        </Text>

        {p?.cover_url && (
          <img
            src={toAbs(p.cover_url)}
            alt=""
            className="w-full max-h-64 object-contain rounded border border-ui-border-base bg-ui-bg-subtle"
          />
        )}
        {s?.media_url && (
          <img
            src={toAbs(s.media_url)}
            alt=""
            className="w-full max-h-64 object-contain rounded border border-ui-border-base bg-ui-bg-subtle"
          />
        )}

        {p?.caption && (
          <div className="text-sm whitespace-pre-wrap text-ui-fg-base">
            {p.caption}
          </div>
        )}

        <div className="flex items-center gap-2 mt-auto pt-3 border-t border-ui-border-base flex-wrap">
          {isApproved ? (
            <Button size="small" variant="secondary" onClick={onReopen}>
              ↺ Desaprobar
            </Button>
          ) : (
            <Button size="small" onClick={onApprove}>
              ✓ Aprobar
            </Button>
          )}
          <Text size="xsmall" className="text-ui-fg-muted">
            Feedback y @menciones en la vista <strong>Lista</strong>.
          </Text>
        </div>
      </div>
    </div>
  )
}

function toAbs(u: string | null | undefined): string | undefined {
  if (!u) return undefined
  if (u.startsWith("http") || u.startsWith("data:")) return u
  return `${API}${u.startsWith("/") ? "" : "/"}${u}`
}

// Re-export badge so parent can still use if needed.
export { Badge }
