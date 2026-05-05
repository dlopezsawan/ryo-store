"use client"

import { useEffect } from "react"

/**
 * Pushes captured attribution cookies (UTMs + referral code) to the active
 * cart's metadata as soon as a cart_id exists in localStorage. Prevents the
 * "ref captured client-side but never written to cart" failure mode where the
 * /api/checkout/complete pipeline either doesn't run or runs against a stale
 * cart.
 *
 * Design notes:
 * - Idempotent: throttled per (cart_id) via sessionStorage, so navigating
 *   between pages doesn't spam the backend.
 * - Cheap: bails immediately if no cart_id or no attribution cookies.
 * - Independent of CartContext — uses localStorage + a polling cadence so it
 *   works regardless of which component first creates the cart.
 * - Failure-tolerant: never blocks rendering, never throws.
 */

const COOKIE_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "referrer", "ref"] as const

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
  return m ? decodeURIComponent(m[1]) : null
}

function readAttribution(): Record<string, string> {
  const out: Record<string, string> = {}
  for (const k of COOKIE_KEYS) {
    const v = readCookie(k)
    if (v) out[k] = v
  }
  return out
}

async function pushAttribution(cartId: string, attribution: Record<string, string>) {
  try {
    await fetch(`/api/cart/${encodeURIComponent(cartId)}/attribution`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(attribution),
      keepalive: true,
    })
  } catch {
    // never block; this is best-effort
  }
}

export default function AttributionSync() {
  useEffect(() => {
    if (typeof window === "undefined") return

    const trySync = () => {
      try {
        const cartId = localStorage.getItem("ryo_cart_id")
        if (!cartId) return
        const attribution = readAttribution()
        if (Object.keys(attribution).length === 0) return

        // Throttle: at most one push per (cart_id, attribution-shape) per session
        const fingerprint = JSON.stringify({ cartId, attribution })
        const sentKey = `ryo_attr_synced_${cartId}`
        if (sessionStorage.getItem(sentKey) === fingerprint) return

        pushAttribution(cartId, attribution)
        sessionStorage.setItem(sentKey, fingerprint)
      } catch {
        // ignore — never block UI
      }
    }

    // Run immediately + when tab becomes visible + on storage changes from
    // other tabs (cart_id might be set by another tab/page).
    trySync()
    const onVisible = () => { if (document.visibilityState === "visible") trySync() }
    const onStorage = (e: StorageEvent) => { if (e.key === "ryo_cart_id") trySync() }
    document.addEventListener("visibilitychange", onVisible)
    window.addEventListener("storage", onStorage)

    // Light polling for the same-tab case where cart_id is set by a non-storage
    // path (createCart writes to localStorage but doesn't fire StorageEvent in
    // the same tab). Cheap — 4 ticks then stops.
    let ticks = 0
    const interval = setInterval(() => {
      trySync()
      if (++ticks >= 4) clearInterval(interval)
    }, 1500)

    return () => {
      document.removeEventListener("visibilitychange", onVisible)
      window.removeEventListener("storage", onStorage)
      clearInterval(interval)
    }
  }, [])

  return null
}
