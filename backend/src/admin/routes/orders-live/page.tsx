import { defineRouteConfig } from "@medusajs/admin-sdk"
import { ComputerDesktop } from "@medusajs/icons"
import { useState, useEffect, useCallback } from "react"

const BACKEND = __BACKEND_URL__ ?? ""

type LiveOrder = {
  id: string
  display_id: number
  status: string
  created_at: string
  metadata: Record<string, string> | null
  first_name: string | null
  last_name: string | null
  phone: string | null
  address_1: string | null
  city: string | null
  province: string | null
  total: number
  currency_code: string
  payment_status: string
  captured_at: string | null
  fulfillment_status: string
  shipped_at: string | null
  delivered_at: string | null
  warehouse_name: string | null
  item_count: number
  item_names: string | null
}

type Stage = "new" | "paid" | "preparing" | "shipped" | "completed"

function getStage(o: LiveOrder): Stage {
  if (o.status === "completed" || o.fulfillment_status === "delivered") return "completed"
  if (o.fulfillment_status === "shipped") return "shipped"
  if (o.fulfillment_status === "fulfilled") return "preparing"
  if (o.payment_status === "captured") return "paid"
  return "new"
}

// Enrola brand palette
const ORANGE = "#E84B2B"
const DARK = "#1A1A1A"
const CREAM = "#F5F0E8"
const OLIVE = "#4D5431"

const STAGES_ORDER: Stage[] = ["new", "paid", "preparing", "shipped", "completed"]

function stageConfig(dark: boolean): Record<Stage, { label: string; color: string; bg: string; icon: string }> {
  return {
    new:       { label: "Nuevo",      color: ORANGE,    bg: dark ? "#3d1510" : "#fde8e4", icon: "🔥" },
    paid:      { label: "Pago OK",    color: "#22c55e", bg: dark ? "#0a3118" : "#dcfce7", icon: "✅" },
    preparing: { label: "Preparando", color: "#3b82f6", bg: dark ? "#0c1e3a" : "#dbeafe", icon: "📦" },
    shipped:   { label: "Enviado",    color: "#a78bfa", bg: dark ? "#1e1435" : "#ede9fe", icon: "🚚" },
    completed: { label: "Completado", color: dark ? "#555" : "#9ca3af", bg: dark ? "#1a1a1a" : "#f3f4f6", icon: "✔" },
  }
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "ahora"
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  return `${Math.floor(hrs / 24)}d`
}

