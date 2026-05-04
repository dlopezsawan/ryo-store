import { useCallback, useEffect, useState } from "react"
import { Badge, Button, Container, Heading, Text, Textarea, toast } from "@medusajs/ui"
import type { SocialSuggestion, SuggestionStatus } from "../types"

const API = "https://api.enrola.shop"

const STATUS_COLORS: Record<SuggestionStatus, "grey" | "orange" | "blue" | "red" | "green"> = {
  idea:       "grey",
  in_design:  "blue",
  rejected:   "red",
  promoted:   "green",
}
const STATUS_LABELS: Record<SuggestionStatus, string> = {
  idea:       "Idea",
  in_design:  "En diseño",
  rejected:   "Descartada",
  promoted:   "Promovida",
}

/**
 * Content suggestions board — mounted above the Posts section in Lista view.
 *
 * Three states on a suggestion:
 *   - idea     → default, user is still refining
 *   - in_design → told Claude / designer, waiting for output
 *   - rejected  → decided not to pursue (kept for history)
 *   - promoted  → converted to a real social_post (not implemented yet — future)
 *
 * The UI is intentionally compact: one row per suggestion, inline editing of
 * status, modal for full create/edit. We show everything by default but
 * collapse rejected/promoted under "Ver archivadas" to cut noise.
 */
