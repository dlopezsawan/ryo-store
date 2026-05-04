"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Plus, Pencil, Trash2, Check, X, AlertCircle, CheckCircle2, MapPin } from "lucide-react"
import { createLocationAction, updateLocationAction, deleteLocationAction } from "./actions"

interface LocationRow {
  id: string
  name: string
  address_1: string
  city: string
  province: string
  postal_code: string
  country_code: string
  phone: string
}

type Toast = { kind: "ok" | "err"; msg: string } | null

export function LocationsManager({ rows }: { rows: LocationRow[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [toast, setToast] = useState<Toast>(null)

  function flash(kind: "ok" | "err", msg: string) {
    setToast({ kind, msg })
    setTimeout(() => setToast(null), 4000)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[12px] text-ink-3 font-mono">
          {rows.length} location{rows.length === 1 ? "" : "s"} · usadas para inventory + envíos
        </p>
        <button
          type="button"
          onClick={() => setCreating(!creating)}
          className="flex items-center gap-1.5 px-3 py-2 bg-orange text-dark rounded-md text-[10px] font-display font-bold uppercase tracking-wider transition-all hover:translate-x-[2px] hover:translate-y-[2px]"
          style={{ border: "2px solid #1A1A1A", boxShadow: "4px 4px 0 0 var(--shadow-color)" }}
        >
          <Plus size={11} strokeWidth={3} /> Nueva ubicación
        </button>
      </div>

      {creating && <CreateForm onDone={() => setCreating(false)} flash={flash} />}

      {rows.length === 0 ? (
        <div className="stamp-card p-10 text-center">
          <p className="font-display font-bold text-[14px] uppercase tracking-wider text-ink-3">
            Sin ubicaciones todavía
          </p>
          <p className="text-[12px] text-ink-3 mt-1">Crea la primera para poder trackear inventario.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {rows.map((loc) => (
            <LocationCard
              key={loc.id}
              row={loc}
              editing={editingId === loc.id}
              pending={pending}
              onEdit={() => setEditingId(loc.id)}
              onCancel={() => setEditingId(null)}
              onSaved={() => { setEditingId(null); flash("ok", "Ubicación actualizada"); router.refresh() }}
              onDeleted={() => { flash("ok", "Ubicación eliminada"); router.refresh() }}
              onError={(m) => flash("err", m)}
              startTransition={startTransition}
            />
          ))}
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

function CreateForm({ onDone, flash }: { onDone: () => void; flash: (k: "ok" | "err", m: string) => void }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [form, setForm] = useState({
    name: "",
    address_1: "",
    city: "",
    province: "",
    postal_code: "",
    country_code: "ve",
    phone: "",
  })

  function submit() {
    startTransition(async () => {
      const res = await createLocationAction({
        name: form.name,
        address: {
          address_1: form.address_1 || undefined,
          city: form.city || undefined,
          province: form.province || undefined,
          postal_code: form.postal_code || undefined,
          country_code: form.country_code,
          phone: form.phone || undefined,
        },
      })
      if (!res.ok) return flash("err", res.error)
      flash("ok", "Ubicación creada")
      onDone()
      router.refresh()
    })
  }

  return (
    <div className="stamp-card p-5 mb-4 bg-orange/5">
      <h4 className="font-display font-black text-[13px] uppercase tracking-wider mb-3">
        Nueva ubicación
      </h4>
      <div className="grid grid-cols-2 gap-2">
        <Input placeholder="Nombre *" value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} />
        <Input placeholder="País (ISO 2) *" value={form.country_code} onChange={(v) => setForm((f) => ({ ...f, country_code: v.toLowerCase().slice(0, 2) }))} maxLength={2} className="font-mono" />
        <Input placeholder="Dirección" value={form.address_1} onChange={(v) => setForm((f) => ({ ...f, address_1: v }))} />
        <Input placeholder="Ciudad" value={form.city} onChange={(v) => setForm((f) => ({ ...f, city: v }))} />
        <Input placeholder="Estado / provincia" value={form.province} onChange={(v) => setForm((f) => ({ ...f, province: v }))} />
        <Input placeholder="Código postal" value={form.postal_code} onChange={(v) => setForm((f) => ({ ...f, postal_code: v }))} />
        <Input placeholder="Teléfono" value={form.phone} onChange={(v) => setForm((f) => ({ ...f, phone: v }))} className="font-mono" />
      </div>
      <div className="flex items-center gap-2 justify-end mt-3">
        <button
          type="button"
          onClick={onDone}
          disabled={pending}
          className="px-3 py-1.5 bg-cream rounded-md text-[10px] font-display font-bold uppercase tracking-wider text-ink hover:bg-cream-2 disabled:opacity-50"
          style={{ border: "1.5px solid var(--border)" }}
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={pending || !form.name.trim() || !form.country_code.trim()}
          className="px-3 py-1.5 bg-secondary text-cream rounded-md text-[10px] font-display font-bold uppercase tracking-wider disabled:opacity-50"
          style={{ border: "1.5px solid #1A1A1A" }}
        >
          {pending ? "Creando…" : "Crear"}
        </button>
      </div>
    </div>
  )
}

function LocationCard({
  row, editing, pending, onEdit, onCancel, onSaved, onDeleted, onError, startTransition,
}: {
  row: LocationRow
  editing: boolean
  pending: boolean
  onEdit: () => void
  onCancel: () => void
  onSaved: () => void
  onDeleted: () => void
  onError: (msg: string) => void
  startTransition: (fn: () => void) => void
}) {
  const [form, setForm] = useState(row)
  const [confirmDel, setConfirmDel] = useState(false)

  function save() {
    startTransition(async () => {
      const patch: Parameters<typeof updateLocationAction>[1] = {}
      if (form.name !== row.name) patch.name = form.name
      const addrPatch: Record<string, string> = {}
      if (form.address_1 !== row.address_1) addrPatch.address_1 = form.address_1
      if (form.city !== row.city) addrPatch.city = form.city
      if (form.province !== row.province) addrPatch.province = form.province
      if (form.postal_code !== row.postal_code) addrPatch.postal_code = form.postal_code
      if (form.country_code !== row.country_code) addrPatch.country_code = form.country_code
      if (form.phone !== row.phone) addrPatch.phone = form.phone
      if (Object.keys(addrPatch).length > 0) patch.address = addrPatch
      if (Object.keys(patch).length === 0) return onCancel()

      const res = await updateLocationAction(row.id, patch)
      if (!res.ok) return onError(res.error)
      onSaved()
    })
  }

  function del() {
    startTransition(async () => {
      const res = await deleteLocationAction(row.id)
      if (!res.ok) return onError(res.error)
      onDeleted()
    })
  }

  if (editing) {
    return (
      <div className="stamp-card p-5 bg-orange/5">
        <div className="grid grid-cols-2 gap-2">
          <Input placeholder="Nombre" value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} />
          <Input placeholder="País" value={form.country_code} onChange={(v) => setForm((f) => ({ ...f, country_code: v.toLowerCase().slice(0, 2) }))} maxLength={2} className="font-mono" />
          <Input placeholder="Dirección" value={form.address_1} onChange={(v) => setForm((f) => ({ ...f, address_1: v }))} />
          <Input placeholder="Ciudad" value={form.city} onChange={(v) => setForm((f) => ({ ...f, city: v }))} />
          <Input placeholder="Estado" value={form.province} onChange={(v) => setForm((f) => ({ ...f, province: v }))} />
          <Input placeholder="CP" value={form.postal_code} onChange={(v) => setForm((f) => ({ ...f, postal_code: v }))} />
          <Input placeholder="Teléfono" value={form.phone} onChange={(v) => setForm((f) => ({ ...f, phone: v }))} className="font-mono col-span-2" />
        </div>
        <div className="flex items-center gap-2 justify-end mt-3">
          <button onClick={onCancel} disabled={pending} className="text-ink-3 hover:text-primary p-1.5 disabled:opacity-50" title="Cancelar">
            <X size={14} strokeWidth={3} />
          </button>
          <button onClick={save} disabled={pending} className="px-3 py-1.5 bg-secondary text-cream rounded-md text-[10px] font-display font-bold uppercase tracking-wider disabled:opacity-50" style={{ border: "1.5px solid #1A1A1A" }}>
            <Check size={11} strokeWidth={3} className="inline mr-1" />
            Guardar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="stamp-card p-5 relative">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 bg-secondary text-cream flex items-center justify-center flex-shrink-0" style={{ border: "1.5px solid var(--border)" }}>
            <MapPin size={14} strokeWidth={2.4} />
          </div>
          <h3 className="font-display font-black text-[14px] uppercase tracking-wider truncate">{row.name}</h3>
        </div>
        {confirmDel ? (
          <div className="flex items-center gap-1 flex-shrink-0">
            <button onClick={del} disabled={pending} className="px-2 py-0.5 bg-primary text-white text-[10px] font-display font-bold uppercase tracking-wider rounded-md disabled:opacity-50">
              Confirmar
            </button>
            <button onClick={() => setConfirmDel(false)} disabled={pending} className="text-ink-3 px-1 disabled:opacity-50">
              <X size={14} />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1 flex-shrink-0">
            <button onClick={onEdit} className="text-ink-3 hover:text-orange p-1" title="Editar">
              <Pencil size={11} strokeWidth={2.4} />
            </button>
            <button onClick={() => setConfirmDel(true)} className="text-ink-3 hover:text-primary p-1" title="Eliminar">
              <Trash2 size={11} strokeWidth={2.4} />
            </button>
          </div>
        )}
      </div>
      <dl className="text-[11px] font-mono space-y-1 text-ink-2">
        {row.address_1 && <div>{row.address_1}</div>}
        <div>
          {[row.city, row.province, row.postal_code].filter(Boolean).join(", ")}
          {row.country_code && <span className="text-ink-3 uppercase ml-1">· {row.country_code}</span>}
        </div>
        {row.phone && <div className="num">{row.phone}</div>}
      </dl>
    </div>
  )
}

function Input({
  value, onChange, placeholder, maxLength, className,
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
  maxLength?: number
  className?: string
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      maxLength={maxLength}
      className={`px-3 py-2 bg-cream rounded-md text-[12px] focus:outline-none ${className ?? ""}`}
      style={{ border: "1.5px solid var(--border)" }}
    />
  )
}
