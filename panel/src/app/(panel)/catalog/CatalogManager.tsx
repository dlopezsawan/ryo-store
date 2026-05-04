"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Plus, Pencil, Trash2, Check, X, AlertCircle, CheckCircle2 } from "lucide-react"
import {
  createCategoryAction, updateCategoryAction, deleteCategoryAction,
  createCollectionAction, updateCollectionAction, deleteCollectionAction,
} from "./actions"

interface CategoryRow {
  id: string
  name: string
  handle: string
  is_active: boolean
  description: string
}

interface CollectionRow {
  id: string
  title: string
  handle: string
}

interface Props {
  categories: CategoryRow[]
  collections: CollectionRow[]
}

type Tab = "categories" | "collections"
type Toast = { kind: "ok" | "err"; msg: string } | null

export function CatalogManager({ categories, collections }: Props) {
  const [tab, setTab] = useState<Tab>("categories")
  const [toast, setToast] = useState<Toast>(null)

  function flash(kind: "ok" | "err", msg: string) {
    setToast({ kind, msg })
    setTimeout(() => setToast(null), 4000)
  }

  return (
    <div>
      {/* Tabs */}
      <div className="flex items-center gap-1 mb-5">
        <TabButton active={tab === "categories"} onClick={() => setTab("categories")}>
          Categorías ({categories.length})
        </TabButton>
        <TabButton active={tab === "collections"} onClick={() => setTab("collections")}>
          Colecciones ({collections.length})
        </TabButton>
      </div>

      {tab === "categories" && <CategoriesPanel rows={categories} flash={flash} />}
      {tab === "collections" && <CollectionsPanel rows={collections} flash={flash} />}

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

function TabButton({
  active, onClick, children,
}: {
  active: boolean; onClick: () => void; children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2 font-display font-bold text-[11px] uppercase tracking-wider rounded-md transition-all ${
        active ? "bg-dark text-cream" : "bg-cream hover:bg-cream-2 text-ink-3"
      }`}
      style={{ border: "1.5px solid var(--border)" }}
    >
      {children}
    </button>
  )
}

// ─── Categories ─────────────────────────────────────────────────────

function CategoriesPanel({
  rows, flash,
}: {
  rows: CategoryRow[]; flash: (k: "ok" | "err", m: string) => void
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState({ name: "", handle: "", description: "" })

  function reset() { setDraft({ name: "", handle: "", description: "" }) }

  function create() {
    startTransition(async () => {
      const res = await createCategoryAction(draft)
      if (!res.ok) return flash("err", res.error)
      flash("ok", "Categoría creada")
      reset()
      setCreating(false)
      router.refresh()
    })
  }

  return (
    <div className="stamp-card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 bg-dark text-cream">
        <h3 className="font-display font-black text-[14px] uppercase tracking-wider">
          Categorías de producto
        </h3>
        <button
          type="button"
          onClick={() => setCreating(!creating)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-orange text-dark rounded-md text-[10px] font-display font-bold uppercase tracking-wider"
          style={{ border: "1.5px solid #1A1A1A" }}
        >
          <Plus size={11} strokeWidth={3} /> Nueva
        </button>
      </div>

      {creating && (
        <div className="p-4 bg-orange/5" style={{ borderBottom: "1.5px dashed var(--border)" }}>
          <div className="grid grid-cols-3 gap-2 mb-2">
            <input
              type="text"
              placeholder="Nombre *"
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              className="px-3 py-2 bg-cream rounded-md text-[12px] focus:outline-none"
              style={{ border: "1.5px solid var(--border)" }}
            />
            <input
              type="text"
              placeholder="handle-url (opcional)"
              value={draft.handle}
              onChange={(e) => setDraft((d) => ({ ...d, handle: e.target.value.toLowerCase().replace(/\s+/g, "-") }))}
              className="px-3 py-2 bg-cream rounded-md text-[12px] font-mono focus:outline-none"
              style={{ border: "1.5px solid var(--border)" }}
            />
            <input
              type="text"
              placeholder="Descripción (opcional)"
              value={draft.description}
              onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
              className="px-3 py-2 bg-cream rounded-md text-[12px] focus:outline-none"
              style={{ border: "1.5px solid var(--border)" }}
            />
          </div>
          <div className="flex items-center gap-2 justify-end">
            <button
              type="button"
              onClick={() => { setCreating(false); reset() }}
              disabled={pending}
              className="px-3 py-1.5 bg-cream rounded-md text-[10px] font-display font-bold uppercase tracking-wider text-ink hover:bg-cream-2"
              style={{ border: "1.5px solid var(--border)" }}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={create}
              disabled={pending || !draft.name.trim()}
              className="px-3 py-1.5 bg-secondary text-cream rounded-md text-[10px] font-display font-bold uppercase tracking-wider disabled:opacity-50"
              style={{ border: "1.5px solid #1A1A1A" }}
            >
              Crear
            </button>
          </div>
        </div>
      )}

      {rows.length === 0 && !creating ? (
        <div className="p-10 text-center text-[13px] text-ink-3">
          No hay categorías todavía. Crea la primera arriba.
        </div>
      ) : (
        <table className="w-full">
          <thead>
            <tr className="bg-cream-2 text-[10px] uppercase tracking-[0.12em]" style={{ borderBottom: "2px solid var(--border)" }}>
              <th className="px-3 py-2.5 text-left font-display font-bold text-ink-2">Nombre</th>
              <th className="px-3 py-2.5 text-left font-display font-bold text-ink-2">Handle</th>
              <th className="px-3 py-2.5 text-left font-display font-bold text-ink-2">Estado</th>
              <th className="px-3 py-2.5 text-right font-display font-bold text-ink-2 w-32">Acción</th>
            </tr>
          </thead>
          <tbody className="text-[13px]">
            {rows.map((c) => (
              <CategoryRow
                key={c.id}
                row={c}
                editing={editingId === c.id}
                pending={pending}
                onEdit={() => setEditingId(c.id)}
                onCancel={() => setEditingId(null)}
                onSaved={() => { setEditingId(null); flash("ok", "Categoría actualizada"); router.refresh() }}
                onDeleted={() => { flash("ok", "Categoría eliminada"); router.refresh() }}
                onError={(m) => flash("err", m)}
                startTransition={startTransition}
              />
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

function CategoryRow({
  row, editing, pending, onEdit, onCancel, onSaved, onDeleted, onError, startTransition,
}: {
  row: CategoryRow
  editing: boolean
  pending: boolean
  onEdit: () => void
  onCancel: () => void
  onSaved: () => void
  onDeleted: () => void
  onError: (msg: string) => void
  startTransition: (fn: () => void) => void
}) {
  const [form, setForm] = useState({ name: row.name, handle: row.handle, is_active: row.is_active })
  const [confirmDel, setConfirmDel] = useState(false)

  function save() {
    startTransition(async () => {
      const res = await updateCategoryAction(row.id, form)
      if (!res.ok) return onError(res.error)
      onSaved()
    })
  }

  function del() {
    startTransition(async () => {
      const res = await deleteCategoryAction(row.id)
      if (!res.ok) return onError(res.error)
      onDeleted()
    })
  }

  if (editing) {
    return (
      <tr className="border-b border-warm-200/50 last:border-b-0 bg-orange/5">
        <td className="px-3 py-3">
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="w-full px-2 py-1 bg-cream rounded-md text-[12px] focus:outline-none"
            style={{ border: "1.5px solid var(--border)" }}
          />
        </td>
        <td className="px-3 py-3">
          <input
            type="text"
            value={form.handle}
            onChange={(e) => setForm((f) => ({ ...f, handle: e.target.value.toLowerCase().replace(/\s+/g, "-") }))}
            className="w-full px-2 py-1 bg-cream rounded-md text-[12px] font-mono focus:outline-none"
            style={{ border: "1.5px solid var(--border)" }}
          />
        </td>
        <td className="px-3 py-3">
          <label className="flex items-center gap-1.5 text-[11px] cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
            />
            Activa
          </label>
        </td>
        <td className="px-3 py-3 text-right">
          <div className="flex items-center justify-end gap-1">
            <button onClick={save} disabled={pending} className="text-secondary p-1 disabled:opacity-50" title="Guardar">
              <Check size={14} strokeWidth={3} />
            </button>
            <button onClick={onCancel} disabled={pending} className="text-ink-3 hover:text-primary p-1 disabled:opacity-50" title="Cancelar">
              <X size={14} strokeWidth={3} />
            </button>
          </div>
        </td>
      </tr>
    )
  }

  return (
    <tr className="row-zebra row-hover border-b border-warm-200/50 last:border-b-0">
      <td className="px-3 py-3 font-display font-bold text-ink">{row.name}</td>
      <td className="px-3 py-3 font-mono text-[11px] text-ink-3">/{row.handle}</td>
      <td className="px-3 py-3">
        {row.is_active ? (
          <span className="pill text-secondary"><span className="pill-dot" />Activa</span>
        ) : (
          <span className="pill text-ink-3"><span className="pill-dot" />Inactiva</span>
        )}
      </td>
      <td className="px-3 py-3 text-right">
        {confirmDel ? (
          <div className="flex items-center justify-end gap-1">
            <button onClick={del} disabled={pending} className="px-2 py-0.5 bg-primary text-white text-[10px] font-display font-bold uppercase tracking-wider rounded-md disabled:opacity-50">
              Confirmar
            </button>
            <button onClick={() => setConfirmDel(false)} disabled={pending} className="text-ink-3 px-1 disabled:opacity-50">
              <X size={14} />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-end gap-1">
            <button onClick={onEdit} className="text-ink-3 hover:text-orange p-1" title="Editar">
              <Pencil size={11} strokeWidth={2.4} />
            </button>
            <button onClick={() => setConfirmDel(true)} className="text-ink-3 hover:text-primary p-1" title="Eliminar">
              <Trash2 size={11} strokeWidth={2.4} />
            </button>
          </div>
        )}
      </td>
    </tr>
  )
}

// ─── Collections ────────────────────────────────────────────────────

function CollectionsPanel({
  rows, flash,
}: {
  rows: CollectionRow[]; flash: (k: "ok" | "err", m: string) => void
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState({ title: "", handle: "" })

  function create() {
    startTransition(async () => {
      const res = await createCollectionAction(draft)
      if (!res.ok) return flash("err", res.error)
      flash("ok", "Colección creada")
      setDraft({ title: "", handle: "" })
      setCreating(false)
      router.refresh()
    })
  }

  return (
    <div className="stamp-card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 bg-dark text-cream">
        <h3 className="font-display font-black text-[14px] uppercase tracking-wider">
          Colecciones
        </h3>
        <button
          type="button"
          onClick={() => setCreating(!creating)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-orange text-dark rounded-md text-[10px] font-display font-bold uppercase tracking-wider"
          style={{ border: "1.5px solid #1A1A1A" }}
        >
          <Plus size={11} strokeWidth={3} /> Nueva
        </button>
      </div>

      {creating && (
        <div className="p-4 bg-orange/5" style={{ borderBottom: "1.5px dashed var(--border)" }}>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <input
              type="text"
              placeholder="Título *"
              value={draft.title}
              onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
              className="px-3 py-2 bg-cream rounded-md text-[12px] focus:outline-none"
              style={{ border: "1.5px solid var(--border)" }}
            />
            <input
              type="text"
              placeholder="handle-url (opcional)"
              value={draft.handle}
              onChange={(e) => setDraft((d) => ({ ...d, handle: e.target.value.toLowerCase().replace(/\s+/g, "-") }))}
              className="px-3 py-2 bg-cream rounded-md text-[12px] font-mono focus:outline-none"
              style={{ border: "1.5px solid var(--border)" }}
            />
          </div>
          <div className="flex items-center gap-2 justify-end">
            <button
              type="button"
              onClick={() => { setCreating(false); setDraft({ title: "", handle: "" }) }}
              disabled={pending}
              className="px-3 py-1.5 bg-cream rounded-md text-[10px] font-display font-bold uppercase tracking-wider text-ink hover:bg-cream-2"
              style={{ border: "1.5px solid var(--border)" }}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={create}
              disabled={pending || !draft.title.trim()}
              className="px-3 py-1.5 bg-secondary text-cream rounded-md text-[10px] font-display font-bold uppercase tracking-wider disabled:opacity-50"
              style={{ border: "1.5px solid #1A1A1A" }}
            >
              Crear
            </button>
          </div>
        </div>
      )}

      {rows.length === 0 && !creating ? (
        <div className="p-10 text-center text-[13px] text-ink-3">
          No hay colecciones todavía.
        </div>
      ) : (
        <table className="w-full">
          <thead>
            <tr className="bg-cream-2 text-[10px] uppercase tracking-[0.12em]" style={{ borderBottom: "2px solid var(--border)" }}>
              <th className="px-3 py-2.5 text-left font-display font-bold text-ink-2">Título</th>
              <th className="px-3 py-2.5 text-left font-display font-bold text-ink-2">Handle</th>
              <th className="px-3 py-2.5 text-right font-display font-bold text-ink-2 w-32">Acción</th>
            </tr>
          </thead>
          <tbody className="text-[13px]">
            {rows.map((c) => (
              <CollectionRow
                key={c.id}
                row={c}
                editing={editingId === c.id}
                pending={pending}
                onEdit={() => setEditingId(c.id)}
                onCancel={() => setEditingId(null)}
                onSaved={() => { setEditingId(null); flash("ok", "Colección actualizada"); router.refresh() }}
                onDeleted={() => { flash("ok", "Colección eliminada"); router.refresh() }}
                onError={(m) => flash("err", m)}
                startTransition={startTransition}
              />
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

function CollectionRow({
  row, editing, pending, onEdit, onCancel, onSaved, onDeleted, onError, startTransition,
}: {
  row: CollectionRow
  editing: boolean
  pending: boolean
  onEdit: () => void
  onCancel: () => void
  onSaved: () => void
  onDeleted: () => void
  onError: (msg: string) => void
  startTransition: (fn: () => void) => void
}) {
  const [form, setForm] = useState({ title: row.title, handle: row.handle })
  const [confirmDel, setConfirmDel] = useState(false)

  function save() {
    startTransition(async () => {
      const res = await updateCollectionAction(row.id, form)
      if (!res.ok) return onError(res.error)
      onSaved()
    })
  }

  function del() {
    startTransition(async () => {
      const res = await deleteCollectionAction(row.id)
      if (!res.ok) return onError(res.error)
      onDeleted()
    })
  }

  if (editing) {
    return (
      <tr className="border-b border-warm-200/50 last:border-b-0 bg-orange/5">
        <td className="px-3 py-3">
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            className="w-full px-2 py-1 bg-cream rounded-md text-[12px] focus:outline-none"
            style={{ border: "1.5px solid var(--border)" }}
          />
        </td>
        <td className="px-3 py-3">
          <input
            type="text"
            value={form.handle}
            onChange={(e) => setForm((f) => ({ ...f, handle: e.target.value.toLowerCase().replace(/\s+/g, "-") }))}
            className="w-full px-2 py-1 bg-cream rounded-md text-[12px] font-mono focus:outline-none"
            style={{ border: "1.5px solid var(--border)" }}
          />
        </td>
        <td className="px-3 py-3 text-right">
          <div className="flex items-center justify-end gap-1">
            <button onClick={save} disabled={pending} className="text-secondary p-1 disabled:opacity-50" title="Guardar">
              <Check size={14} strokeWidth={3} />
            </button>
            <button onClick={onCancel} disabled={pending} className="text-ink-3 hover:text-primary p-1 disabled:opacity-50" title="Cancelar">
              <X size={14} strokeWidth={3} />
            </button>
          </div>
        </td>
      </tr>
    )
  }

  return (
    <tr className="row-zebra row-hover border-b border-warm-200/50 last:border-b-0">
      <td className="px-3 py-3 font-display font-bold text-ink">{row.title}</td>
      <td className="px-3 py-3 font-mono text-[11px] text-ink-3">/{row.handle}</td>
      <td className="px-3 py-3 text-right">
        {confirmDel ? (
          <div className="flex items-center justify-end gap-1">
            <button onClick={del} disabled={pending} className="px-2 py-0.5 bg-primary text-white text-[10px] font-display font-bold uppercase tracking-wider rounded-md disabled:opacity-50">
              Confirmar
            </button>
            <button onClick={() => setConfirmDel(false)} disabled={pending} className="text-ink-3 px-1 disabled:opacity-50">
              <X size={14} />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-end gap-1">
            <button onClick={onEdit} className="text-ink-3 hover:text-orange p-1" title="Editar">
              <Pencil size={11} strokeWidth={2.4} />
            </button>
            <button onClick={() => setConfirmDel(true)} className="text-ink-3 hover:text-primary p-1" title="Eliminar">
              <Trash2 size={11} strokeWidth={2.4} />
            </button>
          </div>
        )}
      </td>
    </tr>
  )
}
