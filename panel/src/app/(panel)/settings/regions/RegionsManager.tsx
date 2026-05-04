"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Plus, Pencil, Trash2, Check, X, Globe2, AlertCircle, CheckCircle2 } from "lucide-react"
import { createRegionAction, updateRegionAction, deleteRegionAction } from "./actions"

interface RegionRow {
  id: string
  name: string
  currency_code: string
  automatic_taxes: boolean
  countries: string[] // iso2
}

type Toast = { kind: "ok" | "err"; msg: string } | null

export function RegionsManager({ rows }: { rows: RegionRow[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [confirmDelId, setConfirmDelId] = useState<string | null>(null)
  const [toast, setToast] = useState<Toast>(null)

  function flash(kind: "ok" | "err", msg: string) {
    setToast({ kind, msg })
    setTimeout(() => setToast(null), 4000)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-[12px] text-ink-3 font-mono">
          {rows.length} región{rows.length === 1 ? "" : "es"} configurada{rows.length === 1 ? "" : "s"}
        </p>
        <button
          type="button"
          onClick={() => setCreating(!creating)}
          className="flex items-center gap-1.5 px-3 py-2 bg-orange text-dark rounded-md text-[10px] font-display font-bold uppercase tracking-wider transition-all hover:translate-x-[2px] hover:translate-y-[2px]"
          style={{ border: "2px solid #1A1A1A", boxShadow: "4px 4px 0 0 var(--shadow-color)" }}
        >
          <Plus size={11} strokeWidth={3} /> Nueva región
        </button>
      </div>

      {creating && <CreateForm onDone={() => setCreating(false)} flash={flash} />}

      {rows.length === 0 ? (
        <div className="stamp-card p-10 text-center">
          <p className="font-display font-bold text-[14px] uppercase tracking-wider text-ink-3">
            Sin regiones todavía
          </p>
          <p className="text-[12px] text-ink-3 mt-1">
            Crea al menos una para que el storefront pueda procesar pedidos.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {rows.map((r) => (
            <RegionCard
              key={r.id}
              row={r}
              editing={editingId === r.id}
              confirmDel={confirmDelId === r.id}
              pending={pending}
              onEdit={() => setEditingId(r.id)}
              onCancel={() => setEditingId(null)}
              onConfirmDel={() => setConfirmDelId(r.id)}
              onCancelDel={() => setConfirmDelId(null)}
              onSaved={() => { setEditingId(null); flash("ok", "Región actualizada"); router.refresh() }}
              onDeleted={() => { setConfirmDelId(null); flash("ok", "Región eliminada"); router.refresh() }}
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
  const [form, setForm] = useState({ name: "", currency_code: "eur", countries: "ve", automatic_taxes: false })

  function submit() {
    startTransition(async () => {
      const countries = form.countries.split(",").map((c) => c.trim()).filter(Boolean)
      const res = await createRegionAction({
        name: form.name,
        currency_code: form.currency_code,
        countries,
        automatic_taxes: form.automatic_taxes,
      })
      if (!res.ok) return flash("err", res.error)
      flash("ok", "Región creada")
      onDone()
      router.refresh()
    })
  }

  return (
    <div className="stamp-card p-4 mb-4 bg-orange/5">
      <h4 className="font-display font-black text-[13px] uppercase tracking-wider mb-3">Nueva región</h4>
      <div className="grid grid-cols-3 gap-2">
        <input
          type="text"
          placeholder="Nombre *"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          className="px-3 py-2 bg-cream rounded-md text-[12px] focus:outline-none"
          style={{ border: "1.5px solid var(--border)" }}
        />
        <input
          type="text"
          placeholder="Currency (eur, usd...) *"
          value={form.currency_code}
          onChange={(e) => setForm((f) => ({ ...f, currency_code: e.target.value.toLowerCase().slice(0, 3) }))}
          maxLength={3}
          className="px-3 py-2 bg-cream rounded-md text-[12px] font-mono focus:outline-none"
          style={{ border: "1.5px solid var(--border)" }}
        />
        <input
          type="text"
          placeholder="Países iso2 (ve,us,es) *"
          value={form.countries}
          onChange={(e) => setForm((f) => ({ ...f, countries: e.target.value.toLowerCase() }))}
          className="px-3 py-2 bg-cream rounded-md text-[12px] font-mono focus:outline-none"
          style={{ border: "1.5px solid var(--border)" }}
        />
      </div>
      <div className="flex items-center justify-between mt-3">
        <label className="flex items-center gap-1.5 text-[11px] cursor-pointer">
          <input
            type="checkbox"
            checked={form.automatic_taxes}
            onChange={(e) => setForm((f) => ({ ...f, automatic_taxes: e.target.checked }))}
          />
          Taxes automáticos
        </label>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onDone} disabled={pending} className="px-3 py-1.5 bg-cream rounded-md text-[10px] font-display font-bold uppercase tracking-wider text-ink hover:bg-cream-2 disabled:opacity-50" style={{ border: "1.5px solid var(--border)" }}>
            Cancelar
          </button>
          <button type="button" onClick={submit} disabled={pending || !form.name.trim() || !form.currency_code.trim() || !form.countries.trim()} className="px-3 py-1.5 bg-secondary text-cream rounded-md text-[10px] font-display font-bold uppercase tracking-wider disabled:opacity-50" style={{ border: "1.5px solid #1A1A1A" }}>
            {pending ? "Creando…" : "Crear"}
          </button>
        </div>
      </div>
    </div>
  )
}

function RegionCard({
  row, editing, confirmDel, pending,
  onEdit, onCancel, onConfirmDel, onCancelDel,
  onSaved, onDeleted, onError, startTransition,
}: {
  row: RegionRow
  editing: boolean
  confirmDel: boolean
  pending: boolean
  onEdit: () => void
  onCancel: () => void
  onConfirmDel: () => void
  onCancelDel: () => void
  onSaved: () => void
  onDeleted: () => void
  onError: (msg: string) => void
  startTransition: (fn: () => void) => void
}) {
  const [form, setForm] = useState({
    name: row.name,
    currency_code: row.currency_code,
    countries: row.countries.join(","),
    automatic_taxes: row.automatic_taxes,
  })

  function save() {
    startTransition(async () => {
      const patch: Parameters<typeof updateRegionAction>[1] = {}
      if (form.name !== row.name) patch.name = form.name
      if (form.currency_code !== row.currency_code) patch.currency_code = form.currency_code
      if (form.countries !== row.countries.join(",")) {
        patch.countries = form.countries.split(",").map((c) => c.trim()).filter(Boolean)
      }
      if (form.automatic_taxes !== row.automatic_taxes) patch.automatic_taxes = form.automatic_taxes
      if (Object.keys(patch).length === 0) return onCancel()
      const res = await updateRegionAction(row.id, patch)
      if (!res.ok) return onError(res.error)
      onSaved()
    })
  }

  function del() {
    startTransition(async () => {
      const res = await deleteRegionAction(row.id)
      if (!res.ok) return onError(res.error)
      onDeleted()
    })
  }

  if (editing) {
    return (
      <div className="stamp-card p-5 bg-orange/5">
        <div className="grid grid-cols-2 gap-2">
          <input type="text" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="px-3 py-2 bg-cream rounded-md text-[12px] focus:outline-none" style={{ border: "1.5px solid var(--border)" }} />
          <input type="text" value={form.currency_code} onChange={(e) => setForm((f) => ({ ...f, currency_code: e.target.value.toLowerCase().slice(0, 3) }))} maxLength={3} className="px-3 py-2 bg-cream rounded-md text-[12px] font-mono focus:outline-none" style={{ border: "1.5px solid var(--border)" }} />
          <input type="text" value={form.countries} onChange={(e) => setForm((f) => ({ ...f, countries: e.target.value.toLowerCase() }))} className="col-span-2 px-3 py-2 bg-cream rounded-md text-[12px] font-mono focus:outline-none" style={{ border: "1.5px solid var(--border)" }} placeholder="iso2,iso2,..." />
        </div>
        <div className="flex items-center justify-between mt-3">
          <label className="flex items-center gap-1.5 text-[11px] cursor-pointer">
            <input type="checkbox" checked={form.automatic_taxes} onChange={(e) => setForm((f) => ({ ...f, automatic_taxes: e.target.checked }))} />
            Taxes automáticos
          </label>
          <div className="flex items-center gap-1">
            <button onClick={onCancel} disabled={pending} className="text-ink-3 hover:text-primary p-1.5 disabled:opacity-50">
              <X size={14} strokeWidth={3} />
            </button>
            <button onClick={save} disabled={pending} className="px-3 py-1.5 bg-secondary text-cream rounded-md text-[10px] font-display font-bold uppercase tracking-wider disabled:opacity-50" style={{ border: "1.5px solid #1A1A1A" }}>
              <Check size={11} className="inline mr-1" /> Guardar
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="stamp-card p-5">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="w-9 h-9 bg-orange text-dark flex items-center justify-center flex-shrink-0" style={{ border: "1.5px solid var(--border)" }}>
            <Globe2 size={14} strokeWidth={2.4} />
          </div>
          <div className="min-w-0">
            <h3 className="font-display font-black text-[14px] uppercase tracking-wider truncate">{row.name}</h3>
            <p className="text-[10px] font-mono text-ink-3 uppercase">
              {row.currency_code} {row.automatic_taxes && "· auto-tax"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {confirmDel ? (
            <>
              <button onClick={del} disabled={pending} className="px-2 py-0.5 bg-primary text-white text-[10px] font-display font-bold uppercase tracking-wider rounded-md disabled:opacity-50">
                Confirmar
              </button>
              <button onClick={onCancelDel} disabled={pending} className="text-ink-3 px-1 disabled:opacity-50">
                <X size={12} />
              </button>
            </>
          ) : (
            <>
              <button onClick={onEdit} className="text-ink-3 hover:text-orange p-1" title="Editar">
                <Pencil size={11} strokeWidth={2.4} />
              </button>
              <button onClick={onConfirmDel} className="text-ink-3 hover:text-primary p-1" title="Eliminar">
                <Trash2 size={11} strokeWidth={2.4} />
              </button>
            </>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-1">
        {row.countries.map((c) => (
          <span key={c} className="text-[10px] font-mono uppercase bg-cream-2 px-2 py-0.5 rounded-md text-ink-2" style={{ border: "1px solid var(--border)" }}>
            {c}
          </span>
        ))}
      </div>
    </div>
  )
}
