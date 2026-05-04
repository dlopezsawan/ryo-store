import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { useState, useEffect } from "react"

const BACKEND = __BACKEND_URL__ ?? ""

const MaintenanceToggle = () => {
  const [enabled, setEnabled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch(`${BACKEND}/admin/maintenance`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setEnabled(d.maintenance))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const toggle = async () => {
    setSaving(true)
    try {
      const r = await fetch(`${BACKEND}/admin/maintenance`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !enabled }),
      })
      const d = await r.json()
      setEnabled(d.maintenance)
    } catch (err) {
      console.error("Error toggling maintenance:", err)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return null

  return (
    <div style={{
      padding: "12px 16px",
      background: enabled ? "#fef2f2" : "#f0fdf4",
      border: `2px solid ${enabled ? "#ef4444" : "#22c55e"}`,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      fontFamily: "Kanit, system-ui, sans-serif",
    }}>
      <div>
        <div style={{ fontWeight: 800, fontSize: 13, color: enabled ? "#dc2626" : "#16a34a", textTransform: "uppercase", letterSpacing: 0.5 }}>
          {enabled ? "🚧 Modo Mantenimiento ACTIVO" : "✅ Tienda Online"}
        </div>
        <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>
          {enabled
            ? "La web muestra 'Coming Soon' a los visitantes"
            : "La tienda está visible para todos"}
        </div>
      </div>
      <button
        onClick={toggle}
        disabled={saving}
        style={{
          padding: "6px 16px",
          fontWeight: 800,
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: 0.5,
          cursor: saving ? "wait" : "pointer",
          border: "2px solid",
          borderColor: enabled ? "#22c55e" : "#ef4444",
          background: enabled ? "#22c55e" : "#ef4444",
          color: "#fff",
          fontFamily: "Kanit, system-ui, sans-serif",
          opacity: saving ? 0.6 : 1,
        }}
      >
        {saving ? "..." : enabled ? "Activar Tienda" : "Activar Mantenimiento"}
      </button>
    </div>
  )
}

export const config = defineWidgetConfig({
  zone: "order.list.before",
})

export default MaintenanceToggle
