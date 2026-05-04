import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Envelope } from "@medusajs/icons"
import { useState, useEffect } from "react"

const API = "https://api.enrola.shop"
import {
  Container,
  Heading,
  Text,
  Badge,
  Button,
  Switch,
  Input,
  Label,
  Textarea,
  toast,
} from "@medusajs/ui"

// ─── Types ────────────────────────────────────────────────────────────────────

interface RemarketingStats {
  total: number
  by_type: Record<string, number>
  last_7_days: number
  last_30_days: number
  recent: Array<{
    id: number
    type: string
    recipient_email: string
    subject: string
    sent_at: string
  }>
}

interface Setting {
  key: string
  value: Record<string, unknown>
}

interface Product {
  id: string
  title: string
  handle: string
}

interface RestockRule {
  product_id: string
  product_title: string
  days: number
}

// ─── Cross-system linkage map (mirror of legacyTypeForRuleKey) ────────────────
// Used by the UI to surface which engine rules belong to which legacy campaign
// type so the operator never misunderstands what they're toggling.
const LEGACY_TYPE_TO_RULE_KEYS: Record<string, string[]> = {
  abandoned_cart: [
    "cart_abandoned_v2",
    "abandoned_checkout_v2",
    "coupon_failed_no_purchase",
  ],
  win_back: ["win_back_v2"],
  restock: ["restock_due_v2"],
}
const RULE_KEY_TO_LEGACY_TYPE: Record<string, string> = {
  cart_abandoned_v2: "abandoned_cart",
  abandoned_checkout_v2: "abandoned_cart",
  coupon_failed_no_purchase: "abandoned_cart",
  win_back_v2: "win_back",
  restock_due_v2: "restock",
}

const TYPE_LABELS: Record<string, string> = {
  welcome: "Bienvenida",
  abandoned_cart: "Carrito abandonado",
  birthday: "Cumpleaños",
  win_back: "Reactivación",
  post_purchase: "Post-compra",
  restock: "Recordatorio restock",
  graduation: "Graduación manual → web",
  pending_payment: "Recordatorio pago pendiente",
  stockout_alert: "Alerta de stock bajo",
}

const TYPE_COLORS: Record<string, "green" | "blue" | "orange" | "purple" | "grey" | "red"> = {
  welcome: "green",
  abandoned_cart: "orange",
  birthday: "purple",
  win_back: "blue",
  post_purchase: "grey",
  restock: "red",
  graduation: "green",
  pending_payment: "orange",
  stockout_alert: "red",
}

const TYPE_ICONS: Record<string, string> = {
  welcome: "👋",
  abandoned_cart: "🛒",
  birthday: "🎂",
  win_back: "💝",
  post_purchase: "📦",
  restock: "🔁",
  graduation: "🎓",
  pending_payment: "⏳",
  stockout_alert: "⚠",
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <Container className="p-4 flex flex-col gap-1">
      <Text size="small" className="text-ui-fg-subtle">{label}</Text>
      <Heading level="h1" className="text-ui-fg-base font-bold">{value}</Heading>
      {sub && <Text size="xsmall" className="text-ui-fg-muted">{sub}</Text>}
    </Container>
  )
}

// ─── Geo Overrides Editor (Sinergia H) ────────────────────────────────────────
function GeoOverridesEditor({
  value,
  baseCode,
  basePct,
  onChange,
}: {
  value: Record<string, Record<string, unknown>>
  baseCode: string
  basePct: number
  onChange: (next: Record<string, Record<string, unknown>>) => void
}) {
  const [newCity, setNewCity] = useState("")
  const [newCode, setNewCode] = useState("")
  const [newPct, setNewPct] = useState<number | "">("")
  const entries = Object.entries(value)

  function addOverride() {
    const city = newCity.trim().toLowerCase()
    if (!city || value[city]) return
    const entry: Record<string, unknown> = {}
    if (newCode.trim()) entry.discount_code = newCode.trim()
    if (newPct !== "" && !isNaN(Number(newPct))) entry.discount_percent = Number(newPct)
    onChange({ ...value, [city]: entry })
    setNewCity("")
    setNewCode("")
    setNewPct("")
  }
  function removeOverride(city: string) {
    const next = { ...value }
    delete next[city]
    onChange(next)
  }
  function updateEntry(city: string, field: "discount_code" | "discount_percent", val: string) {
    const current = value[city] || {}
    const next = { ...current }
    if (field === "discount_percent") {
      if (val === "") delete next.discount_percent
      else next.discount_percent = Number(val)
    } else {
      if (val === "") delete next.discount_code
      else next.discount_code = val
    }
    onChange({ ...value, [city]: next })
  }

  return (
    <div className="flex flex-col gap-2 pt-2 border-t border-ui-border-base">
      <Text size="xsmall" className="text-ui-fg-muted uppercase tracking-wider">
        Overrides por ciudad
      </Text>
      {entries.length > 0 && (
        <div className="flex flex-col gap-1">
          <div className="grid grid-cols-[1fr_120px_80px_60px] gap-2 px-2">
            <Text size="xsmall" className="text-ui-fg-muted">Ciudad</Text>
            <Text size="xsmall" className="text-ui-fg-muted">Código</Text>
            <Text size="xsmall" className="text-ui-fg-muted">%</Text>
            <span />
          </div>
          {entries.map(([city, entry]) => (
            <div
              key={city}
              className="grid grid-cols-[1fr_120px_80px_60px] gap-2 items-center px-2 py-1 bg-ui-bg-subtle rounded"
            >
              <Text size="small" className="text-ui-fg-base capitalize">{city}</Text>
              <Input
                size="small"
                placeholder={baseCode}
                value={String(entry.discount_code ?? "")}
                onChange={(e) => updateEntry(city, "discount_code", e.target.value)}
              />
              <Input
                size="small"
                type="number"
                placeholder={String(basePct)}
                value={String(entry.discount_percent ?? "")}
                onChange={(e) => updateEntry(city, "discount_percent", e.target.value)}
              />
              <Button size="small" variant="transparent" onClick={() => removeOverride(city)}>
                ×
              </Button>
            </div>
          ))}
        </div>
      )}
      <div className="grid grid-cols-[1fr_120px_80px_60px] gap-2 items-center px-2 pt-1">
        <Input
          size="small"
          placeholder="caracas, valencia, ..."
          value={newCity}
          onChange={(e) => setNewCity(e.target.value)}
        />
        <Input
          size="small"
          placeholder={`Código (default: ${baseCode})`}
          value={newCode}
          onChange={(e) => setNewCode(e.target.value)}
        />
        <Input
          size="small"
          type="number"
          placeholder={`${basePct}`}
          value={String(newPct)}
          onChange={(e) => setNewPct(e.target.value === "" ? "" : Number(e.target.value))}
        />
        <Button
          size="small"
          variant="secondary"
          disabled={!newCity.trim() || (!newCode.trim() && newPct === "")}
          onClick={addOverride}
        >
          +
        </Button>
      </div>
      <Text size="xsmall" className="text-ui-fg-muted">
        La ciudad del cliente se resuelve desde el último pedido. Campos en blanco heredan del valor global.
      </Text>
    </div>
  )
}

// ─── Campaign Card ────────────────────────────────────────────────────────────

