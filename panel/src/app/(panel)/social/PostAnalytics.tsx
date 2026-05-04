"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Eye, Heart, MessageCircle, Bookmark, Share2, Edit2, X, AlertCircle, CheckCircle2 } from "lucide-react"
import { recordPostMetricsAction } from "./actions"

type Toast = { kind: "ok" | "err"; msg: string } | null

interface Metrics {
  reach?: number
  likes?: number
  comments?: number
  saves?: number
  shares?: number
}

interface Props {
  postId: string
  metrics?: Metrics | null
  /** Solo permite editar si está publicado o en cierto estado. */
  editable?: boolean
}

export function PostAnalytics({ postId, metrics, editable = true }: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [pending, startTransition] = useTransition()
  const [toast, setToast] = useState<Toast>(null)
  const [form, setForm] = useState<Metrics>({
    reach: metrics?.reach ?? 0,
    likes: metrics?.likes ?? 0,
    comments: metrics?.comments ?? 0,
    saves: metrics?.saves ?? 0,
    shares: metrics?.shares ?? 0,
  })

  function flash(k: "ok" | "err", m: string) {
    setToast({ kind: k, msg: m })
    setTimeout(() => setToast(null), 4000)
  }

  function save() {
    startTransition(async () => {
      const res = await recordPostMetricsAction(postId, form)
      if (!res.ok) return flash("err", res.error)
      flash("ok", "Métricas actualizadas")
      setEditing(false)
      router.refresh()
    })
  }

  const hasMetrics = !!(metrics?.reach || metrics?.likes || metrics?.comments || metrics?.saves)

  return (
    <div className="space-y-2">
      {!editing ? (
        <>
          <div className="grid grid-cols-5 gap-2">
            <Stat icon={<Eye size={11} />}        label="Reach"    value={metrics?.reach    ?? 0} />
            <Stat icon={<Heart size={11} />}      label="Likes"    value={metrics?.likes    ?? 0} tone="primary" />
            <Stat icon={<MessageCircle size={11} />} label="Comments" value={metrics?.comments ?? 0} />
            <Stat icon={<Bookmark size={11} />}   label="Saves"    value={metrics?.saves    ?? 0} tone="secondary" />
            <Stat icon={<Share2 size={11} />}     label="Shares"   value={metrics?.shares   ?? 0} />
          </div>
          {editable && (
            <button onClick={() => setEditing(true)}
              className="text-[10px] font-display font-bold uppercase tracking-wider text-ink-3 hover:text-orange flex items-center gap-1">
              <Edit2 size={10} strokeWidth={2.5} /> {hasMetrics ? "Actualizar métricas" : "Registrar métricas"}
            </button>
          )}
        </>
      ) : (
        <div className="space-y-2 p-3 bg-orange/5 rounded-md" style={{ border: "1.5px dashed #FF3B27" }}>
          <div className="grid grid-cols-5 gap-2">
            <NumInput label="Reach"    value={form.reach    ?? 0} onChange={(v) => setForm((f) => ({ ...f, reach: v }))} />
            <NumInput label="Likes"    value={form.likes    ?? 0} onChange={(v) => setForm((f) => ({ ...f, likes: v }))} />
            <NumInput label="Comments" value={form.comments ?? 0} onChange={(v) => setForm((f) => ({ ...f, comments: v }))} />
            <NumInput label="Saves"    value={form.saves    ?? 0} onChange={(v) => setForm((f) => ({ ...f, saves: v }))} />
            <NumInput label="Shares"   value={form.shares   ?? 0} onChange={(v) => setForm((f) => ({ ...f, shares: v }))} />
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setEditing(false)} disabled={pending}
              className="px-3 py-1.5 bg-cream rounded-md text-[10px] font-display font-bold uppercase tracking-wider hover:bg-cream-2 disabled:opacity-50"
              style={{ border: "1.5px solid var(--border)" }}>
              <X size={11} strokeWidth={2.5} className="inline" /> Cancelar
            </button>
            <button onClick={save} disabled={pending}
              className="px-3 py-1.5 bg-orange text-dark rounded-md text-[10px] font-display font-bold uppercase tracking-wider disabled:opacity-50"
              style={{ border: "1.5px solid #1A1A1A" }}>
              {pending ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </div>
      )}

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

function Stat({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone?: "primary" | "secondary" }) {
  const cls = tone === "primary" ? "text-primary" : tone === "secondary" ? "text-secondary" : "text-ink"
  return (
    <div className="text-center p-2 bg-cream-2/30 rounded-md" style={{ border: "1px solid var(--border-soft)" }}>
      <div className={`flex items-center justify-center gap-1 ${cls} mb-0.5`}>{icon}</div>
      <div className={`font-display font-black text-[14px] num ${cls}`}>{formatNum(value)}</div>
      <div className="text-[8px] font-display font-bold uppercase tracking-wider text-ink-3">{label}</div>
    </div>
  )
}

function NumInput({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="block text-[8px] font-display font-bold uppercase tracking-wider text-ink-3 mb-0.5">{label}</label>
      <input type="number" min="0" value={value} onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="w-full px-2 py-1 bg-cream rounded-md text-[12px] font-mono num focus:outline-none"
        style={{ border: "1.5px solid var(--border)" }} />
    </div>
  )
}

function formatNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}
