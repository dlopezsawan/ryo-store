"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Plus, MapPin, Pencil, Trash2, Check, X, Star, AlertCircle, CheckCircle2 } from "lucide-react"
import { addAddressAction, updateAddressAction, deleteAddressAction } from "./actions"

export interface AddressRow {
  id: string
  first_name: string
  last_name: string
  address_1: string
  city: string
  province: string
  postal_code: string
  country_code: string
  phone: string
  is_default_shipping: boolean
  is_default_billing: boolean
}

interface Props {
  customerId: string
  rows: AddressRow[]
}

type Toast = { kind: "ok" | "err"; msg: string } | null

export function AddressesManager({ customerId, rows }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [confirmDelId, setConfirmDelId] = useState<string | null>(null)
  const [toast, setToast] = useState<Toast>(null)

  function flash(k: "ok" | "err", m: string) {
    setToast({ kind: k, msg: m })
    setTimeout(() => setToast(null), 4000)
  }

  return (
    <div className="stamp-card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 bg-dark text-cream">
        <div className="flex items-center gap-2">
          <MapPin size={14} strokeWidth={2.4} />
          <h3 className="font-display font-black text-[14px] uppercase tracking-wider">Direcciones</h3>
          <span className="text-[10px] font-mono text-cream/60">{rows.length}</span>
        </div>
        <button
          type="button"
          onClick={() => setCreating(!creating)}
          className="flex items-center gap-1 px-2 py-1 bg-orange text-dark rounded-md text-[10px] font-display font-bold uppercase tracking-wider"
          style={{ border: "1.5px solid #1A1A1A" }}
        >
          <Plus size={11} strokeWidth={3} /> Nueva
        </button>
      </div>

      <div className="p-4 space-y-2">
        {creating && (
          <AddressForm
            mode="create"
            pending={pending}
            onCancel={() => setCreating(false)}
            onSubmit={(input) => {
              startTransition(async () => {
                const r = await addAddressAction(customerId, input)
                if (!r.ok) return flash("err", r.error)
                flash("ok", "Dirección añadida")
                setCreating(false)
                router.refresh()
              })
            }}
          />
        )}

        {rows.length === 0 && !creating ? (
          <p className="text-[11px] text-ink-3 italic text-center py-2">Sin direcciones guardadas.</p>
        ) : (
          rows.map((a) => (
            editingId === a.id ? (
              <AddressForm
                key={a.id}
                mode="edit"
                initial={a}
                pending={pending}
                onCancel={() => setEditingId(null)}
                onSubmit={(input) => {
                  startTransition(async () => {
                    const r = await updateAddressAction(customerId, a.id, input)
                    if (!r.ok) return flash("err", r.error)
                    flash("ok", "Dirección actualizada")
                    setEditingId(null)
                    router.refresh()
                  })
                }}
              />
            ) : (
              <div key={a.id} className="p-3 bg-cream-2/40 rounded-md" style={{ border: "1.5px solid var(--border)" }}>
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-display font-bold text-[12px]">
                      {[a.first_name, a.last_name].filter(Boolean).join(" ") || "—"}
                    </span>
                    {a.is_default_shipping && (
                      <span className="text-[9px] bg-orange/15 text-orange px-1.5 py-0 rounded font-display font-bold uppercase tracking-wider flex items-center gap-0.5" style={{ border: "1px solid #FF3B27" }}>
                        <Star size={9} strokeWidth={3} /> envío
                      </span>
                    )}
                    {a.is_default_billing && (
                      <span className="text-[9px] bg-secondary/15 text-secondary px-1.5 py-0 rounded font-display font-bold uppercase tracking-wider flex items-center gap-0.5" style={{ border: "1px solid #4D5431" }}>
                        <Star size={9} strokeWidth={3} /> billing
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {confirmDelId === a.id ? (
                      <>
                        <button
                          onClick={() => startTransition(async () => {
                            const r = await deleteAddressAction(customerId, a.id)
                            if (!r.ok) return flash("err", r.error)
                            flash("ok", "Dirección eliminada")
                            setConfirmDelId(null)
                            router.refresh()
                          })}
                          disabled={pending}
                          className="px-2 py-0 bg-primary text-white text-[9px] font-display font-bold uppercase tracking-wider rounded-md disabled:opacity-50"
                        >
                          Eliminar
                        </button>
                        <button onClick={() => setConfirmDelId(null)} disabled={pending} className="text-ink-3 disabled:opacity-50">
                          <X size={11} />
                        </button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => setEditingId(a.id)} className="text-ink-3 hover:text-orange p-1">
                          <Pencil size={11} strokeWidth={2.4} />
                        </button>
                        <button onClick={() => setConfirmDelId(a.id)} className="text-ink-3 hover:text-primary p-1">
                          <Trash2 size={11} strokeWidth={2.4} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <p className="text-[11px] font-mono text-ink-2 leading-relaxed">
                  {a.address_1 && <>{a.address_1}<br /></>}
                  {[a.city, a.province, a.postal_code].filter(Boolean).join(", ")}
                  {a.country_code && <> · <span className="uppercase">{a.country_code}</span></>}
                  {a.phone && <><br />{a.phone}</>}
                </p>
              </div>
            )
          ))
        )}
      </div>

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-md flex items-center gap-2 text-[12px] font-medium animate-in fade-in slide-in-from-bottom-2"
          style={{ background: toast.kind === "ok" ? "#4D5431" : "#BB3B2E", color: "#fff", border: "2px solid #1A1A1A", boxShadow: "4px 4px 0 0 var(--shadow-color)", minWidth: 280, maxWidth: 480 }}>
          {toast.kind === "ok" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{toast.msg}</span>
        </div>
      )}
    </div>
  )
}

interface FormState {
  first_name: string
  last_name: string
  address_1: string
  city: string
  province: string
  postal_code: string
  country_code: string
  phone: string
  is_default_shipping: boolean
  is_default_billing: boolean
}

function AddressForm({
  mode, initial, pending, onCancel, onSubmit,
}: {
  mode: "create" | "edit"
  initial?: AddressRow
  pending: boolean
  onCancel: () => void
  onSubmit: (input: FormState) => void
}) {
  const [form, setForm] = useState<FormState>({
    first_name: initial?.first_name ?? "",
    last_name: initial?.last_name ?? "",
    address_1: initial?.address_1 ?? "",
    city: initial?.city ?? "",
    province: initial?.province ?? "",
    postal_code: initial?.postal_code ?? "",
    country_code: initial?.country_code ?? "ve",
    phone: initial?.phone ?? "",
    is_default_shipping: initial?.is_default_shipping ?? false,
    is_default_billing: initial?.is_default_billing ?? false,
  })

  return (
    <div className="p-3 bg-orange/5 rounded-md" style={{ border: "1.5px dashed #FF3B27" }}>
      <div className="grid grid-cols-2 gap-2">
        <input type="text" placeholder="Nombre" value={form.first_name} onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))} className="px-2 py-1 bg-cream rounded-md text-[11px] focus:outline-none" style={{ border: "1.5px solid var(--border)" }} />
        <input type="text" placeholder="Apellido" value={form.last_name} onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))} className="px-2 py-1 bg-cream rounded-md text-[11px] focus:outline-none" style={{ border: "1.5px solid var(--border)" }} />
        <input type="text" placeholder="Dirección" value={form.address_1} onChange={(e) => setForm((f) => ({ ...f, address_1: e.target.value }))} className="col-span-2 px-2 py-1 bg-cream rounded-md text-[11px] focus:outline-none" style={{ border: "1.5px solid var(--border)" }} />
        <input type="text" placeholder="Ciudad" value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} className="px-2 py-1 bg-cream rounded-md text-[11px] focus:outline-none" style={{ border: "1.5px solid var(--border)" }} />
        <input type="text" placeholder="Estado" value={form.province} onChange={(e) => setForm((f) => ({ ...f, province: e.target.value }))} className="px-2 py-1 bg-cream rounded-md text-[11px] focus:outline-none" style={{ border: "1.5px solid var(--border)" }} />
        <input type="text" placeholder="CP" value={form.postal_code} onChange={(e) => setForm((f) => ({ ...f, postal_code: e.target.value }))} className="px-2 py-1 bg-cream rounded-md text-[11px] font-mono focus:outline-none" style={{ border: "1.5px solid var(--border)" }} />
        <input type="text" placeholder="País iso2" maxLength={2} value={form.country_code} onChange={(e) => setForm((f) => ({ ...f, country_code: e.target.value.toLowerCase().slice(0, 2) }))} className="px-2 py-1 bg-cream rounded-md text-[11px] font-mono focus:outline-none" style={{ border: "1.5px solid var(--border)" }} />
        <input type="tel" placeholder="Teléfono" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} className="col-span-2 px-2 py-1 bg-cream rounded-md text-[11px] font-mono focus:outline-none" style={{ border: "1.5px solid var(--border)" }} />
      </div>
      <div className="flex items-center gap-3 mt-2 text-[11px]">
        <label className="flex items-center gap-1 cursor-pointer">
          <input type="checkbox" checked={form.is_default_shipping} onChange={(e) => setForm((f) => ({ ...f, is_default_shipping: e.target.checked }))} />
          Default envío
        </label>
        <label className="flex items-center gap-1 cursor-pointer">
          <input type="checkbox" checked={form.is_default_billing} onChange={(e) => setForm((f) => ({ ...f, is_default_billing: e.target.checked }))} />
          Default billing
        </label>
        <span className="flex-1" />
        <button onClick={onCancel} disabled={pending} className="text-ink-3 hover:text-primary p-1 disabled:opacity-50">
          <X size={12} strokeWidth={3} />
        </button>
        <button onClick={() => onSubmit(form)} disabled={pending || !form.country_code} className="px-2 py-1 bg-secondary text-cream rounded-md text-[10px] font-display font-bold uppercase tracking-wider disabled:opacity-50" style={{ border: "1px solid #1A1A1A" }}>
          <Check size={11} className="inline mr-0.5" /> {mode === "create" ? "Crear" : "Guardar"}
        </button>
      </div>
    </div>
  )
}
