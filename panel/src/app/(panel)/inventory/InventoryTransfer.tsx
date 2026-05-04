"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { ArrowRightLeft, AlertCircle, CheckCircle2 } from "lucide-react"
import { transferInventoryAction } from "./actions"

interface LocationStock {
  locationId: string
  locationName: string
  stockedQuantity: number
}

interface Props {
  inventoryItemId: string
  itemTitle: string
  locations: LocationStock[]
}

type Toast = { kind: "ok" | "err"; msg: string } | null

export function InventoryTransfer({ inventoryItemId, itemTitle, locations }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [toast, setToast] = useState<Toast>(null)
  const [fromId, setFromId] = useState(locations[0]?.locationId ?? "")
  const [toId, setToId] = useState(locations[1]?.locationId ?? "")
  const [qty, setQty] = useState(1)

  function flash(k: "ok" | "err", m: string) {
    setToast({ kind: k, msg: m })
    setTimeout(() => setToast(null), 4000)
  }

  const fromLoc = locations.find((l) => l.locationId === fromId)
  const toLoc = locations.find((l) => l.locationId === toId)
  const canSubmit = fromId && toId && fromId !== toId && qty > 0 && (fromLoc?.stockedQuantity ?? 0) >= qty

  function submit() {
    startTransition(async () => {
      const res = await transferInventoryAction({
        inventoryItemId,
        fromLocationId: fromId,
        toLocationId: toId,
        quantity: qty,
      })
      if (!res.ok) return flash("err", res.error)
      flash("ok", `${qty} unidades transferidas (${fromLoc?.locationName} → ${toLoc?.locationName})`)
      setOpen(false)
      setQty(1)
      router.refresh()
    })
  }

  // Si solo hay una location no tiene sentido transferir
  if (locations.length < 2) return null

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Transferir entre locations"
        className="px-2 py-1 rounded-md font-display font-bold text-[10px] uppercase tracking-wider bg-cream hover:bg-cream-2 text-ink flex items-center gap-1"
        style={{ border: "1.5px solid var(--border)" }}
      >
        <ArrowRightLeft size={11} strokeWidth={2.4} /> Transferir
      </button>

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-md flex items-center gap-2 text-[12px] font-medium animate-in fade-in slide-in-from-bottom-2"
          style={{ background: toast.kind === "ok" ? "#4D5431" : "#BB3B2E", color: "#fff", border: "2px solid #1A1A1A", boxShadow: "4px 4px 0 0 var(--shadow-color)", minWidth: 280, maxWidth: 480 }}>
          {toast.kind === "ok" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{toast.msg}</span>
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)" }} onClick={() => !pending && setOpen(false)}>
          <div className="bg-page rounded-md max-w-md w-full p-6" style={{ border: "2.5px solid var(--border)", boxShadow: "5px 5px 0 0 var(--shadow-color)" }} onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display font-black text-[18px] uppercase tracking-tight text-ink mb-1">
              Transferir stock
            </h3>
            <p className="text-[12px] text-ink-2 mb-4">{itemTitle}</p>

            <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-end">
              <div>
                <label className="block text-[10px] font-display font-bold uppercase tracking-[0.18em] text-ink-2 mb-1.5">Desde</label>
                <select value={fromId} onChange={(e) => setFromId(e.target.value)}
                  className="w-full px-3 py-2 bg-cream rounded-md text-[12px] focus:outline-none" style={{ border: "1.5px solid var(--border)" }}>
                  {locations.map((l) => (
                    <option key={l.locationId} value={l.locationId}>
                      {l.locationName} · {l.stockedQuantity} u
                    </option>
                  ))}
                </select>
              </div>
              <div className="pb-2 text-orange">
                <ArrowRightLeft size={20} strokeWidth={2.4} />
              </div>
              <div>
                <label className="block text-[10px] font-display font-bold uppercase tracking-[0.18em] text-ink-2 mb-1.5">Hacia</label>
                <select value={toId} onChange={(e) => setToId(e.target.value)}
                  className="w-full px-3 py-2 bg-cream rounded-md text-[12px] focus:outline-none" style={{ border: "1.5px solid var(--border)" }}>
                  {locations.map((l) => (
                    <option key={l.locationId} value={l.locationId} disabled={l.locationId === fromId}>
                      {l.locationName} · {l.stockedQuantity} u
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-[10px] font-display font-bold uppercase tracking-[0.18em] text-ink-2 mb-1.5">Cantidad</label>
              <input type="number" min={1} max={fromLoc?.stockedQuantity ?? 0} value={qty}
                onChange={(e) => setQty(Math.max(1, Math.min(fromLoc?.stockedQuantity ?? 0, Number(e.target.value) || 1)))}
                className="w-32 px-3 py-2 bg-cream rounded-md text-[14px] font-mono num text-right focus:outline-none" style={{ border: "1.5px solid var(--border)" }} />
              <p className="text-[10px] text-ink-3 font-mono mt-1.5">
                Disponible en origen: {fromLoc?.stockedQuantity ?? 0}
                {fromLoc && qty > fromLoc.stockedQuantity && (
                  <span className="text-primary"> · excede stock disponible</span>
                )}
              </p>
            </div>

            {fromId === toId && (
              <p className="text-[11px] text-primary mt-3">Origen y destino deben ser distintos.</p>
            )}

            <div className="flex items-center justify-end gap-2 mt-5">
              <button type="button" onClick={() => setOpen(false)} disabled={pending}
                className="px-4 py-2 bg-cream rounded-md text-[11px] font-display font-bold uppercase tracking-wider text-ink hover:bg-cream-2 disabled:opacity-50"
                style={{ border: "1.5px solid var(--border)" }}>
                Cancelar
              </button>
              <button type="button" onClick={submit} disabled={pending || !canSubmit}
                className="px-4 py-2 bg-orange text-dark rounded-md text-[11px] font-display font-bold uppercase tracking-wider hover:translate-x-[2px] hover:translate-y-[2px] disabled:opacity-50 transition-all"
                style={{ border: "2px solid #1A1A1A", boxShadow: "4px 4px 0 0 var(--shadow-color)" }}>
                {pending ? "Transfiriendo…" : `Transferir ${qty}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
