"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import Link from "next/link"
import { Bell, ShoppingBag, AlertCircle, CheckCircle2, X } from "lucide-react"

interface Notification {
  id: string
  display_id: number
  email: string
  customer_name: string
  total: number
  currency: string
  payment_status: string | null
  status: string | null
  created_at: string
}

interface ApiResponse {
  since: string
  now: string
  total: number
  orders: Notification[]
}

const POLL_MS = 60_000          // 60s entre polls
const SEEN_KEY = "panel_notifs_seen_at"

function fmtRel(iso: string): string {
  const d = new Date(iso)
  const diff = Date.now() - d.getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return "ahora"
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  const days = Math.floor(hrs / 24)
  return `${days}d`
}

/**
 * Bell del topbar con polling de pedidos nuevos.
 *
 * Persiste en localStorage el timestamp de "última vez que abrí el panel"
 * para que el badge muestre cuántos pedidos llegaron desde entonces.
 *
 * Audio chime opcional (off por default) si llegan pedidos nuevos cuando
 * la pestaña está en background — el browser bloquea autoplay sin
 * interacción previa, así que el chime sólo suena después del primer click.
 */
export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [orders, setOrders] = useState<Notification[]>([])
  const [seenAt, setSeenAt] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const hasInteractedRef = useRef(false)

  // Restaurar seen_at del localStorage
  useEffect(() => {
    try {
      const v = localStorage.getItem(SEEN_KEY)
      if (v) setSeenAt(v)
      else {
        // Primera vez: marcar ahora como seen para que no inunde con todo el historial
        const now = new Date().toISOString()
        localStorage.setItem(SEEN_KEY, now)
        setSeenAt(now)
      }
    } catch { /* ignore */ }
  }, [])

  // Cerrar dropdown al click fuera
  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open])

  // Poll
  const fetchNotifs = useCallback(async () => {
    setLoading(true)
    try {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      const res = await fetch(`/api/notifications?since=${encodeURIComponent(since)}`, { cache: "no-store" })
      if (!res.ok) {
        if (res.status === 401) setError("Sesión expirada")
        else setError(`Error ${res.status}`)
        setLoading(false)
        return
      }
      const data: ApiResponse = await res.json()
      setOrders(data.orders ?? [])
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "error")
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchNotifs()
    const id = setInterval(fetchNotifs, POLL_MS)
    return () => clearInterval(id)
  }, [fetchNotifs])

  // Cuando se abre el dropdown, marca todo como visto
  useEffect(() => {
    if (open) {
      const now = new Date().toISOString()
      try { localStorage.setItem(SEEN_KEY, now) } catch { /* ignore */ }
      setSeenAt(now)
      hasInteractedRef.current = true
    }
  }, [open])

  // Count de unread = orders cuyos created_at > seenAt
  const unread = seenAt
    ? orders.filter((o) => new Date(o.created_at).getTime() > new Date(seenAt).getTime()).length
    : orders.length

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={`${unread} sin leer · auto-refresh ${POLL_MS / 1000}s`}
        aria-label="Notificaciones"
        className="relative w-9 h-9 flex items-center justify-center transition-colors hover:bg-surface-2"
        style={{ border: "1.5px solid var(--border)", borderRadius: 3, color: "rgb(var(--ink-2))" }}
      >
        <Bell size={16} strokeWidth={2.2} className={loading ? "animate-pulse" : undefined} />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 bg-primary text-white text-[9px] font-bold rounded-full flex items-center justify-center font-mono px-1">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute top-[calc(100%+8px)] right-0 w-[380px] z-40 rounded-md overflow-hidden bg-page"
          style={{ border: "2.5px solid var(--border)", boxShadow: "5px 5px 0 0 var(--shadow-color)" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-dark text-cream">
            <div className="flex items-center gap-2">
              <Bell size={14} strokeWidth={2.4} />
              <h3 className="font-display font-black text-[13px] uppercase tracking-wider">
                Notificaciones
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={fetchNotifs}
                disabled={loading}
                className="text-[10px] font-display font-bold uppercase tracking-wider text-orange hover:underline disabled:opacity-50"
              >
                {loading ? "..." : "↻ refrescar"}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-cream/60 hover:text-cream"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-[60vh] overflow-y-auto">
            {error ? (
              <div className="p-6 text-center">
                <AlertCircle size={20} className="mx-auto text-primary mb-2" />
                <p className="text-[12px] text-primary">{error}</p>
              </div>
            ) : orders.length === 0 ? (
              <div className="p-6 text-center">
                <CheckCircle2 size={20} className="mx-auto text-secondary mb-2" />
                <p className="text-[12px] text-ink-3">Sin pedidos en las últimas 24h</p>
              </div>
            ) : (
              <ul className="divide-y divide-warm-200/50">
                {orders.map((o) => {
                  const isUnread = seenAt && new Date(o.created_at).getTime() > new Date(seenAt).getTime()
                  const isPaid = o.payment_status === "captured"
                  const isCancelled = o.status === "canceled"
                  return (
                    <li key={o.id}>
                      <Link
                        href={`/orders/${o.id}`}
                        onClick={() => setOpen(false)}
                        className={`block px-4 py-3 transition-colors hover:bg-cream-2/60 ${isUnread ? "bg-orange/5" : ""}`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-8 h-8 flex items-center justify-center flex-shrink-0 rounded-md ${
                            isCancelled ? "bg-primary/15 text-primary" :
                            isPaid ? "bg-secondary/15 text-secondary" :
                            "bg-orange/15 text-orange"
                          }`} style={{ border: `1.5px solid ${isCancelled ? "#BB3B2E" : isPaid ? "#4D5431" : "#FF3B27"}` }}>
                            <ShoppingBag size={13} strokeWidth={2.4} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-ink text-[13px]">#{o.display_id}</span>
                              {isUnread && (
                                <span className="text-[8px] font-display font-bold uppercase tracking-wider bg-orange text-dark px-1 py-0 rounded">
                                  NUEVO
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-ink-2 truncate">
                              {o.customer_name || o.email || "(sin email)"}
                            </div>
                            <div className="text-[10px] font-mono text-ink-3 mt-0.5">
                              {o.currency.toUpperCase()} {o.total.toFixed(2)} · {fmtRel(o.created_at)}
                            </div>
                          </div>
                        </div>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          {/* Footer */}
          <div
            className="flex items-center justify-between px-4 py-2 text-[10px] font-mono"
            style={{ borderTop: "1px solid var(--border-soft)", background: "rgb(var(--surface-2))" }}
          >
            <span className="text-ink-3">auto cada {POLL_MS / 1000}s</span>
            <Link href="/orders" className="text-orange hover:underline font-display font-bold uppercase tracking-wider" onClick={() => setOpen(false)}>
              Ver todos →
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
