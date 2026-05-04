"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Pencil, AlertCircle, CheckCircle2 } from "lucide-react"
import { updateOrderInfoAction } from "./actions"

interface Props {
  orderId: string
  initial: {
    email: string
    first_name: string
    last_name: string
    address_1: string
    city: string
    province: string
    postal_code: string
    country_code: string
    phone: string
  }
}

type Toast = { kind: "ok" | "err"; msg: string } | null

export function EditOrderInfo({ orderId, initial }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [toast, setToast] = useState<Toast>(null)
  const [form, setForm] = useState(initial)

  function flash(k: "ok" | "err", m: string) {
    setToast({ kind: k, msg: m })
    setTimeout(() => setToast(null), 4000)
  }

  function save() {
    startTransition(async () => {
      const patch: Parameters<typeof updateOrderInfoAction>[1] = {}
      if (form.email !== initial.email) patch.email = form.email
      // Cualquier cambio en address envía el bloque entero (Medusa lo mergea)
      const addrChanged =
        form.first_name !== initial.first_name ||
        form.last_name !== initial.last_name ||
        form.address_1 !== initial.address_1 ||
        form.city !== initial.city ||
        form.province !== initial.province ||
        form.postal_code !== initial.postal_code ||
        form.country_code !== initial.country_code ||
        form.phone !== initial.phone
      if (addrChanged) {
        patch.shipping_address = {
          first_name: form.first_name || undefined,
          last_name: form.last_name || undefined,
          address_1: form.address_1 || undefined,
          city: form.city || undefined,
          province: form.province || undefined,
          postal_code: form.postal_code || undefined,
          country_code: form.country_code || undefined,
          phone: form.phone || undefined,
        }
      }
      if (Object.keys(patch).length === 0) {
        setOpen(false)
        return
      }
      const res = await updateOrderInfoAction(orderId, patch)
      if (!res.ok) return flash("err", res.error)
      flash("ok", "Pedido actualizado")
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Editar email + dirección de envío"
        className="text-ink-3 hover:text-orange p-1"
      >
        <Pencil size={11} strokeWidth={2.4} />
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
            className="bg-page rounded-md max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto"
            style={{ border: "2.5px solid var(--border)", boxShadow: "5px 5px 0 0 var(--shadow-color)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display font-black text-[18px] uppercase tracking-tight text-ink mb-4">
              Editar pedido
            </h3>

            <Field label="Email del cliente">
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className="w-full px-3 py-2 bg-cream rounded-md text-[13px] font-mono focus:outline-none"
                style={{ border: "1.5px solid var(--border)" }}
              />
            </Field>

            <h4 className="font-display font-black text-[12px] uppercase tracking-wider mt-5 mb-3">
              Dirección de envío
            </h4>
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <Field label="Nombre">
                  <input type="text" value={form.first_name} onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))} className="w-full px-3 py-2 bg-cream rounded-md text-[12px] focus:outline-none" style={{ border: "1.5px solid var(--border)" }} />
                </Field>
                <Field label="Apellido">
                  <input type="text" value={form.last_name} onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))} className="w-full px-3 py-2 bg-cream rounded-md text-[12px] focus:outline-none" style={{ border: "1.5px solid var(--border)" }} />
                </Field>
              </div>
              <Field label="Dirección">
                <input type="text" value={form.address_1} onChange={(e) => setForm((f) => ({ ...f, address_1: e.target.value }))} className="w-full px-3 py-2 bg-cream rounded-md text-[12px] focus:outline-none" style={{ border: "1.5px solid var(--border)" }} />
              </Field>
              <div className="grid grid-cols-3 gap-2">
                <Field label="Ciudad">
                  <input type="text" value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} className="w-full px-3 py-2 bg-cream rounded-md text-[12px] focus:outline-none" style={{ border: "1.5px solid var(--border)" }} />
                </Field>
                <Field label="Estado">
                  <input type="text" value={form.province} onChange={(e) => setForm((f) => ({ ...f, province: e.target.value }))} className="w-full px-3 py-2 bg-cream rounded-md text-[12px] focus:outline-none" style={{ border: "1.5px solid var(--border)" }} />
                </Field>
                <Field label="CP">
                  <input type="text" value={form.postal_code} onChange={(e) => setForm((f) => ({ ...f, postal_code: e.target.value }))} className="w-full px-3 py-2 bg-cream rounded-md text-[12px] font-mono focus:outline-none" style={{ border: "1.5px solid var(--border)" }} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field label="País (ISO-2)">
                  <input type="text" maxLength={2} value={form.country_code} onChange={(e) => setForm((f) => ({ ...f, country_code: e.target.value.toLowerCase().slice(0, 2) }))} className="w-full px-3 py-2 bg-cream rounded-md text-[12px] font-mono focus:outline-none" style={{ border: "1.5px solid var(--border)" }} />
                </Field>
                <Field label="Teléfono">
                  <input type="tel" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} className="w-full px-3 py-2 bg-cream rounded-md text-[12px] font-mono focus:outline-none" style={{ border: "1.5px solid var(--border)" }} />
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
