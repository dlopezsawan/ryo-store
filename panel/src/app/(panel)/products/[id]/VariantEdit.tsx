"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Pencil, Check, X, AlertCircle, CheckCircle2 } from "lucide-react"
import { updateVariantAction } from "./actions"

interface Props {
  productId: string
  variantId: string
  initial: {
    title: string
    sku: string
  }
}

export function VariantEdit({ productId, variantId, initial }: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [pending, startTransition] = useTransition()
  const [form, setForm] = useState(initial)
  const [toast, setToast] = useState<{ kind: "ok" | "err"; msg: string } | null>(null)

  function flash(kind: "ok" | "err", msg: string) {
    setToast({ kind, msg })
    setTimeout(() => setToast(null), 4000)
  }

  function save() {
    startTransition(async () => {
      const patch: { title?: string; sku?: string | null } = {}
      if (form.title !== initial.title) patch.title = form.title
      if (form.sku !== initial.sku) patch.sku = form.sku.trim() || null
      if (Object.keys(patch).length === 0) {
        setEditing(false)
        return
      }
      const res = await updateVariantAction(productId, variantId, patch)
      if (!res.ok) {
        flash("err", res.error)
        return
      }
      flash("ok", "Variante actualizada")
      setEditing(false)
      router.refresh()
    })
  }

  if (!editing) {
    return (
      <>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-ink-3 hover:text-orange transition-colors p-1"
          title="Editar variante"
        >
          <Pencil size={11} strokeWidth={2.4} />
        </button>
        {toast && (
          <div
            className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-md flex items-center gap-2 text-[12px] font-medium"
            style={{
              background: toast.kind === "ok" ? "#4D5431" : "#BB3B2E",
              color: "#fff",
              border: "2px solid #1A1A1A",
              boxShadow: "4px 4px 0 0 var(--shadow-color)",
            }}
          >
            {toast.kind === "ok" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{toast.msg}</span>
          </div>
        )}
      </>
    )
  }

  return (
    <div className="flex items-center gap-1">
      <input
        type="text"
        value={form.title}
        onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
        placeholder="Título"
        className="w-24 px-2 py-1 bg-cream rounded-md text-[11px] focus:outline-none"
        style={{ border: "1.5px solid var(--border)" }}
      />
      <input
        type="text"
        value={form.sku}
        onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
        placeholder="SKU"
        className="w-24 px-2 py-1 bg-cream rounded-md text-[11px] font-mono focus:outline-none"
        style={{ border: "1.5px solid var(--border)" }}
      />
      <button
        type="button"
        onClick={save}
        disabled={pending}
        className="text-secondary hover:text-secondary/70 p-1 disabled:opacity-50"
        title="Guardar"
      >
        <Check size={12} strokeWidth={3} />
      </button>
      <button
        type="button"
        onClick={() => { setForm(initial); setEditing(false) }}
        disabled={pending}
        className="text-ink-3 hover:text-primary p-1 disabled:opacity-50"
        title="Cancelar"
      >
        <X size={12} strokeWidth={3} />
      </button>
    </div>
  )
}
