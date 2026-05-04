"use client"

import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Container, Heading, Text, Badge, Button, Input, Textarea, Switch, Table } from "@medusajs/ui"
import { useState, useEffect, useCallback, useRef } from "react"
import { Star, Plus, Pencil, Trash, X, Check, Gift, ChartActivity } from "@medusajs/icons"

const API = "https://api.enrola.shop"

// ─── Types ─────────────────────────────────────────────────────────────────────
type Reward = {
  id: string
  name: string
  description?: string | null
  points_required: number
  image_url?: string | null
  is_active: boolean
  stock?: number | null
  created_at: string
}

type RewardFormData = {
  name: string
  description: string
  points_required: string
  image_url: string
  is_active: boolean
  stock: string
}

type MedusaProduct = {
  id: string
  title: string
  description?: string | null
  thumbnail?: string | null
}

const EMPTY_FORM: RewardFormData = {
  name: "",
  description: "",
  points_required: "",
  image_url: "",
  is_active: true,
  stock: "",
}

// ─── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({
  label, sub, value, icon: Icon, color,
}: {
  label: string; sub?: string; value: string | number; icon: React.ElementType; color: string
}) {
  return (
    <div
      style={{
        background: "var(--color-ui-bg-base, #1c1c1f)",
        border: "1px solid var(--color-ui-border-base, #2e2e32)",
        borderRadius: 12, padding: "18px 20px",
        display: "flex", alignItems: "flex-start", gap: 16,
      }}
    >
      <div style={{
        width: 44, height: 44, borderRadius: 10, flexShrink: 0,
        background: color + "22",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <Icon style={{ color, width: 20, height: 20 }} />
      </div>
      <div>
        <p style={{ color: "var(--color-ui-fg-muted, #9ca3af)", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{label}</p>
        <p style={{ color: "var(--color-ui-fg-base, #f9fafb)", fontSize: 24, fontWeight: 700, lineHeight: 1 }}>{value}</p>
        {sub && <p style={{ color: "var(--color-ui-fg-subtle, #6b7280)", fontSize: 11, marginTop: 4 }}>{sub}</p>}
      </div>
    </div>
  )
}

// ─── Product Selector ───────────────────────────────────────────────────────────
function ProductSelector({
  onSelect,
  onClear,
  selectedProduct,
}: {
  onSelect: (p: MedusaProduct) => void
  onClear: () => void
  selectedProduct: MedusaProduct | null
}) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<MedusaProduct[]>([])
  const [open, setOpen] = useState(false)
  const [searching, setSearching] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); setOpen(false); return }
    setSearching(true)
    try {
      const res = await fetch(`${API}/admin/products?q=${encodeURIComponent(q)}&limit=8&fields=id,title,description,thumbnail`, { credentials: "include" })
      const data = await res.json()
      setResults(data.products ?? [])
      setOpen(true)
    } catch { setResults([]) }
    setSearching(false)
  }, [])

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => search(e.target.value), 300)
  }

  if (selectedProduct) {
    return (
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "8px 12px", borderRadius: 8,
        border: "1px solid var(--color-ui-border-base, #2e2e32)",
        background: "var(--color-ui-bg-subtle, #131316)",
      }}>
        {selectedProduct.thumbnail && (
          <img src={selectedProduct.thumbnail} alt="" style={{ width: 32, height: 32, borderRadius: 6, objectFit: "cover" }} />
        )}
        <span style={{ flex: 1, fontSize: 13, color: "var(--color-ui-fg-base, #f9fafb)", fontWeight: 500 }}>
          {selectedProduct.title}
        </span>
        <button
          type="button" onClick={onClear}
          style={{ border: "none", background: "none", cursor: "pointer", padding: 4, display: "flex", color: "var(--color-ui-fg-muted, #9ca3af)" }}
        >
          <X style={{ width: 14, height: 14 }} />
        </button>
      </div>
    )
  }

  return (
    <div style={{ position: "relative" }}>
      <Input
        value={query}
        onChange={handleInput}
        onFocus={() => query && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Buscar producto existente…"
      />
      {searching && (
        <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontSize: 11, color: "var(--color-ui-fg-muted, #9ca3af)" }}>Buscando…</span>
      )}
      {open && results.length > 0 && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 300,
          background: "var(--color-ui-bg-base, #1c1c1f)",
          border: "1px solid var(--color-ui-border-base, #2e2e32)",
          borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
          maxHeight: 280, overflowY: "auto",
        }}>
          {results.map(p => (
            <button
              key={p.id} type="button"
              onMouseDown={() => { onSelect(p); setQuery(""); setOpen(false) }}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                width: "100%", padding: "8px 12px", border: "none",
                background: "none", cursor: "pointer", textAlign: "left",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "var(--color-ui-bg-subtle, #131316)")}
              onMouseLeave={e => (e.currentTarget.style.background = "none")}
            >
              {p.thumbnail ? (
                <img src={p.thumbnail} alt="" style={{ width: 32, height: 32, borderRadius: 4, objectFit: "cover", flexShrink: 0 }} />
              ) : (
                <div style={{ width: 32, height: 32, borderRadius: 4, background: "#2e2e32", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Gift style={{ width: 14, height: 14, color: "#9ca3af" }} />
                </div>
              )}
              <div>
                <p style={{ fontSize: 13, fontWeight: 500, color: "var(--color-ui-fg-base, #f9fafb)", margin: 0 }}>{p.title}</p>
                {p.description && (
                  <p style={{ fontSize: 11, color: "var(--color-ui-fg-muted, #9ca3af)", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 320 }}>
                    {p.description}
                  </p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Image upload / preview ────────────────────────────────────────────────────
function ImageField({
  imageUrl,
  onChange,
  disabled,
}: {
  imageUrl: string
  onChange: (url: string) => void
  disabled?: boolean
}) {
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append("files", file)
      const res = await fetch(`${API}/admin/uploads`, {
        method: "POST",
        credentials: "include",
        body: fd,
      })
      if (!res.ok) throw new Error("Upload failed")
      const data = await res.json()
      const url = data.files?.[0]?.url ?? data.uploads?.[0]?.url ?? ""
      if (url) onChange(url)
    } catch {
      alert("Error al subir la imagen. Verifica que el backend tenga el módulo de archivos configurado.")
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {imageUrl ? (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <img
            src={imageUrl}
            alt="preview"
            style={{ width: 56, height: 56, borderRadius: 8, objectFit: "cover", border: "1px solid var(--color-ui-border-base, #2e2e32)" }}
          />
          <div style={{ flex: 1, fontSize: 12, color: "var(--color-ui-fg-muted, #9ca3af)", wordBreak: "break-all" }}>
            {imageUrl.length > 60 ? imageUrl.slice(0, 60) + "…" : imageUrl}
          </div>
          <button
            type="button" onClick={() => onChange("")} disabled={disabled}
            style={{ border: "none", background: "none", cursor: "pointer", color: "var(--color-ui-fg-muted, #9ca3af)", display: "flex" }}
          >
            <X style={{ width: 14, height: 14 }} />
          </button>
        </div>
      ) : (
        <div
          onClick={() => fileRef.current?.click()}
          style={{
            border: "2px dashed var(--color-ui-border-base, #2e2e32)",
            borderRadius: 8, padding: "20px 16px",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
            cursor: disabled || uploading ? "not-allowed" : "pointer",
            opacity: disabled || uploading ? 0.6 : 1,
            background: "var(--color-ui-bg-subtle, #131316)",
            transition: "border-color 0.15s",
          }}
        >
          <Gift style={{ width: 22, height: 22, color: "var(--color-ui-fg-muted, #9ca3af)" }} />
          <p style={{ margin: 0, fontSize: 13, color: "var(--color-ui-fg-subtle, #6b7280)", fontWeight: 500 }}>
            {uploading ? "Subiendo…" : "Haz clic para subir imagen"}
          </p>
          <p style={{ margin: 0, fontSize: 11, color: "var(--color-ui-fg-muted, #9ca3af)" }}>PNG, JPG, WEBP · máx 5MB</p>
        </div>
      )}
      <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFile} disabled={disabled || uploading} />
    </div>
  )
}

// ─── Reward Form Modal ─────────────────────────────────────────────────────────
function RewardModal({
  reward, onClose, onSave,
}: {
  reward: Reward | null; onClose: () => void; onSave: () => void
}) {
  const [form, setForm] = useState<RewardFormData>(
    reward
      ? {
          name: reward.name,
          description: reward.description ?? "",
          points_required: String(reward.points_required),
          image_url: reward.image_url ?? "",
          is_active: reward.is_active,
          stock: reward.stock != null ? String(reward.stock) : "",
        }
      : EMPTY_FORM
  )
  const [selectedProduct, setSelectedProduct] = useState<MedusaProduct | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = (field: keyof RewardFormData, value: string | boolean) =>
    setForm((prev) => ({ ...prev, [field]: value }))

  const handleProductSelect = (p: MedusaProduct) => {
    setSelectedProduct(p)
    setForm(prev => ({
      ...prev,
      name: p.title,
      description: p.description?.slice(0, 300) ?? prev.description,
      image_url: p.thumbnail ?? prev.image_url,
    }))
  }

  const handleProductClear = () => {
    setSelectedProduct(null)
    setForm(prev => ({ ...prev, name: "", description: "", image_url: "" }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim() || !form.points_required) {
      setError("Nombre y puntos requeridos son obligatorios")
      return
    }
    setSaving(true); setError(null)
    try {
      const body = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        points_required: parseInt(form.points_required, 10),
        image_url: form.image_url.trim() || null,
        is_active: form.is_active,
        stock: form.stock ? parseInt(form.stock, 10) : null,
      }
      const url = reward ? `${API}/admin/loyalty/rewards/${reward.id}` : `${API}/admin/loyalty/rewards`
      const res = await fetch(url, {
        method: reward ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.message ?? "Error al guardar")
      }
      onSave()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido")
    } finally { setSaving(false) }
  }

  const overlay: React.CSSProperties = {
    position: "fixed", inset: 0, zIndex: 50,
    display: "flex", alignItems: "center", justifyContent: "center",
    background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)", padding: 16,
  }

  const card: React.CSSProperties = {
    background: "var(--color-ui-bg-base, #1c1c1f)",
    border: "1px solid var(--color-ui-border-base, #2e2e32)",
    borderRadius: 14, boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
    width: "100%", maxWidth: 520,
    maxHeight: "90vh", overflowY: "auto",
  }

  return (
    <div style={overlay}>
      <div style={card}>
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "18px 24px",
          borderBottom: "1px solid var(--color-ui-border-base, #2e2e32)",
        }}>
          <Heading level="h2">{reward ? "Editar Recompensa" : "Nueva Recompensa"}</Heading>
          <button type="button" onClick={onClose} style={{ border: "none", background: "none", cursor: "pointer", display: "flex", padding: 4 }}>
            <X style={{ width: 18, height: 18, color: "var(--color-ui-fg-subtle, #6b7280)" }} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 18 }}>

          {/* Product picker */}
          <div>
            <label style={labelStyle}>Tomar de producto existente</label>
            <ProductSelector
              selectedProduct={selectedProduct}
              onSelect={handleProductSelect}
              onClear={handleProductClear}
            />
            {selectedProduct && (
              <p style={{ fontSize: 11, color: "#10b981", marginTop: 4 }}>
                ✓ Nombre, descripción e imagen copiados del producto
              </p>
            )}
          </div>

          {/* Divider */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ flex: 1, height: 1, background: "var(--color-ui-border-base, #2e2e32)" }} />
            <span style={{ fontSize: 11, color: "var(--color-ui-fg-muted, #9ca3af)" }}>o completa manualmente</span>
            <div style={{ flex: 1, height: 1, background: "var(--color-ui-border-base, #2e2e32)" }} />
          </div>

          {/* Name */}
          <div>
            <label style={labelStyle}>Nombre *</label>
            <Input value={form.name} onChange={e => set("name", e.target.value)} placeholder="Ej: Descuento $5" required />
          </div>

          {/* Description */}
          <div>
            <label style={labelStyle}>Descripción</label>
            <Textarea value={form.description} onChange={e => set("description", e.target.value)} placeholder="Descripción visible al cliente" rows={2} />
          </div>

          {/* Points + Stock */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <label style={labelStyle}>Puntos requeridos *</label>
              <Input type="number" min="1" value={form.points_required} onChange={e => set("points_required", e.target.value)} placeholder="500" required />
              <p style={hintStyle}>Los clientes acumulan 10 pts / $1</p>
            </div>
            <div>
              <label style={labelStyle}>Stock <span style={{ color: "var(--color-ui-fg-muted, #9ca3af)", fontWeight: 400 }}>(vacío = ilimitado)</span></label>
              <Input type="number" min="0" value={form.stock} onChange={e => set("stock", e.target.value)} placeholder="∞" />
              <p style={hintStyle}>Límite de canjes disponibles</p>
            </div>
          </div>

          {/* Image */}
          <div>
            <label style={labelStyle}>
              Imagen
              {selectedProduct?.thumbnail && (
                <span style={{ color: "#10b981", marginLeft: 6, fontWeight: 400, fontSize: 11 }}>— del producto seleccionado</span>
              )}
            </label>
            <ImageField imageUrl={form.image_url} onChange={v => set("image_url", v)} disabled={saving} />
          </div>

          {/* Active toggle */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "12px 14px", borderRadius: 8,
            background: "var(--color-ui-bg-subtle, #131316)",
            border: "1px solid var(--color-ui-border-base, #2e2e32)",
          }}>
            <div>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: "var(--color-ui-fg-base, #f9fafb)" }}>Activa</p>
              <p style={{ margin: 0, fontSize: 11, color: "var(--color-ui-fg-muted, #9ca3af)" }}>Visible para los clientes en la tienda</p>
            </div>
            <Switch checked={form.is_active} onCheckedChange={v => set("is_active", v)} />
          </div>

          {/* Error */}
          {error && (
            <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 6, padding: "10px 14px", fontSize: 13, color: "#f87171" }}>
              {error}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: "flex", gap: 10, paddingTop: 4 }}>
            <Button type="submit" isLoading={saving} style={{ flex: 1 }}>
              <Check style={{ width: 15, height: 15, marginRight: 6 }} />
              {reward ? "Guardar Cambios" : "Crear Recompensa"}
            </Button>
            <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>Cancelar</Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Delete confirm ─────────────────────────────────────────────────────────────
