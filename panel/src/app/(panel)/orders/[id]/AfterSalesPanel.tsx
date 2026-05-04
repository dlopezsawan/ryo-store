"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Undo2, ArrowLeftRight, AlertTriangle, Check, X, AlertCircle, CheckCircle2 } from "lucide-react"
import {
  receiveReturnAction, cancelReturnAction,
  createExchangeAction, createClaimAction,
} from "./actions"

export interface ReturnRow {
  id: string
  status: string
  refundAmount: number
  receivedAt: string | null
  createdAt: string
  items: Array<{
    id: string         // return-item id
    itemId: string     // line_item id en la orden
    title: string      // título del line_item (lookup)
    quantity: number
    receivedQuantity: number
  }>
}

export interface OrderItemRow {
  id: string
  title: string
  quantity: number
  unitPrice: number
  variantId: string | null
}

interface Props {
  orderId: string
  currency: string
  /** Returns existentes para listar */
  returns: ReturnRow[]
  /** Items de la orden — para que exchange/claim escojan qué devolver */
  items: OrderItemRow[]
}

type Toast = { kind: "ok" | "err"; msg: string } | null
type Mode = null | "exchange" | "claim"

const STATUS_META: Record<string, { label: string; cls: string }> = {
  requested: { label: "Solicitado", cls: "text-orange" },
  received:  { label: "Recibido",   cls: "text-secondary" },
  canceled:  { label: "Cancelado",  cls: "text-primary" },
  partial:   { label: "Parcial",    cls: "text-orange" },
}

const CLAIM_REASONS = [
  { value: "missing_item", label: "Item faltante" },
  { value: "wrong_item", label: "Item equivocado" },
  { value: "production_failure", label: "Defecto de fabricación" },
  { value: "other", label: "Otro" },
] as const