export function SuggestionsSection({ onPromoted }: { onPromoted?: () => void } = {}) {
  const [suggestions, setSuggestions] = useState<SocialSuggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [modal, setModal] = useState<null | { mode: "create" } | { mode: "edit"; id: string }>(null)
  const [importing, setImporting] = useState(false)
  const [refreshingBrief, setRefreshingBrief] = useState(false)
  const [promoteModal, setPromoteModal] = useState<SocialSuggestion | null>(null)
  // Collapsed by default (same UX as RetrospectiveWidget). Persists per-user
  // in localStorage so once the team prefers it expanded or hidden, that
  // sticks across sessions/devices (per device).
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return true
    const v = window.localStorage.getItem("enrola.social.suggestions_collapsed")
    return v === null ? true : v === "true"
  })
  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev
      try {
        window.localStorage.setItem("enrola.social.suggestions_collapsed", String(next))
      } catch { /* */ }
      return next
    })
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API}/admin/social/suggestions`, {
        credentials: "include",
        cache: "no-store",
      }).then((r) => r.json())
      setSuggestions(res.suggestions ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  /**
   * Parse the day prefix from a campaign-style title ("D1", "D5.2", "D10.1")
   * and turn it into a sortable number. Non-campaign suggestions get a high
   * sentinel so they sort after the day-tagged ones.
   *
   * Why parse from title vs adding a DB column: the 14-day reel campaign
   * titles already encode order, and other suggestions (manual, trend-imported)
   * never carry a day prefix — adding a `day_order` column for one feature
   * would be over-engineering. Frontend parse keeps DB clean.
   */
  const dayOrder = (title: string): number => {
    const m = title.match(/^D(?:[íi]a\s+)?(\d+)(?:\.(\d+))?/i)
    if (!m) return 9999
    return parseInt(m[1], 10) * 10 + parseInt(m[2] ?? "0", 10)
  }
  const sortByDay = (a: SocialSuggestion, b: SocialSuggestion): number => {
    const da = dayOrder(a.title)
    const db = dayOrder(b.title)
    if (da !== db) return da - db
    // Both lack a day prefix (or both equal): newest first as before.
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  }
  const active = suggestions
    .filter((s) => s.status === "idea" || s.status === "in_design")
    .slice()
    .sort(sortByDay)
  const archived = suggestions
    .filter((s) => s.status === "rejected" || s.status === "promoted")
    .slice()
    .sort(sortByDay)
  const visible = showArchived ? suggestions.slice().sort(sortByDay) : active

  const updateStatus = async (id: string, next: SuggestionStatus) => {
    try {
      const res = await fetch(`${API}/admin/social/suggestions/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      toast.success(`Estado: ${STATUS_LABELS[next]}`)
      await load()
    } catch (e) {
      toast.error("No se pudo actualizar", { description: (e as Error).message })
    }
  }

  const remove = async (id: string) => {
    if (!confirm("¿Borrar esta sugerencia?")) return
    await fetch(`${API}/admin/social/suggestions/${id}`, {
      method: "DELETE",
      credentials: "include",
    })
    await load()
  }

  /**
   * Promote a suggestion → creates a real social_post (status=draft) seeded
   * with the modal's overrides on top of the suggestion's defaults. Post
   * lands in Lista grid where user attaches media + final caption + approves.
   *
   * Suggestion gets `status=promoted` + `promoted_to=<post.id>` so it stays
   * in history but rolls into the archived section.
   */
  const submitPromote = async (
    s: SocialSuggestion,
    overrides: {
      title?: string
      caption?: string
      pillar?: string
      format?: string
      date_planned?: string | null
    },
  ) => {
    try {
      const res = await fetch(`${API}/admin/social/suggestions/${s.id}/promote`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(overrides),
      })
      const data = (await res.json().catch(() => ({}))) as {
        post?: { number: string }
        message?: string
      }
      if (!res.ok) throw new Error(data.message ?? `HTTP ${res.status}`)
      toast.success(`Post #${data.post?.number} creado en borrador`, {
        description: "Lo encontrás en la Lista para editarlo y aprobarlo.",
      })
      setPromoteModal(null)
      await load()
      // Tell the parent to refresh posts/stories so the new draft shows up
      // in the Lista grid right after promoting (no manual page reload).
      onPromoted?.()
    } catch (e) {
      toast.error("No se pudo convertir", { description: (e as Error).message })
    }
  }

  /**
   * Two-step combo: regenerate the AI brief with the latest trend signals,
   * then immediately import its themes + ideas as suggestions. Saves the
   * user from switching to the Trends tab to refresh the brief and back.
   *
   * If the refresh fails we still attempt the import (existing brief is
   * better than nothing). If both fail, we surface both errors.
   */
  const refreshBriefAndImport = async () => {
    setRefreshingBrief(true)
    try {
      const refreshRes = await fetch(`${API}/admin/social/trends/refresh`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief: true }),
      })
      if (!refreshRes.ok) {
        toast.error("No se pudo regenerar el brief", {
          description: `HTTP ${refreshRes.status} — intento importar igual con el brief existente`,
        })
      }
    } catch (e) {
      toast.error("Falló refresh del brief", {
        description: (e as Error).message,
      })
    } finally {
      setRefreshingBrief(false)
    }
    // Chain into normal import — same toast logic / dedup / etc.
    await importFromTrends()
  }

  /**
   * One-click import: sweep recent trend signals → create one suggestion per
   * signal that hasn't been imported yet. Dedups on backend by source_ref so
   * pressing this twice in a row only creates new ones.
   */
  const importFromTrends = async () => {
    setImporting(true)
    try {
      const res = await fetch(
        `${API}/admin/social/suggestions/import-from-trends`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),  // server defaults: brief themes + ideas
        }
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as {
        imported: number
        skipped: number
        considered: number
        source: "brief" | "raw"
      }
      const sourceLabel = data.source === "brief" ? "del brief" : "de señales crudas"
      if (data.imported > 0) {
        toast.success(
          `${data.imported} sugerencias creadas ${sourceLabel}` +
            (data.skipped > 0 ? ` · ${data.skipped} ya existían` : "")
        )
      } else if (data.considered === 0) {
        toast.info(
          data.source === "brief"
            ? "El brief actual no tiene temas ni ideas — actualizá el brief en Trends"
            : "No hay señales todavía — corré el cron de Trends primero",
        )
      } else {
        toast.info(`Ya está todo importado del brief actual (${data.skipped} ya existían)`)
      }
      await load()
    } catch (e) {
      toast.error("No se pudo importar", { description: (e as Error).message })
    } finally {
      setImporting(false)
    }
  }

  return (
    <Container className="p-3 flex flex-col gap-2">
      {/* Collapsible header — same pattern as RetrospectiveWidget. Click
          anywhere on the row toggles. Body lives below and only renders
          when expanded so the section doesn't take screen real estate
          when the user isn't actively working on suggestions. */}
      <button
        onClick={toggleCollapsed}
        className="w-full flex items-center justify-between gap-2 text-left"
        aria-expanded={!collapsed}
      >
        <div className="flex items-center gap-2">
          <span aria-hidden>💡</span>
          <Text size="small" weight="plus" className="text-ui-fg-base">
            Sugerencias de contenido
          </Text>
          <Badge size="2xsmall" color="grey">{active.length} activas</Badge>
          {archived.length > 0 && (
            <Badge size="2xsmall" color="grey">+{archived.length} archivadas</Badge>
          )}
        </div>
        <Text size="xsmall" className="text-ui-fg-muted">
          {collapsed ? "Ver detalle ▾" : "Ocultar ▴"}
        </Text>
      </button>

      {!collapsed && (
        <div className="mt-3 flex flex-col gap-2">
          {/* Action toolbar */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            {archived.length > 0 ? (
              <button
                onClick={() => setShowArchived((v) => !v)}
                className="text-xs text-ui-fg-subtle hover:text-ui-fg-base"
              >
                {showArchived ? "Ocultar archivadas" : `Ver archivadas (${archived.length})`}
              </button>
            ) : (
              <span />
            )}
            <div className="flex gap-2 flex-wrap">
              <Button
                size="small"
                variant="secondary"
                disabled={importing || refreshingBrief}
                onClick={importFromTrends}
                title="Importa los temas e ideas del brief actual como sugerencias"
              >
                {importing ? "Importando…" : "📈 Importar desde trends"}
              </Button>
              <Button
                size="small"
                variant="secondary"
                disabled={importing || refreshingBrief}
                onClick={refreshBriefAndImport}
                title="Regenera el brief con los datos actuales e importa todo en un solo click"
              >
                {refreshingBrief ? "Regenerando brief…" : "🧠 Brief + Importar"}
              </Button>
              <Button size="small" onClick={() => setModal({ mode: "create" })}>
                + Nueva sugerencia
              </Button>
            </div>
          </div>

          {loading && suggestions.length === 0 ? (
            <Text className="text-ui-fg-subtle text-sm">Cargando…</Text>
          ) : visible.length === 0 ? (
            <Text className="text-ui-fg-muted text-sm italic">
              Todavía no hay sugerencias. Usalas para capturar ideas de contenido antes de convertirlas en posts reales.
            </Text>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {visible.map((s) => (
                <SuggestionRow
                  key={s.id}
                  suggestion={s}
                  onStatus={updateStatus}
                  onRemove={remove}
                  onEdit={() => setModal({ mode: "edit", id: s.id })}
                  onPromote={() => setPromoteModal(s)}
                />
              ))}
            </ul>
          )}
        </div>
      )}

      {modal && (
        <SuggestionModal
          mode={modal.mode}
          initial={
            modal.mode === "edit"
              ? suggestions.find((s) => s.id === modal.id) ?? null
              : null
          }
          onClose={() => setModal(null)}
          onSaved={async () => {
            setModal(null)
            await load()
          }}
        />
      )}

      {promoteModal && (
        <PromoteModal
          suggestion={promoteModal}
          onClose={() => setPromoteModal(null)}
          onSubmit={(overrides) => submitPromote(promoteModal, overrides)}
        />
      )}
    </Container>
  )
}

