import { useCallback, useEffect, useMemo, useState } from "react"
import { Button, Text, Textarea, toast } from "@medusajs/ui"
import type { SocialFeedbackItem } from "../types"

const API = "https://api.enrola.shop"

/**
 * Threaded feedback panel.
 *
 *  - Top-level comments appear in order.
 *  - Each comment can be replied to inline (click "Responder").
 *  - @handle tokens in the text are highlighted and (server-side) trigger
 *    email notifications to matched admin users.
 *  - Resolve = cross out + move opacity. Delete removes thread entirely
 *    (replies orphan — could be nice-to-have future work).
 */
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
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyDraft, setReplyDraft] = useState("")
  const [replyPosting, setReplyPosting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(
        `${API}/admin/social/feedback?entity_type=${entityType}&entity_id=${entityId}`,
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

  // Group replies under their parent
  const { roots, repliesByParent } = useMemo(() => {
    const rootList: SocialFeedbackItem[] = []
    const byParent: Record<string, SocialFeedbackItem[]> = {}
    for (const it of items) {
      if (it.parent_id) {
        ;(byParent[it.parent_id] = byParent[it.parent_id] ?? []).push(it)
      } else {
        rootList.push(it)
      }
    }
    for (const k of Object.keys(byParent)) {
      byParent[k].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      )
    }
    return { roots: rootList, repliesByParent: byParent }
  }, [items])

  const submitRoot = async () => {
    const text = draft.trim()
    if (!text) return
    setPosting(true)
    try {
      const res = await fetch(`${API}/admin/social/feedback`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entity_type: entityType, entity_id: entityId, text }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setDraft("")
      await load()
    } catch (e) {
      toast.error("No se pudo enviar el comentario", { description: (e as Error).message })
    } finally {
      setPosting(false)
    }
  }

  const submitReply = async (parentId: string) => {
    const text = replyDraft.trim()
    if (!text) return
    setReplyPosting(true)
    try {
      const res = await fetch(`${API}/admin/social/feedback`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity_type: entityType,
          entity_id: entityId,
          text,
          parent_id: parentId,
        }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setReplyDraft("")
      setReplyingTo(null)
      await load()
    } catch (e) {
      toast.error("No se pudo enviar la respuesta", { description: (e as Error).message })
    } finally {
      setReplyPosting(false)
    }
  }

  const resolveToggle = async (id: string, resolved: boolean) => {
    await fetch(`${API}/admin/social/feedback/${id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resolved }),
    })
    await load()
  }

  const remove = async (id: string) => {
    if (!confirm("¿Borrar este comentario?")) return
    await fetch(`${API}/admin/social/feedback/${id}`, {
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

      {roots.length > 0 && (
        <ul className="flex flex-col gap-2 max-h-96 overflow-y-auto">
          {roots.map((it) => (
            <Thread
              key={it.id}
              item={it}
              replies={repliesByParent[it.id] ?? []}
              onReply={() => {
                setReplyingTo(it.id)
                setReplyDraft("")
              }}
              isReplying={replyingTo === it.id}
              replyDraft={replyDraft}
              setReplyDraft={setReplyDraft}
              onCancelReply={() => {
                setReplyingTo(null)
                setReplyDraft("")
              }}
              onSubmitReply={() => submitReply(it.id)}
              replyPosting={replyPosting}
              onResolveToggle={resolveToggle}
              onRemove={remove}
            />
          ))}
        </ul>
      )}

      <Textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Escribí feedback, sugerencias o @menciones…"
        rows={2}
        className="text-sm"
      />
      <div className="flex justify-between items-center">
        <Text size="xsmall" className="text-ui-fg-muted">
          Tip: <code className="text-ui-fg-subtle">@nombre</code> envía email
        </Text>
        <Button size="small" onClick={submitRoot} disabled={posting || !draft.trim()}>
          {posting ? "Enviando…" : "Comentar"}
        </Button>
      </div>
    </div>
  )
}

// ─── Single thread (root + its replies) ────────────────────────────
function Thread({
  item,
  replies,
  onReply,
  isReplying,
  replyDraft,
  setReplyDraft,
  onCancelReply,
  onSubmitReply,
  replyPosting,
  onResolveToggle,
  onRemove,
}: {
  item: SocialFeedbackItem
  replies: SocialFeedbackItem[]
  onReply: () => void
  isReplying: boolean
  replyDraft: string
  setReplyDraft: (v: string) => void
  onCancelReply: () => void
  onSubmitReply: () => void
  replyPosting: boolean
  onResolveToggle: (id: string, resolved: boolean) => Promise<void>
  onRemove: (id: string) => Promise<void>
}) {
  return (
    <li className="flex flex-col gap-1.5">
      <CommentRow
        item={item}
        onReply={onReply}
        onResolveToggle={onResolveToggle}
        onRemove={onRemove}
      />

      {replies.length > 0 && (
        <ul className="flex flex-col gap-1.5 pl-4 border-l-2 border-ui-border-base ml-1">
          {replies.map((r) => (
            <CommentRow
              key={r.id}
              item={r}
              onResolveToggle={onResolveToggle}
              onRemove={onRemove}
              compact
            />
          ))}
        </ul>
      )}

      {isReplying && (
        <div className="pl-4 ml-1 border-l-2 border-ui-border-base">
          <Textarea
            value={replyDraft}
            onChange={(e) => setReplyDraft(e.target.value)}
            placeholder="Tu respuesta…"
            rows={2}
            className="text-sm"
            autoFocus
          />
          <div className="flex justify-end gap-2 mt-1">
            <Button size="small" variant="secondary" onClick={onCancelReply}>
              Cancelar
            </Button>
            <Button
              size="small"
              onClick={onSubmitReply}
              disabled={replyPosting || !replyDraft.trim()}
            >
              {replyPosting ? "…" : "Responder"}
            </Button>
          </div>
        </div>
      )}
    </li>
  )
}

// ─── Single comment ────────────────────────────────────────────────
function CommentRow({
  item,
  onReply,
  onResolveToggle,
  onRemove,
  compact = false,
}: {
  item: SocialFeedbackItem
  onReply?: () => void
  onResolveToggle: (id: string, resolved: boolean) => Promise<void>
  onRemove: (id: string) => Promise<void>
  compact?: boolean
}) {
  return (
    <div
      className={`rounded-md border text-sm ${compact ? "p-1.5" : "p-2"} ${
        item.resolved
          ? "bg-ui-bg-subtle border-ui-border-base opacity-60"
          : "bg-ui-bg-base border-ui-border-strong"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className={`flex-1 ${item.resolved ? "line-through" : ""}`}>
          <CommentBody text={item.text} />
        </div>
        <div className="flex gap-1 shrink-0">
          {onReply && !item.resolved && (
            <button
              onClick={onReply}
              className="text-xs text-ui-fg-subtle hover:text-ui-fg-base"
              title="Responder"
            >
              ↩
            </button>
          )}
          <button
            onClick={() => onResolveToggle(item.id, !item.resolved)}
            className="text-xs text-ui-fg-subtle hover:text-ui-fg-base"
            title={item.resolved ? "Reabrir" : "Resolver"}
          >
            {item.resolved ? "↺" : "✓"}
          </button>
          <button
            onClick={() => onRemove(item.id)}
            className="text-xs text-ui-fg-subtle hover:text-ui-fg-error"
            title="Borrar"
          >
            ×
          </button>
        </div>
      </div>
      <Text size="xsmall" className="text-ui-fg-muted mt-1">
        {new Date(item.created_at).toLocaleString("es-VE", {
          day: "2-digit",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        })}
        {item.author_id ? ` · ${item.author_id.slice(0, 8)}` : ""}
      </Text>
    </div>
  )
}

// ─── @mention highlighting ─────────────────────────────────────────
function CommentBody({ text }: { text: string }) {
  const parts = useMemo(() => {
    const re = /(^|\s)(@[a-zA-Z0-9._-]{2,40})/g
    const nodes: React.ReactNode[] = []
    let last = 0
    let key = 0
    let m: RegExpExecArray | null
    while ((m = re.exec(text)) !== null) {
      const start = m.index + m[1].length // skip the leading whitespace capture
      if (start > last) nodes.push(text.slice(last, start))
      nodes.push(
        <span
          key={key++}
          className="font-medium text-ui-fg-interactive bg-ui-bg-interactive/20 rounded px-1"
        >
          {m[2]}
        </span>
      )
      last = start + m[2].length
    }
    if (last < text.length) nodes.push(text.slice(last))
    return nodes
  }, [text])

  return <span className="whitespace-pre-wrap break-words">{parts}</span>
}
