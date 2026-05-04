"use client"

import { useRouter } from "next/navigation"
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react"

/**
 * Selector de mes para el dashboard de finanzas.
 *
 * - Anterior / Siguiente / Hoy
 * - Genera URL con ?month=YYYY-MM
 * - El componente parent decide qué hacer con ese param.
 */
export function MonthSelector({ month }: { month: string }) {
  const router = useRouter()
  const [yStr, mStr] = month.split("-")
  const y = Number(yStr)
  const m = Number(mStr)

  function goTo(year: number, monthNum: number) {
    const next = `${year}-${String(monthNum).padStart(2, "0")}`
    router.push(`/finanzas?month=${next}`)
  }

  function step(dir: -1 | 1) {
    let ny = y
    let nm = m + dir
    if (nm > 12) { nm = 1; ny += 1 }
    if (nm < 1) { nm = 12; ny -= 1 }
    goTo(ny, nm)
  }

  function goToday() {
    const now = new Date()
    goTo(now.getUTCFullYear(), now.getUTCMonth() + 1)
  }

  const label = new Date(y, m - 1, 1).toLocaleDateString("es-VE", { month: "long", year: "numeric" }).toUpperCase()

  return (
    <div className="flex items-center gap-1">
      <button onClick={() => step(-1)} title="Mes anterior"
        className="p-1.5 hover:bg-cream-2 rounded-md" style={{ border: "1.5px solid var(--border)" }}>
        <ChevronLeft size={12} strokeWidth={2.5} />
      </button>
      <button onClick={goToday}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-cream hover:bg-cream-2 rounded-md text-[10px] font-display font-bold uppercase tracking-wider min-w-[140px] justify-center"
        style={{ border: "1.5px solid var(--border)" }}>
        <Calendar size={11} strokeWidth={2.5} className="text-orange" />
        {label}
      </button>
      <button onClick={() => step(1)} title="Mes siguiente"
        className="p-1.5 hover:bg-cream-2 rounded-md" style={{ border: "1.5px solid var(--border)" }}>
        <ChevronRight size={12} strokeWidth={2.5} />
      </button>
    </div>
  )
}
