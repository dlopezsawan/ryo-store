"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  Bell, BellOff, Volume2, VolumeX, Pause, Play, RefreshCw,
  AlertCircle, CheckCircle2, ShoppingBag, Clock, MapPin, TrendingUp,
  Phone, User, Package, Truck, Send, Hash, ChefHat,
} from "lucide-react"
import { fmtRelative, fmtEur } from "@/lib/utils"
import { capturePaymentAction, markFulfilledAction, markDeliveredAction, completeOrderAction } from "../[id]/actions"

type Toast = { kind: "ok" | "err"; msg: string } | null

interface LiveOrderItem {
  id: string
  title: string
  variant_title: string | null
  quantity: number
  thumbnail: string | null
  sku: string | null
}

interface LiveOrder {
  id: string
  display_id: number
  email: string
  customer_name: string
  total: number
  currency: string
  status: string | null
  payment_status: string | null
  fulfillment_status: string | null
  created_at: string
  shipping_city: string | null
  shipping_country: string | null
  shipping_address_1: string | null
  shipping_phone: string | null
  items_count: number
  items: LiveOrderItem[]
}

interface Kpis {
  today: { revenue: number; count: number; aov: number; currency: string }
  last_hour: { count: number }
  pending: { count: number }
  to_fulfill: { count: number }
}

interface ApiResponse {
  ok: boolean
  orders?: LiveOrder[]
  kpis?: Kpis
  server_time?: string
  error?: string
}

const POLL_MS = 5000  // 5 segundos
const STORAGE_NOTIF = "panel_live_notif"
const STORAGE_SOUND = "panel_live_sound"

