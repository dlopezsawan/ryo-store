import { useEffect, useState } from "react"
import { Container, Heading, Text } from "@medusajs/ui"

type Shortcut = {
  keys: string[]
  label: string
}

const SHORTCUTS: Shortcut[] = [
  { keys: ["?"],        label: "Mostrar/ocultar esta ayuda" },
  { keys: ["1"],        label: "Ir a Lista" },
  { keys: ["2"],        label: "Ir a Calendario" },
  { keys: ["3"],        label: "Ir a Kanban" },
  { keys: ["4"],        label: "Ir a Trends" },
  { keys: ["g", "s"],   label: "Sync desde creación" },
  { keys: ["g", "a"],   label: "Toggle mostrar aprobados" },
  { keys: ["Esc"],      label: "Cerrar modales / limpiar filtros" },
]

/**
 * Global keyboard layer for the Social admin. Each shortcut maps to a
 * DOM-level synthetic action — mostly clicking the right button or tab.
 *
 * We attach listeners at window level but ignore them when focus is inside
 * a text input / textarea / contenteditable, so typing `s` inside a
 * comment doesn't trigger "sync".
 *
 * Renders a floating "?" affordance bottom-right and a help modal.
 */
export function KeyboardShortcuts({
  onTab,
  onSync,
  onToggleApproved,
}: {
  onTab: (tab: "lista" | "calendario" | "kanban" | "trends") => void
  onSync: () => void
  onToggleApproved: () => void
}) {
  const [showHelp, setShowHelp] = useState(false)
  const [gPending, setGPending] = useState(false)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ignore when typing into form fields
      const t = e.target as HTMLElement | null
      if (t && (
        t.tagName === "INPUT" ||
        t.tagName === "TEXTAREA" ||
        t.isContentEditable ||
        t.closest("[contenteditable='true']")
      )) return

      if (e.key === "?" || (e.key === "/" && e.shiftKey)) {
        e.preventDefault()
        setShowHelp((v) => !v)
        return
      }
      if (e.key === "Escape") {
        if (showHelp) setShowHelp(false)
        return
      }

      // g-prefix chord shortcuts
      if (gPending) {
        setGPending(false)
        if (e.key === "s") { e.preventDefault(); onSync(); return }
        if (e.key === "a") { e.preventDefault(); onToggleApproved(); return }
        return
      }
      if (e.key === "g") {
        setGPending(true)
        setTimeout(() => setGPending(false), 800)
        return
      }

      // Numeric tab switch
      if (e.key === "1") { e.preventDefault(); onTab("lista"); return }
      if (e.key === "2") { e.preventDefault(); onTab("calendario"); return }
      if (e.key === "3") { e.preventDefault(); onTab("kanban"); return }
      if (e.key === "4") { e.preventDefault(); onTab("trends"); return }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [gPending, showHelp, onTab, onSync, onToggleApproved])

  return (
    <>
      <button
        onClick={() => setShowHelp(true)}
        aria-label="Ver atajos de teclado"
        className="fixed bottom-4 right-4 z-30 h-10 w-10 rounded-full bg-ui-bg-component text-ui-fg-on-inverted shadow-lg hover:opacity-90 font-mono font-bold text-lg"
        title="Atajos (?)"
      >
        ?
      </button>

      {showHelp && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setShowHelp(false)}
        >
          <Container
            className="max-w-md w-full p-5 flex flex-col gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <Heading level="h3">Atajos de teclado</Heading>
              <button
                onClick={() => setShowHelp(false)}
                className="text-xl leading-none text-ui-fg-subtle hover:text-ui-fg-base"
                aria-label="Cerrar"
              >
                ×
              </button>
            </div>
            <ul className="flex flex-col gap-1.5">
              {SHORTCUTS.map((s, i) => (
                <li key={i} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-ui-fg-base">{s.label}</span>
                  <span className="flex gap-1 shrink-0">
                    {s.keys.map((k, j) => (
                      <kbd
                        key={j}
                        className="px-1.5 py-0.5 rounded border border-ui-border-base bg-ui-bg-subtle font-mono text-xs"
                      >
                        {k}
                      </kbd>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
            <Text size="xsmall" className="text-ui-fg-muted italic">
              Funcionan fuera de inputs. Los de dos teclas (g,s) se tipean en secuencia rápida.
            </Text>
          </Container>
        </div>
      )}
    </>
  )
}
