"use client"

import { useEffect } from "react"

/**
 * Auto-dispara window.print() al cargar la vista de packing slip.
 * Pequeño delay para que las imágenes (thumbnails de productos) carguen
 * antes de imprimir.
 */
export function PrintTrigger() {
  useEffect(() => {
    const t = setTimeout(() => {
      window.print()
    }, 800)
    return () => clearTimeout(t)
  }, [])
  return null
}