export function LiveOrdersClient() {
  const router = useRouter()
  const [orders, setOrders] = useState<LiveOrder[]>([])
  const [kpis, setKpis] = useState<Kpis | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [paused, setPaused] = useState(false)
  const [lastTickAt, setLastTickAt] = useState<Date | null>(null)
  const [notifEnabled, setNotifEnabled] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(false)
  const [toast, setToast] = useState<Toast>(null)
  const [pending, startTransition] = useTransition()
  const [view, setView] = useState<"tickets" | "feed" | "kanban" | "geo">("tickets")

  // Track seen IDs across polls
  const seenIdsRef = useRef<Set<string>>(new Set())
  const isInitialLoadRef = useRef(true)

  function flash(k: "ok" | "err", m: string) {
    setToast({ kind: k, msg: m })
    setTimeout(() => setToast(null), 4000)
  }

  // Restore preferences
  useEffect(() => {
    try {
      setNotifEnabled(localStorage.getItem(STORAGE_NOTIF) === "true")
      setSoundEnabled(localStorage.getItem(STORAGE_SOUND) === "true")
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    try { localStorage.setItem(STORAGE_NOTIF, String(notifEnabled)) } catch { /* ignore */ }
  }, [notifEnabled])
  useEffect(() => {
    try { localStorage.setItem(STORAGE_SOUND, String(soundEnabled)) } catch { /* ignore */ }
  }, [soundEnabled])

  // Web Notifications + sound for new orders
  function notifyNewOrder(o: LiveOrder) {
    if (notifEnabled && typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
      try {
        new Notification(`Nueva orden #${o.display_id}`, {
          body: `${o.customer_name || o.email} · ${fmtEur(o.total)}`,
          tag: `order-${o.id}`,
          icon: "/logo.svg",
        })
      } catch { /* ignore */ }
    }
    if (soundEnabled) {
      // Beep usando Web Audio API (sin archivos)
      try {
        const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
        const o = ctx.createOscillator()
        const g = ctx.createGain()
        o.connect(g); g.connect(ctx.destination)
        o.type = "sine"
        o.frequency.value = 880
        g.gain.value = 0.05
        o.start()
        o.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.15)
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4)
        o.stop(ctx.currentTime + 0.4)
      } catch { /* ignore */ }
    }
  }

  // Polling
  useEffect(() => {
    let mounted = true
    let timer: ReturnType<typeof setTimeout> | null = null

    async function tick() {
      try {
        const res = await fetch("/api/orders/live", { cache: "no-store" })
        const data = await res.json() as ApiResponse
        if (!mounted) return
        if (data.ok && data.orders && data.kpis) {
          // Detect new orders (by id)
          if (!isInitialLoadRef.current) {
            for (const o of data.orders) {
              if (!seenIdsRef.current.has(o.id)) {
                notifyNewOrder(o)
              }
            }
          }
          seenIdsRef.current = new Set(data.orders.map((o) => o.id))
          isInitialLoadRef.current = false
          setOrders(data.orders)
          setKpis(data.kpis)
          setError(null)
          setLastTickAt(new Date())
        } else {
          setError(data.error ?? "respuesta inválida")
        }
      } catch (e) {
        if (mounted) setError(e instanceof Error ? e.message : "network error")
      } finally {
        if (mounted) setLoading(false)
      }
      if (mounted && !paused) {
        timer = setTimeout(tick, POLL_MS)
      }
    }

    tick()
    return () => {
      mounted = false
      if (timer) clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused, notifEnabled, soundEnabled])

  async function requestNotifPermission() {
    if (!("Notification" in window)) {
      flash("err", "Tu navegador no soporta notificaciones")
      return
    }
    if (Notification.permission === "granted") {
      setNotifEnabled((v) => !v)
      return
    }
    if (Notification.permission === "denied") {
      flash("err", "Permiso denegado — activá en config del navegador")
      return
    }
    const result = await Notification.requestPermission()
    if (result === "granted") {
      setNotifEnabled(true)
      flash("ok", "Notificaciones activadas")
    } else {
      flash("err", "Permiso no concedido")
    }
  }

  function manualRefresh() {
    // No hacemos setPaused(false) aquí: eso re-lanzaría el useEffect de polling
    // y generaría un double-fetch (efecto + este fetch inline → flicker).
    // Si el usuario quiere reanudar el polling, usa el botón Pausar/Reanudar.
    setLoading(true)
    isInitialLoadRef.current = true  // no notif on manual
    fetch("/api/orders/live", { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json() as ApiResponse
        if (data.ok && data.orders && data.kpis) {
          seenIdsRef.current = new Set(data.orders.map((o) => o.id))
          setOrders(data.orders)
          setKpis(data.kpis)
          setError(null)
          setLastTickAt(new Date())
        }
      })
      .finally(() => setLoading(false))
  }

  // Quick actions on a row
  function quickCapture(orderId: string) {
    startTransition(async () => {
      const res = await capturePaymentAction(orderId)
      if (!res.ok) return flash("err", res.error)
      flash("ok", "Pago capturado")
      manualRefresh()
      router.refresh()
    })
  }
  function quickFulfill(orderId: string) {
    startTransition(async () => {
      const res = await markFulfilledAction(orderId)
      if (!res.ok) return flash("err", res.error)
      flash("ok", "Pedido preparado")
      manualRefresh()
      router.refresh()
    })
  }
  function quickDeliver(orderId: string) {
    startTransition(async () => {
      const res = await markDeliveredAction(orderId)
      if (!res.ok) return flash("err", res.error)
      flash("ok", "Pedido entregado · cliente recibió")
      manualRefresh()
      router.refresh()
    })
  }
  function quickComplete(orderId: string) {
    startTransition(async () => {
      const res = await completeOrderAction(orderId)
      if (!res.ok) return flash("err", res.error)
      flash("ok", "Pedido completado")
      manualRefresh()
      router.refresh()
    })
  }

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* View switcher */}
        <div className="flex items-center bg-cream rounded-md overflow-hidden" style={{ border: "1.5px solid var(--border)" }}>
          {(["tickets", "feed", "kanban", "geo"] as const).map((v) => (
            <button key={v} onClick={() => setView(v)}
              className={`flex items-center gap-1 px-3 py-2 text-[10px] font-display font-bold uppercase tracking-wider ${
                view === v ? "bg-dark text-cream" : "text-ink-3 hover:bg-cream-2"
              }`}>
              {v === "tickets" && <ChefHat size={11} strokeWidth={2.5} />}
              {v === "tickets" ? "Tickets" : v === "feed" ? "Feed" : v === "kanban" ? "Kanban" : "Geo"}
            </button>
          ))}
        </div>

        <div className="flex-1 min-w-0" />

        {/* Status pill */}
        <div className="flex items-center gap-1.5 px-2 py-1.5 bg-cream-2 rounded-md text-[10px] font-mono">
          {error ? (
            <><span className="w-2 h-2 bg-primary rounded-full" /><span className="text-primary">ERR</span></>
          ) : paused ? (
            <><span className="w-2 h-2 bg-orange rounded-full" /><span className="text-orange">PAUSADO</span></>
          ) : (
            <>
              <span className="w-2 h-2 bg-secondary rounded-full animate-pulse" />
              <span className="text-secondary">LIVE · 5s</span>
            </>
          )}
          {lastTickAt && <span className="text-ink-3 ml-1">{fmtRelative(lastTickAt.toISOString())}</span>}
        </div>

        {/* Notif toggle */}
        <button onClick={requestNotifPermission}
          title={notifEnabled ? "Notificaciones activas" : "Activar notificaciones"}
          className={`flex items-center gap-1 px-2 py-1.5 rounded-md text-[10px] font-display font-bold uppercase tracking-wider ${
            notifEnabled ? "bg-secondary text-cream" : "bg-cream text-ink-3 hover:bg-cream-2"
          }`}
          style={{ border: "1.5px solid var(--border)" }}>
          {notifEnabled ? <Bell size={11} strokeWidth={2.5} /> : <BellOff size={11} strokeWidth={2.5} />}
        </button>

        {/* Sound toggle */}
        <button onClick={() => setSoundEnabled((v) => !v)}
          title={soundEnabled ? "Sonido activo" : "Activar sonido"}
          className={`flex items-center gap-1 px-2 py-1.5 rounded-md text-[10px] font-display font-bold uppercase tracking-wider ${
            soundEnabled ? "bg-orange text-dark" : "bg-cream text-ink-3 hover:bg-cream-2"
          }`}
          style={{ border: "1.5px solid var(--border)" }}>
          {soundEnabled ? <Volume2 size={11} strokeWidth={2.5} /> : <VolumeX size={11} strokeWidth={2.5} />}
        </button>

        {/* Pause/play */}
        <button onClick={() => setPaused((v) => !v)}
          className="flex items-center gap-1 px-2 py-1.5 bg-cream rounded-md text-[10px] font-display font-bold uppercase tracking-wider hover:bg-cream-2"
          style={{ border: "1.5px solid var(--border)" }}>
          {paused ? <Play size={11} strokeWidth={2.5} /> : <Pause size={11} strokeWidth={2.5} />}
          {paused ? "Reanudar" : "Pausar"}
        </button>

        {/* Manual refresh */}
        <button onClick={manualRefresh} disabled={loading}
          className="flex items-center gap-1 px-2 py-1.5 bg-cream rounded-md text-[10px] font-display font-bold uppercase tracking-wider hover:bg-cream-2 disabled:opacity-50"
          style={{ border: "1.5px solid var(--border)" }}>
          <RefreshCw size={11} strokeWidth={2.5} className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      {/* Live KPIs */}
      {kpis && (
        <div className="grid grid-cols-4 gap-3">
          <LiveKpi label="Hoy · Revenue"   value={fmtEur(kpis.today.revenue)} sub={`${kpis.today.count} pedidos`} tone="secondary" pulsing />
          <LiveKpi label="Última hora"     value={String(kpis.last_hour.count)} sub="pedidos nuevos" tone={kpis.last_hour.count > 0 ? "orange" : undefined} />
          <LiveKpi label="Pendientes pago" value={String(kpis.pending.count)} sub="esperando captura" tone={kpis.pending.count > 0 ? "primary" : "secondary"} />
          <LiveKpi label="Por preparar"    value={String(kpis.to_fulfill.count)} sub="pagados sin fulfillment" tone={kpis.to_fulfill.count > 0 ? "orange" : "secondary"} />
        </div>
      )}

      {error && (
        <div className="stamp-card p-3 bg-primary/5" style={{ borderColor: "#BB3B2E" }}>
          <p className="text-[12px] font-medium text-primary"><AlertCircle size={12} className="inline mr-1" /> {error}</p>
        </div>
      )}

      {/* Vista activa */}
      {view === "tickets" && <TicketsView orders={orders} onCapture={quickCapture} onFulfill={quickFulfill} onDeliver={quickDeliver} onComplete={quickComplete} pending={pending} />}
      {view === "feed" && <FeedView orders={orders} onCapture={quickCapture} onFulfill={quickFulfill} onDeliver={quickDeliver} pending={pending} />}
      {view === "kanban" && <KanbanView orders={orders} onCapture={quickCapture} onFulfill={quickFulfill} pending={pending} />}
      {view === "geo" && <GeoView orders={orders} />}

      {toast && (
        <div className="fixed bottom-6 right-6 z-[60] px-4 py-3 rounded-md flex items-center gap-2 text-[12px] font-medium animate-in fade-in slide-in-from-bottom-2"
          style={{ background: toast.kind === "ok" ? "#4D5431" : "#BB3B2E", color: "#fff", border: "2px solid #1A1A1A", boxShadow: "4px 4px 0 0 var(--shadow-color)", minWidth: 280, maxWidth: 480 }}>
          {toast.kind === "ok" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{toast.msg}</span>
        </div>
      )}
    </div>
  )
}

