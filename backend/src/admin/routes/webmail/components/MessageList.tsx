import { Text, Button, Skeleton, Select } from "@medusajs/ui"
import type { SortKey } from "../hooks/use-webmail"

type Message = {
  uid: number; from: string; subject: string
  date: string; seen: boolean; flagged: boolean; size: number
}

type Props = {
  messages: Message[]
  loading: boolean
  selectedUid: number | null
  onSelect: (uid: number) => void
  onStar: (uid: number, flagged: boolean) => void
  onMarkAllRead: () => void
  page: number
  totalPages: number
  onPageChange: (p: number) => void
  sort: SortKey
  onSortChange: (s: SortKey) => void
}

function formatDate(iso: string): string {
  if (!iso) return ""
  const d = new Date(iso)
  const now = new Date()
  const isToday = d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear()
  if (isToday) return d.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })
  return d.toLocaleDateString("es", { day: "2-digit", month: "short" })
}

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "date-desc", label: "Fecha ↓" },
  { value: "date-asc", label: "Fecha ↑" },
  { value: "from-asc", label: "Remitente A-Z" },
  { value: "from-desc", label: "Remitente Z-A" },
  { value: "subject-asc", label: "Asunto A-Z" },
  { value: "subject-desc", label: "Asunto Z-A" },
  { value: "size-desc", label: "Tamaño ↓" },
  { value: "size-asc", label: "Tamaño ↑" },
]

export function MessageList({
  messages, loading, selectedUid, onSelect, onStar, onMarkAllRead,
  page, totalPages, onPageChange, sort, onSortChange,
}: Props) {
  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-ui-border-base bg-ui-bg-subtle shrink-0">
        <select
          value={sort}
          onChange={(e) => onSortChange(e.target.value as SortKey)}
          className="flex-1 text-xs rounded border border-ui-border-base bg-ui-bg-field px-2 py-1 text-ui-fg-base focus:outline-none focus:ring-1 focus:ring-ui-fg-interactive"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <button
          onClick={onMarkAllRead}
          title="Marcar todo como leído"
          className="text-xs text-ui-fg-muted hover:text-ui-fg-base transition-colors px-2 py-1 rounded hover:bg-ui-bg-base-hover whitespace-nowrap"
        >
          ✓ Todo leído
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col gap-2 p-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded" />
          ))}
        </div>
      ) : messages.length === 0 ? (
        <div className="flex items-center justify-center h-full">
          <Text className="text-ui-fg-muted">No hay mensajes</Text>
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          {messages.map((m) => (
            <div
              key={m.uid}
              onClick={() => onSelect(m.uid)}
              className={`flex items-start gap-2 px-3 py-2.5 cursor-pointer border-b border-ui-border-base transition-colors ${
                selectedUid === m.uid
                  ? "bg-ui-bg-base-pressed"
                  : "hover:bg-ui-bg-base-hover"
              }`}
            >
              {/* Unread dot */}
              <div className="w-2 flex-shrink-0 mt-1.5">
                {!m.seen && (
                  <span className="block w-2 h-2 rounded-full bg-blue-500" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <Text
                    size="small"
                    className={`truncate ${!m.seen ? "font-semibold" : ""}`}
                  >
                    {m.from}
                  </Text>
                  <Text size="xsmall" className="text-ui-fg-muted whitespace-nowrap flex-shrink-0">
                    {formatDate(m.date)}
                  </Text>
                </div>
                <Text
                  size="xsmall"
                  className={`truncate ${!m.seen ? "font-medium text-ui-fg-base" : "text-ui-fg-muted"}`}
                >
                  {m.subject}
                </Text>
              </div>

              {/* Star */}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onStar(m.uid, !m.flagged) }}
                className={`flex-shrink-0 text-base leading-none transition-colors ${
                  m.flagged ? "text-yellow-400" : "text-ui-fg-muted hover:text-yellow-400"
                }`}
                title={m.flagged ? "Quitar estrella" : "Marcar con estrella"}
              >
                {m.flagged ? "★" : "☆"}
              </button>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-2 border-t border-ui-border-base shrink-0">
          <Button variant="secondary" size="small" disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}>
            Anterior
          </Button>
          <Text size="small" className="text-ui-fg-muted">{page} / {totalPages}</Text>
          <Button variant="secondary" size="small" disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}>
            Siguiente
          </Button>
        </div>
      )}
    </div>
  )
}
