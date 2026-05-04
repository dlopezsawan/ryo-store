"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  Plus, Trash2, Edit2, Check, X, ExternalLink,
  AlertCircle, CheckCircle2, FileDown,
} from "lucide-react"
import { fmtRelative } from "@/lib/utils"
import { createExpenseAction, updateExpenseAction, deleteExpenseAction } from "../actions"
import type { FinanzasExpense, FinanzasExpenseCategory, FinanzasWallet } from "@/lib/medusa"

type Toast = { kind: "ok" | "err"; msg: string } | null

const BUCKET_COLORS: Record<string, string> = {
  restock: "#FF3B27",
  gastos_fijos: "#BB3B2E",
  marketing: "#D4A015",
  ganancia: "#4D5431",
}

interface Props {
  expenses: FinanzasExpense[]
  categories: FinanzasExpenseCategory[]
  wallets: FinanzasWallet[]
  currentFilter: { status?: string; category_id?: string }
}

export function ExpensesClient({ expenses, categories, wallets, currentFilter }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [toast, setToast] = useState<Toast>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  function flash(k: "ok" | "err", m: string) {
    setToast({ kind: k, msg: m })
    setTimeout(() => setToast(null), 4000)
  }

  function deleteExpense(id: string, description: string) {
    startTransition(async () => {
      const res = await deleteExpenseAction(id)
      if (!res.ok) return flash("err", res.error)
      flash("ok", `Gasto "${description.slice(0, 30)}" eliminado`)
      setConfirmDelete(null)
      router.refresh()
    })
  }

  function togglePaid(e: FinanzasExpense) {
    startTransition(async () => {
      const newStatus: "paid" | "pending_payment" = e.status === "paid" ? "pending_payment" : "paid"
      const res = await updateExpenseAction(e.id, { status: newStatus })
      if (!res.ok) return flash("err", res.error)
      flash("ok", `Gasto marcado como ${newStatus === "paid" ? "pagado" : "pendiente"}`)
      router.refresh()
    })
  }

  // Categories lookup by id
  const catById = new Map(categories.map((c) => [c.id, c]))
  const usdtWallets = wallets.filter((w) => w.currency === "usdt" && w.is_active)

  return (
    <>
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={() => setShowCreate(!showCreate)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-[10px] font-display font-bold uppercase tracking-wider transition-all ${
            showCreate ? "bg-cream text-ink" : "bg-orange text-dark hover:translate-x-[1px] hover:translate-y-[1px]"
          }`}
          style={{ border: "2px solid #1A1A1A", boxShadow: showCreate ? "none" : "3px 3px 0 0 var(--shadow-color)" }}>
          {showCreate ? <X size={11} strokeWidth={2.5} /> : <Plus size={11} strokeWidth={3} />}
          {showCreate ? "Cancelar" : "Nuevo gasto"}
        </button>

        <div className="flex-1" />

        {/* Filters */}
        <div className="flex items-center gap-1">
          <FilterChip label="Todos" active={!currentFilter.status} href="/finanzas/expenses" />
          <FilterChip label="Pagados" active={currentFilter.status === "paid"} href="/finanzas/expenses?status=paid" />
          <FilterChip label="Pendientes" active={currentFilter.status === "pending_payment"} href="/finanzas/expenses?status=pending_payment" tone="orange" />
        </div>

        <select
          value={currentFilter.category_id ?? ""}
          onChange={(e) => {
            const sp = new URLSearchParams()
            if (currentFilter.status) sp.set("status", currentFilter.status)
            if (e.target.value) sp.set("category_id", e.target.value)
            router.push(`/finanzas/expenses${sp.toString() ? `?${sp}` : ""}`)
          }}
          className="px-2 py-2 bg-cream rounded-md text-[10px] font-display font-bold uppercase tracking-wider focus:outline-none"
          style={{ border: "1.5px solid var(--border)" }}>
          <option value="">Todas categorías</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* Create form (inline expandible) */}
      {showCreate && (
        <ExpenseForm
          mode="create"
          categories={categories}
          wallets={usdtWallets}
          onSubmit={(form) => {
            startTransition(async () => {
              const res = await createExpenseAction(form)
              if (!res.ok) return flash("err", res.error)
              flash("ok", "Gasto registrado")
              setShowCreate(false)
              router.refresh()
            })
          }}
          onCancel={() => setShowCreate(false)}
          pending={pending}
        />
      )}

      {/* Empty state */}
      {expenses.length === 0 && !showCreate && (
        <div className="stamp-card p-10 text-center">
          <FileDown size={48} className="text-ink-3 mx-auto mb-3" strokeWidth={1.5} />
          <p className="font-display font-bold text-[14px] uppercase tracking-wider text-ink-3">Sin gastos en este filtro</p>
          <p className="text-[12px] text-ink-3 mt-1">Empieza añadiendo el primero con el botón de arriba.</p>
        </div>
      )}

      {/* Expenses table */}
      {expenses.length > 0 && (
        <div className="stamp-card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 bg-dark text-cream">
            <h3 className="font-display font-black text-[14px] uppercase tracking-wider">Lista de gastos</h3>
            <span className="text-[10px] font-mono text-cream/60">{expenses.length} registro{expenses.length === 1 ? "" : "s"}</span>
          </div>
          <table className="w-full text-[12px]">
            <thead>
              <tr className="bg-cream-2 text-[10px] uppercase tracking-[0.12em]" style={{ borderBottom: "2px solid var(--border)" }}>
                <th className="px-3 py-2 text-left font-display font-bold text-ink-2">Fecha</th>
                <th className="px-3 py-2 text-left font-display font-bold text-ink-2">Categoría</th>
                <th className="px-3 py-2 text-left font-display font-bold text-ink-2">Descripción</th>
                <th className="px-3 py-2 text-right font-display font-bold text-ink-2">USDT</th>
                <th className="px-3 py-2 text-right font-display font-bold text-ink-2">Bs</th>
                <th className="px-3 py-2 text-center font-display font-bold text-ink-2">Estado</th>
                <th className="px-3 py-2 text-right font-display font-bold text-ink-2">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((e) => {
                const cat = e.category_id ? catById.get(e.category_id) : null
                const bucketColor = cat ? BUCKET_COLORS[cat.bucket] ?? "#9C9285" : "#9C9285"
                const isEditing = editingId === e.id
                const isConfirmingDelete = confirmDelete === e.id
                return (
                  <tr key={e.id} className="row-zebra row-hover border-b border-warm-200/50 last:border-b-0">
                    <td className="px-3 py-2 font-mono text-[10px] text-ink-3 num">
                      {new Date(e.expense_date).toLocaleDateString("es-VE", { day: "2-digit", month: "short" })}
                    </td>
                    <td className="px-3 py-2">
                      {cat ? (
                        <div className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: bucketColor }} />
                          <span className="font-display font-bold text-[11px] text-ink truncate">{cat.name}</span>
                        </div>
                      ) : (
                        <span className="text-ink-3 text-[11px] italic">sin categoría</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-ink truncate max-w-[280px]">
                      {e.description}
                      {e.notes && <span className="text-[10px] text-ink-3 font-mono"> · {e.notes}</span>}
                      {e.receipt_url && (
                        <a href={e.receipt_url} target="_blank" rel="noopener noreferrer"
                          className="text-orange hover:underline ml-1 inline-flex items-center text-[10px]">
                          <ExternalLink size={9} strokeWidth={2.5} />
                        </a>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right font-display font-bold num text-primary">
                      −${Number(e.amount_usdt).toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-[10px] text-ink-3 num">
                      {e.amount_bs ? Number(e.amount_bs).toLocaleString("es-VE", { maximumFractionDigits: 0 }) : "—"}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button onClick={() => togglePaid(e)} disabled={pending}
                        className={`px-2 py-0.5 text-[9px] font-display font-bold uppercase tracking-wider rounded-md disabled:opacity-50 ${
                          e.status === "paid"
                            ? "bg-secondary/15 text-secondary hover:bg-secondary/25"
                            : "bg-orange/15 text-orange hover:bg-orange/25"
                        }`}>
                        {e.status === "paid" ? "✓ pagado" : "⏳ pendiente"}
                      </button>
                    </td>
                    <td className="px-3 py-2 text-right">
                      {isConfirmingDelete ? (
                        <div className="flex items-center gap-1 justify-end">
                          <button onClick={() => deleteExpense(e.id, e.description)} disabled={pending}
                            className="px-1.5 py-0.5 bg-primary text-white text-[9px] font-display font-bold uppercase rounded-md disabled:opacity-50">
                            ✓ Eliminar
                          </button>
                          <button onClick={() => setConfirmDelete(null)} disabled={pending} className="text-ink-3 p-0.5">
                            <X size={11} />
                          </button>
                        </div>
                      ) : isEditing ? (
                        null
                      ) : (
                        <div className="flex items-center gap-0.5 justify-end opacity-50 group-hover:opacity-100">
                          <button onClick={() => setEditingId(e.id)} disabled={pending}
                            className="text-ink-3 hover:text-orange p-0.5" title="Editar">
                            <Edit2 size={11} strokeWidth={2.5} />
                          </button>
                          <button onClick={() => setConfirmDelete(e.id)} disabled={pending}
                            className="text-ink-3 hover:text-primary p-0.5" title="Eliminar">
                            <Trash2 size={11} strokeWidth={2.5} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="bg-cream-2/50">
                <td colSpan={3} className="px-3 py-2 text-right text-[10px] font-display font-bold uppercase tracking-wider text-ink-3">
                  TOTAL
                </td>
                <td className="px-3 py-2 text-right font-display font-black num text-primary text-[14px]">
                  −${expenses.reduce((s, e) => s + (Number(e.amount_usdt) || 0), 0).toFixed(2)}
                </td>
                <td colSpan={3} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Edit modal */}
      {editingId && (() => {
        const e = expenses.find((x) => x.id === editingId)
        if (!e) return null
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)" }} onClick={() => !pending && setEditingId(null)}>
            <div className="bg-page rounded-md max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto" style={{ border: "2.5px solid var(--border)", boxShadow: "5px 5px 0 0 var(--shadow-color)" }} onClick={(ev) => ev.stopPropagation()}>
              <h3 className="font-display font-black text-[18px] uppercase tracking-tight text-ink mb-4">Editar gasto</h3>
              <ExpenseForm
                mode="edit"
                expense={e}
                categories={categories}
                wallets={usdtWallets}
                onSubmit={(form) => {
                  startTransition(async () => {
                    const res = await updateExpenseAction(e.id, form)
                    if (!res.ok) return flash("err", res.error)
                    flash("ok", "Gasto actualizado")
                    setEditingId(null)
                    router.refresh()
                  })
                }}
                onCancel={() => setEditingId(null)}
                pending={pending}
              />
            </div>
          </div>
        )
      })()}

      {toast && (
        <div className="fixed bottom-6 right-6 z-[60] px-4 py-3 rounded-md flex items-center gap-2 text-[12px] font-medium animate-in fade-in slide-in-from-bottom-2"
          style={{ background: toast.kind === "ok" ? "#4D5431" : "#BB3B2E", color: "#fff", border: "2px solid #1A1A1A", boxShadow: "4px 4px 0 0 var(--shadow-color)", minWidth: 280, maxWidth: 480 }}>
          {toast.kind === "ok" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{toast.msg}</span>
        </div>
      )}
    </>
  )
}

interface ExpenseFormData {
  category_id: string
  description: string
  amount_usdt: number
  amount_bs?: number
  paid_from_wallet_id?: string
  receipt_url?: string
  expense_date: string
  notes?: string
  status: "paid" | "pending_payment"
}

function ExpenseForm({ mode, expense, categories, wallets, onSubmit, onCancel, pending }: {
  mode: "create" | "edit"
  expense?: FinanzasExpense
  categories: FinanzasExpenseCategory[]
  wallets: FinanzasWallet[]
  onSubmit: (form: ExpenseFormData) => void
  onCancel: () => void
  pending: boolean
}) {
  const today = new Date().toISOString().slice(0, 10)
  const [form, setForm] = useState<ExpenseFormData>({
    category_id: expense?.category_id ?? categories[0]?.id ?? "",
    description: expense?.description ?? "",
    amount_usdt: Number(expense?.amount_usdt) ?? 0,
    amount_bs: expense?.amount_bs ? Number(expense.amount_bs) : undefined,
    paid_from_wallet_id: expense?.paid_from_wallet_id ?? wallets[0]?.id,
    receipt_url: expense?.receipt_url ?? undefined,
    expense_date: expense?.expense_date ? expense.expense_date.slice(0, 10) : today,
    notes: expense?.notes ?? undefined,
    status: (expense?.status as "paid" | "pending_payment") ?? "paid",
  })

  // Group categories by bucket for visual organization
  const byBucket = new Map<string, FinanzasExpenseCategory[]>()
  for (const c of categories.filter((c) => c.is_active)) {
    const arr = byBucket.get(c.bucket) ?? []
    arr.push(c)
    byBucket.set(c.bucket, arr)
  }

  const isValid = form.category_id && form.description.trim() && form.amount_usdt > 0

  return (
    <div className={mode === "create" ? "stamp-card p-4 bg-orange/5" : ""} style={mode === "create" ? { borderColor: "#FF3B27" } : undefined}>
      {mode === "create" && (
        <h4 className="font-display font-black text-[12px] uppercase tracking-wider text-orange mb-3">Nuevo gasto</h4>
      )}

      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <Field label="Fecha *">
            <input type="date" value={form.expense_date} onChange={(e) => setForm((f) => ({ ...f, expense_date: e.target.value }))}
              className="w-full px-3 py-2 bg-cream rounded-md text-[12px] font-mono focus:outline-none" style={{ border: "1.5px solid var(--border)" }} />
          </Field>
          <Field label="Estado">
            <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as "paid" | "pending_payment" }))}
              className="w-full px-3 py-2 bg-cream rounded-md text-[12px] focus:outline-none" style={{ border: "1.5px solid var(--border)" }}>
              <option value="paid">Pagado (afecta wallet)</option>
              <option value="pending_payment">Pendiente</option>
            </select>
          </Field>
        </div>

        <Field label="Categoría * (bucket)">
          <select value={form.category_id} onChange={(e) => setForm((f) => ({ ...f, category_id: e.target.value }))}
            className="w-full px-3 py-2 bg-cream rounded-md text-[12px] focus:outline-none" style={{ border: "1.5px solid var(--border)" }}>
            <option value="">— elegir categoría —</option>
            {Array.from(byBucket.entries()).map(([bucket, cats]) => (
              <optgroup key={bucket} label={bucket.toUpperCase().replace("_", " ")}>
                {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </optgroup>
            ))}
          </select>
        </Field>

        <Field label="Descripción *">
          <input type="text" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="Ej: Hosting Hostinger Q1"
            className="w-full px-3 py-2 bg-cream rounded-md text-[12px] focus:outline-none" style={{ border: "1.5px solid var(--border)" }} />
        </Field>

        <div className="grid grid-cols-2 gap-2">
          <Field label="Monto USDT *">
            <input type="number" min={0} step="0.01" value={form.amount_usdt || ""}
              onChange={(e) => setForm((f) => ({ ...f, amount_usdt: Number(e.target.value) || 0 }))}
              className="w-full px-3 py-2 bg-cream rounded-md text-[12px] font-mono num text-right focus:outline-none" style={{ border: "1.5px solid var(--border)" }} />
          </Field>
          <Field label="Monto Bs (opcional)">
            <input type="number" min={0} step="0.01" value={form.amount_bs ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, amount_bs: e.target.value === "" ? undefined : Number(e.target.value) }))}
              className="w-full px-3 py-2 bg-cream rounded-md text-[12px] font-mono num text-right focus:outline-none" style={{ border: "1.5px solid var(--border)" }} />
          </Field>
        </div>

        {wallets.length > 0 && (
          <Field label="Wallet pagador">
            <select value={form.paid_from_wallet_id ?? ""} onChange={(e) => setForm((f) => ({ ...f, paid_from_wallet_id: e.target.value || undefined }))}
              className="w-full px-3 py-2 bg-cream rounded-md text-[12px] focus:outline-none" style={{ border: "1.5px solid var(--border)" }}>
              <option value="">Default (primary USDT)</option>
              {wallets.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </Field>
        )}

        <Field label="Recibo URL (opcional)">
          <input type="url" value={form.receipt_url ?? ""} onChange={(e) => setForm((f) => ({ ...f, receipt_url: e.target.value || undefined }))}
            placeholder="https://..."
            className="w-full px-3 py-2 bg-cream rounded-md text-[12px] font-mono focus:outline-none" style={{ border: "1.5px solid var(--border)" }} />
        </Field>

        <Field label="Notas (opcional)">
          <textarea rows={2} value={form.notes ?? ""} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value || undefined }))}
            className="w-full px-3 py-2 bg-cream rounded-md text-[12px] focus:outline-none resize-none" style={{ border: "1.5px solid var(--border)" }} />
        </Field>
      </div>

      <div className="flex items-center justify-end gap-2 mt-4">
        <button type="button" onClick={onCancel} disabled={pending}
          className="px-4 py-2 bg-cream rounded-md text-[11px] font-display font-bold uppercase tracking-wider text-ink hover:bg-cream-2 disabled:opacity-50" style={{ border: "1.5px solid var(--border)" }}>
          Cancelar
        </button>
        <button type="button" onClick={() => onSubmit(form)} disabled={pending || !isValid}
          className="px-4 py-2 bg-orange text-dark rounded-md text-[11px] font-display font-bold uppercase tracking-wider hover:translate-x-[2px] hover:translate-y-[2px] disabled:opacity-50 transition-all"
          style={{ border: "2px solid #1A1A1A", boxShadow: "4px 4px 0 0 var(--shadow-color)" }}>
          {pending ? "Guardando…" : mode === "create" ? "Registrar gasto" : "Guardar cambios"}
        </button>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] font-display font-bold uppercase tracking-[0.18em] text-ink-2 mb-1.5">{label}</label>
      {children}
    </div>
  )
}

function FilterChip({ label, active, href, tone }: { label: string; active: boolean; href: string; tone?: "orange" }) {
  const activeColor = tone === "orange" ? "bg-orange text-dark" : "bg-dark text-cream"
  return (
    <Link href={href}
      className={`px-2.5 py-1 text-[10px] font-display font-bold uppercase tracking-wider whitespace-nowrap rounded-md ${
        active ? activeColor : "text-ink-3 hover:bg-cream-2"
      }`}
      style={{ border: "1.5px solid var(--border)" }}>
      {label}
    </Link>
  )
}
