"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Plus, Pencil, Trash2, Check, X, AlertCircle, CheckCircle2 } from "lucide-react"
import { addLineItemAction, updateLineItemAction, deleteLineItemAction } from "./actions"

export interface LineItem {
  id: string
  title: string
  variantTitle: string | null
  sku: string | null
  thumbnail: string | null
  quantity: number
  unitPrice: number
  subtotal: number
  discountTotal: number
  comboCode: string | null
}

interface Props {
  orderId: string
  currency: string
  items: LineItem[]
  /** Si la orden ya está paid+shipped, deshabilitar edición. */
  locked?: boolean
}

type Toast = { kind: "ok" | "err"; msg: string } | null

export function LineItemsEditor({ orderId, currency, items, locked = false }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [confirmDelId, setConfirmDelId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [toast, setToast] = useState<Toast>(null)

  function flash(k: "ok" | "err", m: string) {
    setToast({ kind: k, msg: m })
    setTimeout(() => setToast(null), 4000)
  }

  return (
    <div className="stamp-card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 bg-dark text-cream">
        <h3 className="font-display font-black text-[14px] uppercase tracking-wider">Items del pedido</h3>
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-orange font-mono num">
            {items.length} producto{items.length === 1 ? "" : "s"} ·{" "}
            {items.reduce((s, i) => s + i.quantity, 0)} unidades
          </span>
          {!locked && (
            <button
              type="button"
              onClick={() => setAdding(!adding)}
              className="flex items-center gap-1 px-2 py-1 bg-orange text-dark rounded-md text-[10px] font-display font-bold uppercase tracking-wider"
              style={{ border: "1.5px solid #1A1A1A" }}
            >
              <Plus size={11} strokeWidth={3} /> Item
            </button>
          )}
        </div>
      </div>

      {adding && (
        <AddRow
          currency={currency}
          pending={pending}
          onCancel={() => setAdding(false)}
          onSubmit={(input) => {
            startTransition(async () => {
              const res = await addLineItemAction({ orderId, ...input })
              if (!res.ok) return flash("err", res.error)
              flash("ok", "Item añadido")
              setAdding(false)
              router.refresh()
            })
          }}
        />
      )}

      <table className="w-full">
        <tbody className="text-[13px]">
          {items.map((it, i) => (
            editingId === it.id ? (
              <EditRow
                key={it.id}
                item={it}
                currency={currency}
                pending={pending}
                onCancel={() => setEditingId(null)}
                onSubmit={(patch) => {
                  startTransition(async () => {
                    const res = await updateLineItemAction({ orderId, lineItemId: it.id, ...patch })
                    if (!res.ok) return flash("err", res.error)
                    flash("ok", "Item actualizado")
                    setEditingId(null)
                    router.refresh()
                  })
                }}
              />
            ) : (
              <tr key={it.id} className={i < items.length - 1 ? "border-b-2 border-dashed border-warm-200" : ""}>
                <td className="pl-5 pr-3 py-4 w-14">
                  <div className="w-12 h-12 bg-cream-2 overflow-hidden" style={{ border: "1.5px solid var(--border)" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {it.thumbnail && <img src={it.thumbnail} alt="" className="w-full h-full object-cover" />}
                  </div>
                </td>
                <td className="px-3 py-4">
                  <div className="font-display font-bold text-ink">{it.title}</div>
                  {it.variantTitle && <div className="text-[10px] text-ink-3 mt-0.5">{it.variantTitle}</div>}
                  {it.sku && <div className="text-[10px] text-ink-3 font-mono mt-0.5">{it.sku}</div>}
                  {it.comboCode && (
                    <div className="mt-1.5 inline-flex items-center gap-1 text-[10px] text-secondary bg-secondary/10 px-2 py-0.5 font-display font-bold uppercase tracking-wider"
                         style={{ border: "1px solid #4D5431" }}>
                      ⚡ {it.comboCode}
                    </div>
                  )}
                </td>
                <td className="px-3 py-4 text-right text-ink-2 num">
                  {currency.toUpperCase()} {it.unitPrice.toFixed(2)} × {it.quantity}
                </td>
                <td className="pl-3 pr-3 py-4 text-right">
                  <div className="font-display font-black text-[15px] num">
                    {currency.toUpperCase()} {it.subtotal.toFixed(2)}
                  </div>
                  {it.discountTotal > 0 && (
                    <div className="text-[10px] text-secondary font-display font-bold num">−{currency.toUpperCase()} {it.discountTotal.toFixed(2)}</div>
                  )}
                </td>
                {!locked && (
                  <td className="pr-5 py-4 text-right w-24">
                    {confirmDelId === it.id ? (
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => startTransition(async () => {
                            const res = await deleteLineItemAction({ orderId, lineItemId: it.id })
                            if (!res.ok) return flash("err", res.error)
                            flash("ok", "Item eliminado")
                            setConfirmDelId(null)
                            router.refresh()
                          })}
                          disabled={pending}
                          className="px-2 py-0.5 bg-primary text-white text-[10px] font-display font-bold uppercase tracking-wider rounded-md disabled:opacity-50"
                        >
                          Eliminar
                        </button>
                        <button onClick={() => setConfirmDelId(null)} disabled={pending} className="text-ink-3 px-1 disabled:opacity-50">
                          <X size={11} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setEditingId(it.id)} className="text-ink-3 hover:text-orange p-1" title="Editar">
                          <Pencil size={11} strokeWidth={2.4} />
                        </button>
                        <button onClick={() => setConfirmDelId(it.id)} className="text-ink-3 hover:text-primary p-1" title="Eliminar">
                          <Trash2 size={11} strokeWidth={2.4} />
                        </button>
                      </div>
                    )}
                  </td>
                )}
              </tr>
            )
          ))}
        </tbody>
      </table>

      {locked && (
        <div className="px-5 py-2 text-[10px] font-mono text-ink-3" style={{ background: "rgb(var(--surface-2))", borderTop: "1px solid var(--border)" }}>
          Pedido bloqueado para edición (ya enviado o entregado). Para cambios hay que crear un order edit en Medusa.
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

function AddRow({ currency, pending, onCancel, onSubmit }: {
  currency: string
  pending: boolean
  onCancel: () => void
  onSubmit: (input: { title: string; quantity: number; unit_price: number }) => void
}) {
  const [form, setForm] = useState({ title: "", quantity: 1, unit_price: 0 })
  return (
    <div className="p-4 bg-orange/5" style={{ borderBottom: "2px dashed #FF3B27" }}>
      <div className="grid grid-cols-[1fr_100px_120px] gap-2 items-end">
        <div>
          <label className="block text-[9px] font-display font-bold uppercase tracking-wider text-ink-2 mb-1">Título *</label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="Nombre del item"
            className="w-full px-3 py-2 bg-cream rounded-md text-[12px] focus:outline-none"
            style={{ border: "1.5px solid var(--border)" }}
          />
        </div>
        <div>
          <label className="block text-[9px] font-display font-bold uppercase tracking-wider text-ink-2 mb-1">Cantidad</label>
          <input
            type="number"
            min={1}
            value={form.quantity}
            onChange={(e) => setForm((f) => ({ ...f, quantity: Math.max(1, Number(e.target.value) || 1) }))}
            className="w-full px-3 py-2 bg-cream rounded-md text-[12px] font-mono num text-right focus:outline-none"
            style={{ border: "1.5px solid var(--border)" }}
          />
        </div>
        <div>
          <label className="block text-[9px] font-display font-bold uppercase tracking-wider text-ink-2 mb-1">
            Precio {currency.toUpperCase()}
          </label>
          <input
            type="number"
            min={0}
            step="0.01"
            value={form.unit_price || ""}
            onChange={(e) => setForm((f) => ({ ...f, unit_price: Number(e.target.value) || 0 }))}
            placeholder="0.00"
            className="w-full px-3 py-2 bg-cream rounded-md text-[12px] font-mono num text-right focus:outline-none"
            style={{ border: "1.5px solid var(--border)" }}
          />
        </div>
      </div>
      <div className="flex items-center justify-end gap-2 mt-3">
        <button type="button" onClick={onCancel} disabled={pending}
          className="px-3 py-1.5 bg-cream rounded-md text-[10px] font-display font-bold uppercase tracking-wider text-ink hover:bg-cream-2 disabled:opacity-50"
          style={{ border: "1.5px solid var(--border)" }}>
          Cancelar
        </button>
        <button type="button" onClick={() => onSubmit(form)}
          disabled={pending || !form.title.trim() || form.quantity <= 0}
          className="px-3 py-1.5 bg-secondary text-cream rounded-md text-[10px] font-display font-bold uppercase tracking-wider disabled:opacity-50"
          style={{ border: "1.5px solid #1A1A1A" }}>
          {pending ? "Añadiendo…" : "Añadir item"}
        </button>
      </div>
    </div>
  )
}

function EditRow({ item, currency, pending, onCancel, onSubmit }: {
  item: LineItem
  currency: string
  pending: boolean
  onCancel: () => void
  onSubmit: (patch: { quantity?: number; unit_price?: number; title?: string }) => void
}) {
  const [form, setForm] = useState({
    title: item.title,
    quantity: item.quantity,
    unit_price: item.unitPrice,
  })

  return (
    <tr className="bg-orange/5 border-b-2 border-dashed border-warm-200">
      <td className="pl-5 pr-3 py-3 w-14">
        <div className="w-12 h-12 bg-cream-2 overflow-hidden" style={{ border: "1.5px solid var(--border)" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {item.thumbnail && <img src={item.thumbnail} alt="" className="w-full h-full object-cover" />}
        </div>
      </td>
      <td className="px-3 py-3">
        <input
          type="text"
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          className="w-full px-2 py-1 bg-cream rounded-md text-[12px] focus:outline-none"
          style={{ border: "1.5px solid var(--border)" }}
        />
      </td>
      <td className="px-3 py-3 text-right">
        <div className="flex items-center justify-end gap-1">
          <input
            type="number"
            min={0}
            step="0.01"
            value={form.unit_price}
            onChange={(e) => setForm((f) => ({ ...f, unit_price: Number(e.target.value) || 0 }))}
            className="w-20 px-2 py-1 bg-cream rounded-md text-[11px] font-mono num text-right focus:outline-none"
            style={{ border: "1.5px solid var(--border)" }}
          />
          <span className="text-[10px] text-ink-3 font-mono">×</span>
          <input
            type="number"
            min={1}
            value={form.quantity}
            onChange={(e) => setForm((f) => ({ ...f, quantity: Math.max(1, Number(e.target.value) || 1) }))}
            className="w-14 px-2 py-1 bg-cream rounded-md text-[11px] font-mono num text-right focus:outline-none"
            style={{ border: "1.5px solid var(--border)" }}
          />
        </div>
      </td>
      <td className="pl-3 pr-3 py-3 text-right font-display font-black num text-[14px]">
        {currency.toUpperCase()} {(form.quantity * form.unit_price).toFixed(2)}
      </td>
      <td className="pr-5 py-3 text-right w-24">
        <div className="flex items-center justify-end gap-1">
          <button onClick={() => onSubmit(form)} disabled={pending} className="text-secondary p-1 disabled:opacity-50">
            <Check size={13} strokeWidth={3} />
          </button>
          <button onClick={onCancel} disabled={pending} className="text-ink-3 hover:text-primary p-1 disabled:opacity-50">
            <X size={13} strokeWidth={3} />
          </button>
        </div>
      </td>
    </tr>
  )
}
