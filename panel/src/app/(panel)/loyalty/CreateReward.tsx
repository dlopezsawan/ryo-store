"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Plus, AlertCircle, CheckCircle2 } from "lucide-react"
import { createRewardAction } from "./actions"

type Toast = { kind: "ok" | "err"; msg: string } | null

export function CreateReward() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [toast, setToast] = useState<Toast>(null)
  const [form, setForm] = useState({
    name: "",
    description: "",
    points_required: 100,
    image_url: "",
    is_active: true,
  })

  function flash(k: "ok" | "err", m: string) {
    setToast({ kind: k, msg: m })
    setTimeout(() => setToast(null), 4000)
  }

  function submit() {
    startTransition(async () => {
      const res = await createRewardAction(form)
      if (!res.ok) return flash("err", res.error)
      flash("ok", "Recompensa creada")
      setForm({ name: "", description: "", points_required: 100, image_url: "", is_active: true })
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 py-2 bg-orange text-dark rounded-md text-[10px] font-display font-bold uppercase tracking-wider transition-all hover:translate-x-[2px] hover:translate-y-[2px]"
        style={{ border: "2px solid #1A1A1A", boxShadow: "4px 4px 0 0 var(--shadow-color)" }}
      >
        <Plus size={11} strokeWidth={3} /> Nueva recompensa
      </button>

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-md flex items-center gap-2 text-[12px] font-medium animate-in fade-in slide-in-from-bottom-2"
          style={{ background: toast.kind === "ok" ? "#4D5431" : "#BB3B2E", color: "#fff", border: "2px solid #1A1A1A", boxShadow: "4px 4px 0 0 var(--shadow-color)", minWidth: 280, maxWidth: 480 }}>
          {toast.kind === "ok" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{toast.msg}</span>
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)" }} onClick={() => !pending && setOpen(false)}>
          <div className="bg-page rounded-md max-w-md w-full p-6" style={{ border: "2.5px solid var(--border)", boxShadow: "5px 5px 0 0 var(--shadow-color)" }} onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display font-black text-[18px] uppercase tracking-tight text-ink mb-4">Nueva recompensa</h3>

            <div className="space-y-3">
              <Field label="Nombre *">
                <input type="text" autoFocus value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 bg-cream rounded-md text-[13px] focus:outline-none" style={{ border: "1.5px solid var(--border)" }} />
              </Field>
              <Field label="Puntos requeridos *">
                <input type="number" min={1} value={form.points_required} onChange={(e) => setForm((f) => ({ ...f, points_required: Number(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 bg-cream rounded-md text-[13px] font-mono num focus:outline-none" style={{ border: "1.5px solid var(--border)" }} />
              </Field>
              <Field label="Descripción">
                <textarea rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  className="w-full px-3 py-2 bg-cream rounded-md text-[12px] focus:outline-none resize-none" style={{ border: "1.5px solid var(--border)" }} />
              </Field>
              <Field label="URL imagen">
                <input type="url" value={form.image_url} onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))} placeholder="https://…"
                  className="w-full px-3 py-2 bg-cream rounded-md text-[12px] font-mono focus:outline-none" style={{ border: "1.5px solid var(--border)" }} />
              </Field>
              <label className="flex items-center gap-2 text-[12px] cursor-pointer">
                <input type="checkbox" checked={form.is_active} onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))} />
                Activa (canjeable por clientes)
              </label>
            </div>

            <div className="flex items-center justify-end gap-2 mt-5">
              <button type="button" onClick={() => setOpen(false)} disabled={pending}
                className="px-4 py-2 bg-cream rounded-md text-[11px] font-display font-bold uppercase tracking-wider text-ink hover:bg-cream-2 disabled:opacity-50" style={{ border: "1.5px solid var(--border)" }}>
                Cancelar
              </button>
              <button type="button" onClick={submit} disabled={pending || !form.name.trim() || !(form.points_required > 0)}
                className="px-4 py-2 bg-orange text-dark rounded-md text-[11px] font-display font-bold uppercase tracking-wider hover:translate-x-[2px] hover:translate-y-[2px] disabled:opacity-50 transition-all"
                style={{ border: "2px solid #1A1A1A", boxShadow: "4px 4px 0 0 var(--shadow-color)" }}>
                {pending ? "Creando…" : "Crear"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] font-display font-bold uppercase tracking-[0.18em] text-ink-2 mb-1.5">{label}</label>
      {children}
    </div>
  )
}
