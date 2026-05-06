"use client"

import { useEffect } from "react"

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"] as const
// Referral code (?ref=ENR-XXXXXX). Persisted longer than UTM so a friend who
// shares a link gets credit even if the recipient bookmarks and buys later.
const REFERRAL_KEY = "ref"
const COOKIE_MAX_AGE_DAYS = 30
const REFERRAL_COOKIE_MAX_AGE_DAYS = 90

function setCookie(name: string, value: string, days: number) {
  const expires = new Date(Date.now() + days * 86400 * 1000).toUTCString()
  const encoded = encodeURIComponent(value).slice(0, 200)
  document.cookie = `${name}=${encoded}; expires=${expires}; path=/; samesite=lax`
}

/**
 * Captures UTM parameters from the URL on mount and stores them in cookies
 * (30 days). Also captures document.referrer on the first visit of a session.
 * Cookies are later read server-side at checkout to attribute the order.
 */
export default function UtmCapture() {
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      for (const key of UTM_KEYS) {
        const value = params.get(key)
        if (value) setCookie(key, value, COOKIE_MAX_AGE_DAYS)
      }

      // Capture referral code separately — longer TTL, normalize to upper.
      const refRaw = params.get(REFERRAL_KEY)
      if (refRaw) {
        const cleaned = refRaw.trim().toUpperCase().replace(/\s+/g, "").slice(0, 32)
        if (/^ENR-[A-Z0-9]{3,10}$/.test(cleaned) || /^[A-Z0-9]{3,10}$/.test(cleaned)) {
          const normalized = cleaned.startsWith("ENR-") ? cleaned : `ENR-${cleaned}`
          setCookie(REFERRAL_KEY, normalized, REFERRAL_COOKIE_MAX_AGE_DAYS)
        }
      }

      // Only capture referrer once per session, and only if it's external
      if (!document.cookie.includes("referrer=") && document.referrer) {
        try {
          const ref = new URL(document.referrer)
          if (ref.hostname && ref.hostname !== window.location.hostname) {
            setCookie("referrer", ref.hostname, COOKIE_MAX_AGE_DAYS)
          }
        } catch {
          // ignore malformed referrer
        }
      }
    } catch {
      // defensive: never block rendering because of attribution
    }
  }, [])

  return null
}
