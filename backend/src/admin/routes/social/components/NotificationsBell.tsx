import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Badge, Container, Heading, Text } from "@medusajs/ui"

const API = "https://api.enrola.shop"

/**
 * Dropdown bell that surfaces @-mentions of the current user in the social
 * admin. Mentions are stored as `social_activity` rows by the feedback
 * route; this component fetches the ones targeting the logged-in user.
 *
 * "Unread" state is local (localStorage timestamp). When the user opens
 * the dropdown we record `now` as the last-viewed time; mentions newer
 * than that are highlighted as unread.
 *
 * Polling: refetches every 60s while the page is open. Cheap (one
 * indexed query, payload <5 KB typical).
 */
interface Mention {
  activity_id: string
  created_at: string
  actor_name: string | null
  handle: string
  entity_type: "post" | "story"
  entity_id: string
  entity_title: string
  feedback_id: string | null
  feedback_text: string | null
}

const LAST_VIEWED_KEY = "enrola.social.notifications.last_viewed"

interface NotificationsBellProps {
  /**
   * Called when the user clicks the entity title inside a notification.
   * Parent uses this to switch to Lista, scroll the card into view, and
   * briefly highlight it. Notification dropdown closes after invoking.
   */
  onMentionClick?: (entityType: "post" | "story", entityId: string) => void
}

export function NotificationsBell({ onMentionClick }: NotificationsBellProps = {}) {
  const [open, setOpen] = useState(false)
  const [mentions, setMentions] = useState<Mention[]>([])
  const [handles, setHandles] = useState<string[]>([])
  const [lastViewed, setLastViewed] = useState<number>(() => {
    if (typeof window === "undefined") return 0
    const v = window.localStorage.getItem(LAST_VIEWED_KEY)
    return v ? parseInt(v, 10) : 0
  })
  const popoverRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API}/admin/social/notifications?days=30&limit=30`, {
        credentials: "include",
        cache: "no-store",
      }).then((r) => r.json())
      setMentions(res.mentions ?? [])
      setHandles(res.handles ?? [])
    } catch {
      /* silent — non-critical */
    }
  }, [])

  // Initial load + 60s polling so the bell stays roughly fresh while open.
  useEffect(() => {
    void load()
    const iv = setInterval(load, 60_000)
    return () => clearInterval(iv)
  }, [load])

  // Click outside closes the dropdown.
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open])

  const unreadCount = useMemo(
    () => mentions.filter((m) => new Date(m.created_at).getTime() > lastViewed).length,
    [mentions, lastViewed],
  )

  const togglePanel = () => {
    if (!open) {
      // Mark as viewed when opening — anything older than now is read.
      const now = Date.now()
      setLastViewed(now)
      try { window.localStorage.setItem(LAST_VIEWED_KEY, String(now)) } catch { /* */ }
    }
    setOpen((v) => !v)
  }

  return (
    <div className="relative" ref={popoverRef}>
      <button
        onClick={togglePanel}
        className="relative inline-flex items-center justify-center w-9 h-9 rounded-md border border-ui-border-base bg-ui-bg-base hover:bg-ui-bg-base-hover transition-colors"
        aria-label={`Notificaciones${unreadCount > 0 ? ` (${unreadCount} sin leer)` : ""}`}
        title={
          handles.length > 0
            ? `Menciones a @${handles.join(", @")}`
            : "Menciones"
        }
      >
        <span aria-hidden className="text-base">🔔</span>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-ui-tag-red-bg text-ui-tag-red-text text-[10px] font-bold border border-ui-tag-red-border">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 z-50 w-[380px] max-w-[92vw]">
          <Container className="p-0 max-h-[70vh] overflow-y-auto shadow-xl">
            <div className="px-4 py-3 border-b border-ui-border-base flex items-center justify-between gap-2">
              <Heading level="h3" className="text-base">Notificaciones</Heading>
              <Text size="xsmall" className="text-ui-fg-muted">
                {handles.length > 0
                  ? `@${handles.slice(0, 2).join(", @")}`
                  : "Sin handles"}
              </Text>
            </div>

            {mentions.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <Text size="small" className="text-ui-fg-muted">
                  No tenés menciones en los últimos 30 días.
                </Text>
                {handles.length === 0 && (
                  <Text size="xsmall" className="text-ui-fg-muted mt-2">
                    No detectamos un handle para tu usuario. Asegurate de que tu cuenta admin
                    tenga email + nombre configurados.
                  </Text>
                )}
              </div>
            ) : (
              <ul className="flex flex-col">
                {mentions.map((m) => {
                  const isUnread = new Date(m.created_at).getTime() > lastViewed
                  const preview = m.feedback_text
                    ? m.feedback_text.length > 140
                      ? m.feedback_text.slice(0, 140) + "…"
                      : m.feedback_text
                    : null
                  return (
                    <li
                      key={m.activity_id}
                      className={`px-4 py-3 border-b border-ui-border-base last:border-b-0 ${
                        isUnread ? "bg-ui-bg-highlight" : ""
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {isUnread && (
                          <span
                            aria-hidden
                            className="mt-1.5 w-2 h-2 rounded-full bg-ui-tag-red-bg shrink-0"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm">
                            <strong>{m.actor_name ?? "Alguien"}</strong>
                            <span className="text-ui-fg-muted"> te mencionó (@{m.handle}) en </span>
                            <button
                              onClick={() => {
                                onMentionClick?.(m.entity_type, m.entity_id)
                                setOpen(false)
                              }}
                              className="font-bold text-ui-fg-interactive hover:underline"
                            >
                              {m.entity_title}
                            </button>
                          </div>
                          {preview && (
                            <Text
                              size="xsmall"
                              className="text-ui-fg-subtle mt-1 whitespace-pre-wrap line-clamp-3"
                            >
                              {preview}
                            </Text>
                          )}
                          <Badge size="2xsmall" color="grey" className="mt-2">
                            {relTime(m.created_at)}
                          </Badge>
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}

            <div className="px-4 py-2 border-t border-ui-border-base">
              <Text size="xsmall" className="text-ui-fg-muted">
                Te llega un email cada vez que alguien te etiqueta con <code>@</code>.
              </Text>
            </div>
          </Container>
        </div>
      )}
    </div>
  )
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60) return `hace ${s}s`
  if (s < 3600) return `hace ${Math.floor(s / 60)}m`
  if (s < 86400) return `hace ${Math.floor(s / 3600)}h`
  return `hace ${Math.floor(s / 86400)}d`
}
