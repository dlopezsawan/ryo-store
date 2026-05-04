import { useEffect, useState } from "react"
import { Text, toast } from "@medusajs/ui"

const API = "https://api.enrola.shop"

/**
 * Editable input for a story's link-sticker URL.
 *
 * IG's API doesn't let automation tools (Buffer included) actually place the
 * link sticker onto the story canvas — that has to happen manually in the IG
 * app at publish time. What Buffer DOES take is the URL as metadata, which
 * makes the post flip to "Notify Me" mode so you get a push at the scheduled
 * time with the URL pre-copied, ready to paste into IG's Link sticker UI.
 *
 * This input is where you type/approve that URL.
 *
 * Saves on blur + Enter; Escape reverts.
 */
export function StoryLinkInput({
  storyId,
  value,
  onSaved,
  suggestion,
}: {
  storyId: string
  value: string | null
  onSaved: () => void
  suggestion?: string
}) {
  const [draft, setDraft] = useState(value ?? "")
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    setDraft(value ?? "")
    setDirty(false)
  }, [value])

  const commit = async () => {
    if (!dirty) return
    const trimmed = draft.trim()
    // Basic URL validation — allow empty to clear, otherwise must start with http(s)
    if (trimmed && !/^https?:\/\//i.test(trimmed)) {
      toast.error("El link debe empezar con http:// o https://")
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`${API}/admin/social/stories/${storyId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ link_url: trimmed || null }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      toast.success(trimmed ? "Link guardado" : "Link removido")
      setDirty(false)
      onSaved()
    } catch (e) {
      toast.error("No se pudo guardar el link", { description: (e as Error).message })
    } finally {
      setSaving(false)
    }
  }

  const hostname = (() => {
    try {
      return draft ? new URL(draft).hostname.replace(/^www\./, "") : ""
    } catch {
      return ""
    }
  })()

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2 text-sm">
        <span aria-hidden className="text-ui-fg-muted">🔗</span>
        <Text size="xsmall" className="text-ui-fg-subtle shrink-0">
          Link del sticker
        </Text>
        {hostname && (
          <span className="text-xs text-ui-fg-interactive truncate max-w-[180px]">
            {hostname}
          </span>
        )}
      </div>
      <input
        type="url"
        value={draft}
        disabled={saving}
        placeholder={suggestion || "https://enrola.shop/products/..."}
        onChange={(e) => {
          setDraft(e.target.value)
          setDirty(true)
        }}
        onBlur={() => void commit()}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault()
            ;(e.target as HTMLInputElement).blur()
          } else if (e.key === "Escape") {
            setDraft(value ?? "")
            setDirty(false)
            ;(e.target as HTMLInputElement).blur()
          }
        }}
        className="w-full text-sm bg-ui-bg-base border border-ui-border-base rounded px-2 py-1 focus:outline-none focus:border-ui-border-strong"
      />
      {draft && (
        <Text size="xsmall" className="text-ui-fg-muted">
          📱 Al programar, Buffer te mandará notif al cel con este link copiado al clipboard para pegarlo en IG.
        </Text>
      )}
      {!saving && dirty && (
        <Text size="xsmall" className="text-ui-fg-interactive">
          sin guardar · Enter para guardar · Esc para cancelar
        </Text>
      )}
    </div>
  )
}
