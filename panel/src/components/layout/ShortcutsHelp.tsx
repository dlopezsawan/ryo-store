"use client"

import { useEffect, useState } from "react"
import { X, Keyboard } from "lucide-react"

interface Shortcut {
  keys: string[]   // ej: ["⌘", "K"] o ["?"]
  description: string
  scope: string
}

const SHORTCUTS: Shortcut[] = [
  // Global
  { keys: ["?"],          description: "Mostrar atajos",                scope: "Global" },
  { keys: ["⌘", "K"],     description: "Command palette · buscar",     scope: "Global" },
  { keys: ["⌘", "B"],     description: "Colapsar / expandir sidebar",  scope: "Global" },
  { keys: ["Esc"],        description: "Cerrar modal / overlay",       scope: "Global" },

  // Listings
  { keys: ["j"],          description: "Bajar al siguiente row",       scope: "Listings" },
  { keys: ["k"],          description: "Subir al row anterior",        scope: "Listings" },
  { keys: ["↵"],          description: "Abrir row enfocado",           scope: "Listings" },
  { keys: ["x"],          description: "Seleccionar / deseleccionar",  scope: "Listings" },
  { keys: ["Space"],      description: "Seleccionar (alternativa a x)", scope: "Listings" },

  // Order detail
  { keys: ["⌘", "↵"],     description: "Enviar comentario en thread", scope: "Editores" },
  { keys: ["⌘", "S"],     description: "Guardar (cuando aplica)",     scope: "Editores" },
]

export function ShortcutsHelp() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      // Skip si focus está en un input/textarea
      const target = e.target as HTMLElement | null
      const tag = target?.tagName
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target?.isContentEditable) return

      if (e.key === "?" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault()
        setOpen((v) => !v)
      } else if (e.key === "Escape" && open) {
        setOpen(false)
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [open])

  if (!open) return null

  // Group by scope
  const byScope = SHORTCUTS.reduce<Record<string, Shortcut[]>>((acc, s) => {
    (acc[s.scope] ??= []).push(s)
    return acc
  }, {})

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)" }} onClick={() => setOpen(false)}>
      <div className="bg-page rounded-md max-w-2xl w-full p-6 max-h-[85vh] overflow-y-auto"
        style={{ border: "2.5px solid var(--border)", boxShadow: "5px 5px 0 0 var(--shadow-color)" }}
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Keyboard size={18} strokeWidth={2.5} className="text-orange" />
            <h3 className="font-display font-black text-[18px] uppercase tracking-tight text-ink">Atajos de teclado</h3>
          </div>
          <button onClick={() => setOpen(false)} className="text-ink-3 hover:text-ink p-1">
            <X size={16} strokeWidth={2.5} />
          </button>
        </div>

        <p className="text-[11px] text-ink-3 font-mono mb-4">
          Presioná <Kbd>?</Kbd> en cualquier momento (fuera de inputs) para abrir esta ayuda.
        </p>

        <div className="grid grid-cols-2 gap-x-6 gap-y-4">
          {Object.entries(byScope).map(([scope, shortcuts]) => (
            <div key={scope}>
              <h4 className="text-[10px] font-display font-bold uppercase tracking-[0.18em] text-orange mb-2">{scope}</h4>
              <ul className="space-y-1.5">
                {shortcuts.map((s, i) => (
                  <li key={i} className="flex items-center justify-between gap-3">
                    <span className="text-[12px] text-ink-2">{s.description}</span>
                    <span className="flex items-center gap-1 flex-shrink-0">
                      {s.keys.map((k, j) => (
                        <Kbd key={j}>{k}</Kbd>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-5 pt-3 text-[10px] text-ink-3 font-mono" style={{ borderTop: "1.5px dashed var(--border)" }}>
          💡 ⌘ = Cmd en Mac · Ctrl en Windows/Linux
        </div>
      </div>
    </div>
  )
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-cream rounded-md min-w-[20px] text-center inline-block"
      style={{ border: "1px solid var(--border-soft)", boxShadow: "1px 1px 0 0 var(--shadow-color)" }}>
      {children}
    </kbd>
  )
}
