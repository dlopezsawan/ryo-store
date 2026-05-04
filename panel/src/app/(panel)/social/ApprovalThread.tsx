"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { MessageSquare, Send, AlertCircle, CheckCircle2 } from "lucide-react"
import { addPostCommentAction } from "./actions"
import { fmtRelative } from "@/lib/utils"

type Toast = { kind: "ok" | "err"; msg: string } | null

interface Comment {
  id: string
  text: string
  author: string
  at: string
}

interface Props {
  postId: string
  currentUserEmail: string
  comments: Comment[]
  metadata?: Record<string, unknown> | null
}

export function ApprovalThread({ postId, currentUserEmail, comments, metadata }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [toast, setToast] = useState<Toast>(null)
  const [text, setText] = useState("")

  function flash(k: "ok" | "err", m: string) {
    setToast({ kind: k, msg: m })
    setTimeout(() => setToast(null), 4000)
  }

  function submit() {
    if (!text.trim()) return
    startTransition(async () => {
      const res = await addPostCommentAction(postId, text, currentUserEmail, metadata ?? undefined)
      if (!res.ok) return flash("err", res.error)
      flash("ok", "Comentario agregado")
      setText("")
      router.refresh()
    })
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-[10px] font-display font-bold uppercase tracking-wider text-ink-3">
        <MessageSquare size={11} strokeWidth={2.5} /> Comentarios ({comments.length})
      </div>
      {comments.length > 0 && (
        <div className="space-y-1.5 max-h-48 overflow-y-auto">
          {comments.map((c) => (
            <div key={c.id} className="p-2 bg-cream-2/30 rounded-md text-[11px]" style={{ border: "1px solid var(--border-soft)" }}>
              <div className="flex items-baseline gap-2 mb-0.5">
                <span className="font-display font-bold text-ink text-[10px] truncate">{c.author}</span>
                <span className="text-[9px] text-ink-3 font-mono">{fmtRelative(c.at)}</span>
              </div>
              <p className="text-ink-2 whitespace-pre-wrap break-words">{c.text}</p>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-end gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          placeholder="Comentario para el equipo…"
          className="flex-1 px-2 py-1.5 bg-cream rounded-md text-[11px] focus:outline-none resize-none"
          style={{ border: "1.5px solid var(--border)" }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault()
              submit()
            }
          }}
        />
        <button onClick={submit} disabled={pending || !text.trim()}
          className="px-3 py-2 bg-orange text-dark rounded-md text-[10px] font-display font-bold uppercase tracking-wider disabled:opacity-50 flex items-center gap-1"
          style={{ border: "1.5px solid #1A1A1A" }} title="⌘+Enter">
          <Send size={11} strokeWidth={2.5} /> {pending ? "…" : "Enviar"}
        </button>
      </div>

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-md flex items-center gap-2 text-[12px] font-medium"
          style={{ background: toast.kind === "ok" ? "#4D5431" : "#BB3B2E", color: "#fff", border: "2px solid #1A1A1A", boxShadow: "4px 4px 0 0 var(--shadow-color)", minWidth: 280, maxWidth: 480 }}>
          {toast.kind === "ok" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{toast.msg}</span>
        </div>
      )}
    </div>
  )
}
