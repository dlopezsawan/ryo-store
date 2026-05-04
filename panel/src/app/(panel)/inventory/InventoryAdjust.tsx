"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Pencil, AlertCircle, CheckCircle2 } from "lucide-react"
import { adjustStockAction } from "./actions"

interface LocationStock {
  locationId: string
  locationName: string
  stockedQuantity: number
  reservedQuantity: number
  /** ¿Existe ya el level para este (item, location)? Si no, se crea con POST */
  exists: boolean
}

interface Props {
  inventoryItemId: string
  itemTitle: string
  itemSku?: string | null
  locations: LocationStock[]
}

export function InventoryAdjust({ inventoryItemId, itemTitle, itemSku, locations }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [toast, setToast] = useState<{ kind: "ok" | "err"; msg: string } | null>(null)
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(locations.map((l) => [l.locationId, String(l.stockedQuantity)])),
  )

  function flash(kind: "ok" | "err", msg: string) {
    setToast({ kind, msg })
    setTimeout(() => setToast(null), 4000)
  }

  function save() {
    startTransition(async () => {
      const dirty = locations.filter(
        (l) => values[l.locationId] !== String(l.stockedQuantity),
      )
      if (dirty.length === 0) {
        setOpen(false)
        return
      }
      // Procesamos en serie para no chocar con concurrencia en levels nuevos
      for (const loc of dirty) {
        const qty = Number(values[loc.locationId])
        if (!Number.isFinite(qty) || qty < 0) {
          flash("err", `Cantidad inválida en ${loc.locationName}`)
          return
        }
        const res = await adjustStockAction({
          inventoryItemId,
          locationId: loc.locationId,
          stockedQuantity: qty,
          exists: loc.exists,
        })
        if (!res.ok) {
          flash("err", res.error)
          return
        }
      }
      flash("ok", `Stock actualizado · ${dirty.length} ${dirty.length === 1 ? "ubicación" : "ubicaciones"}`)
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="px-2.5 py-1 rounded-md font-display font-bold text-[10px] uppercase tracking-wider bg-cream hover:bg-cream-2 text-ink flex items-center gap-1"
        style={{ border: "1.5px solid var(--border)" }}
      >
        <Pencil size={11} strokeWidth={2.4} /> Ajustar
      </button>

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

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0, 0, 0, 0.5)" }}
          onClick={() => !pending && setOpen(false)}
        >
          <div
            className="bg-page rounded-md max-w-md w-full p-6"
            style={{ border: "2.5px solid var(--border)", boxShadow: "5px 5px 0 0 var(--shadow-color)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display font-black text-[18px] uppercase tracking-tight text-ink">
              Ajustar stock
            </h3>
            <p className="text-[12px] text-ink-2 mt-1">{itemTitle}</p>
            {itemSku && (
              <p className="text-[10px] text-ink-3 font-mono mt-0.5">{itemSku}</p>
            )}

            <div className="mt-4 space-y-3">
              {locations.length === 0 && (
                <p className="text-[12px] text-ink-3">
                  Este item no tiene location levels aún. Crea uno desde Medusa primero.
                </p>
              )}
              {locations.map((loc) => (
                <div key={loc.locationId} className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-display font-bold uppercase tracking-wider text-ink">
                      {loc.locationName}
                    </div>
                    <div className="text-[10px] text-ink-3 font-mono">
                      reservado: {loc.reservedQuantity}
                    </div>
                  </div>
                  <input
                    type="number"
                    min={0}
                    value={values[loc.locationId] ?? ""}
                    onChange={(e) =>
                      setValues((v) => ({ ...v, [loc.locationId]: e.target.value }))
                    }
                    className="w-24 px-3 py-2 bg-cream rounded-md text-[13px] font-mono num text-right focus:outline-none"
                    style={{ border: "1.5px solid var(--border)" }}
                  />
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 mt-5 justify-end">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={pending}
                className="px-4 py-2 bg-cream rounded-md text-[11px] font-display font-bold uppercase tracking-wider text-ink hover:bg-cream-2 disabled:opacity-50"
                style={{ border: "1.5px solid var(--border)" }}
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={pending || locations.length === 0}
                onClick={save}
                className="px-4 py-2 bg-orange text-dark rounded-md text-[11px] font-display font-bold uppercase tracking-wider hover:translate-x-[2px] hover:translate-y-[2px] disabled:opacity-50 transition-all"
                style={{ border: "2px solid #1A1A1A", boxShadow: "4px 4px 0 0 var(--shadow-color)" }}
              >
                {pending ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
