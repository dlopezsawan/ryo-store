"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Plus, Pencil, Trash2, Check, X, Power, AlertCircle, CheckCircle2, MoreHorizontal } from "lucide-react"
import {
  createPromotionAction, togglePromotionAction, updatePromotionCodeAction, deletePromotionAction,
} from "./actions"

interface PromoRow {
  id: string
  code: string
  status: "active" | "inactive" | "draft"
  is_automatic: boolean
  type: "percentage" | "fixed"
  value: number
  ruleSummary: string
}

type Toast = { kind: "ok" | "err"; msg: string } | null

export function PromotionsManager({ rows }: { rows: PromoRow[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [confirmDelId, setConfirmDelId] = useState<string | null>(null)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [toast, setToast] = useState<Toast>(null)

  function flash(kind: "ok" | "err", msg: string) {
    setToast({ kind, msg })
    setTimeout(() => setToast(null), 4000)
  }

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-mono text-ink-3">{rows.length} totales · {rows.filter(r => r.status === "active").length} activas</span>
        <button
          type="button"
          onClick={() => setCreating(!creating)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-orange text-dark rounded-md text-[10px] font-display font-bold uppercase tracking-wider"
          style={{ border: "1.5px solid #1A1A1A" }}
        >
          <Plus size={11} strokeWidth={3} /> Nueva promo
        </button>
      </div>

      {creating && <CreatePromoForm onDone={() => setCreating(false)} flash={flash} />}

      {rows.length === 0 ? (
        <div className="p-10 text-center text-ink-3 text-[13px]">
          Sin promociones configuradas todavía.
        </div>
      ) : (
        <div className="divide-y divide-warm-200/50">
          {rows.map((p) => (
            <PromoRowItem
              key={p.id}
              row={p}
              editing={editingId === p.id}
              confirmDel={confirmDelId === p.id}
              menuOpen={openMenuId === p.id}
              pending={pending}
              onEdit={() => { setEditingId(p.id); setOpenMenuId(null) }}
              onCancel={() => setEditingId(null)}
              onMenuToggle={() => setOpenMenuId(openMenuId === p.id ? null : p.id)}
              onConfirmDel={() => { setConfirmDelId(p.id); setOpenMenuId(null) }}
              onCancelDel={() => setConfirmDelId(null)}
              onSaved={() => { setEditingId(null); flash("ok", "Promoción actualizada"); router.refresh() }}
              onDeleted={() => { setConfirmDelId(null); flash("ok", "Promoción eliminada"); router.refresh() }}
              onToggled={(s) => { setOpenMenuId(null); flash("ok", s === "active" ? "Activada" : "Desactivada"); router.refresh() }}
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
    </>
  )
}

function CreatePromoForm({ onDone, flash }: { onDone: () => void; flash: (k: "ok" | "err", m: string) => void }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [form, setForm] = useState({
    code: "",
    is_automatic: false,
    type: "percentage" as "percentage" | "fixed",
    value: 10,
    target_type: "order" as "order" | "items" | "shipping_methods",
  })

  function submit() {
    startTransition(async () => {
      const res = await createPromotionAction({
        code: form.code,
        is_automatic: form.is_automatic,
        type: form.type,
        value: Number(form.value),
        target_type: form.target_type,
      })
      if (!res.ok) return flash("err", res.error)
      flash("ok", "Promoción creada")
      onDone()
      router.refresh()
    })
  }

  return (
    <div className="p-4 mb-3 bg-orange/5 rounded-md" style={{ border: "1.5px dashed #FF3B27" }}>
      <div className="grid grid-cols-5 gap-2 mb-2">
        <input
          type="text"
          placeholder="CÓDIGO *"
          value={form.code}
          onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
          className="col-span-2 px-3 py-2 bg-cream rounded-md text-[12px] font-mono font-bold focus:outline-none"
          style={{ border: "1.5px solid var(--border)" }}
        />
        <select
          value={form.type}
          onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as typeof f.type }))}
          className="px-3 py-2 bg-cream rounded-md text-[12px] focus:outline-none"
          style={{ border: "1.5px solid var(--border)" }}
        >
          <option value="percentage">%</option>
          <option value="fixed">€ fijo</option>
        </select>
        <input
          type="number"
          min={0}
          step={form.type === "percentage" ? 1 : 0.01}
          value={form.value}
          onChange={(e) => setForm((f) => ({ ...f, value: Number(e.target.value) }))}
          className="px-3 py-2 bg-cream rounded-md text-[12px] font-mono num text-right focus:outline-none"
          style={{ border: "1.5px solid var(--border)" }}
        />
        <select
          value={form.target_type}
          onChange={(e) => setForm((f) => ({ ...f, target_type: e.target.value as typeof f.target_type }))}
          className="px-3 py-2 bg-cream rounded-md text-[12px] focus:outline-none"
          style={{ border: "1.5px solid var(--border)" }}
        >
          <option value="order">Orden</option>
          <option value="items">Items</option>
          <option value="shipping_methods">Envío</option>
        </select>
      </div>
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-1.5 text-[11px] cursor-pointer">
          <input
            type="checkbox"
            checked={form.is_automatic}
            onChange={(e) => setForm((f) => ({ ...f, is_automatic: e.target.checked }))}
          />
          Automática (no requiere código del cliente)
        </label>
        <div className="flex items-center gap-2">
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
            disabled={pending || !form.code.trim() || !(form.value > 0)}
            className="px-3 py-1.5 bg-secondary text-cream rounded-md text-[10px] font-display font-bold uppercase tracking-wider disabled:opacity-50"
            style={{ border: "1.5px solid #1A1A1A" }}
          >
            {pending ? "Creando…" : "Crear"}
          </button>
        </div>
      </div>
    </div>
  )
}

function PromoRowItem({
  row, editing, confirmDel, menuOpen, pending,
  onEdit, onCancel, onMenuToggle, onConfirmDel, onCancelDel,
  onSaved, onDeleted, onToggled, onError, startTransition,
}: {
  row: PromoRow
  editing: boolean
  confirmDel: boolean
  menuOpen: boolean
  pending: boolean
  onEdit: () => void
  onCancel: () => void
  onMenuToggle: () => void
  onConfirmDel: () => void
  onCancelDel: () => void
  onSaved: () => void
  onDeleted: () => void
  onToggled: (s: "active" | "inactive") => void
  onError: (msg: string) => void
  startTransition: (fn: () => void) => void
}) {
  const [form, setForm] = useState({ code: row.code, value: row.value, is_automatic: row.is_automatic })

  function save() {
    startTransition(async () => {
      const res = await updatePromotionCodeAction(row.id, form)
      if (!res.ok) return onError(res.error)
      onSaved()
    })
  }

  function toggle() {
    const next = row.status === "active" ? "inactive" : "active"
    startTransition(async () => {
      const res = await togglePromotionAction(row.id, next)
      if (!res.ok) return onError(res.error)
      onToggled(next)
    })
  }

  function del() {
    startTransition(async () => {
      const res = await deletePromotionAction(row.id)
      if (!res.ok) return onError(res.error)
      onDeleted()
    })
  }

  const isPercentage = row.type === "percentage"
  const isHigh = isPercentage && row.value >= 25

  if (editing) {
    return (
      <div className="p-4 bg-orange/5 flex items-center gap-3">
        <input
          type="text"
          value={form.code}
          onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
          className="w-32 px-2 py-1 bg-cream rounded-md text-[12px] font-mono font-bold focus:outline-none"
          style={{ border: "1.5px solid var(--border)" }}
        />
        <input
          type="number"
          min={0}
          step={isPercentage ? 1 : 0.01}
          value={form.value}
          onChange={(e) => setForm((f) => ({ ...f, value: Number(e.target.value) }))}
          className="w-20 px-2 py-1 bg-cream rounded-md text-[12px] font-mono num text-right focus:outline-none"
          style={{ border: "1.5px solid var(--border)" }}
        />
        <span className="text-[11px] font-mono text-ink-3">{isPercentage ? "%" : "€"}</span>
        <label className="flex items-center gap-1 text-[11px] cursor-pointer ml-auto">
          <input
            type="checkbox"
            checked={form.is_automatic}
            onChange={(e) => setForm((f) => ({ ...f, is_automatic: e.target.checked }))}
          />
          Auto
        </label>
        <button onClick={save} disabled={pending} className="text-secondary p-1 disabled:opacity-50" title="Guardar">
          <Check size={14} strokeWidth={3} />
        </button>
        <button onClick={onCancel} disabled={pending} className="text-ink-3 hover:text-primary p-1 disabled:opacity-50" title="Cancelar">
          <X size={14} strokeWidth={3} />
        </button>
      </div>
    )
  }

  return (
    <div className="p-4 row-hover flex items-center gap-4 relative">
      <div
        className={`w-12 h-12 flex items-center justify-center font-display font-black text-[14px] flex-shrink-0 ${
          isHigh ? "bg-orange text-dark" : "bg-secondary text-cream"
        } ${row.status !== "active" ? "opacity-40" : ""}`}
        style={{ border: "2px solid #1A1A1A", boxShadow: "2px 2px 0 0 var(--shadow-color)" }}
      >
        {isPercentage ? `${row.value}%` : `€${row.value}`}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`font-mono font-bold text-ink text-[13px] ${row.status !== "active" ? "opacity-50" : ""}`}>{row.code}</span>
          <span className={`pill ${row.status === "active" ? "text-secondary" : "text-ink-3"}`}>
            <span className="pill-dot" />
            {row.is_automatic ? "Auto" : row.status === "active" ? "Manual" : row.status}
          </span>
        </div>
        <div className="text-[10px] text-ink-3 font-mono mt-0.5 truncate">{row.ruleSummary}</div>
      </div>

      {confirmDel ? (
        <div className="flex items-center gap-1">
          <button onClick={del} disabled={pending} className="px-2 py-1 bg-primary text-white text-[10px] font-display font-bold uppercase tracking-wider rounded-md disabled:opacity-50">
            Confirmar
          </button>
          <button onClick={onCancelDel} disabled={pending} className="text-ink-3 px-1 disabled:opacity-50">
            <X size={14} />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-1">
          <button onClick={toggle} disabled={pending} className={`p-1.5 rounded-md disabled:opacity-50 ${row.status === "active" ? "text-secondary hover:bg-secondary/10" : "text-ink-3 hover:bg-cream-2"}`} title={row.status === "active" ? "Desactivar" : "Activar"}>
            <Power size={13} strokeWidth={2.4} />
          </button>
          <button onClick={onMenuToggle} className="text-ink-3 hover:text-ink p-1.5">
            <MoreHorizontal size={16} />
          </button>
          {menuOpen && (
            <div className="absolute right-3 top-12 z-20 bg-page rounded-md py-1 min-w-[140px]" style={{ border: "1.5px solid var(--border)", boxShadow: "3px 3px 0 0 var(--shadow-color)" }}>
              <button onClick={onEdit} className="w-full text-left px-3 py-2 text-[11px] hover:bg-cream-2 flex items-center gap-2 font-display font-bold uppercase tracking-wider">
                <Pencil size={11} /> Editar
              </button>
              <button onClick={onConfirmDel} className="w-full text-left px-3 py-2 text-[11px] hover:bg-primary/10 text-primary flex items-center gap-2 font-display font-bold uppercase tracking-wider">
                <Trash2 size={11} /> Eliminar
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
