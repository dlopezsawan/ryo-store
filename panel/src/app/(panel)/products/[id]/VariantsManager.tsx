"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Plus, Pencil, Trash2, Check, X, AlertCircle, CheckCircle2 } from "lucide-react"
import {
  updateVariantAction, updateVariantPricesAction,
  createVariantAction, deleteVariantAction,
} from "./actions"

interface VariantPrice {
  id?: string
  amount: number
  currency_code: string
}

export interface VariantRow {
  id: string
  title: string
  sku: string
  manage_inventory: boolean
  inventoryQuantity: number
  prices: VariantPrice[]
}

interface Props {
  productId: string
  variants: VariantRow[]
  /** Currencies del store — para mostrar columna por cada una y permitir editar precio */
  storeCurrencies: string[]
}

type Toast = { kind: "ok" | "err"; msg: string } | null

export function VariantsManager({ productId, variants, storeCurrencies }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [confirmDelId, setConfirmDelId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [toast, setToast] = useState<Toast>(null)

  function flash(k: "ok" | "err", m: string) {
    setToast({ kind: k, msg: m })
    setTimeout(() => setToast(null), 4000)
  }

  // Si el producto no tiene currencies declaradas, fallback a la unión de las
  // que ya existen en variantes — para que el editor sirva siempre.
  const currencies = storeCurrencies.length > 0
    ? storeCurrencies
    : Array.from(new Set(variants.flatMap((v) => v.prices.map((p) => p.currency_code))))
        .concat(["eur"])
        .filter((c, i, arr) => arr.indexOf(c) === i)

  return (
    <div className="stamp-card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 bg-dark text-cream">
        <h3 className="font-display font-black text-[14px] uppercase tracking-wider">Variantes</h3>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-orange font-mono num">
            {variants.length} variant{variants.length === 1 ? "e" : "es"}
          </span>
          <button
            type="button"
            onClick={() => setCreating(!creating)}
            className="flex items-center gap-1 px-2 py-1 bg-orange text-dark rounded-md text-[10px] font-display font-bold uppercase tracking-wider"
            style={{ border: "1.5px solid #1A1A1A" }}
          >
            <Plus size={11} strokeWidth={3} /> Nueva
          </button>
        </div>
      </div>

      {creating && (
        <CreateRow
          currencies={currencies}
          pending={pending}
          onCancel={() => setCreating(false)}
          onSubmit={(input) => {
            startTransition(async () => {
              const res = await createVariantAction(productId, input)
              if (!res.ok) return flash("err", res.error)
              flash("ok", "Variante creada")
              setCreating(false)
              router.refresh()
            })
          }}
        />
      )}

      {variants.length === 0 && !creating ? (
        <div className="p-10 text-center font-display font-bold text-[12px] uppercase tracking-wider text-ink-3">
          Sin variantes — crea una con el botón "Nueva"
        </div>
      ) : (
        <table className="w-full">
          <thead>
            <tr className="bg-cream-2 text-[10px] uppercase tracking-[0.12em]" style={{ borderBottom: "2px solid var(--border)" }}>
              <th className="px-3 py-2.5 text-left font-display font-bold text-ink-2">Variante</th>
              <th className="px-3 py-2.5 text-left font-display font-bold text-ink-2">SKU</th>
              <th className="px-3 py-2.5 text-right font-display font-bold text-ink-2">Stock</th>
              {currencies.map((c) => (
                <th key={c} className="px-3 py-2.5 text-right font-display font-bold text-ink-2">
                  {c.toUpperCase()}
                </th>
              ))}
              <th className="px-3 py-2.5 text-right font-display font-bold text-ink-2 w-32">Acción</th>
            </tr>
          </thead>
          <tbody className="text-[13px]">
            {variants.map((v) => (
              <Row
                key={v.id}
                productId={productId}
                v={v}
                currencies={currencies}
                editing={editingId === v.id}
                confirmDel={confirmDelId === v.id}
                pending={pending}
                onEdit={() => setEditingId(v.id)}
                onCancel={() => setEditingId(null)}
                onConfirmDel={() => setConfirmDelId(v.id)}
                onCancelDel={() => setConfirmDelId(null)}
                onSaved={() => { setEditingId(null); flash("ok", "Variante actualizada"); router.refresh() }}
                onDeleted={() => { setConfirmDelId(null); flash("ok", "Variante eliminada"); router.refresh() }}
                onError={(m) => flash("err", m)}
                startTransition={startTransition}
              />
            ))}
          </tbody>
        </table>
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

function Row({
  productId, v, currencies, editing, confirmDel, pending,
  onEdit, onCancel, onConfirmDel, onCancelDel,
  onSaved, onDeleted, onError, startTransition,
}: {
  productId: string
  v: VariantRow
  currencies: string[]
  editing: boolean
  confirmDel: boolean
  pending: boolean
  onEdit: () => void
  onCancel: () => void
  onConfirmDel: () => void
  onCancelDel: () => void
  onSaved: () => void
  onDeleted: () => void
  onError: (m: string) => void
  startTransition: (fn: () => void) => void
}) {
  const [form, setForm] = useState({
    title: v.title === "Default Title" ? "" : v.title,
    sku: v.sku,
    prices: Object.fromEntries(
      currencies.map((c) => [c, String(v.prices.find((p) => p.currency_code === c)?.amount ?? "")]),
    ) as Record<string, string>,
  })

  function save() {
    startTransition(async () => {
      // 1. Guardar campos base si cambiaron
      const baseChanged =
        form.title !== (v.title === "Default Title" ? "" : v.title) ||
        form.sku !== v.sku
      if (baseChanged) {
        const r = await updateVariantAction(productId, v.id, {
          title: form.title.trim() || undefined,
          sku: form.sku.trim() || null,
        })
        if (!r.ok) return onError(r.error)
      }

      // 2. Guardar precios si cambiaron
      const newPrices: VariantPrice[] = []
      for (const c of currencies) {
        const raw = form.prices[c]?.trim()
        const amount = Number(raw)
        if (!raw || !Number.isFinite(amount)) continue
        const existing = v.prices.find((p) => p.currency_code === c)
        // Si el precio existente es el mismo, no incluimos
        if (existing && existing.amount === amount) {
          newPrices.push({ id: existing.id, amount, currency_code: c })
          continue
        }
        newPrices.push({ id: existing?.id, amount, currency_code: c })
      }
      const pricesChanged =
        newPrices.length !== v.prices.length ||
        newPrices.some((p) => {
          const orig = v.prices.find((o) => o.currency_code === p.currency_code)
          return !orig || orig.amount !== p.amount
        })
      if (pricesChanged) {
        const r = await updateVariantPricesAction(productId, v.id, newPrices)
        if (!r.ok) return onError(r.error)
      }
      onSaved()
    })
  }

  function del() {
    startTransition(async () => {
      const r = await deleteVariantAction(productId, v.id)
      if (!r.ok) return onError(r.error)
      onDeleted()
    })
  }

  const stockClass =
    v.inventoryQuantity === 0 ? "text-primary" :
    v.inventoryQuantity < 10 ? "text-orange" : "text-secondary"

  if (editing) {
    return (
      <tr className="row-zebra border-b border-warm-200/50 last:border-b-0 bg-orange/5">
        <td className="px-3 py-2">
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="Título"
            className="w-full px-2 py-1 bg-cream rounded-md text-[12px] focus:outline-none"
            style={{ border: "1.5px solid var(--border)" }}
          />
        </td>
        <td className="px-3 py-2">
          <input
            type="text"
            value={form.sku}
            onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
            placeholder="SKU"
            className="w-full px-2 py-1 bg-cream rounded-md text-[12px] font-mono focus:outline-none"
            style={{ border: "1.5px solid var(--border)" }}
          />
        </td>
        <td className="px-3 py-2 text-right text-ink-3 num text-[11px]">{v.inventoryQuantity}</td>
        {currencies.map((c) => (
          <td key={c} className="px-2 py-2">
            <input
              type="number"
              min={0}
              step="0.01"
              value={form.prices[c]}
              onChange={(e) => setForm((f) => ({ ...f, prices: { ...f.prices, [c]: e.target.value } }))}
              placeholder="0"
              className="w-20 px-2 py-1 bg-cream rounded-md text-[11px] font-mono num text-right focus:outline-none"
              style={{ border: "1.5px solid var(--border)" }}
            />
          </td>
        ))}
        <td className="px-3 py-2 text-right">
          <div className="flex items-center justify-end gap-1">
            <button onClick={save} disabled={pending} className="text-secondary p-1 disabled:opacity-50" title="Guardar">
              <Check size={13} strokeWidth={3} />
            </button>
            <button onClick={onCancel} disabled={pending} className="text-ink-3 hover:text-primary p-1 disabled:opacity-50" title="Cancelar">
              <X size={13} strokeWidth={3} />
            </button>
          </div>
        </td>
      </tr>
    )
  }

  return (
    <tr className="row-zebra border-b border-warm-200/50 last:border-b-0">
      <td className="px-3 py-3 font-display font-bold text-ink">
        {v.title === "Default Title" ? "—" : v.title}
      </td>
      <td className="px-3 py-3 font-mono text-[11px] text-ink-3">{v.sku || "—"}</td>
      <td className={`px-3 py-3 text-right font-display font-bold num ${stockClass}`}>
        {v.inventoryQuantity}
      </td>
      {currencies.map((c) => {
        const price = v.prices.find((p) => p.currency_code === c)
        return (
          <td key={c} className="px-3 py-3 text-right font-display font-black num">
            {price ? price.amount.toFixed(2) : <span className="text-ink-3 font-mono text-[11px]">—</span>}
          </td>
        )
      })}
      <td className="px-3 py-3 text-right">
        {confirmDel ? (
          <div className="flex items-center justify-end gap-1">
            <button onClick={del} disabled={pending} className="px-2 py-0.5 bg-primary text-white text-[10px] font-display font-bold uppercase tracking-wider rounded-md disabled:opacity-50">
              Eliminar
            </button>
            <button onClick={onCancelDel} disabled={pending} className="text-ink-3 px-1 disabled:opacity-50">
              <X size={12} />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-end gap-1">
            <button onClick={onEdit} className="text-ink-3 hover:text-orange p-1" title="Editar">
              <Pencil size={11} strokeWidth={2.4} />
            </button>
            <button onClick={onConfirmDel} className="text-ink-3 hover:text-primary p-1" title="Eliminar">
              <Trash2 size={11} strokeWidth={2.4} />
            </button>
          </div>
        )}
      </td>
    </tr>
  )
}

function CreateRow({
  currencies, pending, onCancel, onSubmit,
}: {
  currencies: string[]
  pending: boolean
  onCancel: () => void
  onSubmit: (input: { title: string; sku: string; prices: Array<{ amount: number; currency_code: string }> }) => void
}) {
  const [form, setForm] = useState({
    title: "",
    sku: "",
    prices: Object.fromEntries(currencies.map((c) => [c, ""])) as Record<string, string>,
  })

  function go() {
    const prices: Array<{ amount: number; currency_code: string }> = []
    for (const c of currencies) {
      const raw = form.prices[c]?.trim()
      if (!raw) continue
      const n = Number(raw)
      if (Number.isFinite(n) && n > 0) prices.push({ amount: n, currency_code: c })
    }
    onSubmit({ title: form.title, sku: form.sku, prices })
  }

  return (
    <div className="bg-orange/5 p-3" style={{ borderBottom: "2px solid var(--border)" }}>
      <div className="flex items-end gap-2 flex-wrap">
        <div className="flex-1 min-w-[160px]">
          <label className="block text-[9px] font-display font-bold uppercase tracking-wider text-ink-2 mb-1">Título *</label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="ej. Talla M, Color Rojo, etc."
            className="w-full px-3 py-1.5 bg-cream rounded-md text-[12px] focus:outline-none"
            style={{ border: "1.5px solid var(--border)" }}
          />
        </div>
        <div className="w-32">
          <label className="block text-[9px] font-display font-bold uppercase tracking-wider text-ink-2 mb-1">SKU</label>
          <input
            type="text"
            value={form.sku}
            onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value.toUpperCase() }))}
            className="w-full px-3 py-1.5 bg-cream rounded-md text-[12px] font-mono focus:outline-none"
            style={{ border: "1.5px solid var(--border)" }}
          />
        </div>
        {currencies.map((c) => (
          <div key={c} className="w-24">
            <label className="block text-[9px] font-display font-bold uppercase tracking-wider text-ink-2 mb-1">{c.toUpperCase()}</label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={form.prices[c]}
              onChange={(e) => setForm((f) => ({ ...f, prices: { ...f.prices, [c]: e.target.value } }))}
              placeholder="0"
              className="w-full px-2 py-1.5 bg-cream rounded-md text-[11px] font-mono num text-right focus:outline-none"
              style={{ border: "1.5px solid var(--border)" }}
            />
          </div>
        ))}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="px-3 py-1.5 bg-cream rounded-md text-[10px] font-display font-bold uppercase tracking-wider text-ink hover:bg-cream-2 disabled:opacity-50"
            style={{ border: "1.5px solid var(--border)" }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={go}
            disabled={pending || !form.title.trim()}
            className="px-3 py-1.5 bg-secondary text-cream rounded-md text-[10px] font-display font-bold uppercase tracking-wider disabled:opacity-50"
            style={{ border: "1.5px solid #1A1A1A" }}
          >
            <Check size={11} className="inline mr-1" />
            Crear
          </button>
        </div>
      </div>
    </div>
  )
}