function OrderCard({ order, dark }: { order: LiveOrder; dark: boolean }) {
  const stage = getStage(order)
  const cfg = stageConfig(dark)[stage]
  const meta = order.metadata || {}
  const totalBs = meta.total_bs ? ` / Bs ${Number(meta.total_bs).toFixed(0)}` : ""
  const cardBg = dark ? "#222" : "#fff"
  const textPrimary = dark ? "#f5f0e8" : DARK
  const textSecondary = dark ? "#888" : "#777"

  return (
    <div style={{
      background: cardBg,
      border: `2.5px solid ${cfg.color}`,
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
      transition: "all 0.3s ease",
      opacity: stage === "completed" ? 0.5 : 1,
      boxShadow: dark ? `0 2px 8px rgba(0,0,0,0.4)` : `3px 3px 0 ${OLIVE}`,
    }}>
      {/* Header */}
      <div style={{
        background: cfg.color,
        color: "#fff",
        padding: "7px 12px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        fontWeight: 800,
        fontSize: 13,
        letterSpacing: 0.5,
        textTransform: "uppercase",
        fontFamily: "Kanit, system-ui, sans-serif",
      }}>
        <span>#{order.display_id}</span>
        <span style={{ fontSize: 11, fontWeight: 700, opacity: 0.9 }}>
          {cfg.icon} {cfg.label}
        </span>
      </div>

      <div style={{ padding: "10px 12px", flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
        {/* Customer + time */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontWeight: 700, fontSize: 14, color: textPrimary, fontFamily: "Kanit, system-ui, sans-serif" }}>
            {order.first_name || ""} {order.last_name || ""}
          </span>
          <span style={{ fontSize: 10, color: textSecondary, fontWeight: 600 }}>{timeAgo(order.created_at)}</span>
        </div>

        {/* Items */}
        <div style={{ fontSize: 11, color: textSecondary, lineHeight: 1.4, maxHeight: 32, overflow: "hidden" }}>
          {order.item_count}x — {order.item_names || "Sin productos"}
        </div>

        {/* Price */}
        <div style={{ fontWeight: 900, fontSize: 18, color: stage === "new" ? ORANGE : textPrimary, fontFamily: "Kanit, system-ui, sans-serif" }}>
          €{Number(order.total).toFixed(2)}{totalBs}
        </div>

        {/* Progress bar */}
        <div style={{ display: "flex", gap: 2, marginTop: 2 }}>
          {STAGES_ORDER.map((s) => {
            const active = STAGES_ORDER.indexOf(stage) >= STAGES_ORDER.indexOf(s)
            return (
              <div key={s} title={stageConfig(dark)[s].label} style={{
                flex: 1, height: 5,
                background: active ? cfg.color : (dark ? "#333" : "#e0ddd5"),
                transition: "background 0.4s",
              }} />
            )
          })}
        </div>

        {/* Location + warehouse */}
        <div style={{ fontSize: 10, color: textSecondary, display: "flex", gap: 8, marginTop: 1 }}>
          {order.city && <span>📍 {order.city}</span>}
          {order.warehouse_name && <span>📦 {order.warehouse_name}</span>}
          {order.phone && <span>📱 {order.phone}</span>}
        </div>
      </div>
    </div>
  )
}

const OrdersLivePage = () => {
  const [orders, setOrders] = useState<LiveOrder[]>([])
  const [todayOnly, setTodayOnly] = useState(true)
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())
  const [hideCompleted, setHideCompleted] = useState(true)
  const [dark, setDark] = useState(false)
  const [isPopup, setIsPopup] = useState(false)

  // Detect popup mode and hide entire Medusa admin shell
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get("popup") === "1") {
      setIsPopup(true)
      const style = document.createElement("style")
      style.id = "kds-popup-style"
      style.textContent = `
        /* Hide everything except the KDS content */
        body > div > div > div > aside,
        body > div > div > div > div > nav,
        body > div > div > div > div > header {
          display: none !important;
        }
        /* Aggressive: hide any sibling of our main content area */
        [data-kds-root] {
          position: fixed !important;
          inset: 0 !important;
          z-index: 99999 !important;
          overflow: auto !important;
        }
        body { overflow: hidden !important; }
      `
      document.head.appendChild(style)
      return () => { document.getElementById("kds-popup-style")?.remove() }
    }
  }, [])

  const fetchOrders = useCallback(async () => {
    try {
      const r = await fetch(`${BACKEND}/admin/orders-live?today=${todayOnly ? "1" : "0"}`, { credentials: "include" })
      const data = await r.json()
      setOrders(data.orders || [])
      setLastUpdate(new Date())
    } catch (err) {
      console.error("Error fetching orders:", err)
    } finally {
      setLoading(false)
    }
  }, [todayOnly])

  useEffect(() => {
    fetchOrders()
    const interval = setInterval(fetchOrders, 5000)
    return () => clearInterval(interval)
  }, [fetchOrders])

  const filtered = hideCompleted ? orders.filter((o) => getStage(o) !== "completed") : orders
  const grouped = STAGES_ORDER.reduce((acc, s) => {
    acc[s] = filtered.filter((o) => getStage(o) === s)
    return acc
  }, {} as Record<Stage, LiveOrder[]>)
  const totalPending = orders.filter((o) => getStage(o) !== "completed").length

  const bg = dark ? DARK : CREAM
  const textPrimary = dark ? "#f5f0e8" : DARK
  const textSecondary = dark ? "#777" : "#999"
  const btnActive = { background: ORANGE, color: "#fff", border: `2px solid ${ORANGE}` }
  const btnInactive = { background: dark ? "#333" : "#fff", color: dark ? "#ccc" : "#555", border: `2px solid ${dark ? "#444" : "#ddd"}` }

  const openPopup = () => {
    const base = window.location.pathname
    const url = `${base}?popup=1`
    window.open(url, "enrola-kds", "width=1200,height=800,menubar=no,toolbar=no,location=no,status=no")
  }

  return (
    <div data-kds-root style={{ padding: 20, minHeight: "100vh", background: bg, transition: "background 0.3s" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <div>
          <h1 style={{
            margin: 0, fontSize: 22, fontWeight: 900, color: textPrimary,
            fontFamily: "Kanit, system-ui, sans-serif", textTransform: "uppercase", letterSpacing: 1,
          }}>
            Pedidos en Vivo
          </h1>
          <p style={{ margin: "2px 0 0", fontSize: 12, color: textSecondary }}>
            {totalPending} pendientes · {lastUpdate.toLocaleTimeString("es-VE")}
          </p>
        </div>

        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          {/* Filters */}
          {(["Hoy", "Todas"] as const).map((label) => {
            const active = label === "Hoy" ? todayOnly : !todayOnly
            return (
              <button key={label} onClick={() => setTodayOnly(label === "Hoy")} style={{
                padding: "5px 14px", fontWeight: 700, fontSize: 12, cursor: "pointer",
                fontFamily: "Kanit, system-ui, sans-serif", textTransform: "uppercase", letterSpacing: 0.5,
                ...(active ? btnActive : btnInactive),
              }}>
                {label}
              </button>
            )
          })}

          <span style={{ width: 1, height: 22, background: dark ? "#444" : "#ddd" }} />

          <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: textSecondary, cursor: "pointer" }}>
            <input type="checkbox" checked={hideCompleted} onChange={(e) => setHideCompleted(e.target.checked)} style={{ accentColor: ORANGE }} />
            Ocultar completados
          </label>

          <span style={{ width: 1, height: 22, background: dark ? "#444" : "#ddd" }} />

          {/* Dark mode toggle */}
          <button onClick={() => setDark(!dark)} style={{
            padding: "5px 10px", cursor: "pointer", fontSize: 14, background: "transparent", border: `2px solid ${dark ? "#555" : "#ddd"}`,
            color: textSecondary,
          }} title={dark ? "Modo dia" : "Modo noche"}>
            {dark ? "☀️" : "🌙"}
          </button>

          {/* Popup button */}
          <button onClick={openPopup} style={{
            padding: "5px 10px", cursor: "pointer", fontSize: 14, background: "transparent", border: `2px solid ${dark ? "#555" : "#ddd"}`,
            color: textSecondary,
          }} title="Abrir en ventana independiente">
            ↗️
          </button>
        </div>
      </div>

      {/* Stage counters */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {STAGES_ORDER.map((s) => {
          if (hideCompleted && s === "completed") return null
          const cfg = stageConfig(dark)[s]
          const count = grouped[s]?.length || 0
          return (
            <div key={s} style={{
              background: cfg.bg, border: `2px solid ${cfg.color}40`,
              padding: "6px 14px", display: "flex", alignItems: "center", gap: 6,
            }}>
              <span style={{ fontSize: 15 }}>{cfg.icon}</span>
              <span style={{ fontWeight: 900, fontSize: 18, color: cfg.color, fontFamily: "Kanit, system-ui, sans-serif" }}>{count}</span>
              <span style={{ fontSize: 11, color: textSecondary, fontWeight: 600 }}>{cfg.label}</span>
            </div>
          )
        })}
      </div>

      {/* Orders grid */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: textSecondary, fontSize: 15 }}>Cargando pedidos...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, color: textSecondary }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
          <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "Kanit, system-ui, sans-serif", color: textPrimary }}>
            No hay pedidos pendientes
          </div>
          <div style={{ fontSize: 12, marginTop: 4 }}>{todayOnly ? "No hay pedidos hoy" : "No hay pedidos"}</div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
          {filtered.map((order) => <OrderCard key={order.id} order={order} dark={dark} />)}
        </div>
      )}
    </div>
  )
}

export const config = defineRouteConfig({
  label: "Pedidos en Vivo",
  icon: ComputerDesktop,
})

export default OrdersLivePage