function CampaignCard({
  setting,
  onToggle,
  onSave,
  onTest,
  linkedRules = [],
  onJumpToRules,
}: {
  setting: Setting
  onToggle: (key: string, enabled: boolean) => void
  onSave: (key: string, updates: Record<string, unknown>) => void
  onTest: (type: string, to: string) => void
  linkedRules?: Array<{ key: string; name: string; enabled: boolean }>
  onJumpToRules?: () => void
}) {
  const [testEmail, setTestEmail] = useState("")
  const [localValue, setLocalValue] = useState(setting.value)

  const isEnabled = localValue.enabled !== false
  const label = TYPE_LABELS[setting.key] || setting.key
  const icon = TYPE_ICONS[setting.key] || "📧"

  function handleField(field: string, val: unknown) {
    setLocalValue((prev) => ({ ...prev, [field]: val }))
  }

  return (
    <Container className="p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{icon}</span>
          <div>
            <Text className="text-ui-fg-base font-semibold text-base">{label}</Text>
            {setting.key === "restock" && (
              <Text size="small" className="text-ui-fg-subtle">
                Configura los productos en la sección de abajo
              </Text>
            )}
          </div>
        </div>
        <Switch
          checked={isEnabled}
          onCheckedChange={(v) => {
            handleField("enabled", v)
            onToggle(setting.key, v)
          }}
        />
      </div>

      {linkedRules.length > 0 && (
        <div className="bg-ui-bg-subtle rounded p-2 flex items-start gap-2 flex-wrap">
          <Text size="xsmall" className="text-ui-fg-muted shrink-0">
            🔗 Reglas v2 vinculadas:
          </Text>
          <div className="flex flex-wrap gap-1 items-center">
            {linkedRules.map((r) => (
              <Badge
                key={r.key}
                color={r.enabled ? "green" : "grey"}
                size="2xsmall"
              >
                {r.enabled ? "✓ " : "○ "}
                {r.name}
              </Badge>
            ))}
            {onJumpToRules && (
              <Button variant="transparent" size="small" onClick={onJumpToRules}>
                Editar →
              </Button>
            )}
          </div>
          <Text size="xsmall" className="text-ui-fg-muted w-full mt-1">
            Apagar esta campaña <strong>no</strong> apaga las reglas v2. Desactívalas también si quieres silencio total.
          </Text>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {setting.key === "abandoned_cart" && (
          <div className="flex flex-col gap-1">
            <Label size="small" className="text-ui-fg-subtle">Horas antes de enviar</Label>
            <Input
              type="number"
              value={String(localValue.hours_delay ?? 2)}
              onChange={(e) => handleField("hours_delay", parseInt(e.target.value))}
              size="small"
            />
          </div>
        )}
        {(setting.key === "birthday" || setting.key === "win_back") && (
          <>
            <div className="flex flex-col gap-1">
              <Label size="small" className="text-ui-fg-subtle">Código de descuento</Label>
              <Input
                value={String(localValue.discount_code ?? "")}
                onChange={(e) => handleField("discount_code", e.target.value)}
                size="small"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label size="small" className="text-ui-fg-subtle">% Descuento</Label>
              <Input
                type="number"
                value={String(localValue.discount_percent ?? 15)}
                onChange={(e) => handleField("discount_percent", parseInt(e.target.value))}
                size="small"
              />
            </div>
          </>
        )}
        {setting.key === "win_back" && (
          <>
            <div className="flex flex-col gap-1">
              <Label size="small" className="text-ui-fg-subtle">
                Días sin compra {localValue.use_personal_cycle ? "(mínimo)" : ""}
              </Label>
              <Input
                type="number"
                value={String(localValue.days_since_order ?? 60)}
                onChange={(e) => handleField("days_since_order", parseInt(e.target.value))}
                size="small"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label size="small" className="text-ui-fg-subtle">
                Multiplicador ciclo personal
              </Label>
              <Input
                type="number"
                step="0.1"
                value={String(localValue.personal_cycle_multiplier ?? 1.2)}
                onChange={(e) => handleField("personal_cycle_multiplier", parseFloat(e.target.value) || 1.2)}
                size="small"
                disabled={!localValue.use_personal_cycle}
              />
            </div>
          </>
        )}
        {setting.key === "post_purchase" && (
          <div className="flex flex-col gap-1">
            <Label size="small" className="text-ui-fg-subtle">Días después del pedido</Label>
            <Input
              type="number"
              value={String(localValue.days_after ?? 3)}
              onChange={(e) => handleField("days_after", parseInt(e.target.value))}
              size="small"
            />
          </div>
        )}
        {setting.key === "stockout_alert" && (
          <>
            <div className="flex flex-col gap-1">
              <Label size="small" className="text-ui-fg-subtle">Días críticos de cobertura</Label>
              <Input
                type="number"
                value={String(localValue.critical_days ?? 7)}
                onChange={(e) => handleField("critical_days", parseInt(e.target.value) || 7)}
                size="small"
                min={1}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label size="small" className="text-ui-fg-subtle">Cohorte (días)</Label>
              <Input
                type="number"
                value={String(localValue.cohort_days ?? 120)}
                onChange={(e) => handleField("cohort_days", parseInt(e.target.value) || 120)}
                size="small"
                min={30}
              />
            </div>
          </>
        )}
        {setting.key === "pending_payment" && (
          <>
            <div className="flex flex-col gap-1">
              <Label size="small" className="text-ui-fg-subtle">Horas antes del recordatorio</Label>
              <Input
                type="number"
                value={String(localValue.hours_threshold ?? 4)}
                onChange={(e) => handleField("hours_threshold", parseInt(e.target.value) || 4)}
                size="small"
                min={1}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label size="small" className="text-ui-fg-subtle">Edad máxima (h)</Label>
              <Input
                type="number"
                value={String(localValue.max_age_hours ?? 48)}
                onChange={(e) => handleField("max_age_hours", parseInt(e.target.value) || 48)}
                size="small"
                min={1}
              />
            </div>
          </>
        )}
        {setting.key === "graduation" && (
          <>
            <div className="flex flex-col gap-1">
              <Label size="small" className="text-ui-fg-subtle">Días después del 1er pedido manual</Label>
              <Input
                type="number"
                value={String(localValue.days_after ?? 3)}
                onChange={(e) => handleField("days_after", parseInt(e.target.value))}
                size="small"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label size="small" className="text-ui-fg-subtle">Código</Label>
              <Input
                value={String(localValue.discount_code ?? "WEB20")}
                onChange={(e) => handleField("discount_code", e.target.value)}
                size="small"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label size="small" className="text-ui-fg-subtle">% Descuento</Label>
              <Input
                type="number"
                value={String(localValue.discount_percent ?? 20)}
                onChange={(e) => handleField("discount_percent", parseInt(e.target.value))}
                size="small"
              />
            </div>
          </>
        )}
      </div>

      {/* Sinergia H: per-city overrides for campaigns with discount */}
      {(setting.key === "birthday" || setting.key === "win_back" || setting.key === "graduation") && (
        <GeoOverridesEditor
          value={(localValue.geo_overrides as Record<string, Record<string, unknown>>) || {}}
          baseCode={String(
            localValue.discount_code ??
            (setting.key === "birthday" ? "CUMPLE15" : setting.key === "win_back" ? "TEVEMOS20" : "WEB20")
          )}
          basePct={Number(
            localValue.discount_percent ??
            (setting.key === "birthday" ? 15 : setting.key === "win_back" ? 20 : 20)
          )}
          onChange={(next) => handleField("geo_overrides", next)}
        />
      )}

      {/* Sinergia B: personal-cycle gate for win_back */}
      {setting.key === "win_back" && (
        <div className="flex items-center gap-3 pt-2 border-t border-ui-border-base">
          <Switch
            checked={localValue.use_personal_cycle === true}
            onCheckedChange={(v) => handleField("use_personal_cycle", v)}
          />
          <div className="flex flex-col">
            <Text size="small" className="text-ui-fg-base">
              Disparar por ciclo personal del cliente
            </Text>
            <Text size="xsmall" className="text-ui-fg-muted">
              En vez de los {String(localValue.days_since_order ?? 60)} días fijos, usa (ciclo mediano del cliente × {String(localValue.personal_cycle_multiplier ?? 1.2)}). Si no hay historial, cae al valor global.
            </Text>
          </div>
        </div>
      )}

      {/* Channel toggles */}
      <div className="flex items-center gap-4 pt-2 border-t border-ui-border-base">
        <Text size="xsmall" className="text-ui-fg-muted uppercase tracking-wider">Canales</Text>
        <div className="flex items-center gap-2">
          <Switch
            checked={(localValue.channels as Record<string, unknown>)?.email !== false}
            onCheckedChange={(v) =>
              handleField("channels", { ...(localValue.channels as object ?? {}), email: v })
            }
          />
          <Text size="small" className="text-ui-fg-base">📧 Email</Text>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            checked={(localValue.channels as Record<string, unknown>)?.whatsapp === true}
            onCheckedChange={(v) =>
              handleField("channels", { ...(localValue.channels as object ?? {}), whatsapp: v })
            }
          />
          <Text size="small" className="text-ui-fg-base">💬 WhatsApp</Text>
        </div>
        <Text size="xsmall" className="text-ui-fg-muted ml-auto">
          Con ambos activos: WhatsApp es primario, email es fallback si no hay teléfono
        </Text>
      </div>

      <div className="flex items-center gap-2 pt-1 border-t border-ui-border-base">
        <Button size="small" variant="secondary" onClick={() => onSave(setting.key, localValue)}>
          Guardar cambios
        </Button>
        <div className="flex items-center gap-1 ml-auto">
          <Input
            placeholder="email@test.com"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            size="small"
            className="w-44"
          />
          <Button
            size="small"
            variant="transparent"
            onClick={() => testEmail && onTest(setting.key, testEmail)}
          >
            Probar
          </Button>
        </div>
      </div>
    </Container>
  )
}

// ─── Product Selector (searchable) ───────────────────────────────────────────

function ProductSelector({
  products,
  value,
  onChange,
  placeholder,
  excludeIds = [],
}: {
  products: Product[]
  value: string
  onChange: (id: string) => void
  placeholder?: string
  excludeIds?: string[]
}) {
  const selected = products.find((p) => p.id === value)
  const [search, setSearch] = useState(selected?.title ?? "")
  const [open, setOpen] = useState(false)

  const filtered = products
    .filter(
      (p) =>
        !excludeIds.includes(p.id) &&
        p.title.toLowerCase().includes(search.toLowerCase())
    )
    .slice(0, 8)

  return (
    <div className="relative">
      <Input
        placeholder={placeholder ?? "Buscar producto…"}
        value={search}
        size="small"
        onChange={(e) => {
          setSearch(e.target.value)
          setOpen(true)
          if (!e.target.value) onChange("")
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 w-full mt-1 border border-ui-border-base rounded-lg shadow-lg bg-ui-bg-base max-h-48 overflow-y-auto">
          {filtered.map((p) => (
            <div
              key={p.id}
              className={`px-3 py-2 cursor-pointer text-sm hover:bg-ui-bg-subtle ${value === p.id ? "bg-ui-bg-highlight font-semibold" : ""}`}
              onMouseDown={() => {
                onChange(p.id)
                setSearch(p.title)
                setOpen(false)
              }}
            >
              {p.title}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Restock Products Section ─────────────────────────────────────────────────

function RestockProductsSection({
  products,
  rules,
  onSave,
  suggestions = {},
}: {
  products: Product[]
  rules: RestockRule[]
  onSave: (rules: RestockRule[]) => void
  suggestions?: Record<string, { product_id: string; median_days: number; sample_size: number }>
}) {
  const [localRules, setLocalRules] = useState<RestockRule[]>(rules)
  const [newProductId, setNewProductId] = useState("")
  const [newDays, setNewDays] = useState(30)

  const existingIds = localRules.map((r) => r.product_id)

  // Auto-suggest days when selecting a product, if there's a computed median
  useEffect(() => {
    if (newProductId && suggestions[newProductId]) {
      setNewDays(Math.round(suggestions[newProductId].median_days))
    }
  }, [newProductId, suggestions])

  function addRule() {
    const product = products.find((p) => p.id === newProductId)
    if (!product) return
    setLocalRules((prev) => [
      ...prev,
      { product_id: product.id, product_title: product.title, days: newDays },
    ])
    setNewProductId("")
    setNewDays(30)
  }

  function removeRule(productId: string) {
    setLocalRules((prev) => prev.filter((r) => r.product_id !== productId))
  }

  function updateDays(productId: string, days: number) {
    setLocalRules((prev) =>
      prev.map((r) => (r.product_id === productId ? { ...r, days } : r))
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Heading level="h2" className="text-ui-fg-base">🔁 Productos con restock activo</Heading>
        <Text size="small" className="text-ui-fg-subtle mt-1">
          Define qué productos activarán el recordatorio de restock y cuántos días después de la compra se envía.
        </Text>
      </div>

      <Container className="p-5 flex flex-col gap-5">
        {/* Add rule */}
        <div className="flex flex-col gap-3">
          <Text className="text-ui-fg-base font-semibold">Añadir producto</Text>

          <div className="grid grid-cols-[1fr_140px_auto] gap-3 items-end">
            <div className="flex flex-col gap-1">
              <Label size="small" className="text-ui-fg-subtle">Producto</Label>
              <ProductSelector
                products={products}
                value={newProductId}
                onChange={setNewProductId}
                placeholder="Buscar producto…"
                excludeIds={existingIds}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label size="small" className="text-ui-fg-subtle">
                Días después de compra
                {newProductId && suggestions[newProductId] && (
                  <span style={{ color: "#6366f1", marginLeft: 6, fontWeight: 500 }}>
                    · sugerido: {Math.round(suggestions[newProductId].median_days)}d
                    (n={suggestions[newProductId].sample_size})
                  </span>
                )}
              </Label>
              <Input
                type="number"
                value={String(newDays)}
                onChange={(e) => setNewDays(parseInt(e.target.value) || 30)}
                size="small"
                min={1}
              />
            </div>
            <Button
              size="small"
              variant="secondary"
              disabled={!newProductId}
              onClick={addRule}
            >
              + Añadir
            </Button>
          </div>
        </div>

        {/* Rules table */}
        {localRules.length > 0 ? (
          <div className="flex flex-col gap-2 border-t border-ui-border-base pt-4">
            <Text className="text-ui-fg-base font-semibold">
              Productos configurados ({localRules.length})
            </Text>

            {/* Header */}
            <div className="grid grid-cols-[1fr_160px_180px_80px] gap-3 px-3 py-1">
              <Text size="xsmall" className="text-ui-fg-muted font-medium uppercase tracking-wide">Producto</Text>
              <Text size="xsmall" className="text-ui-fg-muted font-medium uppercase tracking-wide">Días tras compra</Text>
              <Text size="xsmall" className="text-ui-fg-muted font-medium uppercase tracking-wide">Sugerencia (mediana)</Text>
              <span />
            </div>

            <div className="flex flex-col gap-1">
              {localRules.map((rule) => {
                const suggestion = suggestions[rule.product_id]
                const suggestedDays = suggestion ? Math.round(suggestion.median_days) : null
                const differs = suggestedDays !== null && suggestedDays !== rule.days
                return (
                  <div
                    key={rule.product_id}
                    className="grid grid-cols-[1fr_160px_180px_80px] gap-3 items-center px-3 py-2 bg-ui-bg-subtle rounded-lg"
                  >
                    <Text size="small" className="text-ui-fg-base font-medium truncate">
                      {rule.product_title}
                    </Text>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        value={String(rule.days)}
                        onChange={(e) => updateDays(rule.product_id, parseInt(e.target.value) || 30)}
                        size="small"
                        min={1}
                      />
                      <Text size="xsmall" className="text-ui-fg-muted whitespace-nowrap">días</Text>
                    </div>
                    <div className="flex items-center gap-2">
                      {suggestion ? (
                        <>
                          <Text size="xsmall" className="text-ui-fg-subtle whitespace-nowrap">
                            {suggestedDays}d · n={suggestion.sample_size}
                          </Text>
                          {differs && (
                            <Button
                              size="small"
                              variant="transparent"
                              onClick={() => updateDays(rule.product_id, suggestedDays!)}
                            >
                              Aplicar
                            </Button>
                          )}
                        </>
                      ) : (
                        <Text size="xsmall" className="text-ui-fg-muted">—</Text>
                      )}
                    </div>
                    <Button
                      size="small"
                      variant="transparent"
                      onClick={() => removeRule(rule.product_id)}
                    >
                      Eliminar
                    </Button>
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="text-center py-6 border-t border-ui-border-base">
            <Text size="small" className="text-ui-fg-muted">
              No hay productos configurados. Añade uno arriba para activar el restock.
            </Text>
          </div>
        )}

        <div className="flex justify-end border-t border-ui-border-base pt-3">
          <Button size="small" onClick={() => onSave(localRules)}>
            Guardar reglas de restock
          </Button>
        </div>
      </Container>
    </div>
  )
}

// ─── Cross-Sell Section ───────────────────────────────────────────────────────

type CrossSellSuggestion = {
  anchor_id: string
  anchor_title: string
  also_id: string
  also_title: string
  co_count: number
  anchor_orders: number
  attach_pct: number
}

function CrossSellSection({
  products,
  crosssellMap,
  onSave,
  suggestions = [],
}: {
  products: Product[]
  crosssellMap: Record<string, string[]>
  onSave: (map: Record<string, string[]>) => void
  suggestions?: CrossSellSuggestion[]
}) {
  const [localMap, setLocalMap] = useState<Record<string, string[]>>(crosssellMap)
  const [sourceId, setSourceId] = useState("")
  const [targetIds, setTargetIds] = useState<string[]>([])
  const [targetSearch, setTargetSearch] = useState("")
  const [targetOpen, setTargetOpen] = useState(false)

  const filteredTargets = products
    .filter(
      (p) =>
        p.id !== sourceId &&
        p.title.toLowerCase().includes(targetSearch.toLowerCase())
    )
    .slice(0, 8)

  function toggleTarget(id: string) {
    setTargetIds((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : prev.length < 4
          ? [...prev, id]
          : prev
    )
  }

  function addRule() {
    if (!sourceId || targetIds.length === 0) return
    setLocalMap((prev) => ({ ...prev, [sourceId]: targetIds }))
    setSourceId("")
    setTargetIds([])
    setTargetSearch("")
  }

  function removeRule(id: string) {
    setLocalMap((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Heading level="h2" className="text-ui-fg-base">🔗 Cross-sell en carrito y restock</Heading>
        <Text size="small" className="text-ui-fg-subtle mt-1">
          Define qué productos se sugieren junto a cada producto en el carrito y en los emails de restock.
        </Text>
      </div>

      <Container className="p-5 flex flex-col gap-5">
        <div className="flex flex-col gap-3">
          <Text className="text-ui-fg-base font-semibold">Nueva regla</Text>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <Label size="small" className="text-ui-fg-subtle">Producto principal</Label>
              <ProductSelector
                products={products}
                value={sourceId}
                onChange={(id) => { setSourceId(id); setTargetIds([]) }}
                placeholder="Buscar producto principal…"
              />
            </div>

            <div className="flex flex-col gap-1">
              <Label size="small" className="text-ui-fg-subtle">
                Productos relacionados <span className="text-ui-fg-muted">(máx. 4)</span>
              </Label>
              <div className="relative">
                <Input
                  placeholder={
                    sourceId
                      ? "Buscar productos relacionados…"
                      : "Primero selecciona el producto principal"
                  }
                  value={targetSearch}
                  size="small"
                  disabled={!sourceId}
                  onChange={(e) => { setTargetSearch(e.target.value); setTargetOpen(true) }}
                  onFocus={() => setTargetOpen(true)}
                  onBlur={() => setTimeout(() => setTargetOpen(false), 150)}
                />
                {sourceId && targetOpen && filteredTargets.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 border border-ui-border-base rounded-lg shadow-lg bg-ui-bg-base max-h-48 overflow-y-auto">
                    {filteredTargets.map((p) => (
                      <div
                        key={p.id}
                        className={`px-3 py-2 cursor-pointer text-sm hover:bg-ui-bg-subtle flex items-center gap-2 ${targetIds.includes(p.id) ? "bg-ui-bg-highlight" : ""}`}
                        onMouseDown={() => toggleTarget(p.id)}
                      >
                        <span className="text-xs w-4">{targetIds.includes(p.id) ? "✓" : "○"}</span>
                        <span className="flex-1">{p.title}</span>
                        {targetIds.includes(p.id) && (
                          <Badge color="blue" size="2xsmall">Seleccionado</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {targetIds.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {targetIds.map((id) => {
                    const p = products.find((x) => x.id === id)
                    return p ? (
                      <div
                        key={id}
                        className="flex items-center gap-1 bg-ui-bg-highlight border border-ui-border-base rounded px-2 py-0.5 text-xs cursor-pointer hover:bg-ui-bg-subtle"
                        onClick={() => toggleTarget(id)}
                      >
                        {p.title}
                        <span className="text-ui-fg-muted ml-1">×</span>
                      </div>
                    ) : null
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              size="small"
              variant="secondary"
              disabled={!sourceId || targetIds.length === 0}
              onClick={addRule}
            >
              + Añadir regla
            </Button>
          </div>
        </div>

        {/* Sinergia C: auto-suggestions from real orders */}
        {suggestions.length > 0 && (() => {
          // Group suggestions by anchor, keep top 3 per anchor by attach_pct
          const byAnchor: Record<string, CrossSellSuggestion[]> = {}
          for (const s of suggestions) {
            if (!byAnchor[s.anchor_id]) byAnchor[s.anchor_id] = []
            byAnchor[s.anchor_id].push(s)
          }
          const anchors = Object.keys(byAnchor)
            .map(id => ({
              id,
              title: byAnchor[id][0].anchor_title,
              pairs: byAnchor[id]
                .sort((a, b) => b.attach_pct - a.attach_pct)
                .slice(0, 3),
            }))
            .sort((a, b) => b.pairs[0].attach_pct - a.pairs[0].attach_pct)

          function applyAll() {
            setLocalMap(prev => {
              const next = { ...prev }
              for (const a of anchors) next[a.id] = a.pairs.map(p => p.also_id)
              return next
            })
          }
          function applyAnchor(anchorId: string, alsoIds: string[]) {
            setLocalMap(prev => ({ ...prev, [anchorId]: alsoIds }))
          }

          return (
            <div className="flex flex-col gap-2 border-t border-ui-border-base pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <Text className="text-ui-fg-base font-semibold">
                    🤖 Sugerencias automáticas ({anchors.length})
                  </Text>
                  <Text size="xsmall" className="text-ui-fg-muted">
                    Basado en qué productos se compraron juntos en los últimos 90 días
                  </Text>
                </div>
                <Button size="small" variant="secondary" onClick={applyAll}>
                  Aplicar todas
                </Button>
              </div>
              <div className="flex flex-col gap-2">
                {anchors.map(a => {
                  const currentIds = localMap[a.id] || []
                  const suggestedIds = a.pairs.map(p => p.also_id)
                  const alreadyApplied =
                    currentIds.length === suggestedIds.length &&
                    suggestedIds.every(id => currentIds.includes(id))
                  return (
                    <div key={a.id} className="flex items-center gap-3 p-3 bg-ui-bg-subtle rounded-lg">
                      <div className="flex-1 min-w-0">
                        <Text size="small" className="text-ui-fg-base font-medium truncate">
                          {a.title}
                        </Text>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {a.pairs.map(p => (
                            <Badge
                              key={p.also_id}
                              color={p.attach_pct >= 40 ? "green" : p.attach_pct >= 20 ? "blue" : "grey"}
                              size="2xsmall"
                            >
                              {p.also_title} · {p.attach_pct}%
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <Button
                        size="small"
                        variant={alreadyApplied ? "transparent" : "secondary"}
                        disabled={alreadyApplied}
                        onClick={() => applyAnchor(a.id, suggestedIds)}
                      >
                        {alreadyApplied ? "Aplicado ✓" : "Aplicar"}
                      </Button>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })()}

        {Object.keys(localMap).length > 0 ? (
          <div className="flex flex-col gap-2 border-t border-ui-border-base pt-4">
            <Text className="text-ui-fg-base font-semibold">
              Reglas configuradas ({Object.keys(localMap).length})
            </Text>
            <div className="flex flex-col gap-2">
              {Object.entries(localMap).map(([srcId, tgtIds]) => {
                const source = products.find((p) => p.id === srcId)
                const targets = tgtIds
                  .map((id) => products.find((p) => p.id === id))
                  .filter(Boolean) as Product[]
                if (!source) return null
                return (
                  <div key={srcId} className="flex items-start gap-3 p-3 bg-ui-bg-subtle rounded-lg">
                    <div className="flex-1 min-w-0">
                      <Text size="small" className="text-ui-fg-base font-medium">{source.title}</Text>
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {targets.map((t) => (
                          <Badge key={t.id} color="grey" size="2xsmall">{t.title}</Badge>
                        ))}
                      </div>
                    </div>
                    <Button size="small" variant="transparent" onClick={() => removeRule(srcId)}>
                      Eliminar
                    </Button>
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="text-center py-6 border-t border-ui-border-base">
            <Text size="small" className="text-ui-fg-muted">
              No hay reglas configuradas. Añade una arriba para empezar.
            </Text>
          </div>
        )}

        <div className="flex justify-end border-t border-ui-border-base pt-3">
          <Button size="small" onClick={() => onSave(localMap)}>
            Guardar cross-sell
          </Button>
        </div>
      </Container>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type RestockSuggestion = { product_id: string; median_days: number; sample_size: number }

export default function RemarketingPage() {
  const [subTab, setSubTab] = useState<"campaigns" | "users" | "patterns" | "engine">(() => {
    // Allow deeplinks from team_alert / external links: ?tab=users&user=...
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search)
      const t = params.get("tab")
      if (t === "users" || t === "patterns" || t === "engine" || t === "campaigns") return t
    }
    return "campaigns"
  })
  const [initialUserSearch, setInitialUserSearch] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search)
      return params.get("user") || ""
    }
    return ""
  })
  const [stats, setStats] = useState<RemarketingStats | null>(null)
  const [settings, setSettings] = useState<Setting[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [crosssellMap, setCrosssellMap] = useState<Record<string, string[]>>({})
  const [restockRules, setRestockRules] = useState<RestockRule[]>([])
  const [restockSuggestions, setRestockSuggestions] = useState<Record<string, RestockSuggestion>>({})
  const [crosssellSuggestions, setCrosssellSuggestions] = useState<CrossSellSuggestion[]>([])
  const [rulesLite, setRulesLite] = useState<Array<{ key: string; name: string; enabled: boolean }>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      const [res, analyticsRes, rulesRes] = await Promise.all([
        fetch(`${API}/admin/remarketing`, { credentials: "include" }),
        // Migrated from /admin/analytics to /admin/remarketing/intelligence
        // when the analytics module was absorbed into Finanzas (Batch FA4).
        fetch(`${API}/admin/remarketing/intelligence`, { credentials: "include" }),
        fetch(`${API}/admin/remarketing/rules`, { credentials: "include" }),
      ])
      if (res.ok) {
        const data = await res.json()
        setStats(data.stats)
        setSettings(data.settings)
        setProducts(data.products || [])

        const csEntry = data.settings.find((s: Setting) => s.key === "crosssell_map")
        setCrosssellMap((csEntry?.value?.map as Record<string, string[]>) || {})

        const rrEntry = data.settings.find((s: Setting) => s.key === "restock_products")
        setRestockRules((rrEntry?.value?.rules as RestockRule[]) || [])
      }
      if (rulesRes.ok) {
        const r = await rulesRes.json()
        setRulesLite(
          (r.rules || []).map((rule: any) => ({
            key: rule.key,
            name: rule.name,
            enabled: !!rule.enabled,
          }))
        )
      }
      if (analyticsRes.ok) {
        const a = await analyticsRes.json()
        const cycles = (a.replenishment_cycles || []) as RestockSuggestion[]
        const map: Record<string, RestockSuggestion> = {}
        for (const c of cycles) map[c.product_id] = c
        setRestockSuggestions(map)

        setCrosssellSuggestions((a.attach_matrix || []) as CrossSellSuggestion[])
      }
    } catch {
      toast.error("Error cargando datos de remarketing")
    } finally {
      setLoading(false)
    }
  }

  async function handleToggle(key: string, enabled: boolean) {
    setSettings((prev) =>
      prev.map((s) => (s.key === key ? { ...s, value: { ...s.value, enabled } } : s))
    )
  }

  async function handleSave(key: string, value: Record<string, unknown>) {
    try {
      const res = await fetch(`${API}/admin/remarketing`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_setting", key, value }),
      })
      if (res.ok) {
        toast.success(`Configuración de "${TYPE_LABELS[key] || key}" guardada`)
        setSettings((prev) => prev.map((s) => (s.key === key ? { ...s, value } : s)))
      } else {
        toast.error("Error al guardar configuración")
      }
    } catch {
      toast.error("Error de conexión")
    }
  }

  async function handleSaveCrosssell(map: Record<string, string[]>) {
    try {
      const res = await fetch(`${API}/admin/remarketing`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save_crosssell", map }),
      })
      if (res.ok) {
        setCrosssellMap(map)
        toast.success("Cross-sell guardado correctamente")
      } else {
        toast.error("Error al guardar cross-sell")
      }
    } catch {
      toast.error("Error de conexión")
    }
  }

  async function handleSaveRestockRules(rules: RestockRule[]) {
    try {
      const res = await fetch(`${API}/admin/remarketing`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save_restock_rules", rules }),
      })
      if (res.ok) {
        setRestockRules(rules)
        toast.success("Reglas de restock guardadas")
      } else {
        toast.error("Error al guardar reglas de restock")
      }
    } catch {
      toast.error("Error de conexión")
    }
  }

  async function handleTest(type: string, to: string) {
    try {
      toast.info(`Enviando email de prueba a ${to}…`)
      const res = await fetch(`${API}/admin/remarketing`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test_email", type, to }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success(`Email de prueba enviado a ${to}`)
      } else {
        toast.error("No se pudo enviar. ¿Está configurado RESEND_API_KEY?")
      }
    } catch {
      toast.error("Error de conexión")
    }
  }

  const campaignSettings = settings.filter(
    (s) => s.key !== "crosssell_map" && s.key !== "restock_products"
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Text className="text-ui-fg-subtle">Cargando remarketing…</Text>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Heading level="h1" className="text-ui-fg-base">📧 Remarketing</Heading>
          <Text className="text-ui-fg-subtle mt-1">
            {subTab === "campaigns"
              ? "Automatización de emails para carritos, cumpleaños, reactivación y más"
              : subTab === "users"
              ? "Vista 360° por usuario: comportamiento, señales y acciones"
              : subTab === "patterns"
              ? "Patrones agregados: señales activas, fricción, restock y conversión"
              : "Motor de reglas: configura triggers, templates y ve el feed de fires"}
          </Text>
        </div>
        {subTab === "campaigns" && (
          <Button variant="secondary" size="small" onClick={loadData}>
            Actualizar
          </Button>
        )}
      </div>

      {/* Sub-tab nav */}
      <div className="flex gap-1 border-b border-ui-border-base">
        <button
          type="button"
          onClick={() => setSubTab("campaigns")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            subTab === "campaigns"
              ? "border-ui-border-interactive text-ui-fg-base"
              : "border-transparent text-ui-fg-subtle hover:text-ui-fg-base"
          }`}
        >
          📊 Campañas
        </button>
        <button
          type="button"
          onClick={() => setSubTab("users")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            subTab === "users"
              ? "border-ui-border-interactive text-ui-fg-base"
              : "border-transparent text-ui-fg-subtle hover:text-ui-fg-base"
          }`}
        >
          👤 Users 360
        </button>
        <button
          type="button"
          onClick={() => setSubTab("patterns")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            subTab === "patterns"
              ? "border-ui-border-interactive text-ui-fg-base"
              : "border-transparent text-ui-fg-subtle hover:text-ui-fg-base"
          }`}
        >
          🔍 Patrones
        </button>
        <button
          type="button"
          onClick={() => setSubTab("engine")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            subTab === "engine"
              ? "border-ui-border-interactive text-ui-fg-base"
              : "border-transparent text-ui-fg-subtle hover:text-ui-fg-base"
          }`}
        >
          ⚡ Motor de reglas
        </button>
      </div>

      {subTab === "users" && <UsersTab initialQuery={initialUserSearch} />}
      {subTab === "patterns" && <PatternsTab />}
      {subTab === "engine" && (
        <RulesEngineTab
          campaigns={settings.map((s) => ({
            key: s.key,
            enabled: s.value?.enabled !== false,
          }))}
          onJumpToCampaigns={() => setSubTab("campaigns")}
        />
      )}

      {/* Stats */}
      {subTab === "campaigns" && stats && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Total enviados" value={stats.total} />
            <StatCard label="Últimos 7 días" value={stats.last_7_days} />
            <StatCard label="Últimos 30 días" value={stats.last_30_days} />
            <StatCard
              label="Tipos activos"
              value={campaignSettings.filter((s) => s.value.enabled !== false).length}
              sub={`de ${campaignSettings.length} campañas`}
            />
          </div>

          {Object.keys(stats.by_type).length > 0 && (
            <Container className="p-4">
              <Text className="text-ui-fg-base font-semibold mb-3">Enviados por tipo</Text>
              <div className="flex flex-wrap gap-2">
                {Object.entries(stats.by_type).map(([type, count]) => (
                  <div key={type} className="flex items-center gap-2 bg-ui-bg-subtle rounded-lg px-3 py-2">
                    <span>{TYPE_ICONS[type] || "📧"}</span>
                    <Text size="small" className="text-ui-fg-base font-medium">{TYPE_LABELS[type] || type}</Text>
                    <Badge color={TYPE_COLORS[type] || "grey"}>{count}</Badge>
                  </div>
                ))}
              </div>
            </Container>
          )}
        </>
      )}

      {/* Campaigns */}
      {subTab === "campaigns" && (
        <div>
          <Heading level="h2" className="text-ui-fg-base mb-3">Campañas automáticas</Heading>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {campaignSettings.map((setting) => {
              const linkedKeys = LEGACY_TYPE_TO_RULE_KEYS[setting.key] || []
              const linkedRules = rulesLite.filter((r) => linkedKeys.includes(r.key))
              return (
                <CampaignCard
                  key={setting.key}
                  setting={setting}
                  onToggle={handleToggle}
                  onSave={handleSave}
                  onTest={handleTest}
                  linkedRules={linkedRules}
                  onJumpToRules={() => setSubTab("engine")}
                />
              )
            })}
          </div>
        </div>
      )}

      {/* Restock products */}
      {subTab === "campaigns" && products.length > 0 && (
        <RestockProductsSection
          products={products}
          rules={restockRules}
          onSave={handleSaveRestockRules}
          suggestions={restockSuggestions}
        />
      )}

      {/* Cross-sell */}
      {subTab === "campaigns" && products.length > 0 && (
        <CrossSellSection
          products={products}
          crosssellMap={crosssellMap}
          onSave={handleSaveCrosssell}
          suggestions={crosssellSuggestions}
        />
      )}

      {/* Recent */}
      {subTab === "campaigns" && stats && stats.recent.length > 0 && (
        <Container className="p-4">
          <Heading level="h2" className="text-ui-fg-base mb-3">Actividad reciente</Heading>
          <div className="flex flex-col gap-2">
            {stats.recent.map((log) => (
              <div key={log.id} className="flex items-center gap-3 py-2 border-b border-ui-border-base last:border-0">
                <span className="text-lg flex-shrink-0">{TYPE_ICONS[log.type] || "📧"}</span>
                <div className="flex-1 min-w-0">
                  <Text size="small" className="text-ui-fg-base font-medium truncate">{log.subject}</Text>
                  <Text size="xsmall" className="text-ui-fg-subtle">{log.recipient_email}</Text>
                </div>
                <div className="text-right flex-shrink-0">
                  <Badge color={TYPE_COLORS[log.type] || "grey"} size="2xsmall">
                    {TYPE_LABELS[log.type] || log.type}
                  </Badge>
                  <Text size="xsmall" className="text-ui-fg-muted mt-1 block">
                    {new Date(log.sent_at).toLocaleDateString("es-ES", {
                      day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                    })}
                  </Text>
                </div>
              </div>
            ))}
          </div>
        </Container>
      )}

      {subTab === "campaigns" && stats && stats.total === 0 && (
        <Container className="p-10 text-center">
          <Text className="text-ui-fg-subtle text-4xl mb-3">📭</Text>
          <Text className="text-ui-fg-base font-medium">No se han enviado emails aún</Text>
          <Text size="small" className="text-ui-fg-subtle mt-1">
            Activa las campañas y los emails se enviarán automáticamente
          </Text>
        </Container>
      )}
    </div>
  )
}

// ─── Users 360 Sub-Tab ────────────────────────────────────────────────────────

interface Signal {
  id: string
  type: string
  severity: "high" | "medium" | "low" | "info"
  title: string
  description: string
  evidence?: Record<string, unknown>
  suggested_channel?: "email" | "whatsapp" | "push" | "sms"
  suggested_message?: string
  triggered_at?: string
}

interface UserEvent {
  event: string
  timestamp: string
  properties?: Record<string, unknown>
  distinct_id?: string
}

interface UserFire {
  id: string
  rule_key: string
  signal_id: string
  signal_severity: string
  channel: string
  status: string
  subject: string | null
  body: string | null
  error_message: string | null
  fired_at: string
  converted_order_id: string | null
  converted_at: string | null
}

interface User360Response {
  query: { email: string; customer_id: string; distinct_id: string }
  customer: {
    id: string
    email: string
    first_name?: string
    last_name?: string
    phone?: string
    created_at: string
    metadata?: Record<string, unknown>
  } | null
  medusa_summary: {
    orders_count: number
    lifetime_revenue: number
    avg_order_value: number
    last_order_at: string | null
    days_since_last_order: number | null
    preferred_payment_method: string | null
    orders: Array<{
      id: string
      display_id: number
      total: number
      currency_code: string
      created_at: string
      items: Array<{ product_id: string; title: string; quantity: number; unit_price: number }>
      metadata?: Record<string, unknown>
    }>
  }
  posthog_behavior: {
    person_id: string | null
    person_uuid: string | null
    distinct_ids: string[]
    sessions: number
    pageviews: number
    product_views: number
    cart_events: number
    checkout_starts: number
    orders: number
    add_to_carts: number
    whatsapp_clicks: number
    first_seen_at: string | null
    last_seen_at: string | null
    top_pages: Array<{ url: string; views: number }>
    top_products_viewed: Array<{ title?: string; product_id?: string; views: number; last_viewed_at?: string }>
    recent_events: UserEvent[]
    recent_events_count: number
  }
  signals: Signal[]
  fires: UserFire[]
  fires_summary: {
    total: number
    sent: number
    converted: number
    last_fired_at: string | null
  }
  links: {
    posthog_person: string | null
    clarity_dashboard: string | null
    whatsapp: string | null
  }
}

const SEVERITY_COLORS: Record<string, "red" | "orange" | "blue" | "grey"> = {
  high: "red",
  medium: "orange",
  low: "blue",
  info: "grey",
}

const SEVERITY_LABELS: Record<string, string> = {
  high: "Alta",
  medium: "Media",
  low: "Baja",
  info: "Info",
}

function UsersTab({ initialQuery = "" }: { initialQuery?: string }) {
  const [searchInput, setSearchInput] = useState(initialQuery)
  const [data, setData] = useState<User360Response | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function runSearch(query: string) {
    const q = query.trim()
    if (!q) return
    setLoading(true)
    setError(null)
    try {
      const isEmail = q.includes("@")
      const isCustomer = q.startsWith("cus_")
      const param = isEmail ? "email" : isCustomer ? "customer_id" : "distinct_id"
      const res = await fetch(
        `${API}/admin/remarketing/user360?${param}=${encodeURIComponent(q)}`,
        { credentials: "include" }
      )
      if (!res.ok) {
        setError("Error consultando el usuario")
        setData(null)
      } else {
        const json = (await res.json()) as User360Response
        setData(json)
        if (!json.customer && !json.posthog_behavior.person_id) {
          setError("No se encontró ningún usuario con ese identificador")
        }
      }
    } catch {
      setError("Error de conexión")
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  async function handleSearch(e?: React.FormEvent) {
    if (e) e.preventDefault()
    runSearch(searchInput)
  }

  // Auto-search on mount if we got an initialQuery from a deeplink (e.g. team_alert)
  useEffect(() => {
    if (initialQuery && initialQuery.trim()) {
      runSearch(initialQuery)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="flex flex-col gap-6">
      {/* Search form */}
      <Container className="p-4">
        <form onSubmit={handleSearch} className="flex gap-2 items-end">
          <div className="flex-1">
            <Label htmlFor="user-search" className="text-ui-fg-base mb-1 block">
              Buscar usuario
            </Label>
            <Input
              id="user-search"
              placeholder="email, cus_..., o distinct_id"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          <Button type="submit" variant="primary" isLoading={loading}>
            Buscar
          </Button>
        </form>
        <Text size="xsmall" className="text-ui-fg-subtle mt-2">
          Ej: <code>francisfratta2022@outlook.com</code> · <code>cus_01K...</code> · <code>019dba-...</code>
        </Text>
      </Container>

      {error && (
        <Container className="p-4">
          <Text className="text-ui-fg-error">{error}</Text>
        </Container>
      )}

      {data && (data.customer || data.posthog_behavior.person_id) && (
        <UserDetail data={data} />
      )}
    </div>
  )
}

function UserDetail({ data }: { data: User360Response }) {
  const { customer, medusa_summary, posthog_behavior, signals, fires, fires_summary, links } = data
  const displayName =
    [customer?.first_name, customer?.last_name].filter(Boolean).join(" ") ||
    customer?.email ||
    posthog_behavior.distinct_ids[0] ||
    "Usuario anónimo"

  return (
    <>
      {/* Customer header */}
      <Container className="p-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <Heading level="h2" className="text-ui-fg-base">
              {displayName}
            </Heading>
            <div className="flex gap-3 flex-wrap mt-1">
              {customer?.email && (
                <Text size="small" className="text-ui-fg-subtle">
                  ✉️ {customer.email}
                </Text>
              )}
              {customer?.phone && (
                <Text size="small" className="text-ui-fg-subtle">
                  📱 {customer.phone}
                </Text>
              )}
              {customer?.created_at && (
                <Text size="small" className="text-ui-fg-subtle">
                  🗓 Cliente desde{" "}
                  {new Date(customer.created_at).toLocaleDateString("es-ES", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </Text>
              )}
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {links.whatsapp && (
              <Button variant="secondary" size="small" asChild>
                <a href={links.whatsapp} target="_blank" rel="noopener noreferrer">
                  💬 WhatsApp
                </a>
              </Button>
            )}
            {customer?.email && (
              <Button variant="secondary" size="small" asChild>
                <a href={`mailto:${customer.email}`}>✉️ Email</a>
              </Button>
            )}
            {links.posthog_person && (
              <Button variant="secondary" size="small" asChild>
                <a href={links.posthog_person} target="_blank" rel="noopener noreferrer">
                  PostHog ↗
                </a>
              </Button>
            )}
            {links.clarity_dashboard && (
              <Button variant="secondary" size="small" asChild>
                <a href={links.clarity_dashboard} target="_blank" rel="noopener noreferrer">
                  Clarity ↗
                </a>
              </Button>
            )}
          </div>
        </div>
      </Container>

      {/* Signals */}
      {signals.length > 0 && (
        <div>
          <Heading level="h2" className="text-ui-fg-base mb-3">
            🚨 Señales detectadas ({signals.length})
          </Heading>
          <div className="flex flex-col gap-3">
            {signals.map((s) => (
              <SignalCard key={s.id} signal={s} customerPhone={customer?.phone} customerEmail={customer?.email} />
            ))}
          </div>
        </div>
      )}

      {signals.length === 0 && (
        <Container className="p-6 text-center">
          <Text className="text-ui-fg-subtle">
            ✅ Sin señales activas de remarketing para este usuario
          </Text>
        </Container>
      )}

      {/* Metrics grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Órdenes" value={medusa_summary.orders_count} />
        <StatCard
          label="LTV"
          value={`$${medusa_summary.lifetime_revenue.toFixed(2)}`}
        />
        <StatCard
          label="AOV"
          value={`$${medusa_summary.avg_order_value.toFixed(2)}`}
        />
        <StatCard
          label="Días desde última orden"
          value={medusa_summary.days_since_last_order ?? "—"}
        />
        <StatCard label="Sesiones" value={posthog_behavior.sessions} />
        <StatCard label="Pageviews" value={posthog_behavior.pageviews} />
        <StatCard label="Vistas de producto" value={posthog_behavior.product_views} />
        <StatCard label="Add to cart" value={posthog_behavior.add_to_carts} />
      </div>

      {/* Top products viewed */}
      {posthog_behavior.top_products_viewed.length > 0 && (
        <Container className="p-4">
          <Heading level="h3" className="text-ui-fg-base mb-3">
            🛍 Productos más vistos
          </Heading>
          <div className="flex flex-col gap-2">
            {posthog_behavior.top_products_viewed.slice(0, 10).map((p, i) => (
              <div
                key={i}
                className="flex items-center justify-between py-1 border-b border-ui-border-base last:border-0"
              >
                <Text size="small" className="text-ui-fg-base">
                  {p.title || p.product_id || "—"}
                </Text>
                <Badge color="blue" size="2xsmall">
                  {p.views}×
                </Badge>
              </div>
            ))}
          </div>
        </Container>
      )}

      {/* Top pages */}
      {posthog_behavior.top_pages.length > 0 && (
        <Container className="p-4">
          <Heading level="h3" className="text-ui-fg-base mb-3">
            📄 Páginas más visitadas
          </Heading>
          <div className="flex flex-col gap-2">
            {posthog_behavior.top_pages.slice(0, 10).map((p, i) => (
              <div
                key={i}
                className="flex items-center justify-between py-1 border-b border-ui-border-base last:border-0"
              >
                <Text size="small" className="text-ui-fg-base truncate">
                  {p.url}
                </Text>
                <Badge color="grey" size="2xsmall">
                  {p.views}×
                </Badge>
              </div>
            ))}
          </div>
        </Container>
      )}

      {/* Remarketing fire history */}
      {fires.length > 0 && (
        <Container className="p-4">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <Heading level="h3" className="text-ui-fg-base">
              📨 Historial de remarketing ({fires_summary.total} en 60d)
            </Heading>
            <div className="flex gap-2">
              <Badge color="green" size="2xsmall">
                {fires_summary.sent} enviados
              </Badge>
              {fires_summary.converted > 0 && (
                <Badge color="green" size="2xsmall">
                  ✅ {fires_summary.converted} convertidos
                </Badge>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-1 max-h-80 overflow-y-auto">
            {fires.map((fire) => (
              <UserFireRow key={fire.id} fire={fire} />
            ))}
          </div>
        </Container>
      )}

      {/* Orders */}
      {medusa_summary.orders.length > 0 && (
        <Container className="p-4">
          <Heading level="h3" className="text-ui-fg-base mb-3">
            📦 Órdenes recientes
          </Heading>
          <div className="flex flex-col gap-2">
            {medusa_summary.orders.slice(0, 10).map((o) => (
              <div
                key={o.id}
                className="flex items-center justify-between py-2 border-b border-ui-border-base last:border-0"
              >
                <div className="flex-1 min-w-0">
                  <Text size="small" className="text-ui-fg-base font-medium">
                    #{o.display_id}
                  </Text>
                  <Text size="xsmall" className="text-ui-fg-subtle truncate">
                    {o.items.map((it) => `${it.quantity}× ${it.title}`).join(", ")}
                  </Text>
                </div>
                <div className="text-right flex-shrink-0 ml-3">
                  <Text size="small" className="text-ui-fg-base font-medium">
                    ${o.total.toFixed(2)}
                  </Text>
                  <Text size="xsmall" className="text-ui-fg-muted">
                    {new Date(o.created_at).toLocaleDateString("es-ES", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </Text>
                </div>
              </div>
            ))}
          </div>
        </Container>
      )}

      {/* Event timeline */}
      {posthog_behavior.recent_events.length > 0 && (
        <Container className="p-4">
          <Heading level="h3" className="text-ui-fg-base mb-3">
            ⏱ Timeline de eventos (últimos {posthog_behavior.recent_events.length} de{" "}
            {posthog_behavior.recent_events_count})
          </Heading>
          <div className="flex flex-col gap-1 max-h-96 overflow-y-auto">
            {posthog_behavior.recent_events.map((ev, i) => (
              <div
                key={i}
                className="flex items-start gap-3 py-1 border-b border-ui-border-base last:border-0"
              >
                <Text size="xsmall" className="text-ui-fg-muted flex-shrink-0 w-32">
                  {new Date(ev.timestamp).toLocaleString("es-ES", {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>
                <Badge color="grey" size="2xsmall" className="flex-shrink-0">
                  {ev.event}
                </Badge>
                <Text size="xsmall" className="text-ui-fg-subtle truncate">
                  {formatEventProps(ev)}
                </Text>
              </div>
            ))}
          </div>
        </Container>
      )}
    </>
  )
}

function UserFireRow({ fire }: { fire: UserFire }) {
  const [expanded, setExpanded] = useState(false)
  const statusColors: Record<string, "green" | "red" | "orange" | "blue" | "grey" | "purple"> = {
    sent: "green",
    converted: "green",
    failed: "red",
    pending: "orange",
    skipped_cooldown: "grey",
    skipped_quiet_hours: "grey",
    skipped_cap: "orange",
    skipped_no_channel: "grey",
    dry_run: "blue",
  }
  const statusLabels: Record<string, string> = {
    sent: "Enviado",
    converted: "Convertido ✅",
    failed: "Fallido",
    pending: "Pendiente",
    skipped_cooldown: "Cooldown",
    skipped_quiet_hours: "Silencio",
    skipped_cap: "Cap",
    skipped_no_channel: "Sin canal",
    dry_run: "Dry-run",
  }
  const ruleNames: Record<string, string> = {
    abandoned_checkout_v2: "Checkout abandonado",
    cart_abandoned_v2: "Carrito abandonado",
    multi_view_no_cart_v2: "Multi-view sin carrito",
    restock_due_v2: "Restock por ciclo",
    win_back_v2: "Win-back",
    coupon_failed_no_purchase: "Cupón fallido (rescate)",
    multiple_abandoned_checkouts: "Lead caliente (Telegram)",
  }
  return (
    <div className="border-b border-ui-border-base last:border-0">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 py-2 text-left hover:bg-ui-bg-subtle px-2 -mx-2 rounded"
      >
        <Text size="xsmall" className="text-ui-fg-muted flex-shrink-0 w-32">
          {new Date(fire.fired_at).toLocaleString("es-ES", {
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </Text>
        <Badge
          color={fire.channel === "whatsapp" ? "green" : fire.channel === "email" ? "blue" : "grey"}
          size="2xsmall"
          className="flex-shrink-0"
        >
          {fire.channel}
        </Badge>
        <Text size="small" className="text-ui-fg-base flex-1 truncate">
          {ruleNames[fire.rule_key] || fire.rule_key}
        </Text>
        <Badge color={statusColors[fire.status] || "grey"} size="2xsmall" className="flex-shrink-0">
          {statusLabels[fire.status] || fire.status}
        </Badge>
      </button>
      {expanded && (
        <div className="bg-ui-bg-subtle p-3 mt-1 rounded text-sm flex flex-col gap-2">
          {fire.subject && (
            <div>
              <Text size="xsmall" className="text-ui-fg-muted">Asunto</Text>
              <Text size="small" className="text-ui-fg-base">{fire.subject}</Text>
            </div>
          )}
          {fire.body && (
            <div>
              <Text size="xsmall" className="text-ui-fg-muted">Mensaje</Text>
              <div className="mt-1 p-2 bg-ui-bg-base rounded text-ui-fg-base whitespace-pre-wrap max-h-32 overflow-y-auto">
                {fire.body}
              </div>
            </div>
          )}
          {fire.error_message && (
            <div>
              <Text size="xsmall" className="text-ui-fg-error">Error</Text>
              <Text size="small" className="text-ui-fg-error">{fire.error_message}</Text>
            </div>
          )}
          {fire.converted_order_id && (
            <Text size="xsmall" className="text-ui-fg-subtle">
              Atribuido a orden <code>{fire.converted_order_id}</code>
              {fire.converted_at && (
                <> · {new Date(fire.converted_at).toLocaleString("es-ES", {
                  day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                })}</>
              )}
            </Text>
          )}
          <Text size="xsmall" className="text-ui-fg-muted">
            Señal: <code>{fire.signal_id}</code> · severidad: {fire.signal_severity}
          </Text>
        </div>
      )}
    </div>
  )
}

function formatEventProps(ev: UserEvent): string {
  const p = ev.properties || {}
  const bits: string[] = []
  if (p.product_title) bits.push(String(p.product_title))
  else if (p.title) bits.push(String(p.title))
  if (p.$current_url || p.path || p.$pathname) {
    const url = String(p.$current_url || p.path || p.$pathname)
    bits.push(url.length > 50 ? url.slice(0, 50) + "…" : url)
  }
  if (p.search_query) bits.push(`"${p.search_query}"`)
  if (p.utm_source) bits.push(`utm:${p.utm_source}`)
  return bits.join(" · ")
}

function SignalCard({
  signal,
  customerPhone,
  customerEmail,
}: {
  signal: Signal
  customerPhone?: string
  customerEmail?: string
}) {
  const color = SEVERITY_COLORS[signal.severity] || "grey"
  const waHref =
    customerPhone && signal.suggested_message
      ? `https://wa.me/${customerPhone.replace(/\D/g, "")}?text=${encodeURIComponent(signal.suggested_message)}`
      : null
  const mailHref =
    customerEmail && signal.suggested_message
      ? `mailto:${customerEmail}?body=${encodeURIComponent(signal.suggested_message)}`
      : null

  return (
    <Container className="p-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge color={color} size="small">
              {SEVERITY_LABELS[signal.severity]}
            </Badge>
            <Text className="text-ui-fg-base font-semibold">{signal.title}</Text>
            <Text size="xsmall" className="text-ui-fg-muted">
              {signal.type}
            </Text>
          </div>
          <Text size="small" className="text-ui-fg-subtle mt-1">
            {signal.description}
          </Text>
          {signal.suggested_message && (
            <div className="mt-2 p-2 bg-ui-bg-subtle rounded text-ui-fg-base">
              <Text size="xsmall" className="text-ui-fg-muted mb-1">
                Mensaje sugerido ({signal.suggested_channel || "—"}):
              </Text>
              <Text size="small" className="whitespace-pre-wrap">
                {signal.suggested_message}
              </Text>
            </div>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          {signal.suggested_channel === "whatsapp" && waHref && (
            <Button variant="primary" size="small" asChild>
              <a href={waHref} target="_blank" rel="noopener noreferrer">
                💬 Enviar WA
              </a>
            </Button>
          )}
          {signal.suggested_channel === "email" && mailHref && (
            <Button variant="primary" size="small" asChild>
              <a href={mailHref}>✉️ Enviar email</a>
            </Button>
          )}
        </div>
      </div>
    </Container>
  )
}

// ─── Patterns Sub-Tab ─────────────────────────────────────────────────────────

interface PatternsSummary {
  generated_at: string
  window_hours: number
  active_abandoned_checkouts: number
  active_cart_abandons: number
  active_multi_view_no_cart: number
  active_restock_due: number
  active_win_back_eligible: number
  vip_customers: number
  total_candidates_72h: number
  friction_products: Array<{ product_id: string; title: string; views: number; distinct_viewers: number }>
  restock_due_products: Array<{ product_id: string; title: string; customers_due: number; avg_cycle_days: number }>
  channel_mix: { email: number; whatsapp: number; manual: number }
  funnel: {
    candidates_7d: number
    signals_7d: number
    fires_7d: number
    sent_7d: number
    converted_7d: number
    conversion_rate_pct: number
    revenue_attributed_7d: number
  }
  rule_performance: Array<{
    rule_key: string
    fires_30d: number
    sent_30d: number
    converted_30d: number
    conversion_rate_pct: number
    revenue_attributed: number
  }>
  fires_by_day: Array<{ day: string; sent: number; failed: number; skipped: number; converted: number }>
  experiments: Array<{
    rule_key: string
    variants: Array<{
      key: string
      fires: number
      sent: number
      converted: number
      conversion_rate: number
      revenue_attributed: number
    }>
    leader: string | null
    lift_pct: number | null
    is_significant: boolean
  }>
}

const RULE_LABELS: Record<string, string> = {
  abandoned_checkout_v2: "Checkout abandonado",
  cart_abandoned_v2: "Carrito abandonado",
  multi_view_no_cart_v2: "Multi-view sin carrito",
  restock_due_v2: "Restock por ciclo",
  win_back_v2: "Win-back",
  coupon_failed_no_purchase: "Cupón fallido (rescate)",
  multiple_abandoned_checkouts: "Lead caliente (Telegram)",
  vip_early_access: "VIP early access",
  loyalty_redemption_nudge: "Loyalty redemption",
  out_of_stock_waitlist: "Volvió al stock (waitlist)",
  variant_explorer_indecision: "Indecisión de variantes",
  search_no_result_followup: "Búsqueda sin resultado",
  cart_value_decreased: "Carrito reducido",
  weekly_visitor_dropped: "Visitante regular perdido",
  post_discount_review: "Pedido de review",
  repurchase_referral: "Referrals (repeat)",
}

function PatternsTab() {
  const [data, setData] = useState<PatternsSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    load()
  }, [])

  async function load(force = false) {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `${API}/admin/remarketing/patterns${force ? "?force=1" : ""}`,
        { credentials: "include" }
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = (await res.json()) as PatternsSummary
      setData(json)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  if (loading && !data) {
    return (
      <Container className="p-8 text-center">
        <Text className="text-ui-fg-subtle">Calculando patrones…</Text>
      </Container>
    )
  }

  if (error) {
    return (
      <Container className="p-4">
        <Text className="text-ui-fg-error">Error: {error}</Text>
        <Button variant="secondary" size="small" onClick={() => load(true)} className="mt-2">
          Reintentar
        </Button>
      </Container>
    )
  }

  if (!data) return null

  const channelTotal = data.channel_mix.email + data.channel_mix.whatsapp + data.channel_mix.manual
  const emailPct = channelTotal > 0 ? Math.round((data.channel_mix.email / channelTotal) * 100) : 0
  const waPct = channelTotal > 0 ? Math.round((data.channel_mix.whatsapp / channelTotal) * 100) : 0

  const maxDayTotal = Math.max(
    1,
    ...data.fires_by_day.map((d) => d.sent + d.failed + d.skipped + d.converted)
  )

  return (
    <div className="flex flex-col gap-6">
      {/* Refresh + timestamp */}
      <div className="flex items-center justify-between">
        <Text size="xsmall" className="text-ui-fg-muted">
          Última actualización:{" "}
          {new Date(data.generated_at).toLocaleString("es-ES", {
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })}
        </Text>
        <Button variant="secondary" size="small" onClick={() => load(true)} isLoading={loading}>
          Recalcular
        </Button>
      </div>

      {/* Active signals grid */}
      <div>
        <Heading level="h2" className="text-ui-fg-base mb-3">
          🚨 Señales activas en la base
        </Heading>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="Checkouts abandonados"
            value={data.active_abandoned_checkouts}
            sub="últimas 72h"
          />
          <StatCard
            label="Carritos abandonados"
            value={data.active_cart_abandons}
            sub="últimas 168h"
          />
          <StatCard
            label="Multi-view sin carrito"
            value={data.active_multi_view_no_cart}
            sub="últimos 14d"
          />
          <StatCard
            label="Restock due"
            value={data.active_restock_due}
            sub="ciclo cumplido"
          />
          <StatCard
            label="Win-back elegibles"
            value={data.active_win_back_eligible}
            sub="sin compra 60d+"
          />
          <StatCard label="Clientes VIP" value={data.vip_customers} sub="LTV ≥ $100" />
          <StatCard
            label="Usuarios activos 72h"
            value={data.total_candidates_72h}
            sub="con eventos"
          />
          <StatCard
            label="Ingresos atribuidos"
            value={`$${data.funnel.revenue_attributed_7d.toFixed(2)}`}
            sub="últimos 30d"
          />
        </div>
      </div>

      {/* Conversion funnel */}
      <Container className="p-4">
        <Heading level="h3" className="text-ui-fg-base mb-4">
          📊 Funnel de conversión (7d)
        </Heading>
        <FunnelBars funnel={data.funnel} />
      </Container>

      {/* Channel mix + activity timeline */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Container className="p-4">
          <Heading level="h3" className="text-ui-fg-base mb-3">
            📡 Mix de canales (7d)
          </Heading>
          <div className="flex flex-col gap-3">
            <ChannelBar label="✉️ Email" count={data.channel_mix.email} pct={emailPct} color="blue" />
            <ChannelBar label="💬 WhatsApp" count={data.channel_mix.whatsapp} pct={waPct} color="green" />
            {data.channel_mix.manual > 0 && (
              <ChannelBar
                label="👤 Manual"
                count={data.channel_mix.manual}
                pct={channelTotal > 0 ? Math.round((data.channel_mix.manual / channelTotal) * 100) : 0}
                color="grey"
              />
            )}
          </div>
          {channelTotal === 0 && (
            <Text size="small" className="text-ui-fg-muted">
              Aún no hay dispatches registrados.
            </Text>
          )}
        </Container>

        <Container className="p-4">
          <Heading level="h3" className="text-ui-fg-base mb-3">
            ⏱ Actividad últimos 7 días
          </Heading>
          {data.fires_by_day.length === 0 ? (
            <Text size="small" className="text-ui-fg-muted">
              Sin actividad aún.
            </Text>
          ) : (
            <div className="flex items-end gap-1 h-32">
              {data.fires_by_day.map((d) => {
                const total = d.sent + d.failed + d.skipped + d.converted
                const heightPct = (total / maxDayTotal) * 100
                return (
                  <div key={d.day} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                    <div className="flex-1 w-full flex flex-col justify-end" title={`${d.day}: sent=${d.sent} conv=${d.converted} failed=${d.failed} skipped=${d.skipped}`}>
                      <div
                        className="w-full bg-ui-bg-interactive rounded-t"
                        style={{ height: `${heightPct}%`, minHeight: total > 0 ? "4px" : "0" }}
                      />
                    </div>
                    <Text size="xsmall" className="text-ui-fg-muted truncate">
                      {d.day.slice(5)}
                    </Text>
                  </div>
                )
              })}
            </div>
          )}
        </Container>
      </div>

      {/* Friction products */}
      {data.friction_products.length > 0 && (
        <Container className="p-4">
          <Heading level="h3" className="text-ui-fg-base mb-3">
            🔥 Productos con fricción — vistos 3+ veces sin add_to_cart (14d)
          </Heading>
          <Text size="xsmall" className="text-ui-fg-muted mb-3">
            Alta intención bloqueada: algo (precio, descripción, imagen) les impide dar el siguiente paso.
            Crea una regla específica por producto para campañas dedicadas.
          </Text>
          <div className="flex flex-col gap-2">
            {data.friction_products.map((p) => (
              <FrictionProductRow key={p.product_id} product={p} />
            ))}
          </div>
        </Container>
      )}

      {/* Restock due products */}
      {data.restock_due_products.length > 0 && (
        <Container className="p-4">
          <Heading level="h3" className="text-ui-fg-base mb-3">
            🔁 Productos con clientes en ventana de reorden
          </Heading>
          <Text size="xsmall" className="text-ui-fg-muted mb-3">
            Basado en ciclo medio de recompra detectado. Prioriza estos para campañas de restock.
          </Text>
          <div className="flex flex-col gap-2">
            {data.restock_due_products.map((p) => (
              <div
                key={p.product_id}
                className="flex items-center justify-between py-2 border-b border-ui-border-base last:border-0"
              >
                <div className="flex-1 min-w-0">
                  <Text size="small" className="text-ui-fg-base font-medium truncate">
                    {p.title || p.product_id}
                  </Text>
                  <Text size="xsmall" className="text-ui-fg-subtle">
                    Ciclo medio: {p.avg_cycle_days}d
                  </Text>
                </div>
                <Badge color="orange" size="2xsmall">
                  {p.customers_due} cliente{p.customers_due !== 1 ? "s" : ""}
                </Badge>
              </div>
            ))}
          </div>
        </Container>
      )}

      {/* Active A/B experiments */}
      {data.experiments.length > 0 && (
        <Container className="p-4">
          <Heading level="h3" className="text-ui-fg-base mb-3">
            🧪 Experimentos A/B activos ({data.experiments.length})
          </Heading>
          <Text size="xsmall" className="text-ui-fg-muted mb-4">
            Reglas con 2+ variantes en producción. Significancia básica: ambos brazos ≥30 sent + lift ≥20%.
          </Text>
          <div className="flex flex-col gap-4">
            {data.experiments.map((exp) => (
              <ExperimentCard key={exp.rule_key} experiment={exp} />
            ))}
          </div>
        </Container>
      )}

      {/* Rule performance (30d) */}
      <Container className="p-4">
        <Heading level="h3" className="text-ui-fg-base mb-3">
          ⚙️ Rendimiento por regla (30d)
        </Heading>
        {data.rule_performance.length === 0 ? (
          <Text size="small" className="text-ui-fg-muted">
            Aún no hay dispatches registrados. Las reglas están activas y se ejecutan cada 15 minutos.
          </Text>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-ui-fg-muted">
                <tr className="border-b border-ui-border-base">
                  <th className="text-left py-2 font-medium">Regla</th>
                  <th className="text-right py-2 font-medium">Fires</th>
                  <th className="text-right py-2 font-medium">Enviados</th>
                  <th className="text-right py-2 font-medium">Convertidos</th>
                  <th className="text-right py-2 font-medium">Conv %</th>
                  <th className="text-right py-2 font-medium">Ingresos atrib.</th>
                </tr>
              </thead>
              <tbody>
                {data.rule_performance.map((r) => (
                  <tr key={r.rule_key} className="border-b border-ui-border-base last:border-0">
                    <td className="py-2 text-ui-fg-base">
                      {RULE_LABELS[r.rule_key] || r.rule_key}
                    </td>
                    <td className="py-2 text-right text-ui-fg-base">{r.fires_30d}</td>
                    <td className="py-2 text-right text-ui-fg-base">{r.sent_30d}</td>
                    <td className="py-2 text-right text-ui-fg-base">{r.converted_30d}</td>
                    <td className="py-2 text-right text-ui-fg-base">
                      {r.conversion_rate_pct.toFixed(1)}%
                    </td>
                    <td className="py-2 text-right text-ui-fg-base">
                      ${r.revenue_attributed.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Container>
    </div>
  )
}

function ExperimentCard({
  experiment,
}: {
  experiment: PatternsSummary["experiments"][number]
}) {
  const ruleName = RULE_LABELS[experiment.rule_key] || experiment.rule_key
  const totalFires = experiment.variants.reduce((s, v) => s + v.fires, 0)
  const maxConv = Math.max(0.01, ...experiment.variants.map((v) => v.conversion_rate))

  return (
    <div className="border border-ui-border-base rounded-lg p-3 flex flex-col gap-3 bg-ui-bg-base">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <Text className="text-ui-fg-base font-semibold">{ruleName}</Text>
          <Badge color="grey" size="2xsmall">{experiment.variants.length} variantes</Badge>
          <Badge color="purple" size="2xsmall">{totalFires} fires</Badge>
        </div>
        <div className="flex items-center gap-2">
          {experiment.lift_pct != null && (
            <Badge
              color={experiment.is_significant ? "green" : "grey"}
              size="small"
            >
              Lift{" "}
              {experiment.lift_pct >= 0 ? "+" : ""}
              {experiment.lift_pct.toFixed(1)}%
              {experiment.is_significant ? " ✓" : ""}
            </Badge>
          )}
          {experiment.leader && (
            <Badge color="green" size="small">
              👑 Líder: {experiment.leader}
            </Badge>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {experiment.variants.map((v) => {
          const isLeader = v.key === experiment.leader
          const widthPct = (v.conversion_rate / maxConv) * 100
          return (
            <div key={v.key} className="flex items-center gap-3">
              <div className="w-12 flex-shrink-0">
                <Badge
                  color={isLeader ? "green" : "purple"}
                  size="2xsmall"
                >
                  {v.key}
                </Badge>
              </div>
              <div className="flex-1 h-6 bg-ui-bg-subtle rounded relative overflow-hidden">
                <div
                  className={isLeader ? "bg-ui-tag-green-bg h-full" : "bg-ui-bg-interactive h-full"}
                  style={{ width: `${Math.max(2, widthPct)}%` }}
                />
                <div className="absolute inset-0 flex items-center px-2">
                  <Text size="xsmall" className="text-ui-fg-base font-medium">
                    {v.conversion_rate.toFixed(2)}% conv
                  </Text>
                </div>
              </div>
              <Text size="xsmall" className="text-ui-fg-muted w-32 text-right flex-shrink-0">
                {v.sent} sent · {v.converted} conv
              </Text>
              <Text size="xsmall" className="text-ui-fg-base font-medium w-20 text-right flex-shrink-0">
                ${v.revenue_attributed.toFixed(0)}
              </Text>
            </div>
          )
        })}
      </div>

      {!experiment.is_significant && experiment.lift_pct != null && (
        <Text size="xsmall" className="text-ui-fg-muted">
          ⏳ Aún no significativo — sigue acumulando data antes de declarar ganador.
        </Text>
      )}
    </div>
  )
}

function FrictionProductRow({
  product,
}: {
  product: { product_id: string; title: string; views: number; distinct_viewers: number }
}) {
  const [creating, setCreating] = useState(false)

  async function handleCreateRule() {
    const slug = (product.title || product.product_id)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 50)
    const ruleKey = `friction_${slug}`
    if (
      !confirm(
        `Crear regla "${ruleKey}" para ${product.title}?\n\n` +
        `Disparará cuando un usuario vea este producto 3+ veces sin agregarlo al carrito (14d).\n` +
        `Canal: email · Cooldown 168h · Cap diario 20 · Inicialmente DESACTIVADA.`
      )
    ) return
    setCreating(true)
    try {
      const rule = {
        key: ruleKey,
        name: `Fricción: ${product.title}`.slice(0, 250),
        description: `Auto-generada desde 🔍 Patrones. Apunta a usuarios que vieron "${product.title}" 3+ veces sin add_to_cart.`,
        enabled: false,
        priority: 55,
        cooldown_hours: 168,
        channel: "email" as const,
        match_signal_id: `multi_view_no_cart:${product.product_id}`,
        min_severity: "medium" as const,
        email_subject_template: `¿Dudas con ${product.title}? Te ayudamos`,
        email_html_template: null,
        whatsapp_template: `Hola 👋 Te veo interesado en ${product.title}. Si tienes dudas (precio, calidad, envío), responde por aquí — te ayudo en el momento.`,
        quiet_hours_start: 22,
        quiet_hours_end: 9,
        daily_cap: 20,
      }
      const res = await fetch(`${API}/admin/remarketing/rules`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rule),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      toast.success(
        `Regla "${ruleKey}" creada. Actívala en ⚡ Motor de reglas para que el cron empiece a disparar.`
      )
    } catch (err) {
      toast.error(`Error: ${(err as Error).message}`)
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-ui-border-base last:border-0">
      <div className="flex-1 min-w-0">
        <Text size="small" className="text-ui-fg-base font-medium truncate">
          {product.title || product.product_id}
        </Text>
        <Text size="xsmall" className="text-ui-fg-subtle">
          {product.distinct_viewers} usuario{product.distinct_viewers !== 1 ? "s" : ""} únicos
        </Text>
      </div>
      <Badge color="red" size="2xsmall">
        {product.views} vistas
      </Badge>
      <Button
        variant="secondary"
        size="small"
        isLoading={creating}
        onClick={handleCreateRule}
      >
        + Regla
      </Button>
    </div>
  )
}

function FunnelBars({ funnel }: { funnel: PatternsSummary["funnel"] }) {
  const stages = [
    { label: "Candidatos", value: funnel.candidates_7d, color: "bg-ui-bg-interactive" },
    { label: "Señales detectadas", value: funnel.signals_7d, color: "bg-ui-bg-interactive" },
    { label: "Fires creados", value: funnel.fires_7d, color: "bg-ui-bg-interactive" },
    { label: "Enviados", value: funnel.sent_7d, color: "bg-ui-bg-interactive" },
    { label: "Convertidos", value: funnel.converted_7d, color: "bg-ui-tag-green-bg" },
  ]
  const max = Math.max(1, ...stages.map((s) => s.value))
  return (
    <div className="flex flex-col gap-3">
      {stages.map((s) => {
        const pct = (s.value / max) * 100
        return (
          <div key={s.label} className="flex items-center gap-3">
            <Text size="small" className="text-ui-fg-subtle w-48 flex-shrink-0">
              {s.label}
            </Text>
            <div className="flex-1 h-6 bg-ui-bg-subtle rounded relative overflow-hidden">
              <div
                className={`${s.color} h-full transition-all`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <Text size="small" className="text-ui-fg-base font-medium w-16 text-right flex-shrink-0">
              {s.value}
            </Text>
          </div>
        )
      })}
      <div className="flex items-center justify-between pt-2 border-t border-ui-border-base">
        <Text size="small" className="text-ui-fg-subtle">Tasa de conversión (sent → converted)</Text>
        <Badge color={funnel.conversion_rate_pct > 5 ? "green" : funnel.conversion_rate_pct > 1 ? "orange" : "grey"}>
          {funnel.conversion_rate_pct.toFixed(2)}%
        </Badge>
      </div>
    </div>
  )
}

function ChannelBar({
  label,
  count,
  pct,
  color,
}: {
  label: string
  count: number
  pct: number
  color: "blue" | "green" | "grey"
}) {
  const bgClass =
    color === "blue"
      ? "bg-ui-tag-blue-bg"
      : color === "green"
      ? "bg-ui-tag-green-bg"
      : "bg-ui-bg-subtle"
  return (
    <div className="flex items-center gap-3">
      <Text size="small" className="text-ui-fg-subtle w-28 flex-shrink-0">
        {label}
      </Text>
      <div className="flex-1 h-6 bg-ui-bg-subtle rounded relative overflow-hidden">
        <div className={`${bgClass} h-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <Text size="small" className="text-ui-fg-base font-medium w-20 text-right flex-shrink-0">
        {count} ({pct}%)
      </Text>
    </div>
  )
}

// ─── Rules Engine Sub-Tab ─────────────────────────────────────────────────────

interface RuleStatsRow {
  rule_key: string
  fires_total: number
  fires_24h: number
  fires_7d: number
  fires_30d: number
  sent: number
  failed: number
  converted: number
  conversion_rate: number
  revenue_attributed: number
}

interface VariantStatsRow {
  rule_key: string
  variant: string
  fires: number
  sent: number
  converted: number
  conversion_rate: number
  revenue_attributed: number
}

interface Rule {
  key: string
  name: string
  description?: string | null
  enabled: boolean
  priority: number
  cooldown_hours: number
  channel: "email" | "whatsapp" | "auto" | "manual" | "team_alert"
  match_signal_id?: string | null
  match_signal_prefix?: string | null
  min_severity?: "high" | "medium" | "low" | "info"
  email_subject_template?: string | null
  email_html_template?: string | null
  whatsapp_template?: string | null
  quiet_hours_start?: number | null
  quiet_hours_end?: number | null
  daily_cap?: number | null
  variants?: unknown | null
  geo_overrides?: unknown | null
  variant_stats: VariantStatsRow[]
  stats: RuleStatsRow
}

interface Fire {
  id: string
  rule_key: string
  customer_id: string | null
  email: string | null
  phone: string | null
  distinct_id: string | null
  signal_id: string
  signal_severity: string
  channel: string
  status: string
  subject: string | null
  body: string | null
  error_message: string | null
  fired_at: string
  converted_order_id: string | null
  converted_at: string | null
  context: Record<string, unknown> | null
}

const FIRE_STATUS_COLORS: Record<string, "green" | "red" | "orange" | "blue" | "grey" | "purple"> = {
  sent: "green",
  converted: "green",
  failed: "red",
  pending: "orange",
  skipped_cooldown: "grey",
  skipped_quiet_hours: "grey",
  skipped_cap: "orange",
  skipped_no_channel: "grey",
  dry_run: "blue",
}

const FIRE_STATUS_LABELS: Record<string, string> = {
  sent: "Enviado",
  converted: "Convertido",
  failed: "Fallido",
  pending: "Pendiente",
  skipped_cooldown: "Cooldown",
  skipped_quiet_hours: "Horario silencio",
  skipped_cap: "Cap diario",
  skipped_no_channel: "Sin canal",
  dry_run: "Dry-run",
}

function RulesEngineTab({
  campaigns = [],
  onJumpToCampaigns,
}: {
  campaigns?: Array<{ key: string; enabled: boolean }>
  onJumpToCampaigns?: () => void
}) {
  const [rules, setRules] = useState<Rule[]>([])
  const [fires, setFires] = useState<Fire[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedRule, setExpandedRule] = useState<string | null>(null)
  const [fireFilter, setFireFilter] = useState<{ rule_key?: string; status?: string }>({})
  const [running, setRunning] = useState<"dry" | "real" | null>(null)
  const [expandedFire, setExpandedFire] = useState<string | null>(null)

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    loadFires()
  }, [fireFilter])

  async function load() {
    setLoading(true)
    try {
      await Promise.all([loadRules(), loadFires()])
    } finally {
      setLoading(false)
    }
  }

  async function loadRules() {
    const res = await fetch(`${API}/admin/remarketing/rules`, { credentials: "include" })
    if (res.ok) {
      const j = await res.json()
      setRules(j.rules || [])
    }
  }

  async function loadFires() {
    const qs = new URLSearchParams()
    if (fireFilter.rule_key) qs.set("rule_key", fireFilter.rule_key)
    if (fireFilter.status) qs.set("status", fireFilter.status)
    qs.set("since_hours", "168")
    qs.set("limit", "100")
    const res = await fetch(`${API}/admin/remarketing/fires?${qs}`, { credentials: "include" })
    if (res.ok) {
      const j = await res.json()
      setFires(j.fires || [])
    }
  }

  async function handleToggleRule(key: string, enabled: boolean) {
    setRules((prev) =>
      prev.map((r) => (r.key === key ? { ...r, enabled } : r))
    )
    try {
      const res = await fetch(`${API}/admin/remarketing/rules?action=toggle`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, enabled }),
      })
      if (!res.ok) throw new Error()
      toast.success(`Regla "${key}" ${enabled ? "activada" : "desactivada"}`)
    } catch {
      toast.error("Error al cambiar el estado")
      // rollback
      setRules((prev) =>
        prev.map((r) => (r.key === key ? { ...r, enabled: !enabled } : r))
      )
    }
  }

  async function handleSaveRule(rule: Rule) {
    try {
      const res = await fetch(`${API}/admin/remarketing/rules`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rule),
      })
      if (!res.ok) throw new Error()
      toast.success("Regla guardada")
      await loadRules()
      setExpandedRule(null)
    } catch {
      toast.error("Error al guardar")
    }
  }

  async function handleRunEngine(dryRun: boolean) {
    setRunning(dryRun ? "dry" : "real")
    try {
      const res = await fetch(`${API}/admin/remarketing/engine/run`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dry_run: dryRun }),
      })
      if (!res.ok) throw new Error()
      const j = await res.json()
      toast.success(
        `${dryRun ? "Dry-run" : "Ejecución"} terminado: ${j.candidates_scanned} candidatos · ` +
        `${j.signals_detected} señales · ${j.fires_sent} enviados · ` +
        `${j.fires_skipped} skip · ${j.fires_failed} fails`
      )
      await Promise.all([loadRules(), loadFires()])
    } catch (err) {
      toast.error(`Error: ${(err as Error).message || "desconocido"}`)
    } finally {
      setRunning(null)
    }
  }

  if (loading) {
    return (
      <Container className="p-8 text-center">
        <Text className="text-ui-fg-subtle">Cargando motor de reglas…</Text>
      </Container>
    )
  }

  const enabledCount = rules.filter((r) => r.enabled).length

  return (
    <div className="flex flex-col gap-6">
      {/* Engine controls */}
      <Container className="p-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <Heading level="h3" className="text-ui-fg-base">
              ⚡ Motor de reglas
            </Heading>
            <Text size="small" className="text-ui-fg-subtle mt-1">
              {enabledCount} / {rules.length} reglas activas · cron corre cada 15 min
            </Text>
          </div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="small"
              onClick={() => handleRunEngine(true)}
              isLoading={running === "dry"}
              disabled={running !== null}
            >
              🧪 Dry-run
            </Button>
            <Button
              variant="primary"
              size="small"
              onClick={() => handleRunEngine(false)}
              isLoading={running === "real"}
              disabled={running !== null}
            >
              ▶️ Ejecutar ahora
            </Button>
          </div>
        </div>
      </Container>

      {/* Rules list */}
      <div>
        <Heading level="h3" className="text-ui-fg-base mb-3">
          Reglas configuradas
        </Heading>
        <div className="flex flex-col gap-3">
          {rules.map((rule) => {
            const legacyType = RULE_KEY_TO_LEGACY_TYPE[rule.key]
            const linkedCampaign = legacyType
              ? campaigns.find((c) => c.key === legacyType)
              : undefined
            const linkedCampaignInfo = linkedCampaign
              ? {
                  key: linkedCampaign.key,
                  label: TYPE_LABELS[linkedCampaign.key] || linkedCampaign.key,
                  enabled: linkedCampaign.enabled,
                }
              : undefined
            return (
              <RuleCard
                key={rule.key}
                rule={rule}
                expanded={expandedRule === rule.key}
                onToggleExpand={() =>
                  setExpandedRule(expandedRule === rule.key ? null : rule.key)
                }
                onToggleEnabled={(enabled) => handleToggleRule(rule.key, enabled)}
                onSave={handleSaveRule}
                linkedCampaign={linkedCampaignInfo}
                onJumpToCampaigns={onJumpToCampaigns}
              />
            )
          })}
        </div>
      </div>

      {/* Live feed */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <Heading level="h3" className="text-ui-fg-base">
            📡 Feed de dispatches (7d)
          </Heading>
          <Button variant="transparent" size="small" onClick={loadFires}>
            Refrescar
          </Button>
        </div>

        {/* Filters */}
        <Container className="p-3 mb-3">
          <div className="flex gap-2 flex-wrap items-center">
            <Text size="xsmall" className="text-ui-fg-subtle">Filtrar:</Text>
            <select
              value={fireFilter.rule_key || ""}
              onChange={(e) =>
                setFireFilter((f) => ({ ...f, rule_key: e.target.value || undefined }))
              }
              className="bg-ui-bg-base border border-ui-border-base rounded px-2 py-1 text-sm text-ui-fg-base"
            >
              <option value="">Todas las reglas</option>
              {rules.map((r) => (
                <option key={r.key} value={r.key}>
                  {r.name}
                </option>
              ))}
            </select>
            <select
              value={fireFilter.status || ""}
              onChange={(e) =>
                setFireFilter((f) => ({ ...f, status: e.target.value || undefined }))
              }
              className="bg-ui-bg-base border border-ui-border-base rounded px-2 py-1 text-sm text-ui-fg-base"
            >
              <option value="">Todos los estados</option>
              {Object.entries(FIRE_STATUS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            {(fireFilter.rule_key || fireFilter.status) && (
              <Button variant="transparent" size="small" onClick={() => setFireFilter({})}>
                Limpiar
              </Button>
            )}
          </div>
        </Container>

        <Container className="p-0 overflow-hidden">
          {fires.length === 0 ? (
            <div className="p-8 text-center">
              <Text className="text-ui-fg-muted">
                No hay dispatches registrados. El próximo tick del cron los procesará.
              </Text>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-ui-bg-subtle">
                  <tr>
                    <th className="text-left p-2 text-ui-fg-muted font-medium">Hora</th>
                    <th className="text-left p-2 text-ui-fg-muted font-medium">Regla</th>
                    <th className="text-left p-2 text-ui-fg-muted font-medium">Usuario</th>
                    <th className="text-left p-2 text-ui-fg-muted font-medium">Canal</th>
                    <th className="text-left p-2 text-ui-fg-muted font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {fires.map((fire) => (
                    <FireRow
                      key={fire.id}
                      fire={fire}
                      rules={rules}
                      expanded={expandedFire === fire.id}
                      onToggleExpand={() =>
                        setExpandedFire(expandedFire === fire.id ? null : fire.id)
                      }
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Container>
      </div>
    </div>
  )
}

function RuleCard({
  rule,
  expanded,
  onToggleExpand,
  onToggleEnabled,
  onSave,
  linkedCampaign,
  onJumpToCampaigns,
}: {
  rule: Rule
  expanded: boolean
  onToggleExpand: () => void
  onToggleEnabled: (enabled: boolean) => void
  onSave: (rule: Rule) => void
  linkedCampaign?: { key: string; label: string; enabled: boolean }
  onJumpToCampaigns?: () => void
}) {
  const [draft, setDraft] = useState<Rule>(rule)

  useEffect(() => {
    setDraft(rule)
  }, [rule])

  const matchLabel = rule.match_signal_prefix
    ? `${rule.match_signal_prefix}*`
    : rule.match_signal_id || "—"

  return (
    <Container className="p-0 overflow-hidden">
      {/* Header row */}
      <div className="p-4 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Switch
            checked={rule.enabled}
            onCheckedChange={onToggleEnabled}
            disabled={false}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Text className="text-ui-fg-base font-semibold">{rule.name}</Text>
              <Badge color="grey" size="2xsmall">
                {matchLabel}
              </Badge>
              <Badge
                color={rule.channel === "whatsapp" ? "green" : rule.channel === "email" ? "blue" : "grey"}
                size="2xsmall"
              >
                {rule.channel}
              </Badge>
              <Badge color="purple" size="2xsmall">
                p={rule.priority}
              </Badge>
              {linkedCampaign && (
                <Badge
                  color={linkedCampaign.enabled ? "blue" : "grey"}
                  size="2xsmall"
                >
                  🔗 {linkedCampaign.label}{" "}
                  {linkedCampaign.enabled ? "activa" : "inactiva"}
                </Badge>
              )}
            </div>
            <Text size="xsmall" className="text-ui-fg-subtle mt-1">
              Cooldown {rule.cooldown_hours}h · Cap {rule.daily_cap ?? "∞"}/día ·
              Fires 30d: {rule.stats.fires_30d} · Conv: {rule.stats.conversion_rate.toFixed(1)}% ·
              Ingresos atrib.: ${rule.stats.revenue_attributed.toFixed(2)}
            </Text>
            {linkedCampaign && onJumpToCampaigns && (
              <Text size="xsmall" className="text-ui-fg-muted mt-1">
                Comparte dedup con campaña old{" "}
                <button
                  type="button"
                  onClick={onJumpToCampaigns}
                  className="underline hover:text-ui-fg-base"
                >
                  {linkedCampaign.label} →
                </button>
              </Text>
            )}
          </div>
        </div>
        <Button variant="transparent" size="small" onClick={onToggleExpand}>
          {expanded ? "Cerrar" : "Editar"}
        </Button>
      </div>

      {/* Expanded editor */}
      {expanded && (
        <div className="p-4 border-t border-ui-border-base bg-ui-bg-subtle flex flex-col gap-4">
          <div>
            <Label htmlFor={`name-${rule.key}`} className="text-ui-fg-base mb-1 block">
              Nombre
            </Label>
            <Input
              id={`name-${rule.key}`}
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </div>

          <div>
            <Label htmlFor={`desc-${rule.key}`} className="text-ui-fg-base mb-1 block">
              Descripción
            </Label>
            <Textarea
              id={`desc-${rule.key}`}
              rows={2}
              value={draft.description || ""}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <Label className="text-ui-fg-base mb-1 block text-xs">Canal</Label>
              <select
                value={draft.channel}
                onChange={(e) => setDraft({ ...draft, channel: e.target.value as Rule["channel"] })}
                className="w-full bg-ui-bg-base border border-ui-border-base rounded px-2 py-1 text-sm text-ui-fg-base"
              >
                <option value="auto">Auto (WA si phone, email si no)</option>
                <option value="email">Email</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="team_alert">Team alert (Telegram interno)</option>
                <option value="manual">Manual (solo alerta visual)</option>
              </select>
            </div>
            <div>
              <Label className="text-ui-fg-base mb-1 block text-xs">Severidad mínima</Label>
              <select
                value={draft.min_severity || "medium"}
                onChange={(e) =>
                  setDraft({ ...draft, min_severity: e.target.value as Rule["min_severity"] })
                }
                className="w-full bg-ui-bg-base border border-ui-border-base rounded px-2 py-1 text-sm text-ui-fg-base"
              >
                <option value="high">Alta</option>
                <option value="medium">Media</option>
                <option value="low">Baja</option>
                <option value="info">Info</option>
              </select>
            </div>
            <div>
              <Label className="text-ui-fg-base mb-1 block text-xs">Prioridad</Label>
              <Input
                type="number"
                value={draft.priority}
                onChange={(e) => setDraft({ ...draft, priority: Number(e.target.value) })}
              />
            </div>
            <div>
              <Label className="text-ui-fg-base mb-1 block text-xs">Cooldown (horas)</Label>
              <Input
                type="number"
                value={draft.cooldown_hours}
                onChange={(e) => setDraft({ ...draft, cooldown_hours: Number(e.target.value) })}
              />
            </div>
            <div>
              <Label className="text-ui-fg-base mb-1 block text-xs">Cap diario</Label>
              <Input
                type="number"
                value={draft.daily_cap ?? ""}
                placeholder="sin límite"
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    daily_cap: e.target.value === "" ? null : Number(e.target.value),
                  })
                }
              />
            </div>
            <div>
              <Label className="text-ui-fg-base mb-1 block text-xs">Silencio desde (0-23)</Label>
              <Input
                type="number"
                min={0}
                max={23}
                value={draft.quiet_hours_start ?? ""}
                placeholder="—"
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    quiet_hours_start: e.target.value === "" ? null : Number(e.target.value),
                  })
                }
              />
            </div>
            <div>
              <Label className="text-ui-fg-base mb-1 block text-xs">Silencio hasta (0-23)</Label>
              <Input
                type="number"
                min={0}
                max={23}
                value={draft.quiet_hours_end ?? ""}
                placeholder="—"
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    quiet_hours_end: e.target.value === "" ? null : Number(e.target.value),
                  })
                }
              />
            </div>
            <div>
              <Label className="text-ui-fg-base mb-1 block text-xs">Signal match</Label>
              <Text size="xsmall" className="text-ui-fg-muted py-1">
                {matchLabel} (no editable)
              </Text>
            </div>
          </div>

          <div>
            <Label htmlFor={`emsub-${rule.key}`} className="text-ui-fg-base mb-1 block">
              Asunto email (placeholders: {"{first_name}, {product}, {products}, {cycle_days}"})
            </Label>
            <Input
              id={`emsub-${rule.key}`}
              value={draft.email_subject_template || ""}
              onChange={(e) =>
                setDraft({ ...draft, email_subject_template: e.target.value })
              }
            />
          </div>

          <div>
            <Label htmlFor={`emhtml-${rule.key}`} className="text-ui-fg-base mb-1 block">
              HTML email (opcional, si vacío se usa la descripción de la señal)
            </Label>
            <Textarea
              id={`emhtml-${rule.key}`}
              rows={4}
              value={draft.email_html_template || ""}
              onChange={(e) =>
                setDraft({ ...draft, email_html_template: e.target.value })
              }
            />
          </div>

          <div>
            <Label htmlFor={`watxt-${rule.key}`} className="text-ui-fg-base mb-1 block">
              Texto WhatsApp
            </Label>
            <Textarea
              id={`watxt-${rule.key}`}
              rows={3}
              value={draft.whatsapp_template || ""}
              onChange={(e) => setDraft({ ...draft, whatsapp_template: e.target.value })}
            />
          </div>

          {/* A/B Variants */}
          <VariantEditor
            value={draft.variants}
            onChange={(v) => setDraft({ ...draft, variants: v })}
          />

          {/* Geo overrides per city */}
          <GeoOverridesRuleEditor
            value={draft.geo_overrides}
            onChange={(v) => setDraft({ ...draft, geo_overrides: v })}
          />

          {/* Variant performance */}
          {rule.variant_stats.length > 0 && (
            <div>
              <Label className="text-ui-fg-base mb-2 block">📊 Rendimiento por variante (30d)</Label>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-ui-fg-muted">
                    <tr className="border-b border-ui-border-base">
                      <th className="text-left py-2 font-medium">Variante</th>
                      <th className="text-right py-2 font-medium">Fires</th>
                      <th className="text-right py-2 font-medium">Enviados</th>
                      <th className="text-right py-2 font-medium">Convertidos</th>
                      <th className="text-right py-2 font-medium">Conv %</th>
                      <th className="text-right py-2 font-medium">Ingresos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rule.variant_stats.map((v) => (
                      <tr key={v.variant} className="border-b border-ui-border-base last:border-0">
                        <td className="py-2 text-ui-fg-base">
                          <Badge color="purple" size="2xsmall">{v.variant}</Badge>
                        </td>
                        <td className="py-2 text-right text-ui-fg-base">{v.fires}</td>
                        <td className="py-2 text-right text-ui-fg-base">{v.sent}</td>
                        <td className="py-2 text-right text-ui-fg-base">{v.converted}</td>
                        <td className="py-2 text-right text-ui-fg-base">{v.conversion_rate.toFixed(1)}%</td>
                        <td className="py-2 text-right text-ui-fg-base">${v.revenue_attributed.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" size="small" onClick={() => setDraft(rule)}>
              Descartar
            </Button>
            <Button variant="primary" size="small" onClick={() => onSave(draft)}>
              Guardar cambios
            </Button>
          </div>
        </div>
      )}
    </Container>
  )
}

function GeoOverridesRuleEditor({
  value,
  onChange,
}: {
  value: unknown
  onChange: (v: unknown) => void
}) {
  const [text, setText] = useState(() =>
    value ? JSON.stringify(value, null, 2) : ""
  )
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setText(value ? JSON.stringify(value, null, 2) : "")
    setError(null)
  }, [value])

  const handleChange = (raw: string) => {
    setText(raw)
    if (!raw.trim()) {
      onChange(null)
      setError(null)
      return
    }
    try {
      const parsed = JSON.parse(raw)
      if (typeof parsed !== "object" || Array.isArray(parsed) || parsed == null) {
        setError("Debe ser un objeto { city: { templates… } }")
        return
      }
      // Validate shape: each value should be an object with optional template fields
      for (const [city, ovr] of Object.entries(parsed)) {
        if (!ovr || typeof ovr !== "object" || Array.isArray(ovr)) {
          setError(`Override para "${city}" debe ser objeto`)
          return
        }
        const allowed = ["email_subject_template", "email_html_template", "whatsapp_template"]
        for (const k of Object.keys(ovr as object)) {
          if (!allowed.includes(k)) {
            setError(`Campo no soportado en "${city}": ${k}`)
            return
          }
        }
      }
      setError(null)
      onChange(parsed)
    } catch (err) {
      setError("JSON inválido: " + (err as Error).message)
    }
  }

  return (
    <div>
      <Label className="text-ui-fg-base mb-1 block">
        🌍 Geo overrides por ciudad (JSON, opcional)
      </Label>
      <Text size="xsmall" className="text-ui-fg-muted mb-2">
        Override de templates por ciudad. Las claves se comparan en minúsculas con la ciudad
        del último envío del cliente. Sólo se permiten estos campos por ciudad:{" "}
        <code>email_subject_template</code>, <code>email_html_template</code>,{" "}
        <code>whatsapp_template</code>.
        <br />
        Precedencia: variante &gt; geo &gt; template base.
      </Text>
      <Textarea
        rows={5}
        value={text}
        placeholder={`{
  "caracas": { "whatsapp_template": "Caracas: tu {product} te espera 🛒" },
  "maracaibo": { "whatsapp_template": "Maracay/Maracaibo: ..." }
}`}
        onChange={(e) => handleChange(e.target.value)}
        className="font-mono text-xs"
      />
      {error && (
        <Text size="xsmall" className="text-ui-fg-error mt-1">{error}</Text>
      )}
    </div>
  )
}

function VariantEditor({
  value,
  onChange,
}: {
  value: unknown
  onChange: (v: unknown) => void
}) {
  const [text, setText] = useState(() =>
    value ? JSON.stringify(value, null, 2) : ""
  )
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setText(value ? JSON.stringify(value, null, 2) : "")
    setError(null)
  }, [value])

  const handleChange = (raw: string) => {
    setText(raw)
    if (!raw.trim()) {
      onChange(null)
      setError(null)
      return
    }
    try {
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) {
        setError("Debe ser un array de variantes")
        return
      }
      const valid = parsed.every(
        (v) => v && typeof v.key === "string" && typeof v.weight === "number"
      )
      if (!valid) {
        setError("Cada variante necesita { key: string, weight: number }")
        return
      }
      setError(null)
      onChange(parsed)
    } catch (err) {
      setError("JSON inválido: " + (err as Error).message)
    }
  }

  return (
    <div>
      <Label className="text-ui-fg-base mb-1 block">
        🧪 A/B Variants (JSON, opcional)
      </Label>
      <Text size="xsmall" className="text-ui-fg-muted mb-2">
        Array de variantes con <code>key</code>, <code>weight</code>, y opcionalmente sus propios templates.
        Si está vacío, se usa el template base. Hash determinístico por usuario.
      </Text>
      <Textarea
        rows={5}
        value={text}
        placeholder={`[
  { "key": "A", "weight": 50, "whatsapp_template": "Hola {first_name}, te ayudo?" },
  { "key": "B", "weight": 50, "whatsapp_template": "{first_name}! Tu carrito te espera 🛒" }
]`}
        onChange={(e) => handleChange(e.target.value)}
        className="font-mono text-xs"
      />
      {error && (
        <Text size="xsmall" className="text-ui-fg-error mt-1">{error}</Text>
      )}
    </div>
  )
}

function FireRow({
  fire,
  rules,
  expanded,
  onToggleExpand,
}: {
  fire: Fire
  rules: Rule[]
  expanded: boolean
  onToggleExpand: () => void
}) {
  const ruleName = rules.find((r) => r.key === fire.rule_key)?.name || fire.rule_key
  const statusColor = FIRE_STATUS_COLORS[fire.status] || "grey"
  const userLabel = fire.email || fire.phone || fire.customer_id || fire.distinct_id || "—"

  return (
    <>
      <tr
        className="border-b border-ui-border-base hover:bg-ui-bg-subtle cursor-pointer"
        onClick={onToggleExpand}
      >
        <td className="p-2 text-ui-fg-muted text-xs whitespace-nowrap">
          {new Date(fire.fired_at).toLocaleString("es-ES", {
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </td>
        <td className="p-2 text-ui-fg-base">
          <span className="text-xs">{ruleName}</span>
          <div className="text-ui-fg-muted text-xs mt-0.5">{fire.signal_id}</div>
        </td>
        <td className="p-2 text-ui-fg-base text-xs truncate max-w-xs">{userLabel}</td>
        <td className="p-2">
          <Badge
            color={fire.channel === "whatsapp" ? "green" : fire.channel === "email" ? "blue" : "grey"}
            size="2xsmall"
          >
            {fire.channel}
          </Badge>
        </td>
        <td className="p-2">
          <Badge color={statusColor} size="2xsmall">
            {FIRE_STATUS_LABELS[fire.status] || fire.status}
          </Badge>
        </td>
      </tr>
      {expanded && (
        <tr className="bg-ui-bg-subtle border-b border-ui-border-base">
          <td colSpan={5} className="p-4">
            <div className="flex flex-col gap-3">
              {fire.subject && (
                <div>
                  <Text size="xsmall" className="text-ui-fg-muted">Asunto</Text>
                  <Text size="small" className="text-ui-fg-base font-medium">{fire.subject}</Text>
                </div>
              )}
              {fire.body && (
                <div>
                  <Text size="xsmall" className="text-ui-fg-muted">Cuerpo</Text>
                  <div className="mt-1 p-2 bg-ui-bg-base rounded text-sm text-ui-fg-base whitespace-pre-wrap max-h-48 overflow-y-auto">
                    {fire.body}
                  </div>
                </div>
              )}
              {fire.error_message && (
                <div>
                  <Text size="xsmall" className="text-ui-fg-error">Error</Text>
                  <Text size="small" className="text-ui-fg-error">{fire.error_message}</Text>
                </div>
              )}
              {fire.converted_order_id && (
                <div>
                  <Badge color="green">✅ Convertido</Badge>
                  <Text size="xsmall" className="text-ui-fg-subtle mt-1">
                    Orden: {fire.converted_order_id} ·{" "}
                    {fire.converted_at &&
                      new Date(fire.converted_at).toLocaleString("es-ES", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                  </Text>
                </div>
              )}
              <div className="flex gap-4 flex-wrap text-xs text-ui-fg-muted">
                {fire.email && <span>✉️ {fire.email}</span>}
                {fire.phone && <span>📱 {fire.phone}</span>}
                {fire.customer_id && <span>👤 {fire.customer_id.slice(0, 20)}…</span>}
                {fire.distinct_id && <span>🆔 {fire.distinct_id.slice(0, 20)}…</span>}
                <span>🎯 severity: {fire.signal_severity}</span>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

export const config = defineRouteConfig({
  label: "Remarketing",
  icon: Envelope,
})
