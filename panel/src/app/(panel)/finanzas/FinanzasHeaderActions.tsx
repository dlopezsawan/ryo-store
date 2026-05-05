"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Plus, ArrowRightLeft, FileDown, AlertCircle, CheckCircle2 } from "lucide-react"
import { createConversionAction } from "./actions"

type Toast = { kind: "ok" | "err"; msg: string } | null
type Mode = null | "conversion"

export function FinanzasHeaderActions() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>(null)
  const [pending, startTransition] = useTransition()
  const [toast, setToast] = useState<Toast>(null)

  // Standalone conversion form. Backend POST /admin/finanzas/conversions
  // accepts pago_movil_id as optional — when omitted, it records a
  // manual Bs→USDT swap from the business wallet without linking to a
  // specific customer payment. Twin ledger entries are still written so
  // wallet balances stay accurate.
  const [conv, setConv] = useState({
    date: new Date().toISOString().slice(0, 10),
    amount_bs: 0,
    amount_usdt: 0,
    reference: "",
    notes: "",
  })

  function flash(k: "ok" | "err", m: string) {
    setToast({ kind: k, msg: m })
    setTimeout(() => setToast(null), 4000)
  }

  function submitConversion() {
    startTransition(async () => {
      const res = await createConversionAction(conv)
      if (!res.ok) return flash("err", res.error)
      flash("ok", "Conversión registrada")
      setConv({ date: new Date().toISOString().slice(0, 10), amount_bs: 0, amount_usdt: 0, reference: "", notes: "" })
      setMode(null)
      router.refresh()
    })
  }

  const rate = conv.amount_bs > 0 && conv.amount_usdt > 0 ? conv.amount_bs / conv.amount_usdt : 0

  return (
    <>
      <button
        type="button"
        onClick={() => setMode("conversion")}
        className="flex items-center gap-1.5 px-3 py-2 bg-cream rounded-md text-[10px] font-display font-bold uppercase tracking-wider text-ink hover:bg-cream-2"
        style={{ border: "1.5px solid var(--border)", boxShadow: "3px 3px 0 0 var(--shadow-color)" }}
      >
        <ArrowRightLeft size={11} strokeWidth={2.5} /> Conversión
      </button>
      <Link
        href="/finanzas/expenses"
        className="flex items-center gap-1.5 px-3 py-2 bg-cream rounded-md text-[10px] font-display font-bold uppercase tracking-wider text-ink hover:bg-cream-2"
        style={{ border: "1.5px solid var(--border)", boxShadow: "3px 3px 0 0 var(--shadow-color)" }}
      >
        <FileDown size={11} strokeWidth={2.5} /> Ver gastos
      </Link>
      <Link
        href="/finanzas/expenses"
        className="flex items-center gap-1.5 px-3 py-2 bg-orange text-dark rounded-md text-[10px] font-display font-bold uppercase tracking-wider transition-all hover:translate-x-[2px] hover:translate-y-[2px]"
        style={{ border: "2px solid #1A1A1A", boxShadow: "4px 4px 0 0 var(--shadow-color)" }}
      >
        <Plus size={11} strokeWidth={3} /> Nuevo gasto
      </Link>

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-md flex items-center gap-2 text-[12px] font-medium animate-in fade-in slide-in-from-bottom-2"
          style={{ background: toast.kind === "ok" ? "#4D5431" : "#BB3B2E", color: "#fff", border: "2px solid #1A1A1A", boxShadow: "4px 4px 0 0 var(--shadow-color)", minWidth: 280, maxWidth: 480 }}>
          {toast.kind === "ok" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{toast.msg}</span>
        </div>
      )}

      {mode === "conversion" && (
        <Modal onClose={() => setMode(null)} pending={pending}>
          <h3 className="font-display font-black text-[18px] uppercase tracking-tight text-ink mb-1">Nueva conversión Bs → USDT</h3>
          <p className="text-[11px] text-ink-3 mb-4">Registro manual de la conversión de Bs (Pago Móvil) a USDT en Binance.</p>
          <div className="space-y-3">
            <Field label="Fecha">
              <input type="date" value={conv.date} onChange={(e) => setConv((f) => ({ ...f, date: e.target.value }))}
                className="w-full px-3 py-2 bg-cream rounded-md text-[12px] font-mono focus:outline-none" style={{ border: "1.5px solid var(--border)" }} />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Monto Bs *">
                <input type="number" min={0} step="0.01" value={conv.amount_bs || ""}
                  onChange={(e) => setConv((f) => ({ ...f, amount_bs: Number(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 bg-cream rounded-md text-[12px] font-mono num text-right focus:outline-none" style={{ border: "1.5px solid var(--border)" }} />
              </Field>
              <Field label="USDT recibidos *">
                <input type="number" min={0} step="0.01" value={conv.amount_usdt || ""}
                  onChange={(e) => setConv((f) => ({ ...f, amount_usdt: Number(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 bg-cream rounded-md text-[12px] font-mono num text-right focus:outline-none" style={{ border: "1.5px solid var(--border)" }} />
              </Field>
            </div>
            {rate > 0 && (
              <div className="text-[11px] font-mono text-ink-3 num text-right">
                Tasa implícita: <span className="font-bold text-orange">{rate.toFixed(2)} Bs/USDT</span>
              </div>
            )}
            <Field label="Referencia bancaria">
              <input type="text" value={conv.reference} onChange={(e) => setConv((f) => ({ ...f, reference: e.target.value }))}
                className="w-full px-3 py-2 bg-cream rounded-md text-[12px] font-mono focus:outline-none" style={{ border: "1.5px solid var(--border)" }} />
            </Field>
            <Field label="Notas">
              <textarea rows={2} value={conv.notes} onChange={(e) => setConv((f) => ({ ...f, notes: e.target.value }))}
                className="w-full px-3 py-2 bg-cream rounded-md text-[12px] focus:outline-none resize-none" style={{ border: "1.5px solid var(--border)" }} />
            </Field>
          </div>
          <Footer onCancel={() => setMode(null)} onSubmit={submitConversion} pending={pending}
            disabled={!(conv.amount_bs > 0) || !(conv.amount_usdt > 0)} label="Registrar conversión" />
        </Modal>
      )}
    </>
  )
}

function Modal({ onClose, pending, children }: { onClose: () => void; pending: boolean; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)" }} onClick={() => !pending && onClose()}>
      <div className="bg-page rounded-md max-w-md w-full p-6" style={{ border: "2.5px solid var(--border)", boxShadow: "5px 5px 0 0 var(--shadow-color)" }} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  )
}

function Footer({ onCancel, onSubmit, pending, disabled, label }: { onCancel: () => void; onSubmit: () => void; pending: boolean; disabled: boolean; label: string }) {
  return (
    <div className="flex items-center justify-end gap-2 mt-5">
      <button type="button" onClick={onCancel} disabled={pending}
        className="px-4 py-2 bg-cream rounded-md text-[11px] font-display font-bold uppercase tracking-wider text-ink hover:bg-cream-2 disabled:opacity-50" style={{ border: "1.5px solid var(--border)" }}>
        Cancelar
      </button>
      <button type="button" onClick={onSubmit} disabled={pending || disabled}
        className="px-4 py-2 bg-orange text-dark rounded-md text-[11px] font-display font-bold uppercase tracking-wider hover:translate-x-[2px] hover:translate-y-[2px] disabled:opacity-50 transition-all"
        style={{ border: "2px solid #1A1A1A", boxShadow: "4px 4px 0 0 var(--shadow-color)" }}>
        {pending ? "Guardando…" : label}
      </button>
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