function LiveKpi({ label, value, sub, tone, pulsing }: { label: string; value: string; sub: string; tone?: "primary" | "secondary" | "orange"; pulsing?: boolean }) {
  const bg = tone === "primary" ? "bg-primary/5" : tone === "secondary" ? "bg-secondary/5" : tone === "orange" ? "bg-orange/5" : ""
  const labelTone = tone === "primary" ? "text-primary" : tone === "secondary" ? "text-secondary" : tone === "orange" ? "text-orange" : "text-ink-3"
  const valueTone = tone === "primary" ? "text-primary" : tone === "secondary" ? "text-secondary" : tone === "orange" ? "text-orange" : ""
  return (
    <div className={`stamp-card p-4 ${bg} relative overflow-hidden`}>
      {pulsing && <div className="absolute top-2 right-2 w-1.5 h-1.5 bg-secondary rounded-full animate-pulse" />}
      <div className={`text-[9px] font-display font-bold uppercase tracking-[0.18em] ${labelTone}`}>{label}</div>
      <div className={`stat-display text-[26px] mt-2 num ${valueTone}`}>{value}</div>
      <div className="text-[10px] mt-1 text-ink-3 font-mono">{sub}</div>
    </div>
  )
}

// ─── TICKETS VIEW (restaurant-style) ─────────────────────────────────