// ─── Row ──────────────────────────────────────────────────────────
function SuggestionRow({
  suggestion,
  onStatus,
  onRemove,
  onEdit,
  onPromote,
}: {
  suggestion: SocialSuggestion
  onStatus: (id: string, next: SuggestionStatus) => void
  onRemove: (id: string) => void
  onEdit: () => void
  onPromote: () => void
}) {
  const s = suggestion
  // "Promote" only makes sense for live suggestions that don't yet have a
  // backing post. Once promoted, the row shows a "Ver post" link instead.
  const canPromote =
    s.kind === "post" && (s.status === "idea" || s.status === "in_design")
  return (
    <li className="flex items-start gap-2 rounded-md border border-ui-border-base bg-ui-bg-base px-3 py-2">
      <Badge size="2xsmall" color="grey" className="shrink-0 mt-0.5">
        {s.kind === "story" ? "Story" : "Post"}
      </Badge>

      <div className="flex-1 min-w-0">
        <button onClick={onEdit} className="block w-full text-left">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-ui-fg-base hover:text-ui-fg-interactive">
              {s.title}
            </span>
            {s.format && (
              <Badge size="2xsmall" color="blue">
                {s.format}
              </Badge>
            )}
            {s.pillar && (
              <span className="text-xs text-ui-fg-muted">· {s.pillar}</span>
            )}
            {s.source !== "manual" && (
              <Badge size="2xsmall" color={s.source === "trend" ? "purple" : "orange"}>
                {s.source === "trend" ? "desde trend" : "desde feedback"}
              </Badge>
            )}
            {s.suggested_date && (
              <span className="text-xs text-ui-fg-muted">
                · {new Date(s.suggested_date).toLocaleDateString("es-VE", {
                    day: "2-digit", month: "short",
                  })}
              </span>
            )}
          </div>
          {s.body && (
            <div className="text-xs text-ui-fg-subtle mt-0.5 line-clamp-2">
              {s.body}
            </div>
          )}
        </button>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {canPromote && (
          <button
            onClick={onPromote}
            className="text-xs px-2 py-0.5 rounded bg-ui-button-inverted text-ui-fg-on-inverted hover:opacity-90 font-medium"
            title="Crear un post draft basado en esta sugerencia"
          >
            → Convertir
          </button>
        )}
        {s.status === "promoted" && s.promoted_to && (
          <span
            className="text-xs text-ui-fg-interactive"
            title={`Post id: ${s.promoted_to}`}
          >
            ✓ post creado
          </span>
        )}
        <select
          value={s.status}
          onChange={(e) => onStatus(s.id, e.target.value as SuggestionStatus)}
          className="text-xs bg-ui-bg-subtle border border-ui-border-base rounded px-1.5 py-0.5 focus:outline-none"
          aria-label="Cambiar estado"
        >
          {(Object.keys(STATUS_LABELS) as SuggestionStatus[]).map((st) => (
            <option key={st} value={st}>{STATUS_LABELS[st]}</option>
          ))}
        </select>
        <Badge size="2xsmall" color={STATUS_COLORS[s.status]}>
          {STATUS_LABELS[s.status]}
        </Badge>
        <button
          onClick={() => onRemove(s.id)}
          className="text-ui-fg-subtle hover:text-ui-fg-error text-sm"
          title="Borrar"
          aria-label="Borrar sugerencia"
        >
          ×
        </button>
      </div>
    </li>
  )
}

