"use client"

import { useState, useTransition } from "react"
import { Printer, Undo2, PackageCheck, X, AlertCircle, CheckCircle2, CircleDollarSign } from "lucide-react"
import { useRouter } from "next/navigation"
import {
  markFulfilledAction,
  capturePaymentAction,
  cancelOrderAction,
  refundOrderAction,
} from "./actions"

interface OrderItem {
  id: string
  title: string
  quantity: number
  unitPrice: number
}

interface Props {
  orderId: string
  paymentStatus?: string | null
  fulfillmentStatus?: string | null
  orderStatus?: string | null
  items?: OrderItem[]
  currency?: string
  paidAmount?: number
}

type Toast = { kind: "ok" | "err"; message: string } | null

export function OrderActions({
  orderId, paymentStatus, fulfillmentStatus, orderStatus,
  items = [], currency = "eur", paidAmount = 0,
}: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [toast, setToast] = useState<Toast>(null)
  const [confirmAction, setConfirmAction] = useState<null | "cancel" | "refund">(null)
  const [refundNote, setRefundNote] = useState("")
  // Refund parcial: qty por item id
  const [refundQtys, setRefundQtys] = useState<Record<string, number>>({})
  const [refundAmountOverride, setRefundAmountOverride] = useState<string>("")

  const isCancelled = orderStatus === "canceled" || orderStatus === "archived"
  const canCapture = paymentStatus && paymentStatus !== "captured" && paymentStatus !== "authorized" && paymentStatus !== "refunded"
  const canFulfill = paymentStatus === "captured" && fulfillmentStatus !== "fulfilled" && fulfillmentStatus !== "shipped" && fulfillmentStatus !== "delivered" && !isCancelled
  const canRefund = paymentStatus === "captured" && !isCancelled
  const canCancel = !isCancelled && fulfillmentStatus !== "shipped" && fulfillmentStatus !== "delivered"

  function flash(kind: "ok" | "err", message: string) {
    setToast({ kind, message })
    setTimeout(() => setToast(null), 4000)
  }

  function run(actionFn: () => Promise<{ ok: true } | { ok: false; error: string }>, successMsg: string) {
    startTransition(async () => {
      const res = await actionFn()
      if (res.ok) {
        flash("ok", successMsg)
        router.refresh()
      } else {
        flash("err", res.error)
      }
    })
  }

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap justify-end">
        <a
          href={`/orders/${orderId}/print`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3 py-2 bg-cream rounded-md text-[10px] font-display font-bold uppercase tracking-wider text-ink hover:bg-cream-2"
          style={{ border: "1.5px solid var(--border)", boxShadow: "3px 3px 0 0 var(--shadow-color)" }}
        >
          <Printer size={13} strokeWidth={2.5} /> Packing slip
        </a>

        {canCapture && (
          <button
            type="button"
            onClick={() => run(() => capturePaymentAction(orderId), "Pago capturado")}
            disabled={pending}
            className="flex items-center gap-1.5 px-3 py-2 bg-secondary text-cream rounded-md text-[10px] font-display font-bold uppercase tracking-wider transition-all hover:translate-x-[2px] hover:translate-y-[2px] disabled:opacity-50"
            style={{ border: "2px solid #1A1A1A", boxShadow: "4px 4px 0 0 var(--shadow-color)" }}
          >
            <CircleDollarSign size={13} strokeWidth={2.5} /> Capturar pago
          </button>
        )}

        {canRefund && (
          <button
            type="button"
            onClick={() => setConfirmAction("refund")}
            disabled={pending}
            className="flex items-center gap-1.5 px-3 py-2 bg-cream rounded-md text-[10px] font-display font-bold uppercase tracking-wider text-primary hover:bg-primary/5 disabled:opacity-50"
            style={{ border: "1.5px solid #BB3B2E" }}
          >
            <Undo2 size={13} strokeWidth={2.5} /> Reembolsar
          </button>
        )}

        {canCancel && (
          <button
            type="button"
            onClick={() => setConfirmAction("cancel")}
            disabled={pending}
            className="flex items-center gap-1.5 px-3 py-2 bg-cream rounded-md text-[10px] font-display font-bold uppercase tracking-wider text-primary hover:bg-primary/5 disabled:opacity-50"
            style={{ border: "1.5px solid #BB3B2E" }}
          >
            <X size={13} strokeWidth={2.5} /> Cancelar
          </button>
        )}

        {canFulfill && (
          <button
            type="button"
            onClick={() => run(() => markFulfilledAction(orderId), "Pedido marcado como enviado")}
            disabled={pending}
            className="flex items-center gap-1.5 px-4 py-2 bg-orange text-dark rounded-md text-[10px] font-display font-bold uppercase tracking-wider transition-all hover:translate-x-[2px] hover:translate-y-[2px] disabled:opacity-50"
            style={{ border: "2px solid #1A1A1A", boxShadow: "4px 4px 0 0 var(--shadow-color)" }}
          >
            <PackageCheck size={13} strokeWidth={2.5} /> Marcar enviado
          </button>
        )}

        {pending && (
          <span className="text-[10px] font-mono text-ink-3 ml-2 animate-pulse">procesando…</span>
        )}
      </div>

      {/* Toast */}
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
          <span>{toast.message}</span>
        </div>
      )}

      {/* Cancel confirmation modal (simple) */}
      {confirmAction === "cancel" && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0, 0, 0, 0.5)" }}
          onClick={() => !pending && setConfirmAction(null)}
        >
          <div
            className="bg-page rounded-md max-w-md w-full p-6"
            style={{ border: "2.5px solid var(--border)", boxShadow: "5px 5px 0 0 var(--shadow-color)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display font-black text-[18px] uppercase tracking-tight text-ink">
              ¿Cancelar pedido?
            </h3>
            <p className="text-[13px] text-ink-2 mt-2 leading-relaxed">
              Esta acción cancela el pedido en Medusa. Si ya estaba pagado, el pago no se reembolsa automáticamente — debes hacer el refund por separado.
            </p>
            <div className="flex items-center gap-2 mt-5 justify-end">
              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                disabled={pending}
                className="px-4 py-2 bg-cream rounded-md text-[11px] font-display font-bold uppercase tracking-wider text-ink hover:bg-cream-2 disabled:opacity-50"
                style={{ border: "1.5px solid var(--border)" }}
              >
                Cancelar acción
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  setConfirmAction(null)
                  run(() => cancelOrderAction(orderId), "Pedido cancelado")
                }}
                className="px-4 py-2 bg-primary text-white rounded-md text-[11px] font-display font-bold uppercase tracking-wider hover:translate-x-[2px] hover:translate-y-[2px] disabled:opacity-50 transition-all"
                style={{ border: "2px solid #1A1A1A", boxShadow: "4px 4px 0 0 var(--shadow-color)" }}
              >
                Sí, cancelar pedido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Refund modal — con selector por línea */}
      {confirmAction === "refund" && (() => {
        const lineRefundTotal = items.reduce(
          (s, it) => s + (refundQtys[it.id] ?? 0) * it.unitPrice,
          0,
        )
        const overrideAmount = refundAmountOverride.trim() ? Number(refundAmountOverride) : null
        const finalAmount = overrideAmount != null && Number.isFinite(overrideAmount)
          ? overrideAmount
          : lineRefundTotal > 0 ? lineRefundTotal : paidAmount
        const isPartial = finalAmount > 0 && finalAmount < paidAmount
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "rgba(0, 0, 0, 0.5)" }}
            onClick={() => !pending && setConfirmAction(null)}
          >
            <div
              className="bg-page rounded-md max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto"
              style={{ border: "2.5px solid var(--border)", boxShadow: "5px 5px 0 0 var(--shadow-color)" }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="font-display font-black text-[18px] uppercase tracking-tight text-ink mb-1">
                Reembolsar pedido
              </h3>
              <p className="text-[12px] text-ink-2 mb-4">
                Pagado: <span className="font-mono num font-bold">{currency.toUpperCase()} {paidAmount.toFixed(2)}</span>
                {" · "}
                Selecciona items para refund parcial, o deja todo en 0 y se reembolsa el total.
              </p>

              {items.length > 0 && (
                <div className="space-y-1.5 mb-4">
                  <p className="text-[10px] font-display font-bold uppercase tracking-wider text-ink-2">
                    Items a reembolsar (qty)
                  </p>
                  {items.map((it) => (
                    <div key={it.id} className="flex items-center gap-2 px-3 py-2 bg-cream-2/40 rounded-md text-[12px]" style={{ border: "1.5px solid var(--border)" }}>
                      <span className="flex-1 truncate font-display font-bold">{it.title}</span>
                      <span className="text-[10px] font-mono text-ink-3">
                        comprado: {it.quantity} · {currency.toUpperCase()} {it.unitPrice.toFixed(2)} c/u
                      </span>
                      <input
                        type="number"
                        min={0}
                        max={it.quantity}
                        value={refundQtys[it.id] ?? 0}
                        onChange={(e) => {
                          const v = Math.max(0, Math.min(it.quantity, Number(e.target.value) || 0))
                          setRefundQtys((q) => ({ ...q, [it.id]: v }))
                        }}
                        className="w-16 px-2 py-1 bg-cream rounded-md text-[12px] font-mono num text-right focus:outline-none"
                        style={{ border: "1.5px solid var(--border)" }}
                      />
                    </div>
                  ))}
                  <div className="text-right text-[11px] font-mono num pt-1">
                    Subtotal items: <span className="font-bold">{currency.toUpperCase()} {lineRefundTotal.toFixed(2)}</span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="block text-[10px] font-display font-bold uppercase tracking-[0.18em] text-ink-2 mb-1.5">
                    Override monto ({currency.toUpperCase()})
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={refundAmountOverride}
                    onChange={(e) => setRefundAmountOverride(e.target.value)}
                    placeholder={`auto: ${(lineRefundTotal > 0 ? lineRefundTotal : paidAmount).toFixed(2)}`}
                    className="w-full px-3 py-2 bg-cream rounded-md text-[12px] font-mono num focus:outline-none"
                    style={{ border: "1.5px solid var(--border)" }}
                  />
                  <p className="text-[10px] text-ink-3 mt-1">
                    Sobreescribe si quieres ajustar (ej. excluir envío)
                  </p>
                </div>
                <div>
                  <label className="block text-[10px] font-display font-bold uppercase tracking-[0.18em] text-ink-2 mb-1.5">
                    Razón / nota
                  </label>
                  <textarea
                    value={refundNote}
                    onChange={(e) => setRefundNote(e.target.value)}
                    placeholder="opcional · historial interno"
                    rows={2}
                    className="w-full px-3 py-2 bg-cream rounded-md text-[12px] font-mono focus:outline-none resize-none"
                    style={{ border: "1.5px solid var(--border)" }}
                  />
                </div>
              </div>

              <div className="bg-orange/10 px-4 py-2 rounded-md mb-4" style={{ border: "1.5px solid #FF3B27" }}>
                <p className="text-[12px] font-display font-bold uppercase tracking-wider">
                  Total a reembolsar:{" "}
                  <span className="text-orange num text-[14px]">
                    {currency.toUpperCase()} {finalAmount.toFixed(2)}
                  </span>
                  {isPartial && <span className="ml-2 text-[10px] font-mono text-ink-3">(refund parcial)</span>}
                </p>
              </div>

              <div className="flex items-center gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setConfirmAction(null)
                    setRefundQtys({})
                    setRefundAmountOverride("")
                    setRefundNote("")
                  }}
                  disabled={pending}
                  className="px-4 py-2 bg-cream rounded-md text-[11px] font-display font-bold uppercase tracking-wider text-ink hover:bg-cream-2 disabled:opacity-50"
                  style={{ border: "1.5px solid var(--border)" }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={pending || finalAmount <= 0 || finalAmount > paidAmount}
                  onClick={() => {
                    const note = refundNote.trim() || undefined
                    const amount = finalAmount
                    setConfirmAction(null)
                    setRefundQtys({})
                    setRefundAmountOverride("")
                    setRefundNote("")
                    run(
                      () => refundOrderAction(orderId, { amount, note }),
                      isPartial ? `Refund parcial creado · ${currency.toUpperCase()} ${amount.toFixed(2)}` : "Refund total creado",
                    )
                  }}
                  className="px-4 py-2 bg-primary text-white rounded-md text-[11px] font-display font-bold uppercase tracking-wider hover:translate-x-[2px] hover:translate-y-[2px] disabled:opacity-50 transition-all"
                  style={{ border: "2px solid #1A1A1A", boxShadow: "4px 4px 0 0 var(--shadow-color)" }}
                >
                  Reembolsar {currency.toUpperCase()} {finalAmount.toFixed(2)}
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </>
  )
}
