"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Truck, ExternalLink, Plus, Undo2, AlertCircle, CheckCircle2, PackageCheck } from "lucide-react"
import { addTrackingAction, createReturnAction, markDeliveredAction, completeOrderAction } from "./actions"

interface FulfillmentRow {
  id: string
  createdAt: string
  shippedAt: string | null
  deliveredAt: string | null
  canceledAt: string | null
  labels: Array<{ id: string; tracking_number: string; tracking_url?: string | null }>
}

interface ItemRow {
  id: string
  title: string
  quantity: number
  unitPrice: number
}

interface Props {
  orderId: string
  currency: string
  fulfillments: FulfillmentRow[]
  items: ItemRow[]
}

type Toast = { kind: "ok" | "err"; msg: string } | null

export function FulfillmentPanel({ orderId, currency, fulfillments, items }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [trackingFor, setTrackingFor] = useState<string | null>(null)
  const [returnOpen, setReturnOpen] = useState(false)
  const [toast, setToast] = useState<Toast>(null)

  function flash(kind: "ok" | "err", msg: string) {
    setToast({ kind, msg })
    setTimeout(() => setToast(null), 4000)
  }

  // Global state: ¿se puede completar la orden?
  // Cuando todos los fulfillments están delivered o canceled
  const allFinal = fulfillments.length > 0 && fulfillments.every((f) => f.deliveredAt || f.canceledAt)
  const allDelivered = fulfillments.length > 0 && fulfillments.every((f) => f.deliveredAt)

  return (
    <>
      <div className="stamp-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 bg-dark text-cream gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Truck size={14} strokeWidth={2.4} />
            <h3 className="font-display font-black text-[14px] uppercase tracking-wider">
              Envíos & retornos
            </h3>
          </div>
          <div className="flex items-center gap-1.5">
            {allFinal && (
              <button
                type="button"
                onClick={() => startTransition(async () => {
                  const res = await completeOrderAction(orderId)
                  if (!res.ok) return flash("err", res.error)
                  flash("ok", "Orden completada")
                  router.refresh()
                })}
                disabled={pending}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-secondary text-cream rounded-md text-[10px] font-display font-bold uppercase tracking-wider disabled:opacity-50 animate-pulse"
                style={{ border: "1.5px solid #1A1A1A" }}
                title={allDelivered ? "Cerrar la orden — todos los items entregados" : "Cerrar — todos los fulfillments están finales"}
              >
                <CheckCircle2 size={11} strokeWidth={2.5} /> Completar orden
              </button>
            )}
            <button
              type="button"
              onClick={() => setReturnOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-cream text-ink rounded-md text-[10px] font-display font-bold uppercase tracking-wider hover:bg-cream-2"
              style={{ border: "1.5px solid var(--border)" }}
            >
              <Undo2 size={11} strokeWidth={2.5} /> Crear retorno
            </button>
          </div>
        </div>

        <div className="p-5">
          {fulfillments.length === 0 ? (
            <p className="text-[12px] text-ink-3 text-center py-2">
              Aún no se ha creado ningún envío para esta orden.
            </p>
          ) : (
            <div className="space-y-3">
              {fulfillments.map((f) => (
                <FulfillmentCard
                  key={f.id}
                  f={f}
                  expanded={trackingFor === f.id}
                  onToggle={() => setTrackingFor(trackingFor === f.id ? null : f.id)}
                  orderId={orderId}
                  pending={pending}
                  startTransition={startTransition}
                  onSaved={() => { setTrackingFor(null); flash("ok", "Envío marcado y tracking guardado"); router.refresh() }}
                  onError={(m) => flash("err", m)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {returnOpen && (
        <ReturnModal
          orderId={orderId}
          currency={currency}
          items={items}
          pending={pending}
          startTransition={startTransition}
          onClose={() => setReturnOpen(false)}
          onSaved={() => { setReturnOpen(false); flash("ok", "Retorno creado"); router.refresh() }}
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
    </>
  )
}

function FulfillmentCard({
  f, expanded, onToggle, orderId, pending, startTransition, onSaved, onError,
}: {
  f: FulfillmentRow
  expanded: boolean
  onToggle: () => void
  orderId: string
  pending: boolean
  startTransition: (fn: () => void) => void
  onSaved: () => void
  onError: (msg: string) => void
}) {
  const [tracking, setTracking] = useState("")
  const [trackingUrl, setTrackingUrl] = useState("")

  const status =
    f.canceledAt ? { label: "Cancelado", cls: "text-primary" } :
    f.deliveredAt ? { label: "Entregado", cls: "text-secondary" } :
    f.shippedAt ? { label: "En tránsito", cls: "text-secondary" } :
    { label: "Preparado", cls: "text-orange" }

  const created = new Date(f.createdAt)

  function save() {
    startTransition(async () => {
      const res = await addTrackingAction({
        orderId,
        fulfillmentId: f.id,
        trackingNumber: tracking,
        trackingUrl,
      })
      if (!res.ok) return onError(res.error)
      onSaved()
    })
  }

  return (
    <div className="bg-cream-2/50 p-3 rounded-md" style={{ border: "1.5px solid var(--border)" }}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`pill ${status.cls}`}>
              <span className="pill-dot" />{status.label}
            </span>
            <code className="text-[10px] font-mono text-ink-3 truncate">{f.id}</code>
          </div>
          <p className="text-[11px] text-ink-3 font-mono">
            creado {created.toLocaleDateString("es-VE")} {created.toLocaleTimeString("es-VE", { hour: "2-digit", minute: "2-digit" })}
          </p>
          {f.labels.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {f.labels.map((l) => (
                <a
                  key={l.id}
                  href={l.tracking_url ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-mono text-orange hover:underline px-2 py-0.5 bg-orange/10 rounded-md"
                  style={{ border: "1px solid #FF3B27" }}
                >
                  {l.tracking_number}
                  {l.tracking_url && <ExternalLink size={10} strokeWidth={2.4} />}
                </a>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {!f.shippedAt && !f.canceledAt && (
            <button
              type="button"
              onClick={onToggle}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-orange text-dark rounded-md text-[10px] font-display font-bold uppercase tracking-wider"
              style={{ border: "1.5px solid #1A1A1A" }}
            >
              <Plus size={11} strokeWidth={3} /> Tracking
            </button>
          )}
          {f.shippedAt && !f.deliveredAt && !f.canceledAt && (
            <button
              type="button"
              onClick={() => startTransition(async () => {
                const res = await markDeliveredAction(orderId, f.id)
                if (!res.ok) return onError(res.error)
                onSaved()
              })}
              disabled={pending}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-secondary text-cream rounded-md text-[10px] font-display font-bold uppercase tracking-wider disabled:opacity-50"
              style={{ border: "1.5px solid #1A1A1A" }}
              title="Marcar entregado al cliente"
            >
              <PackageCheck size={11} strokeWidth={2.5} /> Entregado
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="mt-3 pt-3" style={{ borderTop: "1.5px dashed var(--border)" }}>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              placeholder="Tracking number *"
              value={tracking}
              onChange={(e) => setTracking(e.target.value)}
              className="px-3 py-2 bg-cream rounded-md text-[12px] font-mono focus:outline-none"
              style={{ border: "1.5px solid var(--border)" }}
            />
            <input
              type="text"
              placeholder="Tracking URL (opcional)"
              value={trackingUrl}
              onChange={(e) => setTrackingUrl(e.target.value)}
              className="px-3 py-2 bg-cream rounded-md text-[12px] font-mono focus:outline-none"
              style={{ border: "1.5px solid var(--border)" }}
            />
          </div>
          <div className="flex items-center gap-2 justify-end mt-2">
            <button
              type="button"
              onClick={onToggle}
              disabled={pending}
              className="px-3 py-1.5 bg-cream rounded-md text-[10px] font-display font-bold uppercase tracking-wider text-ink hover:bg-cream-2 disabled:opacity-50"
              style={{ border: "1.5px solid var(--border)" }}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={save}
              disabled={pending}
              className="px-3 py-1.5 bg-secondary text-cream rounded-md text-[10px] font-display font-bold uppercase tracking-wider disabled:opacity-50"
              style={{ border: "1.5px solid #1A1A1A" }}
            >
              {pending ? "Guardando…" : "Marcar enviado"}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function ReturnModal({
  orderId, currency, items, pending, startTransition, onClose, onSaved, onError,
}: {
  orderId: string
  currency: string
  items: ItemRow[]
  pending: boolean
  startTransition: (fn: () => void) => void
  onClose: () => void
  onSaved: () => void
  onError: (msg: string) => void
}) {
  const [qtys, setQtys] = useState<Record<string, number>>(
    Object.fromEntries(items.map((i) => [i.id, 0])),
  )
  const [refund, setRefund] = useState(false)
  const [note, setNote] = useState("")

  const refundAmount = items.reduce((s, i) => s + (qtys[i.id] ?? 0) * i.unitPrice, 0)
  const hasItems = Object.values(qtys).some((q) => q > 0)

  function submit() {
    startTransition(async () => {
      const selected = items
        .map((i) => ({ id: i.id, quantity: qtys[i.id] ?? 0 }))
        .filter((i) => i.quantity > 0)
      const res = await createReturnAction({
        orderId,
        items: selected,
        refundAmount: refund ? refundAmount : undefined,
        note: note.trim() || undefined,
      })
      if (!res.ok) return onError(res.error)
      onSaved()
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0, 0, 0, 0.5)" }}
      onClick={() => !pending && onClose()}
    >
      <div
        className="bg-page rounded-md max-w-2xl w-full p-6"
        style={{ border: "2.5px solid var(--border)", boxShadow: "5px 5px 0 0 var(--shadow-color)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-display font-black text-[18px] uppercase tracking-tight text-ink">
          Crear retorno
        </h3>
        <p className="text-[12px] text-ink-3 mt-1">
          Selecciona los items que el cliente devuelve. Si activas el refund, se reembolsará automáticamente
          según el método de pago original.
        </p>

        <div className="mt-4 space-y-2 max-h-72 overflow-y-auto">
          {items.map((it) => (
            <div key={it.id} className="flex items-center gap-3 py-2 px-3 bg-cream-2/40 rounded-md" style={{ border: "1.5px solid var(--border)" }}>
              <div className="flex-1 min-w-0">
                <div className="font-display font-bold text-[13px] text-ink truncate">{it.title}</div>
                <div className="text-[10px] text-ink-3 font-mono">
                  vendido: {it.quantity} · {currency.toUpperCase()} {it.unitPrice.toFixed(2)} c/u
                </div>
              </div>
              <input
                type="number"
                min={0}
                max={it.quantity}
                value={qtys[it.id] ?? 0}
                onChange={(e) => {
                  const v = Math.max(0, Math.min(it.quantity, Number(e.target.value) || 0))
                  setQtys((q) => ({ ...q, [it.id]: v }))
                }}
                className="w-20 px-3 py-2 bg-cream rounded-md text-[13px] font-mono num text-right focus:outline-none"
                style={{ border: "1.5px solid var(--border)" }}
              />
            </div>
          ))}
        </div>

        <div className="mt-4 space-y-2">
          <label className="flex items-center gap-2 text-[12px] cursor-pointer">
            <input type="checkbox" checked={refund} onChange={(e) => setRefund(e.target.checked)} disabled={!hasItems} />
            Reembolsar automáticamente <span className="font-mono num text-orange">
              {currency.toUpperCase()} {refundAmount.toFixed(2)}
            </span>
          </label>
          <textarea
            placeholder="Nota interna (opcional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 bg-cream rounded-md text-[12px] font-mono focus:outline-none resize-none"
            style={{ border: "1.5px solid var(--border)" }}
          />
        </div>

        <div className="flex items-center gap-2 mt-5 justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="px-4 py-2 bg-cream rounded-md text-[11px] font-display font-bold uppercase tracking-wider text-ink hover:bg-cream-2 disabled:opacity-50"
            style={{ border: "1.5px solid var(--border)" }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={pending || !hasItems}
            className="px-4 py-2 bg-primary text-white rounded-md text-[11px] font-display font-bold uppercase tracking-wider hover:translate-x-[2px] hover:translate-y-[2px] disabled:opacity-50 transition-all"
            style={{ border: "2px solid #1A1A1A", boxShadow: "4px 4px 0 0 var(--shadow-color)" }}
          >
            {pending ? "Creando…" : "Crear retorno"}
          </button>
        </div>
      </div>
    </div>
  )
}
