import { useState } from "react"
import { Button, Text, toast } from "@medusajs/ui"
import type { SocialPost, SocialStory, SocialStatus } from "../types"

const API = "https://api.enrola.shop"

type Entity = "post" | "story"

interface Common {
  id: string
  status: SocialStatus
  scheduled_at: string | null
  published_at: string | null
  failure_reason: string | null
  error_count?: number
  ig_link?: string | null
}

function pickCommon(
  entity: Entity,
  item: SocialPost | SocialStory,
  username: string | null
): Common {
  const ig_link = entity === "post"
    ? (item as SocialPost).ig_post_id
      ? `https://www.instagram.com/p/${(item as SocialPost).ig_post_id}/`
      : null
    : (item as SocialStory).ig_story_id && username
      ? `https://www.instagram.com/stories/${username}/${(item as SocialStory).ig_story_id}/`
      : null

  return {
    id: item.id,
    status: item.status,
    scheduled_at: item.scheduled_at,
    published_at: item.published_at,
    failure_reason: item.failure_reason,
    error_count: item.error_count,
    ig_link,
  }
}

/**
 * Row of publish-lifecycle actions shown in every card.
 *
 * States shown:
 *   approved  → "Publicar ahora" · "Programar"  + mode hint (auto vs notif)
 *   scheduled → "Programado HH:mm" + "Cancelar" + "Sync" button
 *   publishing → "Publicando…"
 *   published  → link externo a IG
 *   failed     → mensaje rojo + "Reintentar"
 *   draft      → hidden
 */
