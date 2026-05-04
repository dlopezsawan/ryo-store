"use client"

import { useState, useEffect, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Users, Trash2, Download, X, AlertCircle, CheckCircle2 } from "lucide-react"
import { bulkAddToGroupAction, bulkDeleteCustomersAction, type BulkResult } from "./actions"

interface Props {
  customerIds: string[]
  groups: Array<{ id: string; name: string }>
}

type Toast = { kind: "ok" | "err"; msg: string } | null

/**
 * Bulk toolbar para /customers. Lee selección desde el DOM via los
 * inputs[type=checkbox][data-customer-id] que el page.tsx renderiza.
 *
 * Manejamos el estado aquí (no en page.tsx) porque page es Server Component.
 * Los checkboxes en el server component sólo necesitan tener el atributo
 * `data-customer-id` para que los podamos identificar.
 */
export function CustomersBulkBar({ customerIds, groups }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirmDel, setConfirmDel] = useState(false)
  const [groupId, setGroupId] = useState("")
  const [toast, setToast] = useState<Toast>(null)

  function flash(k: "ok" | "err", m: string) {
    setToast({ kind: k, msg: m })
    setTimeout(() => setToast(null), 5000)
  }

  // Subscribe a cambios en checkboxes via delegación de eventos
  useEffect(() => {
    function onChange(e: Event) {
      const t = e.target as HTMLInputElement
      if (t.type !== "checkbox") return
      const id = t.dataset.customerId
      if (!id) return
      setSelected((prev) => {
        const next = new Set(prev)
        if (t.checked) next.add(id)
        else next.delete(id)
        return next
      })
    }
    document.addEventListener("change", onChange)
    return () => document.removeEventListener("change", onChange)
  }, [])

  // Master toggle
  useEffect(() => {
    const master = document.querySelector("[data-customer-master]") as HTMLInputElement | null
    if (!master) return
    function onMaster(e: Event) {
      const t = e.target as HTMLInputElement
      const all = document.querySelectorAll<HTMLInputElement>("[data-customer-id]")
      all.forEach((cb) => {
        cb.checked = t.checked
      })
      setSelected(t.checked ? new Set(customerIds) : new Set())
    }
    master.addEventListener("change", onMaster)
    return () => master.removeEventListener("change", onMaster)
  }, [customerIds])

  function bulkAdd() {
    if (!groupId) return
    const ids = Array.from(selected)
    startTransition(async () => {
      const res: BulkResult = await bulkAddToGroupAction(ids, groupId)
      flash(res.failed.length === 0 ? "ok" : "err",
        `${res.ok} cliente(s) añadido(s) al segmento${res.failed.length > 0 ? ` · ${res.failed.length} fallaron` : ""}`)
      clear()
      router.refresh()
    })
  }

  function bulkDel() {
    const ids = Array.from(selected)
    startTransition(async () => {
      const res: BulkResult = await bulkDeleteCustomersAction(ids)
      flash(res.failed.length === 0 ? "ok" : "err",
        `${res.ok} eliminado(s)${res.failed.length > 0 ? ` · ${res.failed.length} fallaron` : ""}`)
      setConfirmDel(false)
      clear()
      router.refresh()
    })
  }

  function clear() {
    setSelected(new Set())
    document.querySelectorAll<HTMLInputElement>("[data-customer-id]").forEach((cb) => { cb.checked = false })
    const master = document.querySelector("[data-customer-master]") as HTMLInputElement | null
    if (master) master.checked = false
  }

  if (selected.size === 0) {
    return (
      <>
        {toast && (
          <div
            className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-md flex items-center gap-2 text-[12px] font-medium animate-in fade-in slide-in-from-bottom-2"
            style={{ background: toast.kind === "ok" ? "#4D5431" : "#BB3B2E", color: "#fff", border: "2px solid #1A1A1A", boxShadow: "4px 4px 0 0 var(--shadow-color)", minWidth: 280, maxWidth: 480 }}
          >
            {toast.kind === "ok" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{toast.msg}</span>
          </div>
        )}
      </>
    )
  }

  const exportSp = new URLSearchParams()
  exportSp.set("ids", Array.from(selected).join(","))

  return (
    <>
      <div
        className="stamp-card p-3 flex items-center gap-3 sticky top-2 z-20 bg-page mb-4"
        style={{ borderColor: "#FF3B27" }}
      >
        <span className="text-[12px] font-display font-bold uppercase tracking-wider text-orange">
          {selected.size} cliente{selected.size === 1 ? "" : "s"} seleccionado{selected.size === 1 ? "" : "s"}
        </span>
        <span className="flex-1" />

        <a
          href={`/customers/export?${exportSp}`}
          className="flex items-center gap-1 px-3 py-1.5 bg-cream rounded-md text-[10px] font-display font-bold uppercase tracking-wider text-ink hover:bg-cream-2"
          style={{ border: "1.5px solid var(--border)" }}
        >
          <Download size={11} strokeWidth={2.5} /> Exportar selección
        </a>

        {groups.length > 0 && (
          <div className="flex items-center gap-1">
            <select
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
              className="px-2 py-1.5 bg-cream rounded-md text-[10px] font-display font-bold uppercase tracking-wider text-ink"
              style={{ border: "1.5px solid var(--border)" }}
            >
              <option value="">— segmento —</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={bulkAdd}
              disabled={pending || !groupId}
              className="flex items-center gap-1 px-3 py-1.5 bg-secondary text-cream rounded-md text-[10px] font-display font-bold uppercase tracking-wider disabled:opacity-50"
              style={{ border: "1.5px solid #1A1A1A" }}
            >
              <Users size={11} strokeWidth={2.5} /> Añadir
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={clear}
          disabled={pending}
          className="px-3 py-1.5 bg-cream rounded-md text-[10px] font-display font-bold uppercase tracking-wider text-ink hover:bg-cream-2 disabled:opacity-50"
          style={{ border: "1.5px solid var(--border)" }}
        >
          Deseleccionar
        </button>

        {confirmDel ? (
          <>
            <button
              type="button"
              onClick={bulkDel}
              disabled={pending}
              className="px-3 py-1.5 bg-primary text-white rounded-md text-[10px] font-display font-bold uppercase tracking-wider disabled:opacity-50"
              style={{ border: "1.5px solid #1A1A1A" }}
            >
              Confirmar eliminar
            </button>
            <button onClick={() => setConfirmDel(false)} disabled={pending} className="text-ink-3 px-1 disabled:opacity-50">
              <X size={14} />
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmDel(true)}
            disabled={pending}
            className="flex items-center gap-1 px-3 py-1.5 bg-cream text-primary rounded-md text-[10px] font-display font-bold uppercase tracking-wider hover:bg-primary/5 disabled:opacity-50"
            style={{ border: "1.5px solid #BB3B2E" }}
          >
            <Trash2 size={11} strokeWidth={2.5} /> Eliminar
          </button>
        )}
      </div>

      {toast && (
        <div
          className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-md flex items-center gap-2 text-[12px] font-medium animate-in fade-in slide-in-from-bottom-2"
          style={{ background: toast.kind === "ok" ? "#4D5431" : "#BB3B2E", color: "#fff", border: "2px solid #1A1A1A", boxShadow: "4px 4px 0 0 var(--shadow-color)", minWidth: 280, maxWidth: 480 }}
        >
          {toast.kind === "ok" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{toast.msg}</span>
        </div>
      )}
    </>
  )
}