function DeleteConfirm({ reward, onClose, onDeleted }: { reward: Reward; onClose: () => void; onDeleted: () => void }) {
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await fetch(`${API}/admin/loyalty/rewards/${reward.id}`, { method: "DELETE", credentials: "include" })
      onDeleted()
    } finally { setDeleting(false) }
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)", padding: 16 }}>
      <div style={{ background: "var(--color-ui-bg-base, #1c1c1f)", border: "1px solid var(--color-ui-border-base, #2e2e32)", borderRadius: 14, boxShadow: "0 24px 64px rgba(0,0,0,0.5)", width: "100%", maxWidth: 380, padding: 28 }}>
        <Heading level="h2" style={{ marginBottom: 8 }}>¿Eliminar recompensa?</Heading>
        <Text className="text-ui-fg-subtle" style={{ marginBottom: 24, display: "block" }}>
          <strong style={{ color: "var(--color-ui-fg-base)" }}>"{reward.name}"</strong> se eliminará permanentemente.
        </Text>
        <div style={{ display: "flex", gap: 10 }}>
          <Button variant="danger" isLoading={deleting} onClick={handleDelete} style={{ flex: 1 }}>
            <Trash style={{ width: 15, height: 15, marginRight: 6 }} />
            Eliminar
          </Button>
          <Button variant="secondary" onClick={onClose} disabled={deleting}>Cancelar</Button>
        </div>
      </div>
    </div>
  )
}

