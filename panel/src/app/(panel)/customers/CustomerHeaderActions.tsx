"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Plus, Download, AlertCircle, CheckCircle2 } from "lucide-react"
import { createCustomerAction } from "./actions"

type Toast = { kind: "ok" | "err"; msg: string } | null

export function CustomerHeaderActions() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [toast, setToast] = useState<Toast>(null)
  const [form, setForm] = useState({
    email: "",
    first_name: "",
    last_name: "",
    phone: "",
    cedula: "",
  })

  function flash(kind: "ok" | "err", msg: string) {
    setToast({ kind, msg })
    setTimeout(() => setToast(null), 4000)
  }

  function submit() {
    startTransition(async () => {
      const res = await createCustomerAction(form)
      if (!res.ok) return flash("err", res.error)
      flash("ok", "Cliente creado")
      setOpen(false)
      if (res.data?.id) router.push(`/customers/${res.data.id}`)
      else router.refresh()
    })
  }

  return (
    <>
      <a
        href="/customers/export"
        className="flex items-center gap-1.5 px-3 py-2 bg-cream rounded-md text-[10px] font-display font-bold uppercase tracking-wider text-ink hover:bg-cream-2"
        style={{ border: "1.5px solid var(--border)", boxShadow: "3px 3px 0 0 var(--shadow-color)" }}
      >
        <Download size={11} strokeWidth={2.5} /> Exportar CSV
      </a>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 py-2 bg-orange text-dark rounded-md text-[10px] font-display font-bold uppercase tracking-wider transition-all hover:translate-x-[2px] hover:translate-y-[2px]"
        style={{ border: "2px solid #1A1A1A", boxShadow: "4px 4px 0 0 var(--shadow-color)" }}
      >
        <Plus size={11} strokeWidth={3} /> Nuevo cliente
      </button>

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
            <h3 className="font-display font-black text-[18px] uppercase tracking-tight text-ink mb-4">
              Nuevo cliente
            </h3>

            <div className="space-y-3">
              <Field label="Email *">
                <input
                  type="email"
                  autoFocus
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full px-3 py-2 bg-cream rounded-md text-[13px] font-mono focus:outline-none"
                  style={{ border: "1.5px solid var(--border)" }}
                />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Nombre">
                  <input
                    type="text"
                    value={form.first_name}
                    onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
                    className="w-full px-3 py-2 bg-cream rounded-md text-[12px] focus:outline-none"
                    style={{ border: "1.5px solid var(--border)" }}
                  />
                </Field>
                <Field label="Apellido">
                  <input
                    type="text"
                    value={form.last_name}
                    onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
                    className="w-full px-3 py-2 bg-cream rounded-md text-[12px] focus:outline-none"
                    style={{ border: "1.5px solid var(--border)" }}
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Teléfono">
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    className="w-full px-3 py-2 bg-cream rounded-md text-[12px] font-mono focus:outline-none"
                    style={{ border: "1.5px solid var(--border)" }}
                  />
                </Field>
                <Field label="Cédula (VE)">
                  <input
                    type="text"
                    value={form.cedula}
                    onChange={(e) => setForm((f) => ({ ...f, cedula: e.target.value }))}
                    className="w-full px-3 py-2 bg-cream rounded-md text-[12px] font-mono focus:outline-none"
                    style={{ border: "1.5px solid var(--border)" }}
                  />
                </Field>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 mt-5">
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
                onClick={submit}
                disabled={pending || !form.email.trim()}
                className="px-4 py-2 bg-orange text-dark rounded-md text-[11px] font-display font-bold uppercase tracking-wider hover:translate-x-[2px] hover:translate-y-[2px] disabled:opacity-50 transition-all"
                style={{ border: "2px solid #1A1A1A", boxShadow: "4px 4px 0 0 var(--shadow-color)" }}
              >
                {pending ? "Creando…" : "Crear cliente"}
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
