"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

interface Props {
  /** Lista de hrefs en el orden visual de la página (top → bottom). */
  hrefs: string[]
}

/**
 * Hook headless para navegación por teclado en listas server-rendered.
 * Se monta como `<KeyboardNavList hrefs={[...]} />` y aplica:
 *   - j / ↓ → siguiente row (con outline visual)
 *   - k / ↑ → anterior
 *   - Enter → abrir
 * El highlight se aplica via DOM data-attribute (`data-knl-active`) que
 * la página puede stylar globalmente.
 */
export function KeyboardNavList({ hrefs }: Props) {
  const router = useRouter()
  const [activeIdx, setActiveIdx] = useState(-1)

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null
      const tag = target?.tagName
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target?.isContentEditable) return
      if (e.metaKey || e.ctrlKey || e.altKey) return

      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault()
        setActiveIdx((i) => Math.min(hrefs.length - 1, i < 0 ? 0 : i + 1))
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault()
        setActiveIdx((i) => Math.max(0, i - 1))
      } else if (e.key === "Enter" && activeIdx >= 0 && activeIdx < hrefs.length) {
        e.preventDefault()
        router.push(hrefs[activeIdx])
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [hrefs, activeIdx, router])

  // Aplicar el data-attribute al row activo via DOM scrub
  useEffect(() => {
    const all = document.querySelectorAll("[data-knl-row]")
    all.forEach((el) => el.removeAttribute("data-knl-active"))
    if (activeIdx >= 0) {
      const target = document.querySelector(`[data-knl-row="${activeIdx}"]`)
      if (target) {
        target.setAttribute("data-knl-active", "true")
        target.scrollIntoView({ block: "nearest", behavior: "smooth" })
      }
    }
  }, [activeIdx])

  // Hint footer
  return (
    <div className="text-[10px] font-mono text-ink-3 flex items-center gap-3 px-2 mt-2">
      <span><kbd className="px-1 py-0 bg-cream rounded" style={{ border: "1px solid var(--border-soft)" }}>j</kbd> <kbd className="px-1 py-0 bg-cream rounded" style={{ border: "1px solid var(--border-soft)" }}>k</kbd> navegar</span>
      <span><kbd className="px-1 py-0 bg-cream rounded" style={{ border: "1px solid var(--border-soft)" }}>↵</kbd> abrir</span>
    </div>
  )
}
