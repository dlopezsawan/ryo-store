"use client"

import { useState, useTransition, useMemo } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Plus, ArrowRightLeft, FileDown, AlertCircle, CheckCircle2, Send } from "lucide-react"
import { createConversionAction, createTransferAction } from "./actions"

type Toast = { kind: "ok" | "err"; msg: string } | null
type Mode = null | "conversion" | "transfer"

/**
 * Wallet shape consumed by this component. Matches the slim
 * FinanzasWalletBalance returned by /finanzas/summary; we only need
 * the four fields below for selectors. The full balance is shown next
 * to each wallet name as an affordance — operators can confirm they're
 * picking the right account before moving funds.
 */
export type WalletOption = {
  id: string
  name: string
  currency: string
  balance: number
}

export function FinanzasHeaderActions({ wallets }: { wallets: WalletOption[] }) {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>(null)
  const [pending, startTransition] = useTransition()
  const [toast, setToast] = useState<Toast>(null)

  // Wallets bucketed by currency for the per-side selectors. We keep
  // the original list ordering (sort_order from the DB) so the visual
  // order matches the wallet management screen.
  const bsWallets = useMemo(() => wallets.filter((w) => w.currency === "bs"), [wallets])
  const usdtWallets = useMemo(() => wallets.filter((w) => w.currency === "usdt"), [wallets])

  // Standalone conversion form. Backend POST /admin/finanzas/conversions
  // accepts pago_movil_id as optional — when omitted, it records a
  // manual Bs→USDT swap from the business wallet without linking to a
  // specific customer payment. Twin ledger entries are still written so
  // wallet balances stay accurate.
  //
  // source_wallet_id / dest_wallet_id default to the first wallet of
  // each currency to mirror what the backend would pick anyway, but
  // surfaced to the operator so the choice is intentional rather than
  // a silent fallback.
  const [conv, setConv] = useState({
    date: new Date().toISOString().slice(0, 10),
    amount_bs: 0,
    amount_usdt: 0,
    reference: "",
    notes: "",
    source_wallet_id: bsWallets[0]?.id ?? "",
    dest_wallet_id: usdtWallets[0]?.id ?? "",
  })

  // Transfer form for wallet → wallet movements (same or cross-currency).
  // amount_received is only required when the wallets are different
  // currencies; otherwise it equals amount.
  const [xfer, setXfer] = useState({
    date: new Date().toISOString().slice(0, 10),
    from_wallet_id: wallets[0]?.id ?? "",
    to_wallet_id: wallets[1]?.id ?? "",
    amount: 0,
    amount_received: 0,
    note: "",
  })

  const fromWallet = useMemo(() => wallets.find((w) => w.id === xfer.from_wallet_id), [wallets, xfer.from_wallet_id])
  const toWallet = useMemo(() => wallets.find((w) => w.id === xfer.to_wallet_id), [wallets, xfer.to_wallet_id])
  const isCrossCurrency = !!fromWallet && !!toWallet && fromWallet.currency !== toWallet.currency

  function flash(k: "ok" | "err", m: string) {
    setToast({ kind: k, msg: m })
    setTimeout(() => setToast(null), 4000)
  }

  function submitConversion() {
    startTransition(async () => {
      const res = await createConversionAction(conv)
      if (!res.ok) return flash("err", res.error)
      flash("ok", "Conversión registrada")
      setConv({
        date: new Date().toISOString().slice(0, 10),
        amount_bs: 0,
        amount_usdt: 0,
        reference: "",
        notes: "",
        source_wallet_id: bsWallets[0]?.id ?? "",
        dest_wallet_id: usdtWallets[0]?.id ?? "",
      })
      setMode(null)
      router.refresh()
    })
  }

  function submitTransfer() {
    if (xfer.from_wallet_id === xfer.to_wallet_id) {
      return flash("err", "Las wallets deben ser distintas")
    }
    startTransition(async () => {
      const res = await createTransferAction({
        from_wallet_id: xfer.from_wallet_id,
        to_wallet_id: xfer.to_wallet_id,
        amount: xfer.amount,
        // Only forward amount_received in cross-currency case — for same-
        // currency transfers the backend mirrors `amount` automatically.
        amount_received: isCrossCurrency ? xfer.amount_received : undefined,
        note: xfer.note,
        transferred_at: xfer.date,
      })
      if (!res.ok) return flash("err", res.error)
      flash("ok", "Transferencia registrada")
      setXfer({
        date: new Date().toISOString().slice(0, 10),
        from_wallet_id: wallets[0]?.id ?? "",
        to_wallet_id: wallets[1]?.id ?? "",
        amount: 0,
        amount_received: 0,
        note: "",
      })
      setMode(null)
      router.refresh()
    })
  }

  const rate = conv.amount_bs > 0 && conv.amount_usdt > 0 ? conv.amount_bs / conv.amount_usdt : 0
  const xferRate = isCrossCurrency && xfer.amount > 0 && xfer.amount_received > 0
    ? xfer.amount / xfer.amount_received
    : 0

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
      <button
        type="button"
        onClick={() => setMode("transfer")}
        className="flex items-center gap-1.5 px-3 py-2 bg-cream rounded-md text-[10px] font-display font-bold uppercase tracking-wider text-ink hover:bg-cream-2"
        style={{ border: "1.5px solid var(--border)", boxShadow: "3px 3px 0 0 var(--shadow-color)" }}
      >
        <Send size={11} strokeWidth={2.5} /> Transferencia
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
            <div className="grid grid-cols-2 gap-2">
              <Field label="Wallet origen (Bs)">
                <WalletSelect
                  options={bsWallets}
                  value={conv.source_wallet_id}
                  onChange={(v) => setConv((f) => ({ ...f, source_wallet_id: v }))}
                  emptyHint="No hay wallets en Bs"
                />
              </Field>
              <Field label="Wallet destino (USDT) *">
                <WalletSelect
                  options={usdtWallets}
                  value={conv.dest_wallet_id}
                  onChange={(v) => setConv((f) => ({ ...f, dest_wallet_id: v }))}
                  emptyHint="No hay wallets en USDT"
                />
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
            disabled={!(conv.amount_bs > 0) || !(conv.amount_usdt > 0) || !conv.dest_wallet_id} label="Registrar conversión" />
        </Modal>
      )}

      {mode === "transfer" && (
        <Modal onClose={() => setMode(null)} pending={pending}>
          <h3 className="font-display font-black text-[18px] uppercase tracking-tight text-ink mb-1">Transferencia entre wallets</h3>
          <p className="text-[11px] text-ink-3 mb-4">
            Mover dinero de una wallet a otra. Mismo signo de moneda → solo mueve fondos. Distinta moneda → registra también el monto recibido (similar a una conversión).
          </p>
          <div className="space-y-3">
            <Field label="Fecha">
              <input type="date" value={xfer.date} onChange={(e) => setXfer((f) => ({ ...f, date: e.target.value }))}
                className="w-full px-3 py-2 bg-cream rounded-md text-[12px] font-mono focus:outline-none" style={{ border: "1.5px solid var(--border)" }} />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Desde *">
                <WalletSelect
                  options={wallets}
                  value={xfer.from_wallet_id}
                  onChange={(v) => setXfer((f) => ({ ...f, from_wallet_id: v }))}
                />
              </Field>
              <Field label="Hacia *">
                <WalletSelect
                  options={wallets.filter((w) => w.id !== xfer.from_wallet_id)}
                  value={xfer.to_wallet_id}
                  onChange={(v) => setXfer((f) => ({ ...f, to_wallet_id: v }))}
                />
              </Field>
            </div>
            <Field label={`Monto ${fromWallet ? `(${fromWallet.currency.toUpperCase()})` : ""} *`}>
              <input type="number" min={0} step="0.01" value={xfer.amount || ""}
                onChange={(e) => setXfer((f) => ({ ...f, amount: Number(e.target.value) || 0 }))}
                className="w-full px-3 py-2 bg-cream rounded-md text-[12px] font-mono num text-right focus:outline-none" style={{ border: "1.5px solid var(--border)" }} />
            </Field>
            {isCrossCurrency && (
              <Field label={`Monto recibido (${toWallet?.currency.toUpperCase()}) *`}>
                <input type="number" min={0} step="0.01" value={xfer.amount_received || ""}
                  onChange={(e) => setXfer((f) => ({ ...f, amount_received: Number(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 bg-cream rounded-md text-[12px] font-mono num text-right focus:outline-none" style={{ border: "1.5px solid var(--border)" }} />
              </Field>
            )}
            {xferRate > 0 && (
              <div className="text-[11px] font-mono text-ink-3 num text-right">
                Tasa implícita: <span className="font-bold text-orange">{xferRate.toFixed(2)} {fromWallet?.currency}/{toWallet?.currency}</span>
              </div>
            )}
            <Field label="Nota">
              <textarea rows={2} value={xfer.note} onChange={(e) => setXfer((f) => ({ ...f, note: e.target.value }))}
                placeholder="Ej: ajuste de balances entre Daniel y Leo"
                className="w-full px-3 py-2 bg-cream rounded-md text-[12px] focus:outline-none resize-none" style={{ border: "1.5px solid var(--border)" }} />
            </Field>
          </div>
          <Footer onCancel={() => setMode(null)} onSubmit={submitTransfer} pending={pending}
            disabled={
              !xfer.from_wallet_id ||
              !xfer.to_wallet_id ||
              xfer.from_wallet_id === xfer.to_wallet_id ||
              !(xfer.amount > 0) ||
              (isCrossCurrency && !(xfer.amount_received > 0))
            }
            label="Registrar transferencia" />
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

/**
 * Wallet picker. Shows the current balance next to each option so
 * operators don't accidentally drain the wrong account — especially
 * useful when there are several wallets in the same currency (e.g.
 * "Daniel USDT" vs "Leo USDT"). Empty state shows a hint instead of
 * a useless empty <select>.
 */
function WalletSelect({
  options,
  value,
  onChange,
  emptyHint = "No hay wallets disponibles",
}: {
  options: WalletOption[]
  value: string
  onChange: (v: string) => void
  emptyHint?: string
}) {
  if (options.length === 0) {
    return (
      <div className="px-3 py-2 bg-cream rounded-md text-[11px] text-ink-3 italic" style={{ border: "1.5px dashed var(--border)" }}>
        {emptyHint}
      </div>
    )
  }
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2 bg-cream rounded-md text-[12px] font-mono focus:outline-none"
      style={{ border: "1.5px solid var(--border)" }}
    >
      {options.map((w) => (
        <option key={w.id} value={w.id}>
          {w.name} · {w.balance.toFixed(2)} {w.currency.toUpperCase()}
        </option>
      ))}
    </select>
  )
}