// ─── Modal ────────────────────────────────────────────────────────
function SuggestionModal({
  mode,
  initial,
  onClose,
  onSaved,
}: {
  mode: "create" | "edit"
  initial: SocialSuggestion | null
  onClose: () => void
  onSaved: () => void
}) {
  const [kind, setKind] = useState<"post" | "story">(initial?.kind ?? "post")
  const [title, setTitle] = useState(initial?.title ?? "")
  const [body, setBody] = useState(initial?.body ?? "")
  const [pillar, setPillar] = useState(initial?.pillar ?? "")
  const [format, setFormat] = useState(initial?.format ?? "")
  const [suggestedDate, setSuggestedDate] = useState(
    initial?.suggested_date ? initial.suggested_date.slice(0, 10) : ""
  )
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (!title.trim()) {
      toast.error("El título es obligatorio")
      return
    }
    setSaving(true)
    try {
      const payload = {
        kind,
        title: title.trim(),
        body: body.trim() || null,
        pillar: pillar.trim() || null,
        format: format.trim() || null,
        suggested_date: suggestedDate || null,
      }
      const url =
        mode === "create"
          ? `${API}/admin/social/suggestions`
          : `${API}/admin/social/suggestions/${initial!.id}`
      const res = await fetch(url, {
        method: mode === "create" ? "POST" : "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      toast.success(mode === "create" ? "Sugerencia creada" : "Sugerencia actualizada")
      onSaved()
    } catch (e) {
      toast.error("No se pudo guardar", { description: (e as Error).message })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <Container
        className="w-full max-w-lg p-5 flex flex-col gap-3 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <Heading level="h3">
            {mode === "create" ? "Nueva sugerencia" : "Editar sugerencia"}
          </Heading>
          <button
            onClick={onClose}
            className="text-xl leading-none text-ui-fg-subtle hover:text-ui-fg-base"
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Labeled label="Tipo">
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as "post" | "story")}
              className="text-sm w-full bg-ui-bg-base border border-ui-border-base rounded px-2 py-1"
            >
              <option value="post">Post</option>
              <option value="story">Story</option>
            </select>
          </Labeled>
          <Labeled label="Formato (opcional)">
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value)}
              className="text-sm w-full bg-ui-bg-base border border-ui-border-base rounded px-2 py-1"
            >
              <option value="">—</option>
              {kind === "post" ? (
                <>
                  <option value="Single">Single</option>
                  <option value="Carrusel">Carrusel</option>
                  <option value="Reel">Reel</option>
                </>
              ) : (
                <>
                  <option value="Story">Story</option>
                </>
              )}
            </select>
          </Labeled>
        </div>

        <Labeled label="Título">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Reel: comparativa grinder eléctrico vs manual"
            className="text-sm w-full bg-ui-bg-base border border-ui-border-base rounded px-2 py-1"
            autoFocus
          />
        </Labeled>

        <Labeled label="Notas / referencias">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Ángulo del contenido, referencias, ejemplos, lo que Claude necesita para diseñarlo. Pegá links de inspiración si tenés."
            rows={6}
          />
        </Labeled>

        <div className="grid grid-cols-2 gap-2">
          <Labeled label="Pilar (opcional)">
            <input
              type="text"
              value={pillar}
              onChange={(e) => setPillar(e.target.value)}
              placeholder="Educational, Flores, BTS…"
              className="text-sm w-full bg-ui-bg-base border border-ui-border-base rounded px-2 py-1"
              list="social-pillars"
            />
            <datalist id="social-pillars">
              <option value="Educational" />
              <option value="Flores · Lifestyle" />
              <option value="BTS" />
              <option value="Promocional" />
              <option value="Comunidad" />
            </datalist>
          </Labeled>
          <Labeled label="Sugerido para (opcional)">
            <input
              type="date"
              value={suggestedDate}
              onChange={(e) => setSuggestedDate(e.target.value)}
              className="text-sm w-full bg-ui-bg-base border border-ui-border-base rounded px-2 py-1"
            />
          </Labeled>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button size="small" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button size="small" onClick={submit} disabled={saving}>
            {saving ? "…" : mode === "create" ? "Crear" : "Guardar"}
          </Button>
        </div>
      </Container>
    </div>
  )
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <Text size="xsmall" className="text-ui-fg-subtle uppercase tracking-wide">
        {label}
      </Text>
      {children}
    </label>
  )
}

