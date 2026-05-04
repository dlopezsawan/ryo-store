"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { AlertCircle, CheckCircle2 } from "lucide-react"
import { toggleMaintenanceAction } from "./actions"

interface Props {
  enabled: boolean
  message: string | null
  hadError: boolean
}

type Toast = { kind: "ok" | "err"; msg: string } | null

export function MaintenanceToggle({ enabled, message, hadError }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [toast, setToast] = useState<Toast>(null)
  const [editingMessage, setEditingMessage] = useState(false)
  const [draftMessage, setDraftMessage] = useState(message ?? "")

  function flash(kind: "ok" | "err", msg: string) {
    setToast({ kind, msg })
    setTimeout(() => setToast(null), 4000)
  }

  function toggle() {
    startTransition(async () => {
      const next = !enabled
      const res = await toggleMaintenanceAction({
        enabled: next,
        message: next ? (draftMessage.trim() || undefined) : undefined,
      })
      if (!res.ok) return flash("err", res.error)
      flash("ok", next ? "Modo mantenimiento activado" : "Tienda reactivada")
      router.refresh()
    })
  }

  function saveMessage() {
    startTransition(async () => {
      const res = await toggleMaintenanceAction({
        enabled,
        message: draftMessage.trim() || undefined,
      })
      if (!res.ok) return flash("err", res.error)
      flash("ok", "Mensaje actualizado")
      setEditingMessage(false)
      router.refresh()
    })
  }

  return (
    <>
      <div className={`stamp-card p-5 ${enabled ? "bg-primary/5" : "bg-secondary/5"}`}>
        <div className="flex items-center gap-4">
          <div
            className={`w-12 h-12 ${enabled ? "bg-primary text-white" : "bg-secondary text-cream"} flex items-center justify-center text-[24px]`}
            style={{ border: "2px solid #1A1A1A", boxShadow: "2px 2px 0 0 var(--shadow-color)" }}
          >
            {enabled ? "🚧" : "✓"}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-display font-black text-[16px] uppercase tracking-tight">
                {enabled ? "Modo mantenimiento ACTIVO" : "Tienda operativa"}
              </h3>
              {enabled && (
                <span className="vintage-stamp text-primary" style={{ background: "rgb(var(--surface))" }}>
                  ⚠ TIENDA OFFLINE
                </span>
              )}
            </div>
            {editingMessage ? (
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="text"
                  value={draftMessage}
                  onChange={(e) => setDraftMessage(e.target.value)}
                  placeholder="Mensaje a los visitantes (opcional)"
                  className="flex-1 px-3 py-1.5 bg-cream rounded-md text-[12px] focus:outline-none"
                  style={{ border: "1.5px solid var(--border)" }}
                />
                <button
                  type="button"
                  onClick={saveMessage}
                  disabled={pending}
                  className="px-3 py-1.5 bg-secondary text-cream rounded-md text-[10px] font-display font-bold uppercase tracking-wider disabled:opacity-50"
                  style={{ border: "1.5px solid #1A1A1A" }}
                >
                  Guardar
                </button>
                <button
                  type="button"
                  onClick={() => { setDraftMessage(message ?? ""); setEditingMessage(false) }}
                  disabled={pending}
                  className="px-3 py-1.5 bg-cream rounded-md text-[10px] font-display font-bold uppercase tracking-wider text-ink hover:bg-cream-2 disabled:opacity-50"
                  style={{ border: "1.5px solid var(--border)" }}
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <p className="text-[12px] text-ink-3 mt-1">
                {enabled
                  ? message ?? "El storefront muestra una página de mantenimiento a los visitantes."
                  : "El storefront está accesible para todos los visitantes."}
                {hadError && " (no se pudo verificar el estado)"}
                <button
                  type="button"
                  onClick={() => setEditingMessage(true)}
                  className="ml-2 text-orange hover:underline text-[10px] font-display font-bold uppercase tracking-wider"
                >
                  Editar mensaje
                </button>
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={toggle}
            disabled={pending}
            className={`px-4 py-2 rounded-md text-[11px] font-display font-bold uppercase tracking-wide transition-all hover:translate-x-[2px] hover:translate-y-[2px] disabled:opacity-50 ${
              enabled ? "bg-secondary text-cream" : "bg-primary text-white"
            }`}
            style={{ border: "2px solid #1A1A1A", boxShadow: "4px 4px 0 0 var(--shadow-color)" }}
          >
            {pending ? "..." : enabled ? "Reactivar tienda" : "Activar mantenimiento"}
          </button>
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