function TicketsView({ orders, onCapture, onFulfill, onDeliver, onComplete, pending }: {
  orders: LiveOrder[]
  onCapture: (id: string) => void
  onFulfill: (id: string) => void
  onDeliver: (id: string) => void
  onComplete: (id: string) => void
  pending: boolean
}) {
  // Filtrar: en activos NO mostramos cancelados/archivados, pero SÍ mostramos
  // los entregados que aún no fueron completados (para que aparezca el botón "completar")
  const active = orders.filter((o) => {
    if (o.status === "canceled" || o.status === "archived") return false
    if (o.status === "completed") return false
    return true
  })
  // Sort: más viejo primero (urgencia), pendientes pago al final
  const sorted = active.slice().sort((a, b) => {
    // Pago capturado / autorizado primero
    const aPaid = a.payment_status === "captured" || a.payment_status === "authorized"
    const bPaid = b.payment_status === "captured" || b.payment_status === "authorized"
    if (aPaid !== bPaid) return aPaid ? -1 : 1
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  })

  if (sorted.length === 0) {
    return (
      <div className="stamp-card p-10 text-center">
        <ChefHat size={48} className="text-ink-3 mx-auto mb-3" strokeWidth={1.5} />
        <p className="font-display font-bold text-[14px] uppercase tracking-wider text-ink-3">Sin tickets activos</p>
        <p className="text-[12px] text-ink-3 mt-1">Todos los pedidos están entregados o cancelados.</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
      {sorted.map((o) => <TicketCard key={o.id} order={o} onCapture={onCapture} onFulfill={onFulfill} onDeliver={onDeliver} onComplete={onComplete} pending={pending} />)}
    </div>
  )
}

function TicketCard({ order: o, onCapture, onFulfill, onDeliver, onComplete, pending }: {
  order: LiveOrder
  onCapture: (id: string) => void
  onFulfill: (id: string) => void
  onDeliver: (id: string) => void
  onComplete: (id: string) => void
  pending: boolean
}) {
  // Urgencia: minutos desde creación
  const ageMs = Date.now() - new Date(o.created_at).getTime()
  const ageMin = Math.floor(ageMs / 60_000)
  const ageHr = Math.floor(ageMin / 60)

  // Determinar urgencia visual basado en estado + tiempo
  const isPaid = o.payment_status === "captured" || o.payment_status === "authorized"
  const isPrepared = o.fulfillment_status === "fulfilled" || o.fulfillment_status === "partially_fulfilled"
  const isShipped = o.fulfillment_status === "shipped" || o.fulfillment_status === "partially_shipped"
  const isDelivered = o.fulfillment_status === "delivered"

  // Color top stripe según urgencia
  let urgency: "fresh" | "moderate" | "urgent" | "critical" | "shipped" | "delivered" = "fresh"
  if (isDelivered) {
    urgency = "delivered"  // verde — listo para completar
  } else if (isShipped) {
    urgency = "shipped"  // gris — esperando confirmación de entrega
  } else if (isPrepared) {
    urgency = "moderate"  // naranja — listo para enviar
  } else if (!isPaid) {
    urgency = "moderate"  // naranja — pendiente pago
  } else {
    // Pagado, sin preparar
    if (ageMin < 15) urgency = "fresh"
    else if (ageMin < 30) urgency = "moderate"
    else if (ageMin < 60) urgency = "urgent"
    else urgency = "critical"
  }

  const URGENCY_META = {
    fresh:     { stripe: "#4D5431", label: "FRESCO",         pulse: false },
    moderate:  { stripe: "#FF3B27", label: "PREPARAR",       pulse: false },
    urgent:    { stripe: "#FF3B27", label: "URGENTE",        pulse: true  },
    critical:  { stripe: "#BB3B2E", label: "CRÍTICO",        pulse: true  },
    shipped:   { stripe: "#9C9285", label: "ENVIADO",        pulse: false },
    delivered: { stripe: "#4D5431", label: "ENTREGADO",      pulse: true  },
  }[urgency]

  const stage = isDelivered ? "delivered"
              : isShipped ? "shipped"
              : isPrepared ? "preparing"
              : isPaid ? "paid"
              : "pending_payment"
  const stageMeta = STAGE_META[stage as keyof typeof STAGE_META]

  const ageLabel = ageHr >= 1 ? `${ageHr}h ${ageMin % 60}m` : `${ageMin}m`

  return (
    <div className="stamp-card overflow-hidden flex flex-col" style={{ borderColor: URGENCY_META.stripe, minHeight: 380 }}>
      {/* Top stripe with urgency */}
      <div className={`h-1.5 ${URGENCY_META.pulse ? "animate-pulse" : ""}`} style={{ background: URGENCY_META.stripe }} />

      {/* Ticket header */}
      <div className="p-3 bg-dark text-cream">
        <div className="flex items-center justify-between mb-1">
          <Link href={`/orders/${o.id}`} className="font-display font-black text-[18px] hover:text-orange">
            #{o.display_id}
          </Link>
          <span className={`px-2 py-0.5 text-[9px] font-display font-black uppercase tracking-wider rounded-md ${
            URGENCY_META.pulse ? "animate-pulse" : ""
          }`} style={{ background: URGENCY_META.stripe, color: "#fff" }}>
            {URGENCY_META.label}
          </span>
        </div>
        <div className="flex items-center justify-between text-[10px] font-mono text-cream/70">
          <span><Clock size={9} className="inline mr-0.5" /> {ageLabel}</span>
          <span className="font-display font-black text-[14px] num text-cream">
            {fmtEur(o.total)}
          </span>
        </div>
      </div>

      {/* Customer block */}
      <div className="p-3 bg-cream-2/30 border-b border-warm-200/50">
        <div className="flex items-center gap-2 mb-1">
          <User size={11} strokeWidth={2.5} className="text-ink-3 flex-shrink-0" />
          <span className="font-display font-bold text-[12px] text-ink truncate flex-1">
            {o.customer_name || o.email || "Sin nombre"}
          </span>
        </div>
        {o.shipping_phone && (
          <div className="flex items-center gap-2 text-[10px] font-mono text-ink-3">
            <Phone size={10} strokeWidth={2.5} className="flex-shrink-0" />
            <a href={`tel:${o.shipping_phone}`} className="hover:text-orange truncate">{o.shipping_phone}</a>
          </div>
        )}
        {(o.shipping_address_1 || o.shipping_city) && (
          <div className="flex items-start gap-2 text-[10px] font-mono text-ink-3 mt-0.5">
            <MapPin size={10} strokeWidth={2.5} className="flex-shrink-0 mt-0.5" />
            <span className="truncate">
              {o.shipping_address_1}{o.shipping_address_1 && o.shipping_city && ", "}{o.shipping_city}
            </span>
          </div>
        )}
      </div>

      {/* Items list */}
      <div className="flex-1 p-3 space-y-1.5 overflow-y-auto" style={{ maxHeight: 180 }}>
        {o.items.length === 0 ? (
          <p className="text-[10px] text-ink-3 italic font-mono">Sin items</p>
        ) : (
          o.items.map((it) => (
            <div key={it.id} className="flex items-start gap-2 text-[11px]">
              <span className="font-display font-black num text-orange w-6 text-right flex-shrink-0">×{it.quantity}</span>
              <div className="flex-1 min-w-0">
                <div className="font-display font-bold text-ink leading-tight line-clamp-2">{it.title}</div>
                {(it.variant_title || it.sku) && (
                  <div className="text-[9px] font-mono text-ink-3 truncate">
                    {it.variant_title}
                    {it.variant_title && it.sku && " · "}
                    {it.sku}
                  </div>
                )}
              </div>
              {it.thumbnail && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={it.thumbnail} alt="" className="w-9 h-9 object-cover bg-cream-2 flex-shrink-0" style={{ border: "1px solid var(--border-soft)" }} />
              )}
            </div>
          ))
        )}
      </div>

      {/* Action buttons */}
      <div className="p-2 bg-cream-2/40 border-t border-warm-200/50 flex items-center gap-1.5">
        <span className={`flex-1 text-[9px] font-display font-bold uppercase tracking-wider px-1.5 py-1 rounded-md text-center ${stageMeta.bg} truncate`}
          style={{ color: stageMeta.color, border: `1.5px solid ${stageMeta.color}` }}>
          {stageMeta.label}
        </span>
        {!isPaid && (
          <button onClick={() => onCapture(o.id)} disabled={pending}
            className="flex items-center gap-1 px-2 py-1 bg-secondary text-cream rounded-md text-[10px] font-display font-bold uppercase tracking-wider disabled:opacity-50 hover:opacity-90"
            style={{ border: "1.5px solid #1A1A1A" }} title="Capturar pago">
            <CheckCircle2 size={11} strokeWidth={2.5} /> CAP
          </button>
        )}
        {isPaid && !isPrepared && !isShipped && !isDelivered && (
          <button onClick={() => onFulfill(o.id)} disabled={pending}
            className="flex items-center gap-1 px-2 py-1 bg-orange text-dark rounded-md text-[10px] font-display font-bold uppercase tracking-wider disabled:opacity-50 hover:opacity-90"
            style={{ border: "1.5px solid #1A1A1A" }} title="Marcar preparado">
            <Package size={11} strokeWidth={2.5} /> PREP
          </button>
        )}
        {(isPrepared || isShipped) && !isDelivered && (
          <button onClick={() => onDeliver(o.id)} disabled={pending}
            className="flex items-center gap-1 px-2 py-1 bg-secondary text-cream rounded-md text-[10px] font-display font-bold uppercase tracking-wider disabled:opacity-50 hover:opacity-90"
            style={{ border: "1.5px solid #1A1A1A" }} title="Marcar entregado al cliente">
            <Truck size={11} strokeWidth={2.5} /> ENT
          </button>
        )}
        {isDelivered && o.status !== "completed" && (
          <button onClick={() => onComplete(o.id)} disabled={pending}
            className="flex items-center gap-1 px-2 py-1 bg-secondary text-cream rounded-md text-[10px] font-display font-bold uppercase tracking-wider disabled:opacity-50 hover:opacity-90 animate-pulse"
            style={{ border: "1.5px solid #1A1A1A" }} title="Completar pedido (cierre)">
            <CheckCircle2 size={11} strokeWidth={2.5} /> ✓
          </button>
        )}
      </div>
    </div>
  )
}

