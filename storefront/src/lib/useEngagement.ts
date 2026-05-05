"use client"

import { useEffect, useRef } from "react"
import { trackHighEngagement, trackScrollDepth } from "./posthog"

const DEFAULT_ENGAGEMENT_THRESHOLD_S = 60

/**
 * Tracks deep engagement signals on a page:
 *   - `high_engagement_page` when user stays > thresholdSeconds (default 60s)
 *   - `scroll_depth` at 25%/50%/75%/100% (each only once per page)
 *
 * Auto-pauses the timer when tab is hidden (visibilitychange).
 *
 * Usage:
 *   useEngagement({ page: "/productos/grinder-plastico", productId: "prod_..." })
 */
export function useEngagement(params: {
  page: string
  productId?: string
  thresholdSeconds?: number
  /** Disable on pages where we don't care (e.g. /checkout where conversion is already tracked) */
  enabled?: boolean
}) {
  const startRef = useRef<number>(Date.now())
  const firedEngagementRef = useRef(false)
  const firedScrollRef = useRef<Set<number>>(new Set())
  const activeRef = useRef(true)
  const accumulatedMsRef = useRef(0)
  const lastResumeRef = useRef(Date.now())

  useEffect(() => {
    if (params.enabled === false) return

    const threshold = (params.thresholdSeconds ?? DEFAULT_ENGAGEMENT_THRESHOLD_S) * 1000

    // ─── Visibility ───────────────────────────────────────────────────────
    function onVisibility() {
      const now = Date.now()
      if (document.visibilityState === "hidden") {
        if (activeRef.current) {
          accumulatedMsRef.current += now - lastResumeRef.current
          activeRef.current = false
        }
      } else {
        lastResumeRef.current = now
        activeRef.current = true
      }
    }
    document.addEventListener("visibilitychange", onVisibility)

    // ─── Engagement timer ─────────────────────────────────────────────────
    const timer = setInterval(() => {
      if (!activeRef.current || firedEngagementRef.current) return
      const elapsed = accumulatedMsRef.current + (Date.now() - lastResumeRef.current)
      if (elapsed >= threshold) {
        firedEngagementRef.current = true
        trackHighEngagement({
          page: params.page,
          duration_s: Math.round(elapsed / 1000),
          product_id: params.productId,
        })
      }
    }, 5000)

    // ─── Scroll depth ─────────────────────────────────────────────────────
    function onScroll() {
      const doc = document.documentElement
      const scrollable = (doc.scrollHeight - doc.clientHeight) || 1
      const depth = Math.round((window.scrollY / scrollable) * 100)
      for (const threshold of [25, 50, 75, 100] as const) {
        if (depth >= threshold && !firedScrollRef.current.has(threshold)) {
          firedScrollRef.current.add(threshold)
          trackScrollDepth({
            page: params.page,
            depth_pct: threshold,
            product_id: params.productId,
          })
        }
      }
    }
    window.addEventListener("scroll", onScroll, { passive: true })

    return () => {
      document.removeEventListener("visibilitychange", onVisibility)
      window.removeEventListener("scroll", onScroll)
      clearInterval(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.page, params.productId, params.thresholdSeconds, params.enabled])
}
