import { useEffect, useState } from "react"
import { Button, Text, Textarea, toast } from "@medusajs/ui"

const API = "https://api.enrola.shop"

/**
 * Inline caption editor for posts in draft / in_review state.
 *
 * Why: regular posts get their caption from dashboard.html via
 * `social:sync`, but promoted posts (external_id="promoted-…") only
 * exist in DB and can't be edited via the dashboard. They land with
 * the suggestion's body as their caption — usually a rough first
 * pass that needs cleanup before publishing.
 *
 * Editing flow: collapsible, dirty-tracking, save on Ctrl/Cmd+Enter
 * or click. Esc reverts. Auto-collapses when not dirty.
 *
 * Why not a generic "edit anything" form: the rest of the post fields
 * (title/format/pillar) were already editable in PromoteModal at
 * creation time. Only the long-form caption typically needs iteration
 * after the fact, so we surface just that.
 */
export function CaptionEditor({
  postId,
  value,
  onSaved,
}: {
  postId: string
  value: string | null
  onSaved: () => void
}) {
  const [draft, setDraft] = useState(value ?? "")
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [open, setOpen] = useState(!value) // auto-open if there's no caption yet

  // External value changes (e.g., parent refresh after save) win unless
  // the user is currently editing.
  useEffect(() => {
    if (!dirty) setDraft(value ?? "")
  }, [value, dirty])

  const save = async () => {
    if (!dirty) return
    setSaving(true)
    try {
      const res = await fetch(`${API}/admin/social/posts/${postId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caption: draft.trim() || null }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      toast.success("Caption guardado")
      setDirty(false)
      onSaved()
    } catch (e) {
      toast.error("No se pudo guardar", { description: (e as Error).message })
    } finally {
      setSaving(false)
    }
  }

  const cancel = () => {
    setDraft(value ?? "")
    setDirty(false)
  }

  // Snippet shown when collapsed.
  const preview = (value || "").trim().slice(0, 120)
  const hasCaption = !!(value && value.trim())
  const charCount = draft.length

  return (
    <div className="flex flex-col gap-1.5 text-sm">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-between text-left select-none"
        aria-expanded={open}
      >
        <span className="text-ui-fg-subtle hover:text-ui-fg-base text-xs uppercase tracking-wide">
          ✏️ Caption IG{hasCaption ? "" : " · vacío"}
          {dirty && <span className="ml-2 text-ui-fg-interactive">· sin guardar</span>}
        </span>
        <span className="text-xs text-ui-fg-muted">{open ? "Ocultar" : "Editar"}</span>
      </button>

      {!open && hasCaption && (
        <Text size="xsmall" className="text-ui-fg-subtle line-clamp-2 whitespace-pre-wrap">
          {preview}{(value || "").length > preview.length ? "…" : ""}
        </Text>
      )}

      {open && (
        <>
          <Textarea
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value)
              setDirty(e.target.value !== (value ?? ""))
            }}
            disabled={saving}
            rows={6}
            placeholder="Escribí el caption final acá. Acordate de hashtags, CTA, link en bio…"
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault()
                void save()
              } else if (e.key === "Escape") {
                cancel()
              }
            }}
            className="font-mono text-xs"
          />
          <div className="flex items-center justify-between">
            <Text size="xsmall" className="text-ui-fg-muted">
              {charCount} caracteres · ⌘+Enter guarda · Esc cancela
            </Text>
            <div className="flex gap-1.5">
              {dirty && (
                <Button size="small" variant="secondary" onClick={cancel} disabled={saving}>
                  Cancelar
                </Button>
              )}
              <Button size="small" onClick={save} disabled={saving || !dirty}>
                {saving ? "…" : "Guardar"}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