export function PublishControls({
  entity,
  item,
  igUsername,
  onChange,
}: {
  entity: Entity
  item: SocialPost | SocialStory
  igUsername?: string | null
  onChange: () => void
}) {
  const c = pickCommon(entity, item, igUsername ?? null)
  const [busy, setBusy] = useState(false)
  const [schedulingOpen, setSchedulingOpen] = useState(false)
  const [whenDraft, setWhenDraft] = useState<string>(() =>
    c.scheduled_at ? toLocalInput(c.scheduled_at) : toLocalInput(new Date().toISOString())
  )

  // Figure out mode without a round-trip to Buffer:
  //   - Stories with a link_url → notification (manual tap on phone to publish)
  //   - Everything else → automatic (zero touch)
  const willBeNotification =
    entity === "story" && !!(item as SocialStory).link_url

  const call = async (
    path: string,
    body: Record<string, unknown>
  ): Promise<boolean> => {
    setBusy(true)
    try {
      const res = await fetch(`${API}${path}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entity, ...body }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as { message?: string }).message || `HTTP ${res.status}`)
      }
      onChange()
      return true
    } catch (e) {
      toast.error("No se pudo", { description: (e as Error).message })
      return false
    } finally {
      setBusy(false)
    }
  }

  const publishNow = () =>
    call(`/admin/social/publish/${c.id}`, {}).then(
      (ok) => ok && toast.success("En cola — el worker lo toma en el próximo ciclo")
    )

  const schedule = () => {
    const when = new Date(whenDraft)
    if (isNaN(when.getTime())) {
      toast.error("Fecha inválida")
      return
    }
    void call(`/admin/social/publish/${c.id}`, { when: when.toISOString() }).then(
      (ok) => {
        if (ok) {
          setSchedulingOpen(false)
          toast.success(
            `Programado para ${when.toLocaleString("es-VE", {
              day: "2-digit",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}`
          )
        }
      }
    )
  }

  const cancelSchedule = () => call(`/admin/social/cancel-schedule/${c.id}`, {})

  /**
   * Manual mark-as-published: for when the user already posted on IG
   * themselves (Buffer rate-limited, or just preferred to do it by hand).
   * Skips Buffer entirely — flips status='published' + sets published_at=now().
   * Goes through the standard PATCH route so the activity log captures it.
   */
  const markPublishedManual = async () => {
    const path = entity === "post" ? "posts" : "stories"
    setBusy(true)
    try {
      const res = await fetch(`${API}/admin/social/${path}/${c.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "published",
          published_at: new Date().toISOString(),
        }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      toast.success("Marcado como publicado")
      onChange()
    } catch (e) {
      toast.error("No se pudo marcar", { description: (e as Error).message })
    } finally {
      setBusy(false)
    }
  }

  // ─── Published ──────────────────────────────────────────────────
  if (c.status === "published") {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-medium text-ui-tag-green-text">
          ✓ Publicado
          {c.published_at
            ? ` · ${new Date(c.published_at).toLocaleDateString("es-VE", {
                day: "2-digit",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}`
            : ""}
        </span>
        {c.ig_link && (
          <a
            href={c.ig_link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-ui-fg-interactive hover:underline"
          >
            Ver en Instagram ↗
          </a>
        )}
      </div>
    )
  }

  // ─── Publishing (worker in flight) ─────────────────────────────
  if (c.status === "publishing") {
    return (
      <div className="flex items-center gap-2">
        <Text size="small" className="text-ui-fg-interactive">
          Publicando…
        </Text>
        <Text size="xsmall" className="text-ui-fg-muted">
          El worker de IG está subiendo la media
        </Text>
      </div>
    )
  }

  // ─── Failed ─────────────────────────────────────────────────────
  if (c.status === "failed") {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-start gap-2 rounded-md border border-ui-tag-red-border bg-ui-tag-red-bg text-ui-tag-red-text text-xs p-2">
          <span aria-hidden>⚠</span>
          <div className="flex-1 min-w-0">
            <div className="font-medium">
              Falló {c.error_count ? `(intento ${c.error_count})` : ""}
            </div>
            {c.failure_reason && (
              <div className="opacity-90 break-words mt-0.5">{c.failure_reason}</div>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="small" disabled={busy} onClick={publishNow}>
            Reintentar
          </Button>
          <Button size="small" variant="secondary" disabled={busy} onClick={cancelSchedule}>
            Volver a aprobado
          </Button>
        </div>
      </div>
    )
  }

  // ─── Scheduled ──────────────────────────────────────────────────
  if (c.status === "scheduled") {
    const syncStatus = () => call(`/admin/social/buffer-sync/${c.id}`, {})
    return (
      <div className="flex flex-col gap-1.5 rounded-md bg-ui-tag-blue-bg border border-ui-tag-blue-border px-3 py-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <Text size="small" className="text-ui-tag-blue-text">
            {willBeNotification ? "📱" : "🗓"} Programado para{" "}
            <strong>
              {c.scheduled_at
                ? new Date(c.scheduled_at).toLocaleString("es-VE", {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "?"}
            </strong>
          </Text>
          <div className="flex gap-1.5 shrink-0">
            <Button size="small" variant="transparent" disabled={busy} onClick={syncStatus}>
              ↻
            </Button>
            <Button size="small" variant="secondary" disabled={busy} onClick={cancelSchedule}>
              Cancelar
            </Button>
          </div>
        </div>
        <Text size="xsmall" className="text-ui-fg-muted">
          {willBeNotification
            ? "Buffer te enviará push al cel a esa hora. Abrís la notif, tocás publicar, agregás el link sticker manualmente en IG."
            : "Buffer lo publica automáticamente. No tenés que hacer nada."}
        </Text>
      </div>
    )
  }

  // ─── Approved (main action) ────────────────────────────────────
  if (c.status === "approved") {
    if (schedulingOpen) {
      return (
        <div className="flex flex-col gap-2 rounded-md border border-ui-border-base p-2">
          <Text size="xsmall" weight="plus" className="text-ui-fg-subtle uppercase tracking-wide">
            Programar publicación
          </Text>
          <input
            type="datetime-local"
            value={whenDraft}
            onChange={(e) => setWhenDraft(e.target.value)}
            className="text-sm bg-ui-bg-base border border-ui-border-base rounded px-2 py-1"
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button size="small" variant="secondary" onClick={() => setSchedulingOpen(false)}>
              Cancelar
            </Button>
            <Button size="small" onClick={schedule} disabled={busy}>
              Confirmar
            </Button>
          </div>
        </div>
      )
    }
    return (
      <div className="flex flex-col gap-1.5">
        <div className="flex gap-2 flex-wrap">
          <Button size="small" disabled={busy} onClick={publishNow}>
            📤 Publicar ahora
          </Button>
          <Button
            size="small"
            variant="secondary"
            onClick={() => setSchedulingOpen(true)}
          >
            🗓 Programar
          </Button>
          <Button
            size="small"
            variant="transparent"
            disabled={busy}
            onClick={markPublishedManual}
            title="Si ya lo publicaste a mano en IG"
          >
            ✓ Ya publicado
          </Button>
        </div>
        <Text size="xsmall" className="text-ui-fg-muted">
          {willBeNotification
            ? "📱 Modo notificación — push al cel para que lo termines de publicar con el link sticker."
            : "⚡ Auto-publish — Buffer lo sube a IG sin que toques nada."}
        </Text>
      </div>
    )
  }

  // draft / in_review — nothing until approved
  return null
}

function toLocalInput(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ""
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
