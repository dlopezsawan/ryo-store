import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/** Tailwind class merger — quitar duplicados al componer estilos. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Formatea un número como moneda EUR con sufijo opcional. */
export function fmtEur(n: number, opts?: { sign?: boolean; decimals?: number }) {
  const decimals = opts?.decimals ?? 2
  const value = Math.abs(n).toLocaleString("es-VE", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
  if (opts?.sign && n !== 0) return `${n < 0 ? "−" : "+"}€${value}`
  return n < 0 ? `−€${value}` : `€${value}`
}

/** Tabular formatter para números enteros (cantidades, conteos). */
export function fmtNum(n: number) {
  return n.toLocaleString("es-VE")
}

/** Fecha relativa cortita: "hace 8 min", "hace 2h", "ayer", "27 abr". */
export function fmtRelative(date: Date | string | number) {
  const d = typeof date === "string" || typeof date === "number" ? new Date(date) : date
  const diffMs = Date.now() - d.getTime()
  const diffMin = Math.round(diffMs / 60_000)
  if (diffMin < 1) return "ahora"
  if (diffMin < 60) return `hace ${diffMin} min`
  const diffH = Math.round(diffMin / 60)
  if (diffH < 24) return `hace ${diffH}h`
  const diffD = Math.round(diffH / 24)
  if (diffD === 1) return "ayer"
  if (diffD < 7) return `hace ${diffD}d`
  return d.toLocaleDateString("es-VE", { day: "numeric", month: "short" })
}

/** Iniciales de un nombre completo: "María Jiménez" → "MJ". */
export function initials(name?: string | null) {
  if (!name) return "??"
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase()
}
