"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Plus, Pencil, Trash2, Check, X, Power, Network, AlertCircle, CheckCircle2 } from "lucide-react"
import {
  createSalesChannelAction, updateSalesChannelAction, deleteSalesChannelAction,
} from "./actions"

interface ChannelRow {
  id: string
  name: string
  description: string
  is_disabled: boolean
}

type Toast = { kind: "ok" | "err"; msg: string } | null

export function SalesChannelsManager({ rows }: { rows: ChannelRow[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState({ name: "", description: "" })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [confirmDelId, setConfirmDelId] = useState<string | null>(null)
  const [toast, setToast] = useState<Toast>(null)

  function flash(kind: "ok" | "err", msg: string) {
    setToast({ kind, msg })
    setTimeout(() => setToast(null), 4000)
  }

  function create() {
    startTransition(async () => {
      const res = await createSalesChannelAction(draft)
      if (!res.ok) return flash("err", res.error)
      flash("ok", "Sales channel creado")
      setDraft({ name: "", description: "" })
      setCreating(false)
      router.refresh()
    })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-[12px] text-ink-3 font-mono">
          {rows.length} channel{rows.length === 1 ? "" : "s"} · {rows.filter((r) => !r.is_disabled).length} activo{rows.filter((r) => !r.is_disabled).length === 1 ? "" : "s"}
        </p>
        <button
          type="button"
          onClick={() => setCreating(!creating)}
          className="flex items-center gap-1.5 px-3 py-2 bg-orange text-dark rounded-md text-[10px] font-display font-bold uppercase tracking-wider transition-all hover:translate-x-[2px] hover:translate-y-[2px]"
          style={{ border: "2px solid #1A1A1A", boxShadow: "4px 4px 0 0 var(--shadow-color)" }}
        >
          <Plus size={11} strokeWidth={3} /> Nuevo
        </button>
      </div>

      {creating && (
        <div className="stamp-card p-4 mb-4 bg-orange/5">
          <div className="grid grid-cols-2 gap-2">
            <input type="text" placeholder="Nombre *" value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} className="px-3 py-2 bg-cream rounded-md text-[12px] focus:outline-none" style={{ border: "1.5px solid var(--border)" }} />
            <input type="text" placeholder="Descripción" value={draft.description} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} className="px-3 py-2 bg-cream rounded-md text-[12px] focus:outline-none" style={{ border: "1.5px solid var(--border)" }} />
          </div>
          <div className="flex items-center justify-end gap-2 mt-3">
            <button type="button" onClick={() => { setCreating(false); setDraft({ name: "", description: "" }) }} disabled={pending} className="px-3 py-1.5 bg-cream rounded-md text-[10px] font-display font-bold uppercase tracking-wider text-ink hover:bg-cream-2 disabled:opacity-50" style={{ border: "1.5px solid var(--border)" }}>
              Cancelar
            </button>
            <button type="button" onClick={create} disabled={pending || !draft.name.trim()} className="px-3 py-1.5 bg-secondary text-cream rounded-md text-[10px] font-display font-bold uppercase tracking-wider disabled:opacity-50" style={{ border: "1.5px solid #1A1A1A" }}>
              {pending ? "Creando…" : "Crear"}
            </button>
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="stamp-card p-10 text-center">
          <p className="font-display font-bold text-[14px] uppercase tracking-wider text-ink-3">
            Sin sales channels todavía
          </p>
          <p className="text-[12px] text-ink-3 mt-1">Necesitas al menos uno para vender. El default suele ser "Default Sales Channel".</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {rows.map((r) => (
            <ChannelCard
              key={r.id}
              row={r}
              editing={editingId === r.id}
              confirmDel={confirmDelId === r.id}
              pending={pending}
              onEdit={() => setEditingId(r.id)}
              onCancel={() => setEditingId(null)}
              onConfirmDel={() => setConfirmDelId(r.id)}
              onCancelDel={() => setConfirmDelId(null)}
              onSaved={() => { setEditingId(null); flash("ok", "Channel actualizado"); router.refresh() }}
              onDeleted={() => { setConfirmDelId(null); flash("ok", "Channel eliminado"); router.refresh() }}
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

function ChannelCard({
  row, editing, confirmDel, pending,
  onEdit, onCancel, onConfirmDel, onCancelDel,
  onSaved, onDeleted, onError, startTransition,
}: {
  row: ChannelRow
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
  const [form, setForm] = useState({ name: row.name, description: row.description })

  function save() {
    startTransition(async () => {
      const patch: Parameters<typeof updateSalesChannelAction>[1] = {}
      if (form.name !== row.name) patch.name = form.name
      if (form.description !== row.description) patch.description = form.description.trim() || null
      if (Object.keys(patch).length === 0) return onCancel()
      const res = await updateSalesChannelAction(row.id, patch)
      if (!res.ok) return onError(res.error)
      onSaved()
    })
  }

  function toggleDisabled() {
    startTransition(async () => {
      const res = await updateSalesChannelAction(row.id, { is_disabled: !row.is_disabled })
      if (!res.ok) return onError(res.error)
      onSaved()
    })
  }

  function del() {
    startTransition(async () => {
      const res = await deleteSalesChannelAction(row.id)
      if (!res.ok) return onError(res.error)
      onDeleted()
    })
  }

  if (editing) {
    return (
      <div className="stamp-card p-5 bg-orange/5">
        <input type="text" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="w-full px-3 py-2 bg-cream rounded-md text-[13px] font-display font-bold focus:outline-none mb-2" style={{ border: "1.5px solid var(--border)" }} />
        <textarea rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Descripción" className="w-full px-3 py-2 bg-cream rounded-md text-[12px] focus:outline-none resize-none" style={{ border: "1.5px solid var(--border)" }} />
        <div className="flex items-center justify-end gap-1 mt-2">
          <button onClick={onCancel} disabled={pending} className="text-ink-3 hover:text-primary p-1.5 disabled:opacity-50">
            <X size={14} strokeWidth={3} />
          </button>
          <button onClick={save} disabled={pending} className="px-3 py-1.5 bg-secondary text-cream rounded-md text-[10px] font-display font-bold uppercase tracking-wider disabled:opacity-50" style={{ border: "1.5px solid #1A1A1A" }}>
            <Check size={11} className="inline mr-1" /> Guardar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={`stamp-card p-5 ${row.is_disabled ? "opacity-60" : ""}`}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="w-9 h-9 bg-secondary text-cream flex items-center justify-center flex-shrink-0" style={{ border: "1.5px solid var(--border)" }}>
            <Network size={14} strokeWidth={2.4} />
          </div>
          <div className="min-w-0">
            <h3 className="font-display font-black text-[14px] uppercase tracking-wider truncate">{row.name}</h3>
            <p className="text-[10px] font-mono text-ink-3">
              {row.is_disabled ? "deshabilitado" : "activo"}
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
              <button onClick={toggleDisabled} disabled={pending} className={`p-1.5 rounded-md disabled:opacity-50 ${row.is_disabled ? "text-ink-3" : "text-secondary"}`} title={row.is_disabled ? "Activar" : "Deshabilitar"}>
                <Power size={13} strokeWidth={2.4} />
              </button>
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
      {row.description && <p className="text-[11px] text-ink-2">{row.description}</p>}
    </div>
  )
}
