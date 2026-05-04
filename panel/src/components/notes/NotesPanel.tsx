"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { MessageSquare, Send, Trash2, X, AlertCircle, CheckCircle2 } from "lucide-react"

export interface NoteRow {
  id: string
  text: string
  author: string
  created_at: string
}

type ActionResult = { ok: true } | { ok: false; error: string }

interface Props {
  notes: NoteRow[]
  /** Server actions inyectadas — para que sirva tanto a orders como customers */
  onAdd: (text: string) => Promise<ActionResult>
  onDelete: (noteId: string) => Promise<ActionResult>
  /** Email del usuario actual (para destacar notes propias) */
  currentUser?: string
  title?: string
  emptyLabel?: string
}

type Toast = { kind: "ok" | "err"; msg: string } | null

export function NotesPanel({
  notes,
  onAdd,
  onDelete,
  currentUser,
  title = "Notas internas",
  emptyLabel = "Sin notas. Las notas son visibles sólo para el equipo.",
}: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [text, setText] = useState("")
  const [confirmDelId, setConfirmDelId] = useState<string | null>(null)
  const [toast, setToast] = useState<Toast>(null)

  function flash(k: "ok" | "err", m: string) {
    setToast({ kind: k, msg: m })
    setTimeout(() => setToast(null), 4000)
  }

  function submit() {
    if (!text.trim()) return
    startTransition(async () => {
      const res = await onAdd(text)
      if (!res.ok) return flash("err", res.error)
      setText("")
      router.refresh()
    })
  }

  function del(id: string) {
    startTransition(async () => {
      const res = await onDelete(id)
      if (!res.ok) return flash("err", res.error)
      flash("ok", "Nota eliminada")
      setConfirmDelId(null)
      router.refresh()
    })
  }

  // Notes ordenadas por más recientes primero
  const sorted = [...notes].sort((a, b) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  )

  return (
    <div className="stamp-card overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3 bg-dark text-cream">
        <MessageSquare size={14} strokeWidth={2.4} />
        <h3 className="font-display font-black text-[14px] uppercase tracking-wider">
          {title}
        </h3>
        <span className="ml-auto text-[10px] text-cream/60 font-mono">
          {notes.length}
        </span>
      </div>

      <div className="p-4 space-y-3">
        {/* Add form */}
        <div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                submit()
              }
            }}
            placeholder="Añadir nota interna…"
            rows={2}
            className="w-full px-3 py-2 bg-cream rounded-md text-[12px] focus:outline-none resize-none"
            style={{ border: "1.5px solid var(--border)" }}
          />
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-[10px] text-ink-3 font-mono">
              ⌘↵ para enviar
            </span>
            <button
              type="button"
              onClick={submit}
              disabled={pending || !text.trim()}
              className="flex items-center gap-1 px-3 py-1 bg-orange text-dark rounded-md text-[10px] font-display font-bold uppercase tracking-wider disabled:opacity-50"
              style={{ border: "1.5px solid #1A1A1A" }}
            >
              <Send size={11} strokeWidth={2.5} /> {pending ? "..." : "Añadir"}
            </button>
          </div>
        </div>

        {/* List */}
        {sorted.length === 0 ? (
          <p className="text-[11px] text-ink-3 italic text-center py-2">{emptyLabel}</p>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {sorted.map((n) => {
              const isMine = currentUser && n.author === currentUser
              const date = new Date(n.created_at)
              return (
                <div
                  key={n.id}
                  className={`p-2.5 rounded-md ${isMine ? "bg-orange/5" : "bg-cream-2/50"}`}
                  style={{ border: `1.5px solid ${isMine ? "#FF3B27" : "var(--border)"}` }}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="text-[10px] font-display font-bold uppercase tracking-wider text-ink-3">
                      {n.author.split("@")[0]}
                      {isMine && <span className="ml-1 text-orange">(tú)</span>}
                    </div>
                    {confirmDelId === n.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => del(n.id)}
                          disabled={pending}
                          className="px-1.5 py-0 bg-primary text-white text-[9px] font-display font-bold uppercase tracking-wider rounded-md disabled:opacity-50"
                        >
                          Eliminar
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDelId(null)}
                          disabled={pending}
                          className="text-ink-3 disabled:opacity-50"
                        >
                          <X size={11} />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDelId(n.id)}
                        className="text-ink-3 hover:text-primary"
                      >
                        <Trash2 size={11} strokeWidth={2.4} />
                      </button>
                    )}
                  </div>
                  <p className="text-[12px] text-ink whitespace-pre-wrap">{n.text}</p>
                  <p className="text-[10px] text-ink-3 font-mono mt-1">
                    {date.toLocaleDateString("es-VE", { day: "numeric", month: "short" })} ·{" "}
                    {date.toLocaleTimeString("es-VE", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {toast && (
        <div
          className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-md flex items-center gap-2 text-[12px] font-medium animate-in fade-in slide-in-from-bottom-2"
          style={{
            background: toast.kind === "ok" ? "#4D5431" : "#BB3B2E",
            color: "#fff",
            border: "2px solid #1A1A1A",
            boxShadow: "4px 4px 0 0 var(--shadow-color)",
            minWidth: 280,
            maxWidth: 480,
          }}
        >
          {toast.kind === "ok" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{toast.msg}</span>
        </div>
      )}
    </div>
  )
}
