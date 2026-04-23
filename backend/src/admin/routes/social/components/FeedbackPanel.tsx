import { useCallback, useEffect, useState } from "react"
import { Button, Text, Textarea, toast } from "@medusajs/ui"
import type { SocialFeedbackItem } from "../types"

export function FeedbackPanel({
  entityType,
  entityId,
}: {
  entityType: "post" | "story"
  entityId: string
}) {
  const [items, setItems] = useState<SocialFeedbackItem[]>([])
  const [draft, setDraft] = useState("")
  const [posting, setPosting] = useState(false)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(
        `/admin/social/feedback?entity_type=${entityType}&entity_id=${entityId}`,
        { credentials: "include" }
      ).then((r) => r.json())
      setItems(res.feedback ?? [])
    } catch {
      /* no-op */
    } finally {
      setLoading(false)
    }
  }, [entityType, entityId])

  useEffect(() => {
    void load()
  }, [load])

  const submit = async () => {
    const text = draft.trim()
    if (!text) return
    setPosting(true)
    try {
      await fetch(`/admin/social/feedback`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entity_type: entityType, entity_id: entityId, text }),
      })
      setDraft("")
      await load()
    } catch (e) {
      toast.error("No se pudo enviar el comentario", { description: (e as Error).message })
    } finally {
      setPosting(false)
    }
  }

  const resolveToggle = async (id: string, resolved: boolean) => {
    await fetch(`/admin/social/feedback/${id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resolved }),
    })
    await load()
  }

  const remove = async (id: string) => {
    if (!confirm("¿Borrar este comentario?")) return
    await fetch(`/admin/social/feedback/${id}`, {
      method: "DELETE",
      credentials: "include",
    })
    await load()
  }

  return (
    <div className="flex flex-col gap-2 pt-2 border-t border-ui-border-base">
      <div className="flex items-center justify-between">
        <Text size="xsmall" weight="plus" className="text-ui-fg-subtle uppercase tracking-wide">
          Feedback · {items.length}
        </Text>
        {loading && <Text size="xsmall" className="text-ui-fg-muted">…</Text>}
      </div>

      {items.length > 0 && (
        <ul className="flex flex-col gap-2 max-h-64 overflow-y-auto">
          {items.map((it) => (
            <li
              key={it.id}
              className={`rounded-md border p-2 text-sm ${
                it.resolved
                  ? "bg-ui-bg-subtle border-ui-border-base opacity-60"
                  : "bg-ui-bg-base border-ui-border-strong"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <Text size="small" className={it.resolved ? "line-through" : ""}>
                  {it.text}
                </Text>
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => resolveToggle(it.id, !it.resolved)}
                    className="text-xs text-ui-fg-subtle hover:text-ui-fg-base"
                    title={it.resolved ? "Reabrir" : "Resolver"}
                  >
                    {it.resolved ? "↺" : "✓"}
                  </button>
                  <button
                    onClick={() => remove(it.id)}
                    className="text-xs text-ui-fg-subtle hover:text-ui-fg-error"
                    title="Borrar"
                  >
                    ×
                  </button>
                </div>
              </div>
              <Text size="xsmall" className="text-ui-fg-muted mt-1">
                {new Date(it.created_at).toLocaleString("es-VE", {
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
                {it.author_id ? ` · ${it.author_id.slice(0, 8)}` : ""}
              </Text>
            </li>
          ))}
        </ul>
      )}

      <Textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Escribí feedback, sugerencias, cambios a ejecutar…"
        rows={2}
        className="text-sm"
      />
      <div className="flex justify-end">
        <Button size="small" onClick={submit} disabled={posting || !draft.trim()}>
          {posting ? "Enviando…" : "Comentar"}
        </Button>
      </div>
    </div>
  )
}
