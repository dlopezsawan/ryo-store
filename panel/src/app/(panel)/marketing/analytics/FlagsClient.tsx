"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Power, Edit2, Save, X, AlertCircle, CheckCircle2 } from "lucide-react"
import { togglePosthogFlagAction, updatePosthogRolloutAction } from "../actions"
import type { PosthogFlag } from "@/lib/medusa"

type Toast = { kind: "ok" | "err"; msg: string } | null

export function FlagsClient({ flags }: { flags: PosthogFlag[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [toast, setToast] = useState<Toast>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [rolloutDraft, setRolloutDraft] = useState<number>(0)

  function flash(k: "ok" | "err", m: string) {
    setToast({ kind: k, msg: m })
    setTimeout(() => setToast(null), 4000)
  }

  function toggle(flag: PosthogFlag) {
    startTransition(async () => {
      const res = await togglePosthogFlagAction(flag.id, !flag.active)
      if (!res.ok) return flash("err", res.error)
      flash("ok", `${flag.key} ${!flag.active ? "activado" : "desactivado"}`)
      router.refresh()
    })
  }

  function saveRollout(flag: PosthogFlag) {
    startTransition(async () => {
      const res = await updatePosthogRolloutAction(flag.id, rolloutDraft)
      if (!res.ok) return flash("err", res.error)
      flash("ok", `${flag.key} rollout → ${rolloutDraft}%`)
      setEditingId(null)
      router.refresh()
    })
  }

  if (flags.length === 0) {
    return (
      <div className="p-8 text-center">
        <p className="text-[12px] text-ink-3 italic">Sin feature flags creados todavía. Creá uno en PostHog → Feature Flags.</p>
      </div>
    )
  }

  return (
    <>
      <ul className="divide-y divide-warm-200/50">
        {flags.map((f) => (
          <li key={f.id} className="p-3 flex items-center gap-3">
            <button onClick={() => toggle(f)} disabled={pending}
              className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center disabled:opacity-50 ${
                f.active ? "bg-secondary text-cream" : "bg-cream-2 text-ink-3"
              }`}
              style={{ border: "1.5px solid var(--border)" }}
              title={f.active ? "Desactivar" : "Activar"}>
              <Power size={14} strokeWidth={2.5} />
            </button>

            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2">
                <code className="font-mono font-bold text-[12px] text-ink truncate">{f.key}</code>
                <span className={`text-[9px] font-display font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md ${
                  f.active ? "bg-secondary/15 text-secondary" : "bg-cream-2 text-ink-3"
                }`}>
                  {f.active ? "ACTIVO" : "PAUSADO"}
                </span>
              </div>
              <div className="text-[11px] text-ink-2 mt-0.5">{f.name || f.key}</div>
              {f.description && <p className="text-[10px] text-ink-3 mt-0.5">{f.description}</p>}
            </div>

            {/* Rollout */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {editingId === f.id ? (
                <div className="flex items-center gap-1">
                  <input type="number" min={0} max={100} value={rolloutDraft}
                    onChange={(e) => setRolloutDraft(Number(e.target.value) || 0)}
                    className="w-16 px-2 py-1 bg-cream rounded-md text-[11px] font-mono num text-right focus:outline-none"
                    style={{ border: "1.5px solid var(--border)" }} />
                  <span className="text-[10px] text-ink-3">%</span>
                  <button onClick={() => saveRollout(f)} disabled={pending}
                    className="text-secondary p-1 disabled:opacity-50">
                    <Save size={11} strokeWidth={2.5} />
                  </button>
                  <button onClick={() => setEditingId(null)}
                    className="text-ink-3 p-1">
                    <X size={11} strokeWidth={2.5} />
                  </button>
                </div>
              ) : (
                <button onClick={() => { setEditingId(f.id); setRolloutDraft(f.rollout ?? 100) }}
                  className="flex items-center gap-1 text-[11px] font-mono text-ink-3 hover:text-orange">
                  <Edit2 size={10} strokeWidth={2.5} />
                  rollout {f.rollout ?? 100}%
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>

      {toast && (
        <div className="fixed bottom-6 right-6 z-[60] px-4 py-3 rounded-md flex items-center gap-2 text-[12px] font-medium animate-in fade-in slide-in-from-bottom-2"
          style={{ background: toast.kind === "ok" ? "#4D5431" : "#BB3B2E", color: "#fff", border: "2px solid #1A1A1A", boxShadow: "4px 4px 0 0 var(--shadow-color)", minWidth: 280, maxWidth: 480 }}>
          {toast.kind === "ok" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{toast.msg}</span>
        </div>
      )}
    </>
  )
}
