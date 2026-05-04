"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Plus, X, AlertCircle, CheckCircle2 } from "lucide-react"
import {
  addCustomerToGroupAction, removeCustomerFromGroupAction,
} from "../../customer-groups/actions"

interface Props {
  customerId: string
  /** Grupos en los que el cliente YA está */
  current: Array<{ id: string; name: string }>
  /** Catálogo de todos los grupos (para añadir nuevos) */
  available: Array<{ id: string; name: string }>
}

type Toast = { kind: "ok" | "err"; msg: string } | null

export function CustomerGroups({ customerId, current, available }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [adding, setAdding] = useState(false)
  const [toast, setToast] = useState<Toast>(null)

  const currentIds = new Set(current.map((g) => g.id))
  const candidates = available.filter((g) => !currentIds.has(g.id))

  function flash(kind: "ok" | "err", msg: string) {
    setToast({ kind, msg })
    setTimeout(() => setToast(null), 4000)
  }

  function add(groupId: string) {
    startTransition(async () => {
      const res = await addCustomerToGroupAction({ groupId, customerId })
      if (!res.ok) return flash("err", res.error)
      flash("ok", "Añadido al segmento")
      setAdding(false)
      router.refresh()
    })
  }

  function remove(groupId: string) {
    startTransition(async () => {
      const res = await removeCustomerFromGroupAction({ groupId, customerId })
      if (!res.ok) return flash("err", res.error)
      flash("ok", "Removido del segmento")
      router.refresh()
    })
  }

  return (
    <div className="stamp-card p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display font-black text-[12px] uppercase tracking-wider">Segmentos</h3>
        {candidates.length > 0 && (
          <button
            type="button"
            onClick={() => setAdding(!adding)}
            className="text-orange hover:underline text-[10px] font-display font-bold uppercase tracking-wider flex items-center gap-1"
          >
            <Plus size={11} strokeWidth={3} /> {adding ? "Cerrar" : "Añadir"}
          </button>
        )}
      </div>

      {adding && candidates.length > 0 && (
        <div className="mb-3 p-2 bg-orange/5 rounded-md" style={{ border: "1.5px dashed #FF3B27" }}>
          <p className="text-[10px] font-display font-bold uppercase tracking-wider text-ink-3 mb-2">
            Añadir a:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {candidates.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => add(g.id)}
                disabled={pending}
                className="text-[10px] font-display font-bold uppercase tracking-wider text-ink hover:text-orange bg-cream px-2 py-1 disabled:opacity-50 transition-colors"
                style={{ border: "1px solid var(--border)" }}
              >
                + {g.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {current.length === 0 ? (
        <p className="text-[11px] text-ink-3 italic">Sin segmentos asignados.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {current.map((g) => (
            <span
              key={g.id}
              className="inline-flex items-center gap-1 text-[10px] font-display font-bold uppercase tracking-wider text-secondary bg-secondary/10 pl-2 pr-1 py-1"
              style={{ border: "1px solid #4D5431" }}
            >
              {g.name}
              <button
                type="button"
                onClick={() => remove(g.id)}
                disabled={pending}
                className="hover:bg-secondary hover:text-cream rounded transition-colors p-0.5 disabled:opacity-50"
                title="Remover"
              >
                <X size={10} strokeWidth={3} />
              </button>
            </span>
          ))}
        </div>
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