// ─── Promote modal ────────────────────────────────────────────────
/**
 * Pre-create editor for promotion. Pre-filled from the suggestion; user
 * can tweak title/format/date/pillar/caption before the post hits Lista.
 *
 * Why a modal vs the existing post card edit: the post card lives in
 * Lista which is a step away. Doing the obvious tweaks here means the
 * draft lands ready-to-approve in most cases instead of "ready to fix
 * 4 fields then approve".
 */
function PromoteModal({
  suggestion,
  onClose,
  onSubmit,
}: {
  suggestion: SocialSuggestion
  onClose: () => void
  onSubmit: (overrides: {
    title?: string
    caption?: string
    pillar?: string
    format?: string
    date_planned?: string | null
  }) => Promise<void>
}) {
  const [title, setTitle] = useState(suggestion.title)
  const [format, setFormat] = useState(suggestion.format ?? "Single")
  const [pillar, setPillar] = useState(suggestion.pillar ?? "")
  const [caption, setCaption] = useState(suggestion.body ?? "")
  const [datePlanned, setDatePlanned] = useState(
    suggestion.suggested_date ? suggestion.suggested_date.slice(0, 10) : ""
  )
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error("Título obligatorio")
      return
    }
    setSubmitting(true)
    try {
      await onSubmit({
        title: title.trim(),
        format: format || "Single",
        pillar: pillar.trim() || undefined,
        caption: caption.trim() || undefined,
        date_planned: datePlanned ? new Date(datePlanned).toISOString() : null,
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <Container
        className="w-full max-w-2xl p-5 flex flex-col gap-3 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <Heading level="h3">Convertir en post borrador</Heading>
          <button
            onClick={onClose}
            className="text-xl leading-none text-ui-fg-subtle hover:text-ui-fg-base"
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>

        <Text size="xsmall" className="text-ui-fg-muted">
          Vamos a crear un nuevo post en estado borrador con estos valores.
          Después podés editarlo y aprobarlo desde la Lista. Si dejás caption
          vacío arrancás de cero.
        </Text>

        <Labeled label="Título">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={submitting}
            autoFocus
            className="text-sm w-full bg-ui-bg-base border border-ui-border-base rounded px-2 py-1"
          />
        </Labeled>

        <div className="grid grid-cols-2 gap-2">
          <Labeled label="Formato">
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value)}
              disabled={submitting}
              className="text-sm w-full bg-ui-bg-base border border-ui-border-base rounded px-2 py-1"
            >
              <option value="Single">Single</option>
              <option value="Carrusel">Carrusel</option>
              <option value="Reel">Reel</option>
            </select>
          </Labeled>
          <Labeled label="Fecha planeada (opcional)">
            <input
              type="datetime-local"
              value={datePlanned}
              onChange={(e) => setDatePlanned(e.target.value)}
              disabled={submitting}
              className="text-sm w-full bg-ui-bg-base border border-ui-border-base rounded px-2 py-1"
            />
          </Labeled>
        </div>

        <Labeled label="Pilar (opcional)">
          <input
            type="text"
            value={pillar}
            onChange={(e) => setPillar(e.target.value)}
            disabled={submitting}
            placeholder="Educational, Promocional, BTS…"
            list="promote-pillars"
            className="text-sm w-full bg-ui-bg-base border border-ui-border-base rounded px-2 py-1"
          />
          <datalist id="promote-pillars">
            <option value="Educational" />
            <option value="Flores · Lifestyle" />
            <option value="BTS" />
            <option value="Promocional" />
            <option value="Comunidad" />
          </datalist>
        </Labeled>

        <Labeled label="Caption inicial (editable después)">
          <Textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            disabled={submitting}
            rows={6}
            placeholder="Las notas de la sugerencia se vuelven el primer borrador del caption. Editá lo que quieras antes de crear el post."
          />
        </Labeled>

        <div className="flex justify-end gap-2 pt-2">
          <Button size="small" variant="secondary" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button size="small" onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Creando…" : "→ Crear post borrador"}
          </Button>
        </div>
      </Container>
    </div>
  )
}
