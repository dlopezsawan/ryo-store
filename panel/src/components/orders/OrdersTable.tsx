"use client"

import { useState, useMemo, useEffect, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  CircleDollarSign, X, AlertCircle, CheckCircle2,
} from "lucide-react"
import { fmtEur, fmtRelative } from "@/lib/utils"
import type { AdminOrderListItem } from "@/lib/medusa"
import { bulkCapturePaymentsAction, bulkCancelOrdersAction, type BulkResult } from "@/app/(panel)/orders/actions"

type Toast = { kind: "ok" | "err"; msg: string } | null

/**
 * Tabla de pedidos con:
 *  - Selección múltiple (checkbox + master)
 *  - Bulk actions toolbar
 *  - Atajos j/k/enter para navegar (cuando no hay focus en input)
 */
export function OrdersTable({ orders }: { orders: AdminOrderListItem[] }) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [activeIdx, setActiveIdx] = useState(-1)
  const [pending, startTransition] = useTransition()
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [toast, setToast] = useState<Toast>(null)

  function flash(k: "ok" | "err", m: string) {
    setToast({ kind: k, msg: m })
    setTimeout(() => setToast(null), 5000)
  }

  // Selección
  const allSelected = orders.length > 0 && orders.every((o) => selected.has(o.id))
  function toggleAll() {
    if (allSelected) setSelected(new Set())
    else setSelected(new Set(orders.map((o) => o.id)))
  }
  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Atajos j/k/enter (sólo cuando no hay input enfocado)
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null
      const tag = target?.tagName
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target?.isContentEditable) return
      if (e.metaKey || e.ctrlKey || e.altKey) return

      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault()
        setActiveIdx((i) => Math.min(orders.length - 1, i < 0 ? 0 : i + 1))
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault()
        setActiveIdx((i) => Math.max(0, i - 1))
      } else if (e.key === "Enter") {
        if (activeIdx >= 0 && activeIdx < orders.length) {
          e.preventDefault()
          router.push(`/orders/${orders[activeIdx].id}`)
        }
      } else if (e.key === "x" || e.key === " ") {
        if (activeIdx >= 0 && activeIdx < orders.length) {
          e.preventDefault()
          toggleOne(orders[activeIdx].id)
        }
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [orders, activeIdx, router])

  function bulkCapture() {
    const ids = Array.from(selected)
    startTransition(async () => {
      const res: BulkResult = await bulkCapturePaymentsAction(ids)
      if (res.failed.length === 0) {
        flash("ok", `${res.ok} pago(s) capturado(s)`)
      } else {
        flash("err", `${res.ok} OK · ${res.failed.length} fallaron — ej: ${res.failed[0].error}`)
      }
      setSelected(new Set())
      router.refresh()
    })
  }

  function bulkCancel() {
    const ids = Array.from(selected)
    startTransition(async () => {
      const res: BulkResult = await bulkCancelOrdersAction(ids)
      if (res.failed.length === 0) {
        flash("ok", `${res.ok} pedido(s) cancelado(s)`)
      } else {
        flash("err", `${res.ok} OK · ${res.failed.length} fallaron — ej: ${res.failed[0].error}`)
      }
      setSelected(new Set())
      setConfirmCancel(false)
      router.refresh()
    })
  }

  const exportUrl = useMemo(() => {
    if (selected.size === 0) return null
    const sp = new URLSearchParams()
    sp.set("ids", Array.from(selected).join(","))
    return `/orders/export?${sp}`
  }, [selected])

  if (orders.length === 0) {
    return (
      <div className="stamp-card p-10 text-center">
        <p className="font-display font-bold text-[14px] uppercase tracking-wider text-ink-3">
          No hay pedidos en este filtro
        </p>
        <p className="text-[12px] text-ink-3 mt-1">Prueba ampliar el rango de fechas o limpiar la búsqueda.</p>
      </div>
    )
  }

  return (
    <>
      {/* Bulk toolbar — sólo si hay selección */}
      {selected.size > 0 && (
        <div
          className="stamp-card p-3 flex items-center gap-3 sticky top-2 z-20 bg-page"
          style={{ borderColor: "#FF3B27" }}
        >
          <span className="text-[12px] font-display font-bold uppercase tracking-wider text-orange">
            {selected.size} seleccionado{selected.size === 1 ? "" : "s"}
          </span>
          <span className="flex-1" />
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            disabled={pending}
            className="px-3 py-1.5 bg-cream rounded-md text-[10px] font-display font-bold uppercase tracking-wider text-ink hover:bg-cream-2 disabled:opacity-50"
            style={{ border: "1.5px solid var(--border)" }}
          >
            Deseleccionar
          </button>
          {exportUrl && (
            <a
              href={exportUrl}
              className="px-3 py-1.5 bg-cream rounded-md text-[10px] font-display font-bold uppercase tracking-wider text-ink hover:bg-cream-2"
              style={{ border: "1.5px solid var(--border)" }}
            >
              Exportar selección
            </a>
          )}
          <button
            type="button"
            onClick={bulkCapture}
            disabled={pending}
            className="flex items-center gap-1 px-3 py-1.5 bg-secondary text-cream rounded-md text-[10px] font-display font-bold uppercase tracking-wider disabled:opacity-50"
            style={{ border: "1.5px solid #1A1A1A" }}
          >
            <CircleDollarSign size={11} strokeWidth={2.5} /> Capturar pagos
          </button>
          {confirmCancel ? (
            <>
              <button
                type="button"
                onClick={bulkCancel}
                disabled={pending}
                className="px-3 py-1.5 bg-primary text-white rounded-md text-[10px] font-display font-bold uppercase tracking-wider disabled:opacity-50"
                style={{ border: "1.5px solid #1A1A1A" }}
              >
                Confirmar cancelar
              </button>
              <button onClick={() => setConfirmCancel(false)} disabled={pending} className="text-ink-3 px-1 disabled:opacity-50">
                <X size={14} />
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmCancel(true)}
              disabled={pending}
              className="flex items-center gap-1 px-3 py-1.5 bg-cream text-primary rounded-md text-[10px] font-display font-bold uppercase tracking-wider hover:bg-primary/5 disabled:opacity-50"
              style={{ border: "1.5px solid #BB3B2E" }}
            >
              <X size={11} strokeWidth={2.5} /> Cancelar
            </button>
          )}
        </div>
      )}

      <div className="stamp-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-dark text-cream text-[10px] uppercase tracking-[0.12em]">
              <th className="px-3 py-3 text-left w-10">
                <input type="checkbox" checked={allSelected} onChange={toggleAll} className="rounded-md" />
              </th>
              <th className="px-3 py-3 text-left font-display font-bold">Pedido</th>
              <th className="px-3 py-3 text-left font-display font-bold">Cliente</th>
              <th className="px-3 py-3 text-left font-display font-bold">Items</th>
              <th className="px-3 py-3 text-right font-display font-bold">Total</th>
              <th className="px-3 py-3 text-left font-display font-bold">Pago</th>
              <th className="px-3 py-3 text-left font-display font-bold">Estado</th>
              <th className="px-3 py-3 text-left font-display font-bold">Fecha</th>
            </tr>
          </thead>
          <tbody className="text-[13px]">
            {orders.map((o, idx) => {
              const customerName =
                [o.customer?.first_name, o.customer?.last_name].filter(Boolean).join(" ") ||
                [o.shipping_address?.first_name, o.shipping_address?.last_name].filter(Boolean).join(" ") ||
                o.email ||
                "Cliente sin nombre"
              const customerEmail = o.customer?.email || o.email || "—"
              const totalItems = o.items?.reduce((s, i) => s + (i.quantity ?? 0), 0) ?? 0
              const discount = Number(o.discount_total) || 0
              const cancelled = o.status === "canceled" || o.status === "archived"
              const isSelected = selected.has(o.id)
              const isActive = idx === activeIdx
              return (
                <tr
                  key={o.id}
                  onClick={(e) => {
                    // Click en row no debe seleccionar si vino del checkbox
                    const target = e.target as HTMLElement
                    if (target.closest("input,a,button")) return
                    setActiveIdx(idx)
                    router.push(`/orders/${o.id}`)
                  }}
                  className={`row-hover row-zebra border-b border-warm-200/50 last:border-b-0 cursor-pointer ${
                    isSelected ? "bg-orange/10" : ""
                  } ${isActive ? "outline outline-2 -outline-offset-2 outline-orange" : ""}`}
                >
                  <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleOne(o.id)}
                      className="rounded-md"
                    />
                  </td>
                  <td className="px-3 py-3">
                    <Link href={`/orders/${o.id}`} className="font-mono font-bold text-ink hover:text-orange">
                      #{o.display_id}
                    </Link>
                  </td>
                  <td className="px-3 py-3">
                    <div className="font-medium text-ink">{customerName}</div>
                    <div className="text-[10px] text-ink-3 font-mono">{customerEmail}</div>
                  </td>
                  <td className="px-3 py-3 text-ink-2 num">{totalItems} ítems</td>
                  <td className="px-3 py-3 text-right">
                    <div className={`font-display font-black text-[14px] num ${cancelled ? "text-ink-3 line-through" : ""}`}>
                      {fmtEur(Number(o.total) || 0)}
                    </div>
                    {discount > 0 && (
                      <div className="text-[10px] text-secondary font-display font-bold num">−{fmtEur(discount)}</div>
                    )}
                  </td>
                  <td className="px-3 py-3"><PaymentPill status={o.payment_status} /></td>
                  <td className="px-3 py-3"><StatusPill status={o.status} fulfillment={o.fulfillment_status} /></td>
                  <td className="px-3 py-3 text-ink-3 font-mono text-[11px] num">{fmtRelative(o.created_at)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {/* hint atajos */}
        <div className="px-4 py-2 text-[10px] font-mono text-ink-3 border-t border-warm-200/50 flex items-center gap-3" style={{ background: "rgb(var(--surface-2))" }}>
          <span><kbd className="px-1 py-0 bg-page" style={{ border: "1px solid var(--border-soft)", borderRadius: 2 }}>j</kbd> <kbd className="px-1 py-0 bg-page" style={{ border: "1px solid var(--border-soft)", borderRadius: 2 }}>k</kbd> navegar</span>
          <span><kbd className="px-1 py-0 bg-page" style={{ border: "1px solid var(--border-soft)", borderRadius: 2 }}>↵</kbd> abrir</span>
          <span><kbd className="px-1 py-0 bg-page" style={{ border: "1px solid var(--border-soft)", borderRadius: 2 }}>x</kbd> seleccionar</span>
        </div>
      </div>

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

function StatusPill({ status, fulfillment }: { status?: string | null; fulfillment?: string | null }) {
  // Estado unificado:
  //   1. canceled / archived → tienen prioridad absoluta
  //   2. fulfillment delivered/shipped/fulfilled → muestra esa fase
  //   3. status completed → Completado
  //   4. else → Pendiente
  let label = "Pendiente"
  let cls = "text-orange"
  if (status === "canceled") { label = "Cancelado"; cls = "text-primary" }
  else if (status === "archived") { label = "Archivado"; cls = "text-ink-3" }
  else if (fulfillment === "delivered") { label = "Entregado"; cls = "text-secondary" }
  else if (fulfillment === "shipped") { label = "Enviado"; cls = "text-secondary" }
  else if (fulfillment === "fulfilled") { label = "Preparado"; cls = "text-secondary" }
  else if (fulfillment === "partially_shipped") { label = "Envío parcial"; cls = "text-orange" }
  else if (fulfillment === "partially_fulfilled") { label = "Prep. parcial"; cls = "text-orange" }
  else if (fulfillment === "returned" || fulfillment === "partially_returned") { label = "Devolución"; cls = "text-primary" }
  else if (status === "completed") { label = "Completado"; cls = "text-secondary" }
  else if (status === "requires_action") { label = "Acción"; cls = "text-orange" }
  return (
    <span className={`pill ${cls}`}>
      <span className="pill-dot" />
      {label}
    </span>
  )
}

function PaymentPill({ status }: { status?: string | null }) {
  const map: Record<string, { label: string; cls: string }> = {
    captured:   { label: "Pagado",     cls: "text-secondary" },
    authorized: { label: "Autorizado", cls: "text-secondary" },
    awaiting:   { label: "P. Móvil",   cls: "text-orange" },
    not_paid:   { label: "Sin pagar",  cls: "text-ink-3" },
    canceled:   { label: "Cancelado",  cls: "text-primary" },
    refunded:   { label: "Devuelto",   cls: "text-primary" },
    partially_refunded: { label: "Refund parcial", cls: "text-orange" },
  }
  const m = map[status ?? ""] ?? { label: status ?? "—", cls: "text-ink-3" }
  return (
    <span className={`pill ${m.cls}`}>
      <span className="pill-dot" />
      {m.label}
    </span>
  )
}
