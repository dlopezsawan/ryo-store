import { useCallback, useEffect, useState } from "react"
import { Text } from "@medusajs/ui"
import type { SocialActivityItem } from "../types"

const API = "https://api.enrola.shop"

/**
 * Compact activity timeline for a single post/story.
 * Rendered as a collapsed <details> section so we don't blow up card height.
 */
export function ActivityFeed({
  entityType,
  entityId,
}: {
  entityType: "post" | "story"
  entityId: string
}) {
  const [items, setItems] = useState<SocialActivityItem[]>([])
  const [loaded, setLoaded] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch(
        `${API}/admin/social/activity?entity_type=${entityType}&entity_id=${entityId}`,
        { credentials: "include" }
      ).then((r) => r.json())
      setItems(res.activity ?? [])
    } finally {
      setLoaded(true)
    }
  }, [entityType, entityId])

  useEffect(() => {
    void load()
  }, [load])

  if (!loaded) return null
  if (items.length === 0) return null

  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-ui-fg-subtle hover:text-ui-fg-base text-xs uppercase tracking-wide">
        Actividad · {items.length}
      </summary>
      <ul className="mt-2 flex flex-col gap-1 max-h-56 overflow-y-auto pl-0">
        {items.slice().reverse().map((a) => (
          <li key={a.id} className="flex gap-2 items-start text-xs">
            <span className="text-ui-fg-muted shrink-0 w-24 tabular-nums">
              {formatDate(a.created_at)}
            </span>
            <span className="flex-1 text-ui-fg-subtle">
              {describe(a)}
            </span>
          </li>
        ))}
      </ul>
    </details>
  )
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("es-VE", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function describe(a: SocialActivityItem): React.ReactNode {
  const who = a.actor_name || (a.actor_id ? a.actor_id.slice(0, 8) : "alguien")
  const p = (a.payload ?? {}) as Record<string, unknown>

  switch (a.action) {
    case "status_changed":
      return (
        <>
          <strong>{who}</strong> cambió de{" "}
          <code className="text-ui-fg-subtle">{String(p.from ?? "—")}</code> a{" "}
          <code className="text-ui-fg-base font-medium">{String(p.to ?? "—")}</code>
        </>
      )
    case "feedback_added":
      return (
        <>
          <strong>{who}</strong> comentó:{" "}
          <span className="italic text-ui-fg-muted">
            "{String(p.text_preview ?? "").slice(0, 80)}
            {String(p.text_preview ?? "").length > 80 ? "…" : ""}"
          </span>
        </>
      )
    case "feedback_replied":
      return (
        <>
          <strong>{who}</strong> respondió:{" "}
          <span className="italic text-ui-fg-muted">
            "{String(p.text_preview ?? "").slice(0, 80)}
            {String(p.text_preview ?? "").length > 80 ? "…" : ""}"
          </span>
        </>
      )
    case "feedback_resolved":
      return (
        <>
          <strong>{who}</strong> {p.resolved ? "resolvió" : "reabrió"} un comentario
        </>
      )
    case "feedback_deleted":
      return (
        <>
          <strong>{who}</strong> borró un comentario
        </>
      )
    case "mention":
      return (
        <>
          <strong>{who}</strong> mencionó a{" "}
          <code className="text-ui-fg-interactive">@{String(p.mentioned_handle ?? "")}</code>
        </>
      )
    default:
      return (
        <>
          <strong>{who}</strong> · {a.action}
        </>
      )
  }
}
