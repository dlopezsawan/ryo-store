"use client"

import { useEffect, useState } from "react"
import { Sun, Moon, MonitorSmartphone } from "lucide-react"
import { cn } from "@/lib/utils"

type Theme = "light" | "dark" | "system"

const STORAGE_KEY = "panel_theme"

/**
 * Aplica el tema sobre <html>.
 *  - "dark"   → <html class="dark">
 *  - "light"  → <html> (sin class)
 *  - "system" → mira prefers-color-scheme y aplica/quita
 *
 * También sincroniza con un MediaQueryList listener para que si el user
 * tiene "system" y cambia el modo del OS en vivo, el panel reacciona.
 */
function applyTheme(theme: Theme) {
  const root = document.documentElement
  if (theme === "dark") {
    root.classList.add("dark")
  } else if (theme === "light") {
    root.classList.remove("dark")
  } else {
    // system
    const dark = window.matchMedia("(prefers-color-scheme: dark)").matches
    root.classList.toggle("dark", dark)
  }
}

function getStoredTheme(): Theme {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === "light" || v === "dark" || v === "system") return v
  } catch { /* ignore */ }
  return "system"
}

/**
 * Toggle de 3 estados: System → Light → Dark → System.
 * Posición: en sidebar bottom o en topbar (lo metemos en sidebar al lado del BCV).
 */
export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [theme, setTheme] = useState<Theme>("system")
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setTheme(getStoredTheme())
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    applyTheme(theme)
    try { localStorage.setItem(STORAGE_KEY, theme) } catch { /* ignore */ }

    // Si está en system, escuchar cambios del OS
    if (theme === "system") {
      const mql = window.matchMedia("(prefers-color-scheme: dark)")
      const handler = () => applyTheme("system")
      mql.addEventListener("change", handler)
      return () => mql.removeEventListener("change", handler)
    }
  }, [theme, hydrated])

  function cycle() {
    setTheme((t) => (t === "system" ? "light" : t === "light" ? "dark" : "system"))
  }

  // Mientras no hidrata, evitamos render para no causar mismatch
  if (!hydrated) return <div className={compact ? "w-7 h-7" : "w-full h-7"} />

  const Icon = theme === "system" ? MonitorSmartphone : theme === "light" ? Sun : Moon
  const label = theme === "system" ? "AUTO" : theme === "light" ? "LIGHT" : "DARK"

  if (compact) {
    return (
      <button
        type="button"
        onClick={cycle}
        title={`Tema: ${label.toLowerCase()} · click para cambiar`}
        className="w-7 h-7 flex items-center justify-center hover:text-orange rounded-md transition-colors"
        style={{ color: "rgb(var(--sidebar-text-soft, var(--ink-3)))" }}
        aria-label={`Tema: ${label}`}
      >
        <Icon size={14} strokeWidth={2.2} />
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={cycle}
      title={`Tema: ${label.toLowerCase()} · click para cambiar`}
      className={cn(
        "flex items-center gap-1.5 w-full px-2 py-1 text-[10px] font-mono uppercase tracking-widest",
        "hover:text-orange rounded-md transition-colors sidebar-nav-item"
      )}
      aria-label={`Tema: ${label}`}
    >
      <Icon size={11} strokeWidth={2.2} />
      <span>TEMA · {label}</span>
    </button>
  )
}
