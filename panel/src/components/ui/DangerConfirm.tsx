"use client"

import { useEffect, useState } from "react"
import { AlertTriangle, X } from "lucide-react"

interface DangerConfirmProps {
  /** Cuando true se muestra el modal. */
  open: boolean
  /** Cerrar sin confirmar. */
  onCancel: () => void
  /** Confirmar — el componente desactiva el botón mientras pending=true. */
  onConfirm: () => void | Promise<void>
  /** Pending state mientras se ejecuta la acción confirmada. */
  pending?: boolean
  /** Título del modal — corto, action-oriented. Ej: "¿Eliminar 8 emails?" */
  title: string
  /** Descripción del efecto. Sé EXPLÍCITO — qué se va a tocar y si es reversible. */
  description: React.ReactNode
  /** Texto del botón de confirmación. Default "Confirmar". */
  confirmLabel?: string
  /** Texto del botón cancel. Default "Cancelar". */
  cancelLabel?: string
  /** Si true, requiere mantener pulsado el botón 1.5s para confirmar — usá para acciones masivas. */
  holdToConfirm?: boolean
}

/**
 * Modal de confirmación destructiva estandarizado.
 *
 * Reemplaza al `confirm()` nativo del browser que se ve gris y rompe el theme.
 *
 * Uso típico:
 *   const [showDelete, setShowDelete] = useState(false)
 *   <button onClick={() => setShowDelete(true)}>Eliminar</button>
 *   <DangerConfirm
 *     open={showDelete}
 *     onCancel={() => setShowDelete(false)}
 *     onConfirm={async () => { await del(); setShowDelete(false) }}
 *     title="¿Eliminar este email?"
 *     description="El email se moverá a la papelera. Podés recuperarlo desde ahí."
 *   />
 */
export function DangerConfirm({
  open,
  onCancel,
  onConfirm,
  pending = false,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  holdToConfirm = false,
}: DangerConfirmProps) {
  const [holdProgress, setHoldProgress] = useState(0)
  const [holding, setHolding] = useState(false)

  // Cerrar con ESC
  useEffect(() => {
    if (!open) return
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape" && !pending) onCancel()
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [open, pending, onCancel])

  // Hold-to-confirm progress bar
  useEffect(() => {
    if (!holding || !holdToConfirm) {
      setHoldProgress(0)
      return
    }
    const start = Date.now()
    const DURATION = 1500
    const t = setInterval(() => {
      const pct = Math.min(100, ((Date.now() - start) / DURATION) * 100)
      setHoldProgress(pct)
      if (pct >= 100) {
        clearInterval(t)
        setHolding(false)
        void onConfirm()
      }
    }, 30)
    return () => clearInterval(t)
  }, [holding, holdToConfirm, onConfirm])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 animate-in fade-in"
      style={{ background: "rgba(0,0,0,0.55)" }}
      onClick={() => !pending && onCancel()}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="stamp-card bg-cream max-w-md w-full p-5 animate-in zoom-in-95"
        style={{ borderColor: "#BB3B2E", borderWidth: "2px" }}
      >
        <div className="flex items-start gap-3 mb-3">
          <div
            className="w-9 h-9 bg-primary/10 flex items-center justify-center flex-shrink-0 rounded-md"
            style={{ border: "1.5px solid #BB3B2E" }}
          >
            <AlertTriangle size={16} className="text-primary" strokeWidth={2.5} />
          </div>
          <div className="flex-1">
            <h3 className="font-display font-black text-[15px] uppercase tracking-wider text-primary">
              {title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            aria-label="Cerrar"
            className="text-ink-3 hover:text-ink p-1 disabled:opacity-50"
          >
            <X size={14} strokeWidth={2.5} />
          </button>
        </div>

        <div className="text-[12px] text-ink-2 leading-relaxed mb-4">{description}</div>

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="px-3 py-2 bg-cream-2 hover:bg-cream rounded-md text-[10px] font-display font-bold uppercase tracking-wider disabled:opacity-50"
            style={{ border: "1.5px solid var(--border)" }}
          >
            {cancelLabel}
          </button>
          {holdToConfirm ? (
            <button
              type="button"
              onMouseDown={() => setHolding(true)}
              onMouseUp={() => setHolding(false)}
              onMouseLeave={() => setHolding(false)}
              onTouchStart={() => setHolding(true)}
              onTouchEnd={() => setHolding(false)}
              disabled={pending}
              className="relative overflow-hidden px-4 py-2 bg-primary text-white rounded-md text-[10px] font-display font-bold uppercase tracking-wider disabled:opacity-50"
              style={{ border: "1.5px solid #1A1A1A" }}
            >
              <span
                className="absolute inset-0 bg-white/20 transition-[width]"
                style={{ width: `${holdProgress}%` }}
                aria-hidden
              />
              <span className="relative">
                {pending ? "Ejecutando…" : holding ? "Mantené…" : `Mantené para ${confirmLabel.toLowerCase()}`}
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void onConfirm()}
              disabled={pending}
              className="px-4 py-2 bg-primary text-white rounded-md text-[10px] font-display font-bold uppercase tracking-wider disabled:opacity-50 hover:opacity-90"
              style={{ border: "1.5px solid #1A1A1A" }}
            >
              {pending ? "Ejecutando…" : confirmLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
