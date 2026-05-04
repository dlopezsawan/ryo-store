"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Pencil, Copy, Trash2, AlertCircle, CheckCircle2, X } from "lucide-react"
import { updateProductAction, toggleProductStatusAction, duplicateProductAction, deleteProductAction } from "./actions"

type Toast = { kind: "ok" | "err"; msg: string } | null

interface Props {
  productId: string
  initial: {
    title: string
    handle: string
    description: string
    status: "draft" | "published" | "proposed" | "rejected"
  }
}

export function ProductEdit({ productId, initial }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [toast, setToast] = useState<Toast>(null)
  const [form, setForm] = useState(initial)

  function flash(kind: "ok" | "err", msg: string) {
    setToast({ kind, msg })
    setTimeout(() => setToast(null), 4000)
  }

  function save() {
    startTransition(async () => {
      const patch: Parameters<typeof updateProductAction>[1] = {}
      if (form.title !== initial.title) patch.title = form.title
      if (form.handle !== initial.handle) patch.handle = form.handle
      if (form.description !== initial.description) {
        patch.description = form.description.trim() || null
      }
      if (form.status !== initial.status) patch.status = form.status
      if (Object.keys(patch).length === 0) {
        setOpen(false)
        return
      }
      const res = await updateProductAction(productId, patch)
      if (!res.ok) {
        flash("err", res.error)
        return
      }
      flash("ok", "Producto actualizado")
      setOpen(false)
      router.refresh()
    })
  }

  function quickToggle() {
    const next = initial.status === "published" ? "draft" : "published"
    startTransition(async () => {
      const res = await toggleProductStatusAction(productId, next)
      if (!res.ok) flash("err", res.error)
      else {
        flash("ok", next === "published" ? "Producto publicado" : "Pasado a borrador")
        router.refresh()
      }
    })
  }

  function duplicate() {
    startTransition(async () => {
      const res = await duplicateProductAction(productId, { redirectToNew: true })
      if (!res.ok) flash("err", res.error)
      // Si redirectToNew=true, la action redirige y este código no llega
    })
  }

  const [confirmDel, setConfirmDel] = useState(false)
  function del() {
    startTransition(async () => {
      const res = await deleteProductAction(productId)
      if (!res.ok) return flash("err", res.error)
      router.push("/products")
    })
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={duplicate}
          disabled={pending}
          title="Duplicar producto (status: borrador)"
          className="flex items-center gap-1.5 px-3 py-2 bg-cream rounded-md text-[10px] font-display font-bold uppercase tracking-wider text-ink hover:bg-cream-2 disabled:opacity-50"
          style={{ border: "1.5px solid var(--border)" }}
        >
          <Copy size={13} strokeWidth={2.5} /> Duplicar
        </button>
        {confirmDel ? (
          <>
            <button
              type="button"
              onClick={del}
              disabled={pending}
              className="px-3 py-2 bg-primary text-white rounded-md text-[10px] font-display font-bold uppercase tracking-wider disabled:opacity-50"
              style={{ border: "2px solid #1A1A1A" }}
            >
              Confirmar eliminar
            </button>
            <button onClick={() => setConfirmDel(false)} disabled={pending} className="text-ink-3 hover:text-primary p-2 disabled:opacity-50">
              <X size={14} />
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmDel(true)}
            disabled={pending}
            title="Eliminar producto"
            className="flex items-center gap-1.5 px-3 py-2 bg-cream rounded-md text-[10px] font-display font-bold uppercase tracking-wider text-primary hover:bg-primary/5 disabled:opacity-50"
            style={{ border: "1.5px solid #BB3B2E" }}
          >
            <Trash2 size={13} strokeWidth={2.5} /> Eliminar
          </button>
        )}
        <button
          type="button"
          onClick={quickToggle}
          disabled={pending}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-[10px] font-display font-bold uppercase tracking-wider disabled:opacity-50 ${
            initial.status === "published"
              ? "bg-cream text-ink hover:bg-cream-2"
              : "bg-secondary text-cream hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
          }`}
          style={{
            border: initial.status === "published" ? "1.5px solid var(--border)" : "2px solid #1A1A1A",
            boxShadow: initial.status === "published" ? undefined : "4px 4px 0 0 var(--shadow-color)",
          }}
        >
          {initial.status === "published" ? "Pasar a borrador" : "Publicar"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={pending}
          className="flex items-center gap-1.5 px-3 py-2 bg-orange text-dark rounded-md text-[10px] font-display font-bold uppercase tracking-wider transition-all hover:translate-x-[2px] hover:translate-y-[2px] disabled:opacity-50"
          style={{ border: "2px solid #1A1A1A", boxShadow: "4px 4px 0 0 var(--shadow-color)" }}
        >
          <Pencil size={13} strokeWidth={2.5} /> Editar
        </button>
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

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0, 0, 0, 0.5)" }}
          onClick={() => !pending && setOpen(false)}
        >
          <div
            className="bg-page rounded-md max-w-lg w-full p-6"
            style={{ border: "2.5px solid var(--border)", boxShadow: "5px 5px 0 0 var(--shadow-color)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display font-black text-[18px] uppercase tracking-tight text-ink">
              Editar producto
            </h3>

            <div className="mt-4 space-y-3">
              <Field label="Título">
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  className="w-full px-3 py-2 bg-cream rounded-md text-[13px] focus:outline-none"
                  style={{ border: "1.5px solid var(--border)" }}
                />
              </Field>
              <Field label="Handle (URL)">
                <input
                  type="text"
                  value={form.handle}
                  onChange={(e) => setForm((f) => ({ ...f, handle: e.target.value.toLowerCase().replace(/\s+/g, "-") }))}
                  className="w-full px-3 py-2 bg-cream rounded-md text-[13px] font-mono focus:outline-none"
                  style={{ border: "1.5px solid var(--border)" }}
                />
              </Field>
              <Field label="Estado">
                <select
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as typeof f.status }))}
                  className="w-full px-3 py-2 bg-cream rounded-md text-[13px] focus:outline-none"
                  style={{ border: "1.5px solid var(--border)" }}
                >
                  <option value="published">Publicado</option>
                  <option value="draft">Borrador</option>
                  <option value="proposed">Propuesto</option>
                  <option value="rejected">Rechazado</option>
                </select>
              </Field>
              <Field label="Descripción">
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={5}
                  className="w-full px-3 py-2 bg-cream rounded-md text-[12px] focus:outline-none resize-none"
                  style={{ border: "1.5px solid var(--border)" }}
                />
              </Field>
            </div>

            <div className="flex items-center gap-2 mt-5 justify-end">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={pending}
                className="px-4 py-2 bg-cream rounded-md text-[11px] font-display font-bold uppercase tracking-wider text-ink hover:bg-cream-2 disabled:opacity-50"
                style={{ border: "1.5px solid var(--border)" }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={save}
                disabled={pending}
                className="px-4 py-2 bg-orange text-dark rounded-md text-[11px] font-display font-bold uppercase tracking-wider hover:translate-x-[2px] hover:translate-y-[2px] disabled:opacity-50 transition-all"
                style={{ border: "2px solid #1A1A1A", boxShadow: "4px 4px 0 0 var(--shadow-color)" }}
              >
                {pending ? "Guardando…" : "Guardar"}
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
      <label className="block text-[10px] font-display font-bold uppercase tracking-[0.18em] text-ink-2 mb-1.5">
        {label}
      </label>
      {children}
    </div>
  )
}