// ─── Shared styles ──────────────────────────────────────────────────────────────
const labelStyle: React.CSSProperties = {
  display: "block", fontSize: 12, fontWeight: 600,
  color: "var(--color-ui-fg-subtle, #6b7280)",
  marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.04em",
}
const hintStyle: React.CSSProperties = {
  margin: "4px 0 0", fontSize: 11, color: "var(--color-ui-fg-muted, #9ca3af)",
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function LoyaltyPage() {
  const [rewards, setRewards] = useState<Reward[]>([])
  const [loading, setLoading] = useState(true)
  const [modalReward, setModalReward] = useState<Reward | null | "new">(null)
  const [deleteReward, setDeleteReward] = useState<Reward | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const fetchRewards = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API}/admin/loyalty/rewards`, { credentials: "include" })
      const data = await res.json()
      setRewards(data.rewards ?? [])
    } catch { setRewards([]) } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchRewards() }, [fetchRewards])

  const handleToggleActive = async (reward: Reward) => {
    setTogglingId(reward.id)
    try {
      await fetch(`${API}/admin/loyalty/rewards/${reward.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify({ is_active: !reward.is_active }),
      })
      await fetchRewards()
    } finally { setTogglingId(null) }
  }

  const totalActive = rewards.filter(r => r.is_active).length
  const minPoints = rewards.length ? Math.min(...rewards.map(r => r.points_required)) : null
  const maxPoints = rewards.length ? Math.max(...rewards.map(r => r.points_required)) : null

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, padding: 24, maxWidth: 900, margin: "0 auto" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 44, height: 44, background: "rgba(245,158,11,0.15)", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Star style={{ width: 22, height: 22, color: "#f59e0b" }} />
          </div>
          <div>
            <Heading level="h1">Club Enrola — Recompensas</Heading>
            <Text className="text-ui-fg-muted" style={{ fontSize: 13 }}>Gestiona el catálogo de recompensas por puntos</Text>
          </div>
        </div>
        <Button onClick={() => setModalReward("new")} size="base">
          <Plus style={{ width: 15, height: 15, marginRight: 6 }} />
          Nueva Recompensa
        </Button>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
        <StatCard
          label="Recompensas activas"
          sub="visibles en la tienda"
          value={totalActive}
          icon={Gift}
          color="#f59e0b"
        />
        <StatCard
          label="Puntos mínimos"
          sub={minPoints != null ? "la recompensa más accesible" : "sin recompensas aún"}
          value={minPoints != null ? `${minPoints.toLocaleString()} pts` : "—"}
          icon={Star}
          color="#10b981"
        />
        <StatCard
          label="Puntos máximos"
          sub={maxPoints != null ? "la recompensa más exclusiva" : "sin recompensas aún"}
          value={maxPoints != null ? `${maxPoints.toLocaleString()} pts` : "—"}
          icon={ChartActivity}
          color="#6366f1"
        />
      </div>

      {/* Rewards table */}
      <Container style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 24px", borderBottom: "1px solid var(--color-ui-border-base, #2e2e32)" }}>
          <Heading level="h2">Catálogo de Recompensas</Heading>
          <Badge color="grey">{rewards.length} total</Badge>
        </div>

        {loading ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "64px 0", color: "var(--color-ui-fg-muted, #9ca3af)", gap: 12 }}>
            <div style={{ width: 24, height: 24, border: "2px solid currentColor", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
            Cargando recompensas…
          </div>
        ) : rewards.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "64px 0", textAlign: "center" }}>
            <Gift style={{ width: 48, height: 48, color: "var(--color-ui-fg-muted, #9ca3af)", marginBottom: 16, opacity: 0.5 }} />
            <Text className="text-ui-fg-subtle" style={{ fontWeight: 500, fontSize: 16, marginBottom: 4 }}>Sin recompensas todavía</Text>
            <Text className="text-ui-fg-muted" style={{ fontSize: 13, marginBottom: 20 }}>Crea la primera recompensa para el Club Enrola</Text>
            <Button onClick={() => setModalReward("new")}>
              <Plus style={{ width: 15, height: 15, marginRight: 6 }} />
              Crear Recompensa
            </Button>
          </div>
        ) : (
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>Recompensa</Table.HeaderCell>
                <Table.HeaderCell style={{ textAlign: "right" }}>Puntos</Table.HeaderCell>
                <Table.HeaderCell style={{ textAlign: "center" }}>Stock</Table.HeaderCell>
                <Table.HeaderCell style={{ textAlign: "center" }}>Activa</Table.HeaderCell>
                <Table.HeaderCell style={{ textAlign: "right" }}>Acciones</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {rewards.map(reward => (
                <Table.Row key={reward.id}>
                  <Table.Cell>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      {reward.image_url ? (
                        <img src={reward.image_url} alt={reward.name} style={{ width: 40, height: 40, borderRadius: 8, objectFit: "cover", border: "1px solid var(--color-ui-border-base, #2e2e32)", flexShrink: 0 }} />
                      ) : (
                        <div style={{ width: 40, height: 40, borderRadius: 8, background: "rgba(245,158,11,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <Gift style={{ width: 18, height: 18, color: "#f59e0b" }} />
                        </div>
                      )}
                      <div>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: "var(--color-ui-fg-base, #f9fafb)" }}>{reward.name}</p>
                        {reward.description && (
                          <p style={{ margin: 0, fontSize: 11, color: "var(--color-ui-fg-muted, #9ca3af)", maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{reward.description}</p>
                        )}
                      </div>
                    </div>
                  </Table.Cell>
                  <Table.Cell style={{ textAlign: "right" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "rgba(245,158,11,0.12)", color: "#f59e0b", fontWeight: 700, fontSize: 12, padding: "4px 10px", borderRadius: 20, border: "1px solid rgba(245,158,11,0.25)" }}>
                      <Star style={{ width: 11, height: 11 }} />
                      {reward.points_required.toLocaleString()}
                    </span>
                  </Table.Cell>
                  <Table.Cell style={{ textAlign: "center" }}>
                    {reward.stock != null ? (
                      <Badge color={reward.stock > 5 ? "green" : reward.stock > 0 ? "orange" : "red"}>{reward.stock}</Badge>
                    ) : (
                      <span style={{ fontSize: 16, color: "var(--color-ui-fg-muted, #9ca3af)" }}>∞</span>
                    )}
                  </Table.Cell>
                  <Table.Cell style={{ textAlign: "center" }}>
                    <Switch checked={reward.is_active} onCheckedChange={() => handleToggleActive(reward)} disabled={togglingId === reward.id} />
                  </Table.Cell>
                  <Table.Cell style={{ textAlign: "right" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6 }}>
                      <button type="button" onClick={() => setModalReward(reward)} title="Editar"
                        style={{ padding: 6, borderRadius: 6, border: "none", background: "none", cursor: "pointer", color: "var(--color-ui-fg-subtle, #6b7280)", display: "flex" }}>
                        <Pencil style={{ width: 15, height: 15 }} />
                      </button>
                      <button type="button" onClick={() => setDeleteReward(reward)} title="Eliminar"
                        style={{ padding: 6, borderRadius: 6, border: "none", background: "none", cursor: "pointer", color: "#ef4444", display: "flex" }}>
                        <Trash style={{ width: 15, height: 15 }} />
                      </button>
                    </div>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        )}
      </Container>

      {/* Info box */}
      <div style={{ display: "flex", gap: 14, padding: "16px 20px", borderRadius: 12, background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)" }}>
        <Star style={{ width: 18, height: 18, color: "#f59e0b", flexShrink: 0, marginTop: 2 }} />
        <div>
          <p style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 600, color: "#fbbf24" }}>¿Cómo funciona el Club Enrola?</p>
          <p style={{ margin: 0, fontSize: 12, color: "#d97706", lineHeight: 1.6 }}>
            Los clientes acumulan <strong>10 puntos por cada $1</strong> de compra al completar un pedido. Pueden canjear sus puntos por las recompensas que configures aquí.
            Los <strong>puntos mínimos</strong> indican la recompensa más fácil de alcanzar; los <strong>puntos máximos</strong>, la más exclusiva del catálogo.
          </p>
        </div>
      </div>

      {/* Modals */}
      {(modalReward === "new" || (modalReward && modalReward !== "new")) && (
        <RewardModal
          reward={modalReward === "new" ? null : modalReward}
          onClose={() => setModalReward(null)}
          onSave={() => { setModalReward(null); fetchRewards() }}
        />
      )}
      {deleteReward && (
        <DeleteConfirm
          reward={deleteReward}
          onClose={() => setDeleteReward(null)}
          onDeleted={() => { setDeleteReward(null); fetchRewards() }}
        />
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

export const config = defineRouteConfig({
  label: "Club Enrola",
  icon: Star,
})