// ─── FEED VIEW ───────────────────────────────────────────────────────

function FeedView({ orders, onCapture, onFulfill, onDeliver, pending }: {
  orders: LiveOrder[]
  onCapture: (id: string) => void
  onFulfill: (id: string) => void
  onDeliver: (id: string) => void
  pending: boolean
}) {
  if (orders.length === 0) {
    return (
      <div className="stamp-card p-10 text-center">
        <ShoppingBag size={48} className="text-ink-3 mx-auto mb-3" strokeWidth={1.5} />
        <p className="font-display font-bold text-[14px] uppercase tracking-wider text-ink-3">Sin pedidos activos</p>
      </div>
    )
  }
  return (
    <div className="stamp-card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 bg-dark text-cream">
        <h3 className="font-display font-black text-[14px] uppercase tracking-wider">Feed live · últimos 7 días</h3>
        <span className="text-[10px] text-cream/60 font-mono">{orders.length} órdenes</span>
      </div>
      <ul className="divide-y divide-warm-200/50 max-h-[600px] overflow-y-auto">
        {orders.map((o) => <FeedRow key={o.id} order={o} onCapture={onCapture} onFulfill={onFulfill} onDeliver={onDeliver} pending={pending} />)}
      </ul>
    </div>
  )
}

function FeedRow({ order: o, onCapture, onFulfill, onDeliver, pending }: {
  order: LiveOrder
  onCapture: (id: string) => void
  onFulfill: (id: string) => void
  onDeliver: (id: string) => void
  pending: boolean
}) {
  const ageMs = Date.now() - new Date(o.created_at).getTime()
  const isFresh = ageMs < 60_000  // < 1min
  const stage = stageFromOrder(o)
  const meta = STAGE_META[stage]
  const canCapture = o.payment_status === "not_paid" || o.payment_status === "awaiting"
  const canFulfill = (o.payment_status === "captured" || o.payment_status === "authorized") && (!o.fulfillment_status || o.fulfillment_status === "not_fulfilled")
  const canDeliver = (o.fulfillment_status === "shipped" || o.fulfillment_status === "fulfilled" || o.fulfillment_status === "partially_fulfilled" || o.fulfillment_status === "partially_shipped")

  return (
    <li className={`p-3 flex items-center gap-3 row-hover ${isFresh ? "bg-orange/5" : ""}`}>
      {isFresh && <span className="w-1.5 h-1.5 bg-orange rounded-full animate-pulse flex-shrink-0" />}
      <span className={`px-2 py-1 text-[9px] font-display font-bold uppercase tracking-wider rounded-md flex-shrink-0`}
        style={{ background: meta.color, color: "#fff" }}>
        {meta.label}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <Link href={`/orders/${o.id}`} className="font-mono font-bold text-ink hover:text-orange text-[13px]">
            #{o.display_id}
          </Link>
          <span className="font-display font-bold text-[12px] text-ink truncate">{o.customer_name || o.email}</span>
          {o.shipping_city && <span className="text-[10px] text-ink-3 font-mono"><MapPin size={9} className="inline mr-0.5" />{o.shipping_city}</span>}
        </div>
        <div className="text-[10px] text-ink-3 font-mono mt-0.5">
          {o.items_count} {o.items_count === 1 ? "ítem" : "ítems"} · <Clock size={9} className="inline mr-0.5" />{fmtRelative(o.created_at)}
        </div>
      </div>
      <div className="text-right flex-shrink-0">
        <div className="font-display font-black num text-[15px]">{fmtEur(o.total)}</div>
        <div className="text-[9px] text-ink-3 font-mono">{(o.currency || "eur").toUpperCase()}</div>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        {canCapture && (
          <button onClick={() => onCapture(o.id)} disabled={pending}
            className="px-2 py-1 bg-secondary text-cream text-[9px] font-display font-bold uppercase tracking-wider rounded-md disabled:opacity-50 hover:opacity-90"
            style={{ border: "1.5px solid #1A1A1A" }}
            title="Capturar pago">
            CAP
          </button>
        )}
        {canFulfill && (
          <button onClick={() => onFulfill(o.id)} disabled={pending}
            className="px-2 py-1 bg-orange text-dark text-[9px] font-display font-bold uppercase tracking-wider rounded-md disabled:opacity-50 hover:opacity-90"
            style={{ border: "1.5px solid #1A1A1A" }}
            title="Marcar preparado">
            PREP
          </button>
        )}
        {canDeliver && (
          <button onClick={() => onDeliver(o.id)} disabled={pending}
            className="px-2 py-1 bg-secondary text-cream text-[9px] font-display font-bold uppercase tracking-wider rounded-md disabled:opacity-50 hover:opacity-90"
            style={{ border: "1.5px solid #1A1A1A" }}
            title="Marcar entregado al cliente">
            ENT
          </button>
        )}
      </div>
    </li>
  )
}

