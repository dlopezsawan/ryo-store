"use client"

import { useEffect, useState } from "react"
import { Sparkles, X } from "lucide-react"

const COOKIE_NAME = "ref"
const DISMISS_KEY = "ryo_ref_toast_dismissed"

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
  return m ? decodeURIComponent(m[1]) : null
}

/**
 * If the visitor arrived with a valid ?ref= cookie, show a small dismissible
 * banner confirming the referral is active. The banner self-dismisses for the
 * session once the user closes it.
 *
 * Place once in the root layout. Cheap on the server (no auth needed) and
 * silent if there's no cookie — never blocks first paint.
 */
export default function ReferralCookieToast() {
  const [code, setCode] = useState<string | null>(null)
  const [valid, setValid] = useState<boolean | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return
    if (sessionStorage.getItem(DISMISS_KEY) === "1") {
      setDismissed(true)
      return
    }
    const c = readCookie(COOKIE_NAME)
    if (!c) return
    setCode(c)
    fetch("/api/referrals/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: c }),
    })
      .then((r) => r.json())
      .then((d) => setValid(Boolean(d?.valid)))
      .catch(() => setValid(false))
  }, [])

  if (dismissed || !code || valid !== true) return null

  return (
    <div
      className="fixed bottom-4 right-4 z-50 max-w-xs border-[3px] border-dark bg-cream p-3 pr-9 shadow-[6px_6px_0px_0px_var(--primary)]"
      role="status"
      aria-live="polite"
    >
      <button
        onClick={() => {
          setDismissed(true)
          try { sessionStorage.setItem(DISMISS_KEY, "1") } catch { /* ignore */ }
        }}
        className="absolute top-1.5 right-1.5 p-1 hover:bg-dark/10"
        aria-label="Cerrar"
      >
        <X size={14} strokeWidth={2.5} />
      </button>
      <div className="flex items-start gap-2">
        <Sparkles size={16} strokeWidth={2.5} className="text-orange flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-dark">
            Referido aplicado
          </p>
          <p className="text-xs text-dark/70 mt-0.5 leading-snug">
            Código <span className="font-mono font-black">{code}</span> activo. En tu primera compra,
            ambos ganan <span className="font-black text-orange">200 puntos</span>.
          </p>
        </div>
      </div>
    </div>
  )
}
