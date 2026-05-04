"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Plus, X, AlertCircle, CheckCircle2 } from "lucide-react"
import { inviteAction, cancelInviteAction } from "./actions"

interface InviteRow {
  id: string
  email: string
  accepted: boolean
  expires_at: string
}

type Toast = { kind: "ok" | "err"; msg: string } | null

export function InviteSection({ rows }: { rows: InviteRow[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [email, setEmail] = useState("")
  const [toast, setToast] = useState<Toast>(null)

  function flash(kind: "ok" | "err", msg: string) {
    setToast({ kind, msg })
    setTimeout(() => setToast(null), 4000)
  }

  function invite() {
    startTransition(async () => {
      const res = await inviteAction({ email })
      if (!res.ok) return flash("err", res.error)
      flash("ok", "Invitación enviada")
      setEmail("")
      router.refresh()
    })
  }

  function cancel(id: string) {
    startTransition(async () => {
      const res = await cancelInviteAction(id)
      if (!res.ok) return flash("err", res.error)
      flash("ok", "Invitación cancelada")
      router.refresh()
    })
  }

  const pendingInvites = rows.filter((r) => !r.accepted)

  return (
    <div className="stamp-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display font-black text-[14px] uppercase tracking-wider">
          Invitar al equipo
        </h3>
        <span className="text-[11px] font-mono text-ink-3">
          {pendingInvites.length} pendiente{pendingInvites.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <input
          type="email"
          placeholder="email@ejemplo.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              invite()
            }
          }}
          className="flex-1 px-3 py-2 bg-cream rounded-md text-[12px] focus:outline-none"
          style={{ border: "1.5px solid var(--border)" }}
        />
        <button
          type="button"
          onClick={invite}
          disabled={pending || !email.trim()}
          className="flex items-center gap-1.5 px-3 py-2 bg-orange text-dark rounded-md text-[10px] font-display font-bold uppercase tracking-wider transition-all hover:translate-x-[2px] hover:translate-y-[2px] disabled:opacity-50"
          style={{ border: "2px solid #1A1A1A", boxShadow: "4px 4px 0 0 var(--shadow-color)" }}
        >
          <Plus size={11} strokeWidth={3} /> {pending ? "Invitando…" : "Invitar"}
        </button>
      </div>

      {pendingInvites.length > 0 && (
        <div className="space-y-1.5">
          {pendingInvites.map((inv) => {
            const expiresAt = new Date(inv.expires_at)
            const expired = expiresAt < new Date()
            return (
              <div key={inv.id} className="flex items-center justify-between gap-2 py-1.5 px-3 bg-cream-2/40 rounded-md text-[12px]" style={{ border: "1px solid var(--border)" }}>
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className="font-mono truncate text-ink">{inv.email}</span>
                  <span className={`pill ${expired ? "text-primary" : "text-orange"} flex-shrink-0`}>
                    <span className="pill-dot" />
                    {expired ? "Expirada" : "Pendiente"}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => cancel(inv.id)}
                  disabled={pending}
                  className="text-ink-3 hover:text-primary p-1 flex-shrink-0 disabled:opacity-50"
                  title="Cancelar invitación"
                >
                  <X size={12} strokeWidth={2.5} />
                </button>
              </div>
            )
          })}
        </div>
      )}

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
