"use client"

import { useEffect, useState } from "react"
import { Download, X } from "lucide-react"

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

const STORAGE_DISMISSED = "panel_pwa_dismissed"
const DISMISS_TTL_DAYS = 14

/**
 * - Registra el service worker en mount
 * - Captura `beforeinstallprompt` y muestra un banner sutil
 * - El banner se puede dismissar (recordado 14 días en localStorage)
 */
export function PwaInstaller() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [showBanner, setShowBanner] = useState(false)

  useEffect(() => {
    // 1. Registrar SW
    if ("serviceWorker" in navigator) {
      const onLoad = () => {
        navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
          // Silencioso — no bloquear UX si el SW falla
        })
      }
      if (document.readyState === "complete") onLoad()
      else window.addEventListener("load", onLoad, { once: true })
    }

    // 2. Capturar install prompt
    function handler(e: Event) {
      e.preventDefault()
      const ev = e as BeforeInstallPromptEvent
      setInstallEvent(ev)

      // Check si fue dismissado recientemente
      try {
        const dismissedAt = localStorage.getItem(STORAGE_DISMISSED)
        if (dismissedAt) {
          const daysAgo = (Date.now() - Number(dismissedAt)) / (86400 * 1000)
          if (daysAgo < DISMISS_TTL_DAYS) return
        }
      } catch { /* ignore */ }

      // Mostrar banner después de 5s para no ser invasivo
      setTimeout(() => setShowBanner(true), 5000)
    }

    window.addEventListener("beforeinstallprompt", handler as EventListener)
    return () => window.removeEventListener("beforeinstallprompt", handler as EventListener)
  }, [])

  async function install() {
    if (!installEvent) return
    await installEvent.prompt()
    const { outcome } = await installEvent.userChoice
    if (outcome === "accepted") {
      setShowBanner(false)
      setInstallEvent(null)
    }
  }

  function dismiss() {
    try { localStorage.setItem(STORAGE_DISMISSED, String(Date.now())) } catch { /* ignore */ }
    setShowBanner(false)
  }

  if (!showBanner || !installEvent) return null

  return (
    <div
      className="fixed bottom-4 left-1/2 -translate-x-1/2 md:left-auto md:right-4 md:translate-x-0 z-[55] max-w-md w-[calc(100%-2rem)] bg-page p-3 rounded-md flex items-center gap-3 animate-in fade-in slide-in-from-bottom-3"
      style={{ border: "2px solid #FF3B27", boxShadow: "4px 4px 0 0 var(--shadow-color)" }}
    >
      <div className="w-10 h-10 bg-orange flex items-center justify-center flex-shrink-0" style={{ border: "1.5px solid #1A1A1A" }}>
        <Download size={18} className="text-dark" strokeWidth={2.5} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-display font-black text-[12px] uppercase tracking-tight text-ink">Instalar Enrola Panel</div>
        <p className="text-[11px] text-ink-3 font-medium">Acceso directo desde tu pantalla de inicio · funciona offline</p>
      </div>
      <button onClick={install}
        className="px-3 py-1.5 bg-orange text-dark rounded-md text-[10px] font-display font-bold uppercase tracking-wider hover:translate-x-[1px] hover:translate-y-[1px] transition-all"
        style={{ border: "1.5px solid #1A1A1A", boxShadow: "2px 2px 0 0 var(--shadow-color)" }}>
        Instalar
      </button>
      <button onClick={dismiss} className="text-ink-3 hover:text-ink p-1" title="Más tarde">
        <X size={14} />
      </button>
    </div>
  )
}
