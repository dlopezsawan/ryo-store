"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Plus, Pencil, Trash2, Check, X, Users, AlertCircle, CheckCircle2 } from "lucide-react"
import { createGroupAction, updateGroupAction, deleteGroupAction } from "./actions"

interface GroupRow {
  id: string
  name: string
  memberCount: number
  createdAt: string
}

type Toast = { kind: "ok" | "err"; msg: string } | null

export function GroupsManager({ rows }: { rows: GroupRow[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [confirmDelId, setConfirmDelId] = useState<string | null>(null)
  const [draftName, setDraftName] = useState("")
  const [toast, setToast] = useState<Toast>(null)

  function flash(kind: "ok" | "err", msg: string) {
    setToast({ kind, msg })
    setTimeout(() => setToast(null), 4000)
  }

  function create() {
    startTransition(async () => {
      const res = await createGroupAction({ name: draftName })
      if (!res.ok) return flash("err", res.error)
      flash("ok", "Segmento creado")
      setDraftName("")
      setCreating(false)
      router.refresh()
    })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-[12px] text-ink-3 font-mono">
          {rows.length} segmento{rows.length === 1 ? "" : "s"} ·{" "}
          {rows.reduce((s, r) => s + r.memberCount, 0)} miembros totales
        </p>
        <button
          type="button"
          onClick={() => setCreating(!creating)}
          className="flex items-center gap-1.5 px-3 py-2 bg-orange text-dark rounded-md text-[10px] font-display font-bold uppercase tracking-wider transition-all hover:translate-x-[2px] hover:translate-y-[2px]"
          style={{ border: "2px solid #1A1A1A", boxShadow: "4px 4px 0 0 var(--shadow-color)" }}
        >
          <Plus size={11} strokeWidth={3} /> Nuevo segmento
        </button>
      </div>

      {creating && (
        <div className="stamp-card p-4 mb-4 bg-orange/5">
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Nombre del segmento (ej. VIP, Mayoristas)"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              autoFocus
              className="flex-1 px-3 py-2 bg-cream rounded-md text-[12px] focus:outline-none"
              style={{ border: "1.5px solid var(--border)" }}
            />
            <button
              type="button"
              onClick={() => { setCreating(false); setDraftName("") }}
              disabled={pending}
              className="px-3 py-2 bg-cream rounded-md text-[10px] font-display font-bold uppercase tracking-wider text-ink hover:bg-cream-2 disabled:opacity-50"
              style={{ border: "1.5px solid var(--border)" }}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={create}
              disabled={pending || !draftName.trim()}
              className="px-3 py-2 bg-secondary text-cream rounded-md text-[10px] font-display font-bold uppercase tracking-wider disabled:opacity-50"
              style={{ border: "1.5px solid #1A1A1A" }}
            >
              {pending ? "Creando…" : "Crear"}
            </button>
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="stamp-card p-10 text-center">
          <p className="font-display font-bold text-[14px] uppercase tracking-wider text-ink-3">
            Sin segmentos todavía
          </p>
          <p className="text-[12px] text-ink-3 mt-1">
            Los segmentos sirven para agrupar clientes (VIPs, mayoristas, etc.) y aplicarles promos específicas.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {rows.map((g) => (
            <GroupCard
              key={g.id}
              row={g}
              editing={editingId === g.id}
              confirmDel={confirmDelId === g.id}
              pending={pending}
              onEdit={() => setEditingId(g.id)}
              onCancel={() => setEditingId(null)}
              onConfirmDel={() => setConfirmDelId(g.id)}
              onCancelDel={() => setConfirmDelId(null)}
              onSaved={() => { setEditingId(null); flash("ok", "Segmento actualizado"); router.refresh() }}
              onDeleted={() => { setConfirmDelId(null); flash("ok", "Segmento eliminado"); router.refresh() }}
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

function GroupCard({
  row, editing, confirmDel, pending,
  onEdit, onCancel, onConfirmDel, onCancelDel,
  onSaved, onDeleted, onError, startTransition,
}: {
  row: GroupRow
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
  const [name, setName] = useState(row.name)

  function save() {
    startTransition(async () => {
      if (!name.trim() || name === row.name) return onCancel()
      const res = await updateGroupAction(row.id, { name: name.trim() })
      if (!res.ok) return onError(res.error)
      onSaved()
    })
  }

  function del() {
    startTransition(async () => {
      const res = await deleteGroupAction(row.id)
      if (!res.ok) return onError(res.error)
      onDeleted()
    })
  }

  return (
    <div className="stamp-card p-5">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="w-9 h-9 bg-secondary text-cream flex items-center justify-center flex-shrink-0" style={{ border: "1.5px solid var(--border)" }}>
            <Users size={14} strokeWidth={2.4} />
          </div>
          {editing ? (
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              className="flex-1 min-w-0 px-2 py-1 bg-cream rounded-md text-[13px] font-display font-bold focus:outline-none"
              style={{ border: "1.5px solid var(--border)" }}
            />
          ) : (
            <h3 className="font-display font-black text-[14px] uppercase tracking-wider truncate">{row.name}</h3>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {editing ? (
            <>
              <button onClick={save} disabled={pending} className="text-secondary p-1 disabled:opacity-50" title="Guardar">
                <Check size={12} strokeWidth={3} />
              </button>
              <button onClick={onCancel} disabled={pending} className="text-ink-3 p-1 disabled:opacity-50" title="Cancelar">
                <X size={12} strokeWidth={3} />
              </button>
            </>
          ) : confirmDel ? (
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

      <div className="flex items-baseline justify-between">
        <Link
          href={`/customers?group_id=${row.id}`}
          className="font-display font-black text-[24px] num text-ink hover:text-orange transition-colors"
        >
          {row.memberCount}
        </Link>
        <span className="text-[10px] font-display font-bold uppercase tracking-wider text-ink-3">
          miembro{row.memberCount === 1 ? "" : "s"}
        </span>
      </div>
    </div>
  )
}
