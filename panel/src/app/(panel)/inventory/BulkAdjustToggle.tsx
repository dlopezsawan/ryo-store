"use client"

import { useState, useTransition, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Pencil, Save, X, AlertCircle, CheckCircle2 } from "lucide-react"
import { bulkAdjustStockAction, type BulkAdjustEntry, type BulkAdjustResult } from "./actions"

type Toast = { kind: "ok" | "err"; msg: string } | null

/**
 * Toggle de "modo edición masiva". Cuando se activa:
 *  - Cambia los chips de location (read-only) por inputs editables
 *  - Aparece bar sticky abajo con "Guardar cambios" + count de dirty
 *  - Submit hace bulk adjust de todas las celdas modificadas en paralelo
 *
 * Lee los valores iniciales del DOM via [data-stock-cell] y los inputs
 * editables tienen [data-stock-input]. El componente mantiene un Map
 * de cambios pendientes via event delegation.
 */
export function BulkAdjustToggle() {
  const router = useRouter()
  const [editMode, setEditMode] = useState(false)
  const [pending, startTransition] = useTransition()
  const [dirty, setDirty] = useState<Map<string, number>>(new Map())
  const [toast, setToast] = useState<Toast>(null)

  function flash(k: "ok" | "err", m: string) {
    setToast({ kind: k, msg: m })
    setTimeout(() => setToast(null), 5000)
  }

  // Aplicar/quitar atributo en <html> para que CSS active los inputs
  useEffect(() => {
    document.documentElement.setAttribute("data-inventory-edit", editMode ? "true" : "false")
    if (!editMode) setDirty(new Map())
    return () => {
      document.documentElement.removeAttribute("data-inventory-edit")
    }
  }, [editMode])

  // Listen cambios en inputs
  useEffect(() => {
    if (!editMode) return
    function onInput(e: Event) {
      const t = e.target as HTMLInputElement
      if (!t.dataset.stockInput) return
      const itemId = t.dataset.itemId
      const locationId = t.dataset.locationId
      const original = Number(t.dataset.original)
      const current = Number(t.value)
      if (!itemId || !locationId) return
      const key = `${itemId}@${locationId}`
      setDirty((prev) => {
        const next = new Map(prev)
        if (current === original) next.delete(key)
        else next.set(key, current)
        return next
      })
    }
    document.addEventListener("input", onInput)
    return () => document.removeEventListener("input", onInput)
  }, [editMode])

  function save() {
    const entries: BulkAdjustEntry[] = []
    for (const [key, qty] of dirty.entries()) {
      const [inventoryItemId, locationId] = key.split("@")
      entries.push({ inventoryItemId, locationId, stockedQuantity: qty })
    }
    if (entries.length === 0) return
    startTransition(async () => {
      const res: BulkAdjustResult = await bulkAdjustStockAction(entries)
      flash(
        res.failed.length === 0 ? "ok" : "err",
        `${res.ok} ajuste(s) aplicados${res.failed.length > 0 ? ` · ${res.failed.length} fallaron` : ""}`,
      )
      setDirty(new Map())
      setEditMode(false)
      router.refresh()
    })
  }

  function cancel() {
    setEditMode(false)
    setDirty(new Map())
    // Restaurar valores originales en los inputs
    document.querySelectorAll<HTMLInputElement>("[data-stock-input]").forEach((el) => {
      el.value = el.dataset.original ?? "0"
    })
  }

  return (
    <>
      {!editMode ? (
        <button
          type="button"
          onClick={() => setEditMode(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-cream rounded-md text-[10px] font-display font-bold uppercase tracking-wider text-ink hover:bg-cream-2"
          style={{ border: "1.5px solid var(--border)", boxShadow: "3px 3px 0 0 var(--shadow-color)" }}
        >
          <Pencil size={11} strokeWidth={2.5} /> Edición masiva
        </button>
      ) : (
        <button
          type="button"
          onClick={cancel}
          disabled={pending}
          className="flex items-center gap-1.5 px-3 py-2 bg-cream rounded-md text-[10px] font-display font-bold uppercase tracking-wider text-ink hover:bg-cream-2 disabled:opacity-50"
          style={{ border: "1.5px solid var(--border)", boxShadow: "3px 3px 0 0 var(--shadow-color)" }}
        >
          <X size={11} strokeWidth={2.5} /> Salir edición
        </button>
      )}

      {editMode && (
        <div
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 stamp-card px-5 py-3 flex items-center gap-3 bg-page"
          style={{ borderColor: "#FF3B27", boxShadow: "5px 5px 0 0 var(--shadow-color)" }}
        >
          <span className="text-[12px] font-display font-bold uppercase tracking-wider">
            <span className="text-orange num">{dirty.size}</span> celda{dirty.size === 1 ? "" : "s"} modificada{dirty.size === 1 ? "" : "s"}
          </span>
          <button
            type="button"
            onClick={save}
            disabled={pending || dirty.size === 0}
            className="flex items-center gap-1.5 px-4 py-2 bg-orange text-dark rounded-md text-[11px] font-display font-bold uppercase tracking-wider hover:translate-x-[2px] hover:translate-y-[2px] disabled:opacity-50 transition-all"
            style={{ border: "2px solid #1A1A1A", boxShadow: "4px 4px 0 0 var(--shadow-color)" }}
          >
            <Save size={13} strokeWidth={2.5} /> {pending ? "Guardando…" : "Guardar todo"}
          </button>
        </div>
      )}

      {toast && (
        <div
          className="fixed bottom-20 right-6 z-50 px-4 py-3 rounded-md flex items-center gap-2 text-[12px] font-medium animate-in fade-in slide-in-from-bottom-2"
          style={{ background: toast.kind === "ok" ? "#4D5431" : "#BB3B2E", color: "#fff", border: "2px solid #1A1A1A", boxShadow: "4px 4px 0 0 var(--shadow-color)", minWidth: 280, maxWidth: 480 }}
        >
          {toast.kind === "ok" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{toast.msg}</span>
        </div>
      )}
    </>
  )
}