export function AfterSalesPanel({ orderId, currency, returns, items }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [toast, setToast] = useState<Toast>(null)
  const [mode, setMode] = useState<Mode>(null)
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null)
  const [receivingId, setReceivingId] = useState<string | null>(null)

  function flash(k: "ok" | "err", m: string) {
    setToast({ kind: k, msg: m })
    setTimeout(() => setToast(null), 4000)
  }

  function receiveAll(ret: ReturnRow) {
    setReceivingId(ret.id)
  }

  return (
    <div className="stamp-card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 bg-dark text-cream">
        <div className="flex items-center gap-2">
          <ArrowLeftRight size={14} strokeWidth={2.4} />
          <h3 className="font-display font-black text-[14px] uppercase tracking-wider">
            Post-venta
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMode("exchange")}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-cream text-ink rounded-md text-[10px] font-display font-bold uppercase tracking-wider hover:bg-cream-2"
            style={{ border: "1.5px solid var(--border)" }}
          >
            <ArrowLeftRight size={11} strokeWidth={2.5} /> Cambio
          </button>
          <button
            type="button"
            onClick={() => setMode("claim")}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-cream text-primary rounded-md text-[10px] font-display font-bold uppercase tracking-wider hover:bg-primary/5"
            style={{ border: "1.5px solid #BB3B2E" }}
          >
            <AlertTriangle size={11} strokeWidth={2.5} /> Reclamo
          </button>
        </div>
      </div>

      <div className="p-5">
        {returns.length === 0 ? (
          <p className="text-[12px] text-ink-3 text-center py-2">
            Sin retornos, cambios o reclamos en esta orden.
          </p>
        ) : (
          <div className="space-y-3">
            {returns.map((ret) => {
              const meta = STATUS_META[ret.status] ?? { label: ret.status, cls: "text-ink-3" }
              const created = new Date(ret.createdAt)
              const isReceiving = receivingId === ret.id
              return (
                <div key={ret.id} className="bg-cream-2/50 p-3 rounded-md" style={{ border: "1.5px solid var(--border)" }}>
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Undo2 size={13} strokeWidth={2.4} className="text-ink-3" />
                      <span className={`pill ${meta.cls}`}>
                        <span className="pill-dot" />{meta.label}
                      </span>
                      <code className="text-[10px] font-mono text-ink-3 truncate">{ret.id}</code>
                    </div>
                    {ret.status !== "canceled" && ret.status !== "received" && (
                      <div className="flex items-center gap-1">
                        {isReceiving ? null : (
                          <>
                            <button
                              type="button"
                              onClick={() => receiveAll(ret)}
                              disabled={pending}
                              className="px-2 py-1 bg-secondary text-cream rounded-md text-[10px] font-display font-bold uppercase tracking-wider disabled:opacity-50"
                              style={{ border: "1.5px solid #1A1A1A" }}
                            >
                              <Check size={11} className="inline" /> Recibir
                            </button>
                            {confirmCancelId === ret.id ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => startTransition(async () => {
                                    const r = await cancelReturnAction({ orderId, returnId: ret.id })
                                    if (!r.ok) return flash("err", r.error)
                                    flash("ok", "Retorno cancelado")
                                    setConfirmCancelId(null)
                                    router.refresh()
                                  })}
                                  disabled={pending}
                                  className="px-2 py-1 bg-primary text-white rounded-md text-[10px] font-display font-bold uppercase tracking-wider disabled:opacity-50"
                                >
                                  ✓
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmCancelId(null)}
                                  className="text-ink-3 px-1"
                                >
                                  <X size={11} />
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmCancelId(ret.id)}
                                className="text-ink-3 hover:text-primary p-1"
                                title="Cancelar"
                              >
                                <X size={12} strokeWidth={2.4} />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="text-[11px] font-mono text-ink-3 mb-1.5">
                    creado {created.toLocaleDateString("es-VE")} · {ret.items.length} ítem(s)
                    {ret.refundAmount > 0 && <> · refund {currency.toUpperCase()} {ret.refundAmount.toFixed(2)}</>}
                  </div>

                  {isReceiving ? (
                    <ReceiveForm
                      ret={ret}
                      pending={pending}
                      onCancel={() => setReceivingId(null)}
                      onSubmit={(items) => startTransition(async () => {
                        const r = await receiveReturnAction({ orderId, returnId: ret.id, items })
                        if (!r.ok) return flash("err", r.error)
                        flash("ok", "Retorno marcado como recibido")
                        setReceivingId(null)
                        router.refresh()
                      })}
                    />
                  ) : (
                    <ul className="space-y-0.5 text-[11px]">
                      {ret.items.map((it) => (
                        <li key={it.id} className="flex items-center justify-between gap-2 px-2 py-1 bg-cream/40 rounded">
                          <span className="font-display font-bold text-ink truncate">{it.title}</span>
                          <span className="font-mono num text-ink-3 flex-shrink-0">
                            {it.receivedQuantity > 0 && (
                              <span className="text-secondary mr-1">recibido: {it.receivedQuantity}/</span>
                            )}
                            {it.quantity}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {mode === "exchange" && (
        <ExchangeModal
          orderId={orderId}
          currency={currency}
          items={items}
          pending={pending}
          startTransition={startTransition}
          onClose={() => setMode(null)}
          onSaved={() => { setMode(null); flash("ok", "Cambio creado"); router.refresh() }}
          onError={(m) => flash("err", m)}
        />
      )}

      {mode === "claim" && (
        <ClaimModal
          orderId={orderId}
          currency={currency}
          items={items}
          pending={pending}
          startTransition={startTransition}
          onClose={() => setMode(null)}
          onSaved={() => { setMode(null); flash("ok", "Reclamo creado"); router.refresh() }}
          onError={(m) => flash("err", m)}
        />
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

function ReceiveForm({
  ret, pending, onCancel, onSubmit,
}: {
  ret: ReturnRow
  pending: boolean
  onCancel: () => void
  onSubmit: (items: Array<{ id: string; quantity: number }>) => void
}) {
  const [qtys, setQtys] = useState<Record<string, number>>(
    Object.fromEntries(ret.items.map((it) => [it.id, it.quantity - it.receivedQuantity])),
  )

  return (
    <div className="mt-3 pt-3" style={{ borderTop: "1.5px dashed var(--border)" }}>
      <p className="text-[10px] font-display font-bold uppercase tracking-wider text-ink-2 mb-2">
        ¿Cuánto se recibió?
      </p>
      <div className="space-y-1.5">
        {ret.items.map((it) => {
          const max = it.quantity - it.receivedQuantity
          return (
            <div key={it.id} className="flex items-center gap-2">
              <span className="flex-1 text-[11px] font-display font-bold truncate">{it.title}</span>
              <span className="text-[10px] font-mono text-ink-3">de {max}</span>
              <input
                type="number"
                min={0}
                max={max}
                value={qtys[it.id] ?? 0}
                onChange={(e) => setQtys((q) => ({ ...q, [it.id]: Math.max(0, Math.min(max, Number(e.target.value) || 0)) }))}
                className="w-16 px-2 py-1 bg-cream rounded-md text-[12px] font-mono num text-right focus:outline-none"
                style={{ border: "1.5px solid var(--border)" }}
              />
            </div>
          )
        })}
      </div>
      <div className="flex items-center justify-end gap-1 mt-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          className="px-2 py-1 bg-cream rounded-md text-[10px] font-display font-bold uppercase tracking-wider text-ink hover:bg-cream-2 disabled:opacity-50"
          style={{ border: "1px solid var(--border)" }}
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={() => {
            const items = ret.items
              .map((it) => ({ id: it.id, quantity: qtys[it.id] ?? 0 }))
              .filter((it) => it.quantity > 0)
            onSubmit(items)
          }}
          disabled={pending}
          className="px-3 py-1 bg-secondary text-cream rounded-md text-[10px] font-display font-bold uppercase tracking-wider disabled:opacity-50"
          style={{ border: "1px solid #1A1A1A" }}
        >
          {pending ? "..." : "Confirmar"}
        </button>
      </div>
    </div>
  )
}

function ExchangeModal({
  orderId, currency, items, pending, startTransition, onClose, onSaved, onError,
}: {
  orderId: string
  currency: string
  items: OrderItemRow[]
  pending: boolean
  startTransition: (fn: () => void) => void
  onClose: () => void
  onSaved: () => void
  onError: (m: string) => void
}) {
  const [returnQtys, setReturnQtys] = useState<Record<string, number>>(
    Object.fromEntries(items.map((i) => [i.id, 0])),
  )
  const [additional, setAdditional] = useState<Array<{ variant_id: string; quantity: number; unit_price: number }>>([
    { variant_id: "", quantity: 1, unit_price: 0 },
  ])
  const [note, setNote] = useState("")

  function addRow() {
    setAdditional((rows) => [...rows, { variant_id: "", quantity: 1, unit_price: 0 }])
  }
  function removeRow(i: number) {
    setAdditional((rows) => rows.filter((_, idx) => idx !== i))
  }
  function updateRow(i: number, patch: Partial<{ variant_id: string; quantity: number; unit_price: number }>) {
    setAdditional((rows) => rows.map((r, idx) => idx === i ? { ...r, ...patch } : r))
  }

  function submit() {
    const return_items = items
      .map((i) => ({ id: i.id, quantity: returnQtys[i.id] ?? 0, note: note.trim() || undefined }))
      .filter((i) => i.quantity > 0)

    const validAdditional = additional
      .filter((a) => a.variant_id.trim() && a.quantity > 0)
      .map((a) => ({
        variant_id: a.variant_id.trim(),
        quantity: a.quantity,
        unit_price: a.unit_price > 0 ? a.unit_price : undefined,
      }))

    const returnTotal = return_items.reduce((s, ri) => {
      const it = items.find((i) => i.id === ri.id)
      return s + (it ? it.unitPrice * ri.quantity : 0)
    }, 0)
    const addTotal = validAdditional.reduce((s, a) => s + a.quantity * (a.unit_price ?? 0), 0)
    const difference = addTotal - returnTotal

    startTransition(async () => {
      const r = await createExchangeAction({
        orderId,
        return_items,
        additional_items: validAdditional,
        difference_due: difference > 0 ? difference : undefined,
      })
      if (!r.ok) return onError(r.error)
      onSaved()
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)" }} onClick={() => !pending && onClose()}>
      <div className="bg-page rounded-md max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto" style={{ border: "2.5px solid var(--border)", boxShadow: "5px 5px 0 0 var(--shadow-color)" }} onClick={(e) => e.stopPropagation()}>
        <h3 className="font-display font-black text-[18px] uppercase tracking-tight text-ink mb-1">
          Crear cambio (exchange)
        </h3>
        <p className="text-[11px] text-ink-3 mb-4">
          El cliente devuelve unos items y recibe otros en su lugar. Si el total de los nuevos
          es mayor, Medusa registra <code>difference_due</code> y se cobra al confirmar.
        </p>

        <div className="space-y-4">
          <div>
            <h4 className="font-display font-black text-[12px] uppercase tracking-wider mb-2">
              1. Items que devuelve
            </h4>
            <div className="space-y-1">
              {items.map((it) => (
                <div key={it.id} className="flex items-center gap-3 py-1.5 px-3 bg-cream-2/40 rounded-md text-[12px]" style={{ border: "1.5px solid var(--border)" }}>
                  <span className="flex-1 truncate">{it.title}</span>
                  <span className="text-[10px] text-ink-3 font-mono">vendido: {it.quantity}</span>
                  <input
                    type="number"
                    min={0}
                    max={it.quantity}
                    value={returnQtys[it.id] ?? 0}
                    onChange={(e) => setReturnQtys((q) => ({
                      ...q,
                      [it.id]: Math.max(0, Math.min(it.quantity, Number(e.target.value) || 0)),
                    }))}
                    className="w-16 px-2 py-0.5 bg-cream rounded-md text-[11px] font-mono num text-right focus:outline-none"
                    style={{ border: "1.5px solid var(--border)" }}
                  />
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-display font-black text-[12px] uppercase tracking-wider">
                2. Items que recibe a cambio
              </h4>
              <button onClick={addRow} className="text-orange hover:underline text-[10px] font-display font-bold uppercase tracking-wider">
                + Línea
              </button>
            </div>
            <div className="space-y-1.5">
              {additional.map((row, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="variant_id"
                    value={row.variant_id}
                    onChange={(e) => updateRow(i, { variant_id: e.target.value })}
                    className="flex-1 px-2 py-1.5 bg-cream rounded-md text-[11px] font-mono focus:outline-none"
                    style={{ border: "1.5px solid var(--border)" }}
                  />
                  <input
                    type="number"
                    min={1}
                    value={row.quantity}
                    onChange={(e) => updateRow(i, { quantity: Number(e.target.value) || 1 })}
                    className="w-16 px-2 py-1.5 bg-cream rounded-md text-[11px] font-mono num text-right focus:outline-none"
                    style={{ border: "1.5px solid var(--border)" }}
                  />
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="precio"
                    value={row.unit_price || ""}
                    onChange={(e) => updateRow(i, { unit_price: Number(e.target.value) || 0 })}
                    className="w-24 px-2 py-1.5 bg-cream rounded-md text-[11px] font-mono num text-right focus:outline-none"
                    style={{ border: "1.5px solid var(--border)" }}
                  />
                  <button
                    onClick={() => removeRow(i)}
                    disabled={additional.length === 1}
                    className="text-ink-3 hover:text-primary p-1 disabled:opacity-30"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
              <p className="text-[10px] text-ink-3 italic">
                Tip: el variant_id se ve en URL del producto en Medusa o en la columna SKU.
              </p>
            </div>
          </div>

          <textarea
            rows={2}
            placeholder="Nota (opcional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full px-3 py-2 bg-cream rounded-md text-[12px] focus:outline-none resize-none"
            style={{ border: "1.5px solid var(--border)" }}
          />
        </div>

        <div className="flex items-center justify-end gap-2 mt-5">
          <button onClick={onClose} disabled={pending}
            className="px-4 py-2 bg-cream rounded-md text-[11px] font-display font-bold uppercase tracking-wider text-ink hover:bg-cream-2 disabled:opacity-50" style={{ border: "1.5px solid var(--border)" }}>
            Cancelar
          </button>
          <button onClick={submit} disabled={pending}
            className="px-4 py-2 bg-orange text-dark rounded-md text-[11px] font-display font-bold uppercase tracking-wider hover:translate-x-[2px] hover:translate-y-[2px] disabled:opacity-50 transition-all"
            style={{ border: "2px solid #1A1A1A", boxShadow: "4px 4px 0 0 var(--shadow-color)" }}>
            {pending ? "Creando…" : "Crear cambio"}
          </button>
        </div>
      </div>
    </div>
  )
}

function ClaimModal({
  orderId, currency, items, pending, startTransition, onClose, onSaved, onError,
}: {
  orderId: string
  currency: string
  items: OrderItemRow[]
  pending: boolean
  startTransition: (fn: () => void) => void
  onClose: () => void
  onSaved: () => void
  onError: (m: string) => void
}) {
  const [type, setType] = useState<"refund" | "replace">("refund")
  const [rows, setRows] = useState<Record<string, { quantity: number; reason: typeof CLAIM_REASONS[number]["value"]; note: string }>>(
    Object.fromEntries(items.map((i) => [i.id, { quantity: 0, reason: "production_failure" as const, note: "" }])),
  )
  const [refundAmount, setRefundAmount] = useState<number>(0)

  const claim_items = items
    .map((i) => ({ id: i.id, ...rows[i.id] }))
    .filter((i) => i.quantity > 0)

  const claimTotal = claim_items.reduce((s, ci) => {
    const it = items.find((i) => i.id === ci.id)
    return s + (it ? it.unitPrice * ci.quantity : 0)
  }, 0)

  function submit() {
    const items = claim_items.map((ci) => ({
      id: ci.id,
      quantity: ci.quantity,
      reason: ci.reason,
      note: ci.note.trim() || undefined,
    }))
    startTransition(async () => {
      const r = await createClaimAction({
        orderId,
        type,
        claim_items: items,
        refund_amount: type === "refund" ? (refundAmount > 0 ? refundAmount : claimTotal) : undefined,
      })
      if (!r.ok) return onError(r.error)
      onSaved()
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)" }} onClick={() => !pending && onClose()}>
      <div className="bg-page rounded-md max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto" style={{ border: "2.5px solid #BB3B2E", boxShadow: "5px 5px 0 0 var(--shadow-color)" }} onClick={(e) => e.stopPropagation()}>
        <h3 className="font-display font-black text-[18px] uppercase tracking-tight text-ink mb-1 flex items-center gap-2">
          <AlertTriangle size={18} className="text-primary" /> Reclamo (claim)
        </h3>
        <p className="text-[11px] text-ink-3 mb-4">
          Items dañados, equivocados o defectuosos. <strong>refund</strong> reembolsa sin pedir devolución;{" "}
          <strong>replace</strong> manda un reemplazo gratis.
        </p>

        <div className="flex items-center gap-1 mb-4 p-0.5 bg-cream rounded-md w-fit" style={{ border: "1.5px solid var(--border)" }}>
          <button
            type="button"
            onClick={() => setType("refund")}
            className={`px-3 py-1 rounded-md text-[10px] font-display font-bold uppercase tracking-wider ${
              type === "refund" ? "bg-dark text-cream" : "text-ink-3"
            }`}
          >
            Refund
          </button>
          <button
            type="button"
            onClick={() => setType("replace")}
            className={`px-3 py-1 rounded-md text-[10px] font-display font-bold uppercase tracking-wider ${
              type === "replace" ? "bg-dark text-cream" : "text-ink-3"
            }`}
          >
            Replace
          </button>
        </div>

        <div className="space-y-1.5">
          {items.map((it) => (
            <div key={it.id} className="grid grid-cols-12 gap-2 items-center py-1.5 px-3 bg-cream-2/40 rounded-md text-[12px]" style={{ border: "1.5px solid var(--border)" }}>
              <span className="col-span-4 truncate font-display font-bold">{it.title}</span>
              <select
                value={rows[it.id]?.reason ?? "production_failure"}
                onChange={(e) => setRows((s) => ({ ...s, [it.id]: { ...s[it.id], reason: e.target.value as typeof CLAIM_REASONS[number]["value"] } }))}
                className="col-span-4 px-2 py-1 bg-cream rounded-md text-[11px] focus:outline-none"
                style={{ border: "1.5px solid var(--border)" }}
              >
                {CLAIM_REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
              <input
                type="text"
                value={rows[it.id]?.note ?? ""}
                onChange={(e) => setRows((s) => ({ ...s, [it.id]: { ...s[it.id], note: e.target.value } }))}
                placeholder="nota"
                className="col-span-3 px-2 py-1 bg-cream rounded-md text-[11px] focus:outline-none"
                style={{ border: "1.5px solid var(--border)" }}
              />
              <input
                type="number"
                min={0}
                max={it.quantity}
                value={rows[it.id]?.quantity ?? 0}
                onChange={(e) => setRows((s) => ({
                  ...s,
                  [it.id]: { ...s[it.id], quantity: Math.max(0, Math.min(it.quantity, Number(e.target.value) || 0)) },
                }))}
                className="col-span-1 px-2 py-1 bg-cream rounded-md text-[11px] font-mono num text-right focus:outline-none"
                style={{ border: "1.5px solid var(--border)" }}
              />
            </div>
          ))}
        </div>

        {type === "refund" && (
          <div className="mt-4">
            <label className="block text-[10px] font-display font-bold uppercase tracking-[0.18em] text-ink-2 mb-1.5">
              Monto a reembolsar ({currency.toUpperCase()})
            </label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={refundAmount || ""}
              onChange={(e) => setRefundAmount(Number(e.target.value) || 0)}
              placeholder={`auto: ${claimTotal.toFixed(2)} (suma items)`}
              className="w-full px-3 py-2 bg-cream rounded-md text-[12px] font-mono focus:outline-none"
              style={{ border: "1.5px solid var(--border)" }}
            />
          </div>
        )}

        <div className="flex items-center justify-end gap-2 mt-5">
          <button onClick={onClose} disabled={pending}
            className="px-4 py-2 bg-cream rounded-md text-[11px] font-display font-bold uppercase tracking-wider text-ink hover:bg-cream-2 disabled:opacity-50" style={{ border: "1.5px solid var(--border)" }}>
            Cancelar
          </button>
          <button onClick={submit} disabled={pending || claim_items.length === 0}
            className="px-4 py-2 bg-primary text-white rounded-md text-[11px] font-display font-bold uppercase tracking-wider hover:translate-x-[2px] hover:translate-y-[2px] disabled:opacity-50 transition-all"
            style={{ border: "2px solid #1A1A1A", boxShadow: "4px 4px 0 0 var(--shadow-color)" }}>
            {pending ? "Creando…" : `Crear claim · ${type}`}
          </button>
        </div>
      </div>
    </div>
  )
}