// ─── KANBAN VIEW ─────────────────────────────────────────────────────

type KanbanStage = "pending_payment" | "paid" | "preparing" | "shipped" | "delivered"

const STAGE_META: Record<KanbanStage, { label: string; color: string; bg: string }> = {
  pending_payment: { label: "Pendiente pago", color: "#BB3B2E", bg: "bg-primary/5" },
  paid:            { label: "Pagado",         color: "#FF3B27", bg: "bg-orange/5"  },
  preparing:       { label: "Preparando",     color: "#D4A015", bg: "bg-orange/10" },
  shipped:         { label: "Enviado",        color: "#4D5431", bg: "bg-secondary/5" },
  delivered:       { label: "Entregado",      color: "#1A1A1A", bg: "bg-cream-2"   },
}

function stageFromOrder(o: LiveOrder): KanbanStage {
  if (o.fulfillment_status === "delivered") return "delivered"
  if (o.fulfillment_status === "shipped" || o.fulfillment_status === "partially_shipped") return "shipped"
  if (o.fulfillment_status === "fulfilled" || o.fulfillment_status === "partially_fulfilled") return "preparing"
  if (o.payment_status === "captured" || o.payment_status === "authorized") return "paid"
  return "pending_payment"
}

function KanbanView({ orders, onCapture, onFulfill, pending }: {
  orders: LiveOrder[]
  onCapture: (id: string) => void
  onFulfill: (id: string) => void
  pending: boolean
}) {
  const byStage = new Map<KanbanStage, LiveOrder[]>()
  for (const o of orders) {
    const s = stageFromOrder(o)
    const arr = byStage.get(s) ?? []
    arr.push(o)
    byStage.set(s, arr)
  }

  function handleDrop(orderId: string, targetStage: KanbanStage) {
    const order = orders.find((o) => o.id === orderId)
    if (!order) return
    const currentStage = stageFromOrder(order)
    if (currentStage === targetStage) return

    // Determinar acción: solo permitimos transiciones válidas hacia adelante
    if (currentStage === "pending_payment" && targetStage === "paid") {
      onCapture(orderId)
    } else if (currentStage === "paid" && targetStage === "preparing") {
      onFulfill(orderId)
    } else if (currentStage === "pending_payment" && targetStage === "preparing") {
      // capture + fulfill secuencial — el feedback inmediato es solo capture, fulfill se agarra siguiente tick
      onCapture(orderId)
    } else {
      // Otras transiciones (shipped, delivered) requieren ir al detalle de la orden
      // para añadir tracking — abrimos en nueva tab
      window.open(`/orders/${orderId}`, "_blank")
    }
  }

  return (
    <div className="grid grid-cols-5 gap-3">
      {(["pending_payment", "paid", "preparing", "shipped", "delivered"] as KanbanStage[]).map((stage) => {
        const stageOrders = byStage.get(stage) ?? []
        const meta = STAGE_META[stage]
        const total = stageOrders.reduce((s, o) => s + o.total, 0)
        return (
          <div key={stage}
            className={`stamp-card overflow-hidden flex flex-col`}
            style={{ borderColor: meta.color, minHeight: 400 }}
            onDragOver={(e) => { e.preventDefault() }}
            onDrop={(e) => {
              e.preventDefault()
              const id = e.dataTransfer.getData("text/order-id")
              if (id) handleDrop(id, stage)
            }}>
            <div className="px-3 py-2 text-cream" style={{ background: meta.color }}>
              <div className="font-display font-black text-[11px] uppercase tracking-wider">{meta.label}</div>
              <div className="text-[10px] font-mono opacity-80 flex items-center justify-between">
                <span>{stageOrders.length} órdenes</span>
                <span>{fmtEur(total)}</span>
              </div>
            </div>
            <div className={`flex-1 p-2 space-y-2 ${meta.bg} overflow-y-auto`} style={{ maxHeight: 600 }}>
              {stageOrders.length === 0 && (
                <p className="text-[10px] text-ink-3 font-mono text-center py-4">— vacío —</p>
              )}
              {stageOrders.map((o) => <KanbanCard key={o.id} order={o} />)}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function KanbanCard({ order: o }: { order: LiveOrder }) {
  return (
    <div
      draggable
      onDragStart={(e) => e.dataTransfer.setData("text/order-id", o.id)}
      className="bg-page p-2 cursor-grab active:cursor-grabbing hover:opacity-90 transition-opacity"
      style={{ border: "1.5px solid var(--border)", boxShadow: "1.5px 1.5px 0 0 var(--shadow-color)" }}
    >
      <Link href={`/orders/${o.id}`} className="block">
        <div className="flex items-baseline justify-between mb-1">
          <span className="font-mono font-bold text-ink text-[11px]">#{o.display_id}</span>
          <span className="font-display font-black num text-[12px]">{fmtEur(o.total)}</span>
        </div>
        <div className="text-[10px] font-medium text-ink truncate">{o.customer_name || o.email}</div>
        <div className="text-[9px] text-ink-3 font-mono mt-0.5 flex items-center gap-1.5">
          <span><Clock size={8} className="inline mr-0.5" />{fmtRelative(o.created_at)}</span>
          {o.shipping_city && <span>· {o.shipping_city}</span>}
        </div>
      </Link>
    </div>
  )
}

// ─── GEO VIEW ────────────────────────────────────────────────────────

function GeoView({ orders }: { orders: LiveOrder[] }) {
  // Group by city (fallback: country)
  const byCity = new Map<string, { city: string; country: string; orders: LiveOrder[]; revenue: number }>()
  for (const o of orders) {
    const key = (o.shipping_city ?? "Sin ciudad") + "|" + (o.shipping_country ?? "ve")
    const cur = byCity.get(key) ?? { city: o.shipping_city ?? "Sin ciudad", country: (o.shipping_country ?? "VE").toUpperCase(), orders: [] as LiveOrder[], revenue: 0 }
    cur.orders.push(o)
    cur.revenue += o.total
    byCity.set(key, cur)
  }
  const cities = Array.from(byCity.values()).sort((a, b) => b.revenue - a.revenue)
  const totalRevenue = cities.reduce((s, c) => s + c.revenue, 0)

  if (cities.length === 0) {
    return (
      <div className="stamp-card p-10 text-center">
        <MapPin size={48} className="text-ink-3 mx-auto mb-3" strokeWidth={1.5} />
        <p className="font-display font-bold text-[14px] uppercase tracking-wider text-ink-3">Sin datos geográficos</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-12 gap-5">
      <div className="col-span-7 stamp-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 bg-dark text-cream">
          <h3 className="font-display font-black text-[14px] uppercase tracking-wider">Por ciudad</h3>
          <span className="text-[10px] font-mono text-cream/60">{cities.length} ubicaciones</span>
        </div>
        <ul className="divide-y divide-warm-200/50 max-h-[500px] overflow-y-auto">
          {cities.map((c) => {
            const pct = totalRevenue > 0 ? (c.revenue / totalRevenue) * 100 : 0
            return (
              <li key={`${c.city}-${c.country}`} className="p-3">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <MapPin size={12} className="text-orange" strokeWidth={2.5} />
                    <span className="font-display font-bold text-[12px] text-ink">{c.city}</span>
                    <span className="text-[9px] text-ink-3 font-mono">{c.country}</span>
                  </div>
                  <div className="text-right">
                    <div className="font-display font-black num text-[13px]">{fmtEur(c.revenue)}</div>
                    <div className="text-[9px] text-ink-3 font-mono">{c.orders.length} pedidos · {pct.toFixed(0)}%</div>
                  </div>
                </div>
                <div className="w-full h-1.5 bg-cream-2 rounded-md overflow-hidden">
                  <div className="h-full bg-orange transition-all" style={{ width: `${Math.max(pct, 1)}%` }} />
                </div>
              </li>
            )
          })}
        </ul>
      </div>

      <div className="col-span-5 stamp-card p-5">
        <h3 className="font-display font-black text-[14px] uppercase tracking-tight mb-3">
          <TrendingUp size={14} className="inline mr-1.5 text-orange" /> Top 5 ciudades
        </h3>
        <ol className="space-y-2">
          {cities.slice(0, 5).map((c, i) => (
            <li key={`${c.city}-top`} className="flex items-center gap-3 p-2 bg-cream-2/40 rounded-md">
              <span className={`w-7 h-7 flex items-center justify-center font-display font-black text-[12px] flex-shrink-0 rounded-full ${
                i === 0 ? "bg-orange text-dark" : i < 3 ? "bg-secondary/20 text-secondary" : "bg-cream-2 text-ink-3"
              }`}>
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <div className="font-display font-bold text-[12px] text-ink truncate">{c.city}</div>
                <div className="text-[10px] text-ink-3 font-mono">{c.orders.length} pedidos</div>
              </div>
              <div className="font-display font-black num text-[13px]">{fmtEur(c.revenue)}</div>
            </li>
          ))}
        </ol>
        <p className="text-[10px] text-ink-3 font-mono mt-4 italic text-center">
          💡 Para mapa visual añade <code>NEXT_PUBLIC_GOOGLE_MAPS_KEY</code> a env vars
        </p>
      </div>
    </div>
  )
}
