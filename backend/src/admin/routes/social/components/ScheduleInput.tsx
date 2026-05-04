import { useEffect, useState } from "react"
import { Text, toast } from "@medusajs/ui"

const API = "https://api.enrola.shop"

/**
 * Inline editor for "suggested posting time".
 *
 * Value is read/written via PATCH /admin/social/<entity>/:id with the field
 * the caller passes (`date_planned` for posts, `scheduled_at` for stories).
 * Commits on blur or Enter; discards on Escape.
 *
 * Shown as a compact row:
 *     ⏰ [datetime-local input]   (saved ✓ | editing · | never)
 */
export function ScheduleInput({
  entityType,
  entityId,
  field,
  value,
  onSaved,
}: {
  entityType: "post" | "story"
  entityId: string
  field: "date_planned" | "scheduled_at"
  value: string | null
  onSaved: () => void
}) {
  const [draft, setDraft] = useState(() => toLocalInput(value))
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  // Re-seed when prop changes (after parent refresh).
  useEffect(() => {
    setDraft(toLocalInput(value))
    setDirty(false)
  }, [value])

  const commit = async () => {
    if (!dirty) return
    setSaving(true)
    try {
      const path = entityType === "post" ? "posts" : "stories"
      const payload =
        draft === ""
          ? { [field]: null }
          : { [field]: new Date(draft).toISOString() }
      const res = await fetch(`${API}/admin/social/${path}/${entityId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      toast.success("Hora actualizada")
      setDirty(false)
      onSaved()
    } catch (e) {
      toast.error("No se pudo guardar la hora", { description: (e as Error).message })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      <span aria-hidden className="text-ui-fg-muted">⏰</span>
      <Text size="xsmall" className="text-ui-fg-subtle shrink-0">
        Hora sugerida
      </Text>
      <input
        type="datetime-local"
        value={draft}
        disabled={saving}
        onChange={(e) => {
          setDraft(e.target.value)
          setDirty(true)
        }}
        onBlur={() => {
          void commit()
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault()
            ;(e.target as HTMLInputElement).blur()
          } else if (e.key === "Escape") {
            setDraft(toLocalInput(value))
            setDirty(false)
            ;(e.target as HTMLInputElement).blur()
          }
        }}
        className="flex-1 min-w-0 text-sm bg-ui-bg-base border border-ui-border-base rounded px-2 py-1 focus:outline-none focus:border-ui-border-strong"
      />
      {saving && <Text size="xsmall" className="text-ui-fg-muted">…</Text>}
      {!saving && dirty && (
        <Text size="xsmall" className="text-ui-fg-interactive">
          sin guardar
        </Text>
      )}
    </div>
  )
}

// ── helpers ─────────────────────────────────────────────────────────
// "2026-05-15T20:00:00.000Z" → "2026-05-15T16:00" (local browser time, for
// <input type="datetime-local"> which expects YYYY-MM-DDTHH:mm, no TZ).
function toLocalInput(iso: string | null): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ""
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
