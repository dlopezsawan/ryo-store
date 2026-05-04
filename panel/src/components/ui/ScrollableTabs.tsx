"use client"

import { useEffect, useRef, useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Wrapper para tab strips con overflow horizontal.
 *
 * Soluciona el problema de los tabs que se ocultan a la derecha sin que el
 * usuario sepa que hay más. Agrega:
 *   - Fade gradient en los bordes cuando hay overflow
 *   - Botones ◀ ▶ que aparecen sólo cuando hace falta scroll
 *   - Auto-scroll al tab activo cuando entra a la página
 *
 * Uso:
 *   <ScrollableTabs>
 *     {TABS.map(t => <Link href={t.href} key={t.href}>...</Link>)}
 *   </ScrollableTabs>
 */
export function ScrollableTabs({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [overflow, setOverflow] = useState<{ left: boolean; right: boolean }>({ left: false, right: false })

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => {
      const left = el.scrollLeft > 4
      const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 4
      setOverflow({ left, right })
    }
    update()
    el.addEventListener("scroll", update, { passive: true })
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => {
      el.removeEventListener("scroll", update)
      ro.disconnect()
    }
  }, [])

  // Scroll al tab activo en mount (si hay un .nav-active dentro)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const active = el.querySelector<HTMLElement>("[data-tab-active='true'], .tab-active, .nav-active")
    if (active) {
      const elRect = el.getBoundingClientRect()
      const activeRect = active.getBoundingClientRect()
      // Si el tab activo no está completamente visible, centrarlo
      if (activeRect.left < elRect.left || activeRect.right > elRect.right) {
        active.scrollIntoView({ block: "nearest", inline: "center" })
      }
    }
  }, [])

  function scrollBy(delta: number) {
    ref.current?.scrollBy({ left: delta, behavior: "smooth" })
  }

  return (
    <div className={cn("relative", className)}>
      {/* Fade left */}
      {overflow.left && (
        <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-cream to-transparent z-10 pointer-events-none" aria-hidden />
      )}
      {/* Fade right */}
      {overflow.right && (
        <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-cream to-transparent z-10 pointer-events-none" aria-hidden />
      )}
      {/* Scroll buttons */}
      {overflow.left && (
        <button
          type="button"
          onClick={() => scrollBy(-200)}
          aria-label="Scroll left"
          className="absolute left-0 top-1/2 -translate-y-1/2 z-20 w-6 h-6 flex items-center justify-center bg-cream text-ink hover:bg-orange hover:text-dark rounded-full transition-colors"
          style={{ border: "1.5px solid #1A1A1A", boxShadow: "1.5px 1.5px 0 0 var(--shadow-color)" }}
        >
          <ChevronLeft size={11} strokeWidth={3} />
        </button>
      )}
      {overflow.right && (
        <button
          type="button"
          onClick={() => scrollBy(200)}
          aria-label="Scroll right"
          className="absolute right-0 top-1/2 -translate-y-1/2 z-20 w-6 h-6 flex items-center justify-center bg-cream text-ink hover:bg-orange hover:text-dark rounded-full transition-colors"
          style={{ border: "1.5px solid #1A1A1A", boxShadow: "1.5px 1.5px 0 0 var(--shadow-color)" }}
        >
          <ChevronRight size={11} strokeWidth={3} />
        </button>
      )}
      <div ref={ref} className="overflow-x-auto no-scrollbar">
        {children}
      </div>
    </div>
  )
}
