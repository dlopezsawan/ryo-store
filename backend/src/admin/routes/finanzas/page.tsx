"use client"

import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Container, Heading, Text, Badge, Button, Input, Select, Tabs, Table, Drawer } from "@medusajs/ui"
import { useState, useEffect, useCallback, useMemo } from "react"
import {
  CurrencyDollar, Trash, Plus, ArrowDownTray, ArrowUpRightOnBox,
  ArrowsPointingOut, MagnifyingGlass, ArrowPathMini, ChevronDownMini,
  ChevronRightMini, Cog6Tooth, ReceiptPercent,
} from "@medusajs/icons"

const API = "https://api.enrola.shop"

// ───── Theme tokens (use CSS vars so dark mode just works) ────────────────────
const T = {
  bgBase:    "var(--color-ui-bg-base, #1c1c1f)",
  bgSubtle:  "var(--color-ui-bg-subtle, #131316)",
  bgHover:   "var(--color-ui-bg-base-hover, #26262b)",
  border:    "var(--color-ui-border-base, #2e2e32)",
  borderStr: "var(--color-ui-border-strong, #3a3a40)",
  fgBase:    "var(--color-ui-fg-base, #f9fafb)",
  fgSubtle:  "var(--color-ui-fg-subtle, #6b7280)",
  fgMuted:   "var(--color-ui-fg-muted, #9ca3af)",
  warn:      "#facc15",
  warnBg:    "rgba(250,204,21,0.10)",
  rose:      "#fb7185",
  rose20:    "rgba(251,113,133,0.18)",
  green:     "#4ade80",
  green20:   "rgba(74,222,128,0.18)",
  amber:     "#fbbf24",
  amber20:   "rgba(251,191,36,0.18)",
  indigo:    "#818cf8",
  indigo20:  "rgba(129,140,248,0.18)",
  slate:     "#94a3b8",
  slate20:   "rgba(148,163,184,0.18)",
}

// Bucket → accent color mapping (used everywhere consistently).
const BUCKET_COLORS: Record<string, string> = {
  restock:        T.amber,
  gastos_fijos:   T.rose,
  marketing:      T.indigo,
  ganancia:       T.green,
  comisiones_pago: T.slate,
  envios:         T.slate,
  otros:          T.slate,
}
const BUCKET_LABELS: Record<string, string> = {
  restock: "Restock",
  gastos_fijos: "Gastos fijos",
  marketing: "Marketing",
  ganancia: "Ganancia",
  comisiones_pago: "Comisiones",
  envios: "Envíos",
  otros: "Otros",
}

// ───── Types ──────────────────────────────────────────────────────────────────
type Currency = "eur" | "bs" | "usdt"

type Summary = {
  month: string
  totals: {
    orders: number
    revenue_eur: number
    revenue_bs: number
    revenue_usdt_theoretical: number
    cogs_eur: number
    margin_eur: number
    bs_pending: number
  }
  splits: Record<
    "restock" | "gastos_fijos" | "marketing" | "ganancia",
    { eur: number; usdt: number; spent_usdt: number }
  >
  wallets: Array<{ id: string; name: string; currency: string; balance: number }>
  alerts: { missing_cost: number; negative_margin: number }
}

type PagoMovil = {
  id: string
  order_id: string
  order_display_id: number
  customer_name: string | null
  cedula: string | null
  customer_phone: string | null
  amount_eur_subtotal: number
  amount_eur_discount: number
  amount_eur_total: number
  amount_bs_total: number
  amount_usdt_theoretical: number
  amount_eur_cogs: number
  amount_eur_margin: number
  bs_converted_total: number
  bs_pending: number
  status: string
  cogs_complete: boolean
  margin_negative: boolean
  split_restock_eur: number
  split_gastos_fijos_eur: number
  split_marketing_eur: number
  split_ganancia_eur: number
  split_restock_bs: number
  split_gastos_fijos_bs: number
  split_marketing_bs: number
  split_ganancia_bs: number
  split_restock_usdt: number
  split_gastos_fijos_usdt: number
  split_marketing_usdt: number
  split_ganancia_usdt: number
  bcv_eur_rate: number
  usdt_eur_rate: number
  payment_proof_url: string | null
  notes: string | null
  created_at: string
}
type PagoMovilLine = {
  id: string
  pago_movil_id: string
  product_handle: string | null
  title: string
  quantity: number
  unit_price_eur: number
  line_revenue_eur: number
  unit_cost_eur: number | null
  line_cost_eur: number | null
  line_margin_eur: number | null
}
type Conversion = {
  id: string
  pago_movil_id: string
  amount_bs: number
  amount_usdt: number
  rate_bs_per_usdt: number
  source_wallet_id: string | null
  dest_wallet_id: string | null
  note: string | null
  converted_at: string
}
type Wallet = { id: string; name: string; currency: string; is_active: boolean }
type SplitRule = { id: string; bucket: string; percentage: number; description?: string | null }
type ExpenseCategory = {
  id: string
  name: string
  bucket: string
  is_recurring: boolean
  recurring_amount_usdt: number | null
  recurring_day_of_month: number | null
  is_active: boolean
}
type Expense = {
  id: string
  category_id: string
  description: string
  amount_usdt: number
  amount_bs: number | null
  rate_bs_per_usdt: number | null
  paid_from_wallet_id: string | null
  receipt_url: string | null
  expense_date: string
  notes: string | null
}
type ProductCost = {
  id: string
  variant_id: string
  product_handle: string | null
  variant_title: string | null
  unit_cost_eur: number
  notes: string | null
}
type ProductVariant = {
  variant_id: string
  product_handle: string
  product_title: string
  variant_title: string | null
  sku: string | null
}

// Unified movement row for the Movimientos ledger.
type MovementType = "ingreso" | "gasto" | "conversion"
type Movement = {
  key: string                       // unique id (prefixed by type)
  type: MovementType
  date: string                      // ISO
  description: string
  bucket?: string | null            // bucket label, when applicable
  category?: string | null          // expense category name
  related_order?: number | null     // order display id, for ingresos / conversions
  amount_eur: number | null         // null when not applicable
  amount_bs: number | null
  amount_usdt: number | null
  status?: string | null
  raw: PagoMovil | Expense | (Conversion & { _parent: PagoMovil | undefined })
}

// ───── Helpers ────────────────────────────────────────────────────────────────
const fmtMoney = (n: number | null | undefined, currency: Currency): string => {
  if (n == null) return "—"
  const v = Number(n) || 0
  if (currency === "bs")   return `Bs ${v.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  if (currency === "usdt") return `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  return `€${v.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString("es-VE", { day: "2-digit", month: "2-digit", year: "numeric" })
const fmtDateTime = (s: string) =>
  new Date(s).toLocaleString("es-VE", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })

async function api<R = unknown>(path: string, init?: RequestInit): Promise<R> {
  const res = await fetch(`${API}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    ...init,
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error((data as { error?: string }).error || `HTTP ${res.status}`)
  }
  return res.json() as Promise<R>
}

// ───── Reusable visual atoms ──────────────────────────────────────────────────
function Panel({ children, padded = true, style }: { children: React.ReactNode; padded?: boolean; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: T.bgBase,
      border: `1px solid ${T.border}`,
      borderRadius: 12,
      overflow: "hidden",
      ...style,
    }}>
      <div style={{ padding: padded ? 14 : 0 }}>{children}</div>
    </div>
  )
}

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0
  return (
    <div style={{ height: 6, background: T.bgSubtle, borderRadius: 999, overflow: "hidden" }}>
      <div style={{
        width: `${pct}%`,
        height: "100%",
        background: color,
        transition: "width 300ms ease",
      }} />
    </div>
  )
}

function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return null
  const w = 80, h = 24
  const min = Math.min(...values), max = Math.max(...values)
  const range = max - min || 1
  const step = w / (values.length - 1)
  const pts = values.map((v, i) => `${i * step},${h - ((v - min) / range) * h}`).join(" ")
  return (
    <svg width={w} height={h} style={{ display: "block" }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function BucketPill({ bucket }: { bucket: string }) {
  const color = BUCKET_COLORS[bucket] || T.slate
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 4,
      padding: "2px 8px",
      borderRadius: 999,
      fontSize: 11,
      fontWeight: 600,
      color,
      background: `${color}22`,
    }}>
      {BUCKET_LABELS[bucket] || bucket}
    </span>
  )
}

function TypeIcon({ type }: { type: MovementType }) {
  if (type === "ingreso") {
    return <span style={{ color: T.green, fontSize: 16, fontWeight: 700 }}>↑</span>
  }
  if (type === "gasto") {
    return <span style={{ color: T.rose, fontSize: 16, fontWeight: 700 }}>↓</span>
  }
  return <span style={{ color: T.indigo, fontSize: 16, fontWeight: 700 }}>↻</span>
}

function CurrencySwitch({ value, onChange }: { value: Currency; onChange: (v: Currency) => void }) {
  const opts: Array<{ v: Currency; label: string }> = [
    { v: "eur",  label: "EUR" },
    { v: "bs",   label: "Bs" },
    { v: "usdt", label: "USDT" },
  ]
  return (
    <div style={{ display: "inline-flex", border: `1px solid ${T.border}`, borderRadius: 8, overflow: "hidden" }}>
      {opts.map((o) => (
        <button
          key={o.v}
          onClick={() => onChange(o.v)}
          style={{
            padding: "6px 12px",
            background: value === o.v ? T.bgHover : "transparent",
            color: value === o.v ? T.fgBase : T.fgMuted,
            border: "none",
            cursor: "pointer",
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function MonthPicker({ value, onChange }: { value: string; onChange: (m: string) => void }) {
  // value is YYYY-MM
  const [y, m] = value.split("-").map(Number)
  const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]
  const shift = (delta: number) => {
    const d = new Date(Date.UTC(y, m - 1 + delta, 1))
    onChange(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`)
  }
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 4, border: `1px solid ${T.border}`, borderRadius: 8, padding: 2 }}>
      <button onClick={() => shift(-1)} style={{ background: "transparent", border: "none", color: T.fgMuted, cursor: "pointer", padding: "4px 8px" }}>‹</button>
      <span style={{ color: T.fgBase, fontSize: 13, fontWeight: 600, minWidth: 86, textAlign: "center" }}>
        {months[m - 1]} {y}
      </span>
      <button onClick={() => shift(+1)} style={{ background: "transparent", border: "none", color: T.fgMuted, cursor: "pointer", padding: "4px 8px" }}>›</button>
    </div>
  )
}

// ───── Monthly trend (last N months bar chart + MoM/YoY chips) ───────────────
function MonthlyTrend({ months, currency, currentMonth, setMonth }: {
  months: Array<{
    month: string
    revenue: { eur: number; bs: number; usdt_theoretical: number }
    margin_eur: number
    cogs_eur: number
    expenses_paid_usdt: number
  }>
  currency: Currency
  currentMonth: string
  setMonth: (m: string) => void
}) {
  if (!months || months.length === 0) return null

  const pickRev = (b: { revenue: { eur: number; bs: number; usdt_theoretical: number } }) =>
    currency === "eur" ? b.revenue.eur : currency === "bs" ? b.revenue.bs : b.revenue.usdt_theoretical
  const pickMargin = (b: { margin_eur: number }) =>
    currency === "bs" ? b.margin_eur * 567 : currency === "usdt" ? b.margin_eur / 1.08 : b.margin_eur
  const pickExp = (b: { expenses_paid_usdt: number }) =>
    currency === "eur" ? b.expenses_paid_usdt * 1.08 : currency === "bs" ? b.expenses_paid_usdt * 612 : b.expenses_paid_usdt

  const maxRev = Math.max(1, ...months.map(pickRev))

  // MoM and YoY for last bucket vs prior
  const last = months[months.length - 1]
  const prev = months[months.length - 2]
  const yoyIdx = months.length - 13
  const yoy = yoyIdx >= 0 ? months[yoyIdx] : null
  const delta = (cur: number, p: number) => (p > 0 ? (cur - p) / p : null)

  const fmtDelta = (d: number | null) => {
    if (d == null) return null
    const sign = d >= 0 ? "+" : ""
    const color = d >= 0 ? T.green : T.rose
    return <span style={{ color, fontWeight: 600 }}>{sign}{(d * 100).toFixed(1)}%</span>
  }

  const monthLabel = (k: string) => {
    const [, m] = k.split("-").map(Number)
    return ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"][m - 1]
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
        <Heading level="h3" style={{ fontSize: 14, color: T.fgBase }}>Tendencia mensual ({months.length} meses)</Heading>
        <div style={{ display: "flex", gap: 12, fontSize: 12, color: T.fgSubtle }}>
          {prev && <span>MoM ingresos: {fmtDelta(delta(pickRev(last), pickRev(prev)))}</span>}
          {yoy && <span>YoY ingresos: {fmtDelta(delta(pickRev(last), pickRev(yoy)))}</span>}
        </div>
      </div>
      <div style={{
        background: T.bgBase, border: `1px solid ${T.border}`, borderRadius: 12, padding: "16px 14px",
      }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: `repeat(${months.length}, minmax(0, 1fr))`,
          alignItems: "end",
          gap: 6,
          height: 140,
        }}>
          {months.map((b) => {
            const rev = pickRev(b)
            const mar = Math.max(0, pickMargin(b))
            const exp = Math.max(0, pickExp(b))
            const heightPct = (rev / maxRev) * 100
            const marPct = rev > 0 ? (mar / rev) * heightPct : 0
            const expPct = rev > 0 ? (exp / rev) * heightPct : 0
            const isCurrent = b.month === currentMonth
            return (
              <button
                key={b.month}
                onClick={() => setMonth(b.month)}
                title={`${b.month}: ${fmtMoney(rev, currency)} ingresos · ${fmtMoney(mar, currency)} margen · ${fmtMoney(exp, currency)} gastos`}
                style={{
                  position: "relative",
                  height: "100%",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "flex-end",
                  padding: 0,
                  gap: 2,
                }}
              >
                {/* Revenue bar (full) */}
                <div style={{
                  width: "100%",
                  height: `${heightPct}%`,
                  background: isCurrent ? T.indigo : `${T.indigo}88`,
                  borderRadius: "3px 3px 0 0",
                  transition: "all 200ms ease",
                  position: "relative",
                }}>
                  {/* Margin overlay (green at bottom of revenue bar) */}
                  <div style={{
                    position: "absolute", bottom: 0, left: 0, right: 0,
                    height: rev > 0 ? `${(mar / rev) * 100}%` : 0,
                    background: T.green,
                    opacity: 0.8,
                    borderRadius: "3px 3px 0 0",
                  }} />
                  {/* Expenses tick (rose line over the margin) */}
                  {exp > 0 && (
                    <div style={{
                      position: "absolute", bottom: rev > 0 ? `${(exp / rev) * 100}%` : 0,
                      left: 0, right: 0, height: 2, background: T.rose,
                    }} />
                  )}
                </div>
                <div style={{ fontSize: 10, color: isCurrent ? T.fgBase : T.fgSubtle, fontWeight: isCurrent ? 700 : 400 }}>
                  {monthLabel(b.month)}
                </div>
              </button>
            )
          })}
        </div>
        <div style={{ display: "flex", gap: 16, fontSize: 11, color: T.fgSubtle, marginTop: 12, justifyContent: "center" }}>
          <span><span style={{ display: "inline-block", width: 10, height: 10, background: T.indigo, marginRight: 4, verticalAlign: "middle" }}></span>Ingresos</span>
          <span><span style={{ display: "inline-block", width: 10, height: 10, background: T.green, marginRight: 4, verticalAlign: "middle" }}></span>Margen bruto</span>
          <span><span style={{ display: "inline-block", width: 10, height: 2, background: T.rose, marginRight: 4, verticalAlign: "middle" }}></span>Gastos pagados</span>
        </div>
      </div>
    </div>
  )
}

// ───── Donut: split share visualization ──────────────────────────────────────
function SplitDonut({ splits, currency }: {
  splits: Record<"restock" | "gastos_fijos" | "marketing" | "ganancia", { eur: number; usdt: number }>
  currency: Currency
}) {
  const pickAmount = (b: { eur: number; usdt: number }) =>
    currency === "eur" ? b.eur : currency === "usdt" ? b.usdt : b.eur
  const items = (["restock", "gastos_fijos", "marketing", "ganancia"] as const).map((k) => ({
    key: k,
    label: BUCKET_LABELS[k],
    color: BUCKET_COLORS[k],
    value: pickAmount(splits[k]),
  }))
  const total = items.reduce((s, i) => s + i.value, 0)
  if (total <= 0) return null

  const size = 120
  const stroke = 16
  const r = (size - stroke) / 2
  const cx = size / 2, cy = size / 2
  const circumference = 2 * Math.PI * r
  let offset = 0

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
      <svg width={size} height={size} style={{ flexShrink: 0 }}>
        {/* track */}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={T.border} strokeWidth={stroke} />
        {items.map((it) => {
          if (it.value <= 0) return null
          const slice = (it.value / total) * circumference
          const dasharray = `${slice} ${circumference - slice}`
          const dashoffset = -offset
          offset += slice
          return (
            <circle
              key={it.key}
              cx={cx} cy={cy} r={r}
              fill="none"
              stroke={it.color}
              strokeWidth={stroke}
              strokeDasharray={dasharray}
              strokeDashoffset={dashoffset}
              transform={`rotate(-90 ${cx} ${cy})`}
            />
          )
        })}
        <text x={cx} y={cy - 2} textAnchor="middle" fill={T.fgBase} fontSize="12" fontWeight={700}>
          {fmtMoney(total, currency)}
        </text>
        <text x={cx} y={cy + 12} textAnchor="middle" fill={T.fgMuted} fontSize="8" textTransform="uppercase">
          margen total
        </text>
      </svg>
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
        {items.map((it) => {
          const pct = total > 0 ? (it.value / total) * 100 : 0
          return (
            <div key={it.key} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, minWidth: 0 }}>
              <span style={{ width: 10, height: 10, background: it.color, borderRadius: 2, display: "inline-block", flexShrink: 0 }} />
              <span style={{ color: T.fgBase, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.label}</span>
              <span style={{ color: T.fgSubtle, textAlign: "right", flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>{pct.toFixed(0)}%</span>
              <span style={{ color: T.fgBase, textAlign: "right", fontWeight: 600, flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>
                {fmtMoney(it.value, currency)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ───── Tesoreria types ──────────────────────────────────────────────────────
type RunwayPayload = {
  usdt_balance: number
  monthly_burn_target_usdt: number
  monthly_burn_actual_usdt: number
  monthly_burn_used_usdt: number
  runway_months: number | null
  level: "critical" | "warning" | "ok"
  history_3m: Array<{ month: string; spent_usdt: number }>
}
type BreakevenPayload = {
  monthly_fixed_usdt: number
  monthly_fixed_eur: number
  avg_margin_per_order_eur: number
  breakeven_orders: number | null
  current_month: {
    orders: number
    margin_eur: number
    margin_usdt: number
    orders_progress_pct: number
    margin_coverage_pct: number
  }
}
type RecommenderPayload = {
  recommendation: "convertir_ahora" | "esperar" | "neutral" | "no_data"
  message: string
  bs_pending: number
  estimated_usdt_at_paralelo: number | null
  latest_snapshot: {
    taken_at: string
    bcv_eur: number
    bcv_usd: number
    paralelo_usdt: number | null
    spread_ratio: number
    spread_pct: number
  } | null
  stats_30d?: {
    samples: number
    avg_spread_pct: number
    zscore: number
    min_ratio: number
    max_ratio: number
  }
}
type SpreadPlPayload = {
  period: string
  conversions: Array<{
    id: string
    converted_at: string
    order_display_id: number | null
    customer_name: string | null
    amount_bs: number
    actual_usdt: number
    actual_rate: number
    bcv_usd_at_conversion: number | null
    theoretical_usdt_at_bcv: number | null
    spread_gain_usdt: number | null
    spread_gain_pct: number | null
  }>
  totals: {
    conversions: number
    bs_converted: number
    actual_usdt: number
    theoretical_usdt_at_bcv: number
    spread_gain_usdt: number
    spread_gain_pct: number
  }
}
type RestockRow = {
  variant_id: string
  product_handle: string | null
  title: string
  units_sold: number
  daily_velocity: number
  current_stock: number
  days_remaining: number | null
  recommended_qty: number
  unit_cost_eur: number
  restock_cost_usdt: number
  urgency: "critical" | "warning" | "ok"
}
type RestockPayload = {
  window_days: number
  rows: RestockRow[]
  summary: {
    critical: number
    warning: number
    ok: number
    total_restock_cost_usdt: number
  }
}
// FA2: per-location restock detail + warehouse balance.
type RestockDetailRow = {
  product_handle: string
  product_title: string
  variant_title: string
  variant_id: string
  location_name: string
  location_id: string
  stocked: number
  reserved: number
  available: number
  sold_30d: number
  days_of_cover: number | null
  risk: "critical" | "low" | "stale" | "ok"
}
type RestockDetailPayload = {
  window_days: number
  rows: RestockDetailRow[]
  summary: { critical: number; low: number; stale: number; ok: number }
}
type WarehouseDistributionRow = {
  warehouse: string
  orders: number
  revenue_eur: number
  share_pct: number
}
type WarehouseDistributionPayload = {
  month: string
  total_orders: number
  rows: WarehouseDistributionRow[]
  imbalance_pct: number
  gini: number
}
type WalletSparklineData = Array<{ date: string; balance_eod: number; daily_change: number }>

// ───── Tesoreria UI components ───────────────────────────────────────────────
function RunwayCard({ runway }: { runway: RunwayPayload }) {
  const color =
    runway.level === "critical" ? T.rose :
    runway.level === "warning"  ? T.amber : T.green
  const months = runway.runway_months
  return (
    <div style={{
      background: T.bgBase, border: `1px solid ${T.border}`, borderLeft: `4px solid ${color}`,
      borderRadius: 12, padding: "14px 16px",
    }}>
      <div style={{ color: T.fgMuted, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".06em" }}>
        Runway
      </div>
      <div style={{ color: T.fgBase, fontSize: 28, fontWeight: 700, marginTop: 6 }}>
        {months != null ? `${months}` : "—"}
        <span style={{ fontSize: 14, color: T.fgSubtle, fontWeight: 500, marginLeft: 4 }}>meses</span>
      </div>
      <div style={{ color: T.fgSubtle, fontSize: 11, marginTop: 4 }}>
        Saldo USDT: <b style={{ color: T.fgBase }}>${runway.usdt_balance.toFixed(2)}</b>
      </div>
      <div style={{ color: T.fgSubtle, fontSize: 11 }}>
        Burn mensual: <b style={{ color: T.fgBase }}>${runway.monthly_burn_used_usdt.toFixed(2)}</b>
      </div>
      {runway.level === "critical" && (
        <div style={{ color: T.rose, fontSize: 11, marginTop: 6, fontWeight: 600 }}>
          ⚠ Crítico — convertí Bs y/o reducí gastos
        </div>
      )}
    </div>
  )
}

function BreakevenCard({ breakeven }: { breakeven: BreakevenPayload }) {
  const cur = breakeven.current_month
  const targetOrders = breakeven.breakeven_orders ?? 0
  return (
    <div style={{
      background: T.bgBase, border: `1px solid ${T.border}`, borderLeft: `4px solid ${T.indigo}`,
      borderRadius: 12, padding: "14px 16px",
    }}>
      <div style={{ color: T.fgMuted, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".06em" }}>
        Punto de equilibrio
      </div>
      <div style={{ color: T.fgBase, fontSize: 22, fontWeight: 700, marginTop: 6 }}>
        {targetOrders > 0 ? `${cur.orders} / ${targetOrders}` : "—"}
        <span style={{ fontSize: 12, color: T.fgSubtle, fontWeight: 500, marginLeft: 4 }}>órdenes</span>
      </div>
      {targetOrders > 0 && (
        <>
          <div style={{ marginTop: 6 }}>
            <ProgressBar value={cur.orders} max={targetOrders} color={T.indigo} />
          </div>
          <div style={{ color: T.fgSubtle, fontSize: 11, marginTop: 4 }}>
            {cur.orders_progress_pct}% · Cobertura margen {cur.margin_coverage_pct}%
          </div>
        </>
      )}
      <div style={{ color: T.fgSubtle, fontSize: 11, marginTop: 4 }}>
        Margen prom/orden: <b style={{ color: T.fgBase }}>€{breakeven.avg_margin_per_order_eur.toFixed(2)}</b>
      </div>
      <div style={{ color: T.fgSubtle, fontSize: 11 }}>
        Costos fijos: <b style={{ color: T.fgBase }}>${breakeven.monthly_fixed_usdt.toFixed(2)}/mes</b>
      </div>
    </div>
  )
}

function RecommenderCard({ recommender }: { recommender: RecommenderPayload }) {
  const r = recommender.recommendation
  const color =
    r === "convertir_ahora" ? T.green :
    r === "esperar" ? T.amber :
    r === "neutral" ? T.indigo : T.slate
  const label =
    r === "convertir_ahora" ? "Convertir ahora" :
    r === "esperar" ? "Esperá" :
    r === "neutral" ? "Neutral" : "Sin datos"
  const ls = recommender.latest_snapshot
  return (
    <div style={{
      background: T.bgBase, border: `1px solid ${T.border}`, borderLeft: `4px solid ${color}`,
      borderRadius: 12, padding: "14px 16px",
    }}>
      <div style={{ color: T.fgMuted, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".06em" }}>
        Recomendador de conversión
      </div>
      <div style={{ color, fontSize: 16, fontWeight: 700, marginTop: 6 }}>{label}</div>
      <div style={{ color: T.fgSubtle, fontSize: 11, marginTop: 4 }}>{recommender.message}</div>
      {ls && (
        <div style={{ display: "flex", gap: 8, marginTop: 8, fontSize: 11, color: T.fgMuted }}>
          <span>Spread: <b style={{ color: T.fgBase }}>{ls.spread_pct.toFixed(1)}%</b></span>
          <span>Paralelo: <b style={{ color: T.fgBase }}>{ls.paralelo_usdt ? ls.paralelo_usdt.toFixed(2) : "—"}</b></span>
        </div>
      )}
      {recommender.bs_pending > 0 && recommender.estimated_usdt_at_paralelo != null && (
        <div style={{ color: T.fgSubtle, fontSize: 11, marginTop: 4 }}>
          {recommender.bs_pending.toFixed(0)} Bs pendientes ≈ <b style={{ color: T.fgBase }}>${recommender.estimated_usdt_at_paralelo}</b>
        </div>
      )}
    </div>
  )
}

function SpreadCard({ spread }: { spread: SpreadPlPayload }) {
  const gain = spread.totals.spread_gain_usdt
  const color = gain >= 0 ? T.green : T.rose
  return (
    <div style={{
      background: T.bgBase, border: `1px solid ${T.border}`, borderLeft: `4px solid ${color}`,
      borderRadius: 12, padding: "14px 16px",
    }}>
      <div style={{ color: T.fgMuted, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".06em" }}>
        Spread cambiario
      </div>
      <div style={{ color, fontSize: 22, fontWeight: 700, marginTop: 6 }}>
        {gain >= 0 ? "+" : ""}${gain.toFixed(2)}
      </div>
      <div style={{ color: T.fgSubtle, fontSize: 11, marginTop: 4 }}>
        {spread.totals.conversions} conversiones · {(spread.totals.spread_gain_pct * 100).toFixed(1)}% sobre BCV
      </div>
      <div style={{ color: T.fgSubtle, fontSize: 11 }}>
        Recibido ${spread.totals.actual_usdt.toFixed(2)} vs BCV ${spread.totals.theoretical_usdt_at_bcv.toFixed(2)}
      </div>
    </div>
  )
}

function TesoreriaSection({ runway, breakeven, recommender, spread }: {
  runway: RunwayPayload | null
  breakeven: BreakevenPayload | null
  recommender: RecommenderPayload | null
  spread: SpreadPlPayload | null
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <SectionTitle>Tesorería</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
        {runway && <RunwayCard runway={runway} />}
        {breakeven && <BreakevenCard breakeven={breakeven} />}
        {recommender && <RecommenderCard recommender={recommender} />}
        {spread && spread.totals.conversions > 0 && <SpreadCard spread={spread} />}
      </div>
    </div>
  )
}

function RestockSection({ data }: { data: RestockPayload | null }) {
  if (!data || data.rows.length === 0) return null
  return (
    <div>
      <SectionTitle>Predicción de restock ({data.window_days} días)</SectionTitle>
      {(data.summary.critical > 0 || data.summary.warning > 0) && (
        <div style={{
          background: T.warnBg, border: `1px solid ${T.warn}`, borderRadius: 10,
          padding: "8px 12px", color: T.fgBase, fontSize: 13, marginBottom: 10,
        }}>
          {data.summary.critical > 0 && <span style={{ color: T.rose, fontWeight: 600 }}>⚠ {data.summary.critical} crítico(s)</span>}
          {data.summary.critical > 0 && data.summary.warning > 0 && " · "}
          {data.summary.warning > 0 && <span style={{ color: T.amber }}>⚠ {data.summary.warning} próximo(s) a agotarse</span>}
          {" · "}
          <span style={{ color: T.fgSubtle }}>Reposición sugerida: <b style={{ color: T.fgBase }}>${data.summary.total_restock_cost_usdt.toFixed(2)}</b></span>
        </div>
      )}
      <Panel padded={false}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead style={{ background: T.bgSubtle }}>
            <tr>
              <th style={thStyle()}>Producto</th>
              <th style={thStyle({ textAlign: "right" })}>Vendidos</th>
              <th style={thStyle({ textAlign: "right" })}>Vel. diaria</th>
              <th style={thStyle({ textAlign: "right" })}>Stock</th>
              <th style={thStyle({ textAlign: "right" })}>Días</th>
              <th style={thStyle({ textAlign: "right" })}>Sugerido</th>
              <th style={thStyle({ textAlign: "right" })}>Costo</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r) => {
              const c = r.urgency === "critical" ? T.rose : r.urgency === "warning" ? T.amber : T.fgSubtle
              return (
                <tr key={r.variant_id} style={{ borderTop: `1px solid ${T.border}` }}>
                  <td style={{ padding: "6px 14px", color: T.fgBase }}>{r.title}</td>
                  <td style={{ padding: "6px 14px", textAlign: "right", color: T.fgSubtle, fontVariantNumeric: "tabular-nums" }}>{r.units_sold}</td>
                  <td style={{ padding: "6px 14px", textAlign: "right", color: T.fgSubtle, fontVariantNumeric: "tabular-nums" }}>{r.daily_velocity}</td>
                  <td style={{ padding: "6px 14px", textAlign: "right", color: T.fgBase, fontVariantNumeric: "tabular-nums" }}>{r.current_stock}</td>
                  <td style={{ padding: "6px 14px", textAlign: "right", color: c, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                    {r.days_remaining ?? "∞"}
                  </td>
                  <td style={{ padding: "6px 14px", textAlign: "right", color: T.fgBase, fontVariantNumeric: "tabular-nums" }}>{r.recommended_qty}</td>
                  <td style={{ padding: "6px 14px", textAlign: "right", color: T.fgBase, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                    ${r.restock_cost_usdt.toFixed(2)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </Panel>
    </div>
  )
}

// ───── Operations detail (FA2: stock per location + warehouse balance) ──────
const RISK_LABEL: Record<RestockDetailRow["risk"], string> = {
  critical: "crítico",
  low: "bajo",
  stale: "estancado",
  ok: "ok",
}
const RISK_COLOR: Record<RestockDetailRow["risk"], string> = {
  critical: "#ef4444",  // T.rose
  low: "#f59e0b",       // T.amber
  stale: "#64748b",     // T.slate
  ok: "#10b981",        // T.green
}

function OperationsDetailSection({
  restockDetail, warehouseDist, currency,
}: {
  restockDetail: RestockDetailPayload | null
  warehouseDist: WarehouseDistributionPayload | null
  currency: Currency
}) {
  if (!restockDetail && !warehouseDist) return null
  const moneyCcy: Currency = currency === "bs" ? "eur" : currency
  const rdRows = restockDetail?.rows ?? []
  const whRows = warehouseDist?.rows ?? []
  // Gini interpretation: <0.2 balanced; 0.2-0.4 moderate; >0.4 concentrated
  const giniLabel = (() => {
    const g = warehouseDist?.gini ?? 0
    if (g < 0.2) return { text: "balanceado", color: T.green }
    if (g < 0.4) return { text: "moderado", color: T.amber }
    return { text: "concentrado", color: T.rose }
  })()

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <SectionTitle>Operaciones — stock por ubicación &amp; warehouses</SectionTitle>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.6fr) minmax(0, 1fr)", gap: 16, alignItems: "start" }}>
        {/* Per (variant × location) detail */}
        <Panel padded={false}>
          <div style={{
            padding: "10px 14px", borderBottom: `1px solid ${T.border}`,
            color: T.fgBase, fontWeight: 600, fontSize: 13,
            display: "flex", justifyContent: "space-between", alignItems: "baseline",
          }}>
            <span>📦 Stock × ubicación (top 30 por urgencia)</span>
            {restockDetail && (
              <span style={{ color: T.fgSubtle, fontSize: 11, fontWeight: 400 }}>
                {restockDetail.summary.critical > 0 && (
                  <span style={{ color: T.rose, fontWeight: 600 }}>
                    {restockDetail.summary.critical} crítico{restockDetail.summary.critical > 1 ? "s" : ""}
                  </span>
                )}
                {restockDetail.summary.critical > 0 && restockDetail.summary.low > 0 && " · "}
                {restockDetail.summary.low > 0 && (
                  <span style={{ color: T.amber }}>{restockDetail.summary.low} bajo</span>
                )}
                {restockDetail.summary.stale > 0 && (
                  <> · <span style={{ color: T.slate }}>{restockDetail.summary.stale} estancado</span></>
                )}
              </span>
            )}
          </div>
          {rdRows.length === 0 ? (
            <div style={{ padding: 20, color: T.fgSubtle, textAlign: "center", fontSize: 13 }}>
              Sin inventario registrado.
            </div>
          ) : (
            <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
              <thead style={{ background: T.bgSubtle }}>
                <tr>
                  <th style={thStyle()}>Producto</th>
                  <th style={thStyle()}>Variante</th>
                  <th style={thStyle()}>Ubicación</th>
                  <th style={thStyle({ textAlign: "right" })}>Stock</th>
                  <th style={thStyle({ textAlign: "right" })}>Vendidos 30d</th>
                  <th style={thStyle({ textAlign: "right" })}>Días cobertura</th>
                  <th style={thStyle()}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {rdRows.map((r, i) => {
                  const c = RISK_COLOR[r.risk]
                  return (
                    <tr key={`${r.variant_id}|${r.location_id}|${i}`} style={{ borderTop: `1px solid ${T.border}` }}>
                      <td style={{ padding: "6px 14px", color: T.fgBase }}>{r.product_title}</td>
                      <td style={{ padding: "6px 14px", color: T.fgSubtle, fontSize: 11 }}>{r.variant_title}</td>
                      <td style={{ padding: "6px 14px", color: T.fgSubtle, fontSize: 11 }}>{r.location_name}</td>
                      <td style={{ padding: "6px 14px", textAlign: "right", color: T.fgBase, fontVariantNumeric: "tabular-nums" }}>
                        {r.stocked}
                        {r.reserved > 0 && (
                          <span style={{ color: T.fgSubtle, fontSize: 10 }}> ({r.reserved} res.)</span>
                        )}
                      </td>
                      <td style={{ padding: "6px 14px", textAlign: "right", color: T.fgSubtle, fontVariantNumeric: "tabular-nums" }}>
                        {r.sold_30d}
                      </td>
                      <td style={{ padding: "6px 14px", textAlign: "right", color: c, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                        {r.days_of_cover !== null ? `${r.days_of_cover}d` : "—"}
                      </td>
                      <td style={{ padding: "6px 14px" }}>
                        <span style={{
                          background: c, color: "white", padding: "2px 8px",
                          borderRadius: 999, fontSize: 10, fontWeight: 600, textTransform: "uppercase",
                        }}>
                          {RISK_LABEL[r.risk]}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </Panel>

        {/* Warehouse distribution */}
        <Panel padded={false}>
          <div style={{
            padding: "10px 14px", borderBottom: `1px solid ${T.border}`,
            color: T.fgBase, fontWeight: 600, fontSize: 13,
            display: "flex", justifyContent: "space-between", alignItems: "baseline",
          }}>
            <span>🏭 Distribución de pedidos</span>
            {warehouseDist && (
              <span style={{ color: T.fgSubtle, fontSize: 11, fontWeight: 400 }}>
                Gini <b style={{ color: giniLabel.color }}>{warehouseDist.gini.toFixed(2)}</b>
                {" · "}<span style={{ color: giniLabel.color }}>{giniLabel.text}</span>
              </span>
            )}
          </div>
          {whRows.length === 0 ? (
            <div style={{ padding: 20, color: T.fgSubtle, textAlign: "center", fontSize: 13 }}>
              Sin metadata de warehouse en el período.
            </div>
          ) : (
            <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
              {whRows.map((w) => (
                <div key={w.warehouse}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                    <span style={{ color: T.fgBase, fontSize: 12, fontWeight: 600, textTransform: "capitalize" }}>
                      {w.warehouse}
                    </span>
                    <span style={{ color: T.fgSubtle, fontSize: 11, fontVariantNumeric: "tabular-nums" }}>
                      {w.orders} ord. · {fmtMoney(w.revenue_eur, moneyCcy)}
                    </span>
                  </div>
                  <ProgressBar value={w.share_pct} max={100} color={T.indigo} />
                  <div style={{ color: T.fgSubtle, fontSize: 10, textAlign: "right", marginTop: 2 }}>
                    {w.share_pct.toFixed(1)}%
                  </div>
                </div>
              ))}
              {warehouseDist && warehouseDist.imbalance_pct > 30 && (
                <div style={{
                  marginTop: 4, padding: "8px 10px",
                  background: T.warnBg, border: `1px solid ${T.warn}`, borderRadius: 6,
                  color: T.fgBase, fontSize: 11,
                }}>
                  ⚠ Spread {warehouseDist.imbalance_pct.toFixed(1)}% entre el mayor y el menor —
                  considerá rebalancear stock.
                </div>
              )}
            </div>
          )}
        </Panel>
      </div>
    </div>
  )
}

function WalletSparkline({ daily, color }: {
  daily: WalletSparklineData
  color: string
}) {
  if (!daily || daily.length < 2) return null
  const w = 100, h = 28
  const values = daily.map((d) => d.balance_eod)
  const min = Math.min(...values), max = Math.max(...values)
  const range = max - min || 1
  const step = w / (values.length - 1)
  const pts = values.map((v, i) => `${i * step},${h - ((v - min) / range) * h}`).join(" ")
  return (
    <svg width={w} height={h} style={{ display: "block" }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ───── BI types ──────────────────────────────────────────────────────────────
type ProfitabilityRow = {
  product_id: string | null
  product_handle: string | null
  variant_id: string | null
  title: string
  variant_title: string | null
  units_sold: number
  revenue_eur: number
  cogs_eur: number
  margin_eur: number
  margin_pct: number
  orders: number
  lines_missing_cost: number
}
type ChannelRow = {
  channel: string
  orders: number
  revenue_eur: number
  margin_eur: number
  aov_eur: number
  margin_pct: number
}
type LtvRow = {
  identity: string
  name: string | null
  cedula: string | null
  email: string | null
  phone: string | null
  orders: number
  revenue_eur: number
  margin_eur: number
  aov_eur: number
  first_order_at: string
  last_order_at: string
  days_since_last: number
  loyalty_points: number | null
}
type ForecastPayload = {
  month: string
  is_current: boolean
  days_elapsed: number
  days_in_month: number
  current: { orders: number; revenue_eur: number; margin_eur: number }
  projection: { orders: number; revenue_eur: number; margin_eur: number }
  avg_per_day: { orders: number; revenue_eur: number; margin_eur: number }
  last_3_months: Array<{ month: string; orders: number; revenue_eur: number; margin_eur: number }>
}

// Marketing/operations widgets absorbed from the legacy analytics module (FA1).
type CampaignRevenueRow = {
  campaign: string
  source: string
  medium: string
  orders: number
  revenue_eur: number
  margin_eur: number
  margin_pct: number
  avg_ticket_eur: number
  revenue_share_pct: number
  orders_with_margin: number
}
type CampaignRevenuePayload = {
  month: string
  rows: CampaignRevenueRow[]
  total_revenue_eur: number
}
type TopCityRow = {
  city: string
  orders: number
  revenue_eur: number
  avg_ticket_eur: number
  revenue_share_pct: number
}
type TopCitiesPayload = {
  month: string
  rows: TopCityRow[]
  total_revenue_eur: number
}
type PendingAgingPayload = {
  window: string
  p50_hours: number | null
  p90_hours: number | null
  over_12h_count: number
  total: number
  over_12h_pct: number
  alert: boolean
}
type GraduationRatePayload = {
  manual_first: number
  graduated: number
  manual_first_with_repeat: number
  rate: number
  rate_among_repeaters: number
}

const CHANNEL_LABELS: Record<string, string> = {
  instagram_ads: "📷 Instagram",
  google: "🔎 Google",
  google_login: "🔐 Login Google",
  whatsapp_share: "💬 Compartido WA",
  whatsapp_bot: "🤖 Bot WhatsApp",
  directo: "🌐 Directo",
}

function channelLabel(k: string): string {
  if (CHANNEL_LABELS[k]) return CHANNEL_LABELS[k]
  if (k.startsWith("ref_")) return `🔗 ${k.slice(4)}`
  return k
}

// ───── BI: Profitability + Channels + LTV + Forecast section ────────────────
function BiSection({ profitability, channels, ltv, forecast, currency }: {
  profitability: ProfitabilityRow[]
  channels: ChannelRow[]
  ltv: LtvRow[]
  forecast: ForecastPayload | null
  currency: Currency
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Forecast strip */}
      {forecast && forecast.is_current && (
        <div style={{
          background: T.bgBase, border: `1px solid ${T.border}`,
          borderLeft: `4px solid ${T.indigo}`,
          borderRadius: 12, padding: "14px 16px",
        }}>
          <div style={{ color: T.fgMuted, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".06em" }}>
            Proyección del mes (lineal)
          </div>
          <div style={{ display: "flex", gap: 24, alignItems: "baseline", marginTop: 6, flexWrap: "wrap" }}>
            <div>
              <span style={{ color: T.fgSubtle, fontSize: 12, marginRight: 6 }}>Hoy:</span>
              <span style={{ color: T.fgBase, fontWeight: 600 }}>{forecast.current.orders} órdenes · {fmtMoney(forecast.current.revenue_eur, "eur")}</span>
            </div>
            <div>
              <span style={{ color: T.fgSubtle, fontSize: 12, marginRight: 6 }}>Fin de mes (estimado):</span>
              <span style={{ color: T.indigo, fontWeight: 700 }}>~{forecast.projection.orders} órdenes · {fmtMoney(forecast.projection.revenue_eur, "eur")}</span>
            </div>
            <div style={{ marginLeft: "auto", color: T.fgSubtle, fontSize: 11 }}>
              Día {forecast.days_elapsed} de {forecast.days_in_month}
            </div>
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 16 }}>
        {/* Top productos */}
        <Panel padded={false}>
          <div style={{ padding: "10px 14px", borderBottom: `1px solid ${T.border}`, color: T.fgBase, fontWeight: 600, fontSize: 13 }}>
            🏆 Top productos por margen
          </div>
          {profitability.length === 0 ? (
            <div style={{ padding: 20, color: T.fgSubtle, textAlign: "center", fontSize: 13 }}>Sin datos en el período.</div>
          ) : (
            <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
              <thead style={{ background: T.bgSubtle }}>
                <tr>
                  <th style={thStyle()}>Producto</th>
                  <th style={thStyle({ textAlign: "right" })}>Uds</th>
                  <th style={thStyle({ textAlign: "right" })}>Margen</th>
                  <th style={thStyle({ textAlign: "right" })}>%</th>
                </tr>
              </thead>
              <tbody>
                {profitability.slice(0, 8).map((p, i) => (
                  <tr key={(p.product_id || p.variant_id || "") + i} style={{ borderTop: `1px solid ${T.border}` }}>
                    <td style={{ padding: "6px 14px", color: T.fgBase }}>
                      {p.title}
                      {p.variant_title && p.variant_title !== p.title && (
                        <span style={{ color: T.fgSubtle, fontSize: 11 }}> · {p.variant_title}</span>
                      )}
                      {p.lines_missing_cost > 0 && (
                        <span title="Algunas líneas sin costo registrado" style={{ color: T.amber, marginLeft: 4 }}>⚠</span>
                      )}
                    </td>
                    <td style={{ padding: "6px 14px", textAlign: "right", color: T.fgSubtle, fontVariantNumeric: "tabular-nums" }}>{p.units_sold}</td>
                    <td style={{ padding: "6px 14px", textAlign: "right", color: p.margin_eur >= 0 ? T.green : T.rose, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                      {fmtMoney(p.margin_eur, "eur")}
                    </td>
                    <td style={{ padding: "6px 14px", textAlign: "right", color: T.fgSubtle, fontVariantNumeric: "tabular-nums" }}>
                      {(p.margin_pct * 100).toFixed(0)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>

        {/* Atribución por canal */}
        <Panel padded={false}>
          <div style={{ padding: "10px 14px", borderBottom: `1px solid ${T.border}`, color: T.fgBase, fontWeight: 600, fontSize: 13 }}>
            📡 Atribución por canal
          </div>
          {channels.length === 0 ? (
            <div style={{ padding: 20, color: T.fgSubtle, textAlign: "center", fontSize: 13 }}>Sin órdenes en el período.</div>
          ) : (
            <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
              <thead style={{ background: T.bgSubtle }}>
                <tr>
                  <th style={thStyle()}>Canal</th>
                  <th style={thStyle({ textAlign: "right" })}>Ord.</th>
                  <th style={thStyle({ textAlign: "right" })}>Ingresos</th>
                  <th style={thStyle({ textAlign: "right" })}>AOV</th>
                </tr>
              </thead>
              <tbody>
                {channels.map((c) => (
                  <tr key={c.channel} style={{ borderTop: `1px solid ${T.border}` }}>
                    <td style={{ padding: "6px 14px", color: T.fgBase }}>{channelLabel(c.channel)}</td>
                    <td style={{ padding: "6px 14px", textAlign: "right", color: T.fgSubtle, fontVariantNumeric: "tabular-nums" }}>{c.orders}</td>
                    <td style={{ padding: "6px 14px", textAlign: "right", color: T.fgBase, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                      {fmtMoney(c.revenue_eur, currency === "bs" ? "eur" : currency)}
                    </td>
                    <td style={{ padding: "6px 14px", textAlign: "right", color: T.fgSubtle, fontVariantNumeric: "tabular-nums" }}>
                      {fmtMoney(c.aov_eur, currency === "bs" ? "eur" : currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      </div>

      {/* Top clientes */}
      <Panel padded={false}>
        <div style={{ padding: "10px 14px", borderBottom: `1px solid ${T.border}`, color: T.fgBase, fontWeight: 600, fontSize: 13 }}>
          ⭐ Top clientes por valor
        </div>
        {ltv.length === 0 ? (
          <div style={{ padding: 20, color: T.fgSubtle, textAlign: "center", fontSize: 13 }}>Sin datos.</div>
        ) : (
          <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
            <thead style={{ background: T.bgSubtle }}>
              <tr>
                <th style={thStyle()}>Cliente</th>
                <th style={thStyle()}>Cédula</th>
                <th style={thStyle({ textAlign: "right" })}>Órdenes</th>
                <th style={thStyle({ textAlign: "right" })}>Ingresos</th>
                <th style={thStyle({ textAlign: "right" })}>Margen</th>
                <th style={thStyle({ textAlign: "right" })}>AOV</th>
                <th style={thStyle({ textAlign: "right" })}>Última</th>
              </tr>
            </thead>
            <tbody>
              {ltv.map((c) => (
                <tr key={c.identity} style={{ borderTop: `1px solid ${T.border}` }}>
                  <td style={{ padding: "6px 14px", color: T.fgBase }}>
                    <div>{c.name || "—"}</div>
                    <div style={{ color: T.fgSubtle, fontSize: 10 }}>{c.email}</div>
                  </td>
                  <td style={{ padding: "6px 14px", color: T.fgSubtle }}>{c.cedula || "—"}</td>
                  <td style={{ padding: "6px 14px", textAlign: "right", color: T.fgSubtle, fontVariantNumeric: "tabular-nums" }}>{c.orders}</td>
                  <td style={{ padding: "6px 14px", textAlign: "right", color: T.fgBase, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{fmtMoney(c.revenue_eur, "eur")}</td>
                  <td style={{ padding: "6px 14px", textAlign: "right", color: T.green, fontVariantNumeric: "tabular-nums" }}>{fmtMoney(c.margin_eur, "eur")}</td>
                  <td style={{ padding: "6px 14px", textAlign: "right", color: T.fgSubtle, fontVariantNumeric: "tabular-nums" }}>{fmtMoney(c.aov_eur, "eur")}</td>
                  <td style={{ padding: "6px 14px", textAlign: "right", color: c.days_since_last > 30 ? T.amber : T.fgSubtle, fontSize: 11 }}>
                    {c.days_since_last < 1 ? "hoy" : `hace ${c.days_since_last}d`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  )
}

// ───── Marketing Insights (Batch FA1: campaigns + cities + graduation) ──────
function MarketingInsightsSection({
  campaigns, cities, graduation, currency,
}: {
  campaigns: CampaignRevenuePayload | null
  cities: TopCitiesPayload | null
  graduation: GraduationRatePayload | null
  currency: Currency
}) {
  const moneyCcy: Currency = currency === "bs" ? "eur" : currency
  const campaignRows = campaigns?.rows ?? []
  const cityRows = cities?.rows ?? []
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <SectionTitle>Marketing & geografía</SectionTitle>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr)", gap: 16 }}>
        {/* Campaign revenue (UTM rollup with margin) */}
        <Panel padded={false}>
          <div style={{ padding: "10px 14px", borderBottom: `1px solid ${T.border}`, color: T.fgBase, fontWeight: 600, fontSize: 13, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span>🎯 Campañas (UTM) por ingresos</span>
            <span style={{ color: T.fgSubtle, fontSize: 11, fontWeight: 400 }}>
              top 20 · {fmtMoney(campaigns?.total_revenue_eur ?? 0, moneyCcy)}
            </span>
          </div>
          {campaignRows.length === 0 ? (
            <div style={{ padding: 20, color: T.fgSubtle, textAlign: "center", fontSize: 13 }}>
              Sin órdenes con UTM en el período.
            </div>
          ) : (
            <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
              <thead style={{ background: T.bgSubtle }}>
                <tr>
                  <th style={thStyle()}>Campaña</th>
                  <th style={thStyle()}>Fuente / medio</th>
                  <th style={thStyle({ textAlign: "right" })}>Ord.</th>
                  <th style={thStyle({ textAlign: "right" })}>Ingresos</th>
                  <th style={thStyle({ textAlign: "right" })}>Margen</th>
                  <th style={thStyle({ textAlign: "right" })}>%</th>
                </tr>
              </thead>
              <tbody>
                {campaignRows.map((r, i) => (
                  <tr key={`${r.campaign}|${r.source}|${r.medium}|${i}`} style={{ borderTop: `1px solid ${T.border}` }}>
                    <td style={{ padding: "6px 14px", color: T.fgBase, fontWeight: 600 }}>{r.campaign}</td>
                    <td style={{ padding: "6px 14px", color: T.fgSubtle, fontSize: 11 }}>
                      {r.source} · {r.medium}
                    </td>
                    <td style={{ padding: "6px 14px", textAlign: "right", color: T.fgSubtle, fontVariantNumeric: "tabular-nums" }}>
                      {r.orders}
                    </td>
                    <td style={{ padding: "6px 14px", textAlign: "right", color: T.fgBase, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                      {fmtMoney(r.revenue_eur, moneyCcy)}
                    </td>
                    <td style={{
                      padding: "6px 14px", textAlign: "right",
                      color: r.orders_with_margin === 0 ? T.fgSubtle : (r.margin_eur >= 0 ? T.green : T.rose),
                      fontWeight: 600, fontVariantNumeric: "tabular-nums",
                    }}>
                      {r.orders_with_margin === 0 ? "—" : fmtMoney(r.margin_eur, moneyCcy)}
                    </td>
                    <td style={{ padding: "6px 14px", textAlign: "right", color: T.fgSubtle, fontVariantNumeric: "tabular-nums" }}>
                      {r.revenue_share_pct.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>

        {/* Top cities + graduation rate stacked */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Panel padded={false}>
            <div style={{ padding: "10px 14px", borderBottom: `1px solid ${T.border}`, color: T.fgBase, fontWeight: 600, fontSize: 13 }}>
              📍 Top ciudades
            </div>
            {cityRows.length === 0 ? (
              <div style={{ padding: 20, color: T.fgSubtle, textAlign: "center", fontSize: 13 }}>
                Sin envíos en el período.
              </div>
            ) : (
              <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                <thead style={{ background: T.bgSubtle }}>
                  <tr>
                    <th style={thStyle()}>Ciudad</th>
                    <th style={thStyle({ textAlign: "right" })}>Ord.</th>
                    <th style={thStyle({ textAlign: "right" })}>Ingresos</th>
                    <th style={thStyle({ textAlign: "right" })}>%</th>
                  </tr>
                </thead>
                <tbody>
                  {cityRows.map((c, i) => (
                    <tr key={c.city + i} style={{ borderTop: `1px solid ${T.border}` }}>
                      <td style={{ padding: "6px 14px", color: T.fgBase }}>{c.city}</td>
                      <td style={{ padding: "6px 14px", textAlign: "right", color: T.fgSubtle, fontVariantNumeric: "tabular-nums" }}>{c.orders}</td>
                      <td style={{ padding: "6px 14px", textAlign: "right", color: T.fgBase, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                        {fmtMoney(c.revenue_eur, moneyCcy)}
                      </td>
                      <td style={{ padding: "6px 14px", textAlign: "right", color: T.fgSubtle, fontVariantNumeric: "tabular-nums" }}>
                        {c.revenue_share_pct.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>

          {/* Graduation rate mini card */}
          <Panel>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ color: T.fgMuted, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".06em" }}>
                🎓 Graduación manual → web
              </div>
              {graduation ? (
                <>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                    <div style={{ color: T.fgBase, fontSize: 22, fontWeight: 700 }}>
                      {graduation.rate.toFixed(1)}%
                    </div>
                    <div style={{ color: T.fgSubtle, fontSize: 11 }}>
                      {graduation.graduated} / {graduation.manual_first} clientes manuales
                    </div>
                  </div>
                  <div style={{ color: T.fgSubtle, fontSize: 11 }}>
                    Entre repeaters: <b style={{ color: T.fgBase }}>{graduation.rate_among_repeaters.toFixed(1)}%</b>
                    {" "}· {graduation.manual_first_with_repeat} con segunda compra
                  </div>
                </>
              ) : (
                <Text>Cargando…</Text>
              )}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  )
}

// ───── B7: Money tooltip ─────────────────────────────────────────────────────
type RateContext = {
  bcv_eur: number
  bcv_usd: number
  paralelo_usdt: number | null
}

function MoneyTooltip({ amount, currency, rates, children }: {
  amount: number | null | undefined
  currency: Currency
  rates: RateContext | null
  children: React.ReactNode
}) {
  if (amount == null || !rates) return <>{children}</>
  let eur = 0, bs = 0, usdt = 0
  const v = Number(amount) || 0
  if (currency === "eur") {
    eur = v
    bs = v * rates.bcv_eur
    usdt = v / 1.08
  } else if (currency === "bs") {
    bs = v
    eur = rates.bcv_eur > 0 ? v / rates.bcv_eur : 0
    usdt = rates.paralelo_usdt && rates.paralelo_usdt > 0 ? v / rates.paralelo_usdt : eur / 1.08
  } else {
    usdt = v
    eur = v * 1.08
    bs = rates.paralelo_usdt ? v * rates.paralelo_usdt : v * rates.bcv_usd
  }
  const tip = [
    `€${eur.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    `Bs ${bs.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    `$${usdt.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    `tasa BCV €=${rates.bcv_eur.toFixed(2)} · paralelo USDT=${rates.paralelo_usdt?.toFixed(2) ?? "—"}`,
  ].join("\n")
  return (
    <span title={tip} style={{ cursor: "help", borderBottom: `1px dotted ${T.border}` }}>
      {children}
    </span>
  )
}

// ───── B7: Cmd+K command palette ─────────────────────────────────────────────
type CommandItem = {
  key: string
  label: string
  hint: string
  group: "Movimientos" | "Productos" | "Categorías" | "Wallets" | "Acciones"
  onPick: () => void
}

function CommandPalette({ items, open, onClose }: {
  items: CommandItem[]
  open: boolean
  onClose: () => void
}) {
  const [query, setQuery] = useState("")
  const [activeIdx, setActiveIdx] = useState(0)
  useEffect(() => {
    if (open) { setQuery(""); setActiveIdx(0) }
  }, [open])

  const q = query.trim().toLowerCase()
  const filtered = useMemo(() => {
    if (!q) return items.slice(0, 20)
    return items
      .map((it) => {
        const score =
          (it.label.toLowerCase().includes(q) ? 2 : 0) +
          (it.hint.toLowerCase().includes(q) ? 1 : 0)
        return { it, score }
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 30)
      .map((x) => x.it)
  }, [items, q])
  const grouped = useMemo(() => {
    const m = new Map<string, CommandItem[]>()
    for (const it of filtered) {
      const list = m.get(it.group) || []
      list.push(it)
      m.set(it.group, list)
    }
    return m
  }, [filtered])
  const allFlat = filtered

  if (!open) return null
  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
        zIndex: 9999, display: "flex", justifyContent: "center", alignItems: "flex-start",
        paddingTop: 80,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(640px, 92vw)",
          background: T.bgBase, border: `1px solid ${T.border}`,
          borderRadius: 12, boxShadow: "0 24px 48px rgba(0,0,0,0.5)",
          overflow: "hidden", display: "flex", flexDirection: "column",
          maxHeight: "70vh",
        }}
      >
        <div style={{ padding: "12px 14px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ color: T.fgMuted }}>🔎</span>
          <input
            autoFocus
            placeholder="Buscar órdenes, productos, categorías…"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActiveIdx(0) }}
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose()
              if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, allFlat.length - 1)) }
              if (e.key === "ArrowUp") { e.preventDefault(); setActiveIdx((i) => Math.max(0, i - 1)) }
              if (e.key === "Enter") {
                e.preventDefault()
                const it = allFlat[activeIdx]
                if (it) { it.onPick(); onClose() }
              }
            }}
            style={{
              flex: 1, background: "transparent", border: "none", outline: "none",
              color: T.fgBase, fontSize: 15,
            }}
          />
          <span style={{ color: T.fgSubtle, fontSize: 11, fontFamily: "monospace" }}>esc</span>
        </div>
        <div style={{ overflowY: "auto", flex: 1 }}>
          {allFlat.length === 0 && (
            <div style={{ padding: 24, color: T.fgSubtle, textAlign: "center", fontSize: 13 }}>
              Sin resultados.
            </div>
          )}
          {[...grouped.entries()].map(([group, list]) => (
            <div key={group}>
              <div style={{
                padding: "6px 14px", color: T.fgMuted, fontSize: 10,
                fontWeight: 600, textTransform: "uppercase", letterSpacing: ".06em",
                background: T.bgSubtle,
              }}>{group}</div>
              {list.map((it) => {
                const idx = allFlat.findIndex((x) => x.key === it.key)
                const isActive = idx === activeIdx
                return (
                  <button
                    key={it.key}
                    onClick={() => { it.onPick(); onClose() }}
                    onMouseEnter={() => setActiveIdx(idx)}
                    style={{
                      width: "100%", textAlign: "left",
                      padding: "8px 14px", border: "none",
                      background: isActive ? T.bgHover : "transparent",
                      cursor: "pointer", display: "flex", flexDirection: "column",
                    }}
                  >
                    <span style={{ color: T.fgBase, fontSize: 13 }}>{it.label}</span>
                    {it.hint && <span style={{ color: T.fgSubtle, fontSize: 11 }}>{it.hint}</span>}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
        <div style={{
          padding: "8px 14px", borderTop: `1px solid ${T.border}`,
          color: T.fgSubtle, fontSize: 11, display: "flex", gap: 12,
        }}>
          <span>↑↓ navegar</span>
          <span>↵ seleccionar</span>
          <span>esc cerrar</span>
        </div>
      </div>
    </div>
  )
}

// ───── B7: Date range picker (presets + custom range) ────────────────────────
type DateRange = { from: string | null; to: string | null }

function DateRangePicker({ value, onChange }: {
  value: DateRange
  onChange: (v: DateRange) => void
}) {
  const setPreset = (preset: "all" | "7d" | "30d" | "mtd" | "last_month") => {
    const today = new Date()
    if (preset === "all") return onChange({ from: null, to: null })
    if (preset === "7d") {
      const d = new Date(today.getTime() - 7 * 86400000)
      return onChange({ from: d.toISOString().slice(0, 10), to: today.toISOString().slice(0, 10) })
    }
    if (preset === "30d") {
      const d = new Date(today.getTime() - 30 * 86400000)
      return onChange({ from: d.toISOString().slice(0, 10), to: today.toISOString().slice(0, 10) })
    }
    if (preset === "mtd") {
      const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1))
      return onChange({ from: d.toISOString().slice(0, 10), to: today.toISOString().slice(0, 10) })
    }
    if (preset === "last_month") {
      const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1))
      const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 0))
      return onChange({ from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) })
    }
  }

  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 4, border: `1px solid ${T.border}`, borderRadius: 8, padding: 2 }}>
      {[
        { k: "all", label: "Todo" },
        { k: "7d", label: "7d" },
        { k: "30d", label: "30d" },
        { k: "mtd", label: "MTD" },
        { k: "last_month", label: "Mes pasado" },
      ].map((p) => (
        <button
          key={p.k}
          onClick={() => setPreset(p.k as Parameters<typeof setPreset>[0])}
          style={{
            padding: "4px 10px", background: "transparent", border: "none",
            color: T.fgMuted, cursor: "pointer", fontSize: 11, fontWeight: 600,
          }}
        >
          {p.label}
        </button>
      ))}
      <input
        type="date" value={value.from || ""}
        onChange={(e) => onChange({ ...value, from: e.target.value || null })}
        style={{
          background: "transparent", color: T.fgBase, fontSize: 11,
          border: `1px solid ${T.border}`, borderRadius: 4, padding: "2px 4px",
        }}
      />
      <span style={{ color: T.fgSubtle }}>→</span>
      <input
        type="date" value={value.to || ""}
        onChange={(e) => onChange({ ...value, to: e.target.value || null })}
        style={{
          background: "transparent", color: T.fgBase, fontSize: 11,
          border: `1px solid ${T.border}`, borderRadius: 4, padding: "2px 4px",
        }}
      />
    </div>
  )
}

// ───── B6: Close month + roles + comments ───────────────────────────────────
type MonthCloseRow = {
  id: string
  month: string
  closed_at: string
  closed_by_email: string | null
  reopened_at: string | null
  reopened_by_email: string | null
  reopen_reason: string | null
}

function CloseMonthButton({ month, onChanged }: { month: string; onChanged: () => void }) {
  const [closes, setCloses] = useState<MonthCloseRow[]>([])
  const [loading, setLoading] = useState(false)

  const reload = useCallback(async () => {
    try {
      const r = await api<{ closes: MonthCloseRow[] }>("/admin/finanzas/month-close")
      setCloses(r.closes)
    } catch { /* ignore */ }
  }, [])
  useEffect(() => { reload() }, [reload])

  const isClosed = closes.some((c) => c.month === month && !c.reopened_at)

  const close = async () => {
    if (!confirm(`¿Cerrar ${month}? Las modificaciones futuras requerirán nota de corrección.`)) return
    setLoading(true)
    try {
      await api("/admin/finanzas/month-close", {
        method: "POST",
        body: JSON.stringify({ month }),
      })
      await reload(); onChanged()
    } catch (e) { alert((e as Error).message) }
    finally { setLoading(false) }
  }
  const reopen = async () => {
    const reason = prompt(`Motivo de reapertura de ${month} (mínimo 10 caracteres):`)
    if (!reason || reason.trim().length < 10) return
    setLoading(true)
    try {
      await api("/admin/finanzas/month-close", {
        method: "DELETE",
        body: JSON.stringify({ month, reason }),
      })
      await reload(); onChanged()
    } catch (e) { alert((e as Error).message) }
    finally { setLoading(false) }
  }

  if (isClosed) {
    return (
      <Button variant="secondary" size="small" onClick={reopen} disabled={loading}
              style={{ borderColor: T.green, color: T.green }}>
        🔒 Cerrado · Reabrir
      </Button>
    )
  }
  return (
    <Button variant="secondary" size="small" onClick={close} disabled={loading}>
      {loading ? "Cerrando…" : "🔓 Cerrar mes"}
    </Button>
  )
}

/**
 * Botón para disparar manualmente el email de cierre mensual con DOCX adjunto.
 * Reemplaza el cron deshabilitado tras el bug del scheduler (906k runs en 24h).
 * Default: envía el cierre del mes anterior al actual al email configurado en
 * FINANZAS_REPORT_EMAIL. Si quieres otro mes/destinatario, prompt del input.
 */
function SendCloseEmailButton({ month }: { month: string }) {
  const [loading, setLoading] = useState(false)
  const send = async () => {
    const targetMonth = prompt(
      "Mes a enviar (formato YYYY-MM). Default = mes anterior al actual.\nDeja vacío para usar el default.",
      ""
    )
    if (targetMonth === null) return // canceled

    const overrideTo = prompt(
      "Email destinatario (default = FINANZAS_REPORT_EMAIL configurado).\nDeja vacío para usar el default.",
      ""
    )
    if (overrideTo === null) return

    const body: Record<string, string> = {}
    if (targetMonth.trim()) body.month = targetMonth.trim()
    if (overrideTo.trim()) body.to = overrideTo.trim()

    if (!confirm(`¿Enviar cierre${body.month ? ` de ${body.month}` : ""}${body.to ? ` a ${body.to}` : ""}?`)) return

    setLoading(true)
    try {
      const r = await api<{
        status: "sent" | "skipped"
        reason?: string
        month?: string
        to?: string
        orders?: number
        net_eur?: number
      }>("/admin/finanzas/send-monthly-close", {
        method: "POST",
        body: JSON.stringify(body),
      })
      if (r.status === "sent") {
        alert(`✅ Cierre de ${r.month} enviado a ${r.to}\nÓrdenes: ${r.orders ?? 0}\nNeto: €${(r.net_eur ?? 0).toFixed(2)}`)
      } else {
        alert(`⚠️ No se envió: ${r.reason || "razón desconocida"}`)
      }
    } catch (e) {
      alert(`Error: ${(e as Error).message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button variant="secondary" size="small" onClick={send} disabled={loading} title="Enviar el email de cierre con DOCX adjunto manualmente. Reemplaza el cron deshabilitado.">
      {loading ? "Enviando…" : "📧 Enviar cierre"}
    </Button>
  )
}

type CommentRow = {
  id: string
  body: string
  author_email: string | null
  resolved_at: string | null
  created_at: string
}

function CommentsThread({ entityType, entityId }: { entityType: string; entityId: string }) {
  const [comments, setComments] = useState<CommentRow[]>([])
  const [draft, setDraft] = useState("")
  const [loading, setLoading] = useState(false)

  const reload = useCallback(async () => {
    try {
      const r = await api<{ comments: CommentRow[] }>(
        `/admin/finanzas/comments?entity_type=${entityType}&entity_id=${entityId}`
      )
      setComments(r.comments)
    } catch { /* ignore */ }
  }, [entityType, entityId])
  useEffect(() => { reload() }, [reload])

  const post = async () => {
    if (!draft.trim()) return
    setLoading(true)
    try {
      await api("/admin/finanzas/comments", {
        method: "POST",
        body: JSON.stringify({ entity_type: entityType, entity_id: entityId, body: draft }),
      })
      setDraft("")
      await reload()
    } catch (e) { alert((e as Error).message) }
    finally { setLoading(false) }
  }

  const remove = async (id: string) => {
    await api(`/admin/finanzas/comments/${id}`, { method: "DELETE" })
    reload()
  }

  return (
    <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 12, marginTop: 8 }}>
      <div style={{ color: T.fgBase, fontWeight: 600, fontSize: 13, marginBottom: 8 }}>
        💬 Comentarios {comments.length > 0 && <span style={{ color: T.fgSubtle, fontWeight: 400 }}>({comments.length})</span>}
      </div>
      {comments.length === 0 && <Text size="small" style={{ color: T.fgSubtle }}>Sin comentarios.</Text>}
      {comments.map((c) => (
        <div key={c.id} style={{
          padding: "6px 0", borderBottom: `1px dashed ${T.border}`, fontSize: 12,
          display: "flex", justifyContent: "space-between", gap: 8,
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ color: T.fgBase }}>{c.body}</div>
            <div style={{ color: T.fgSubtle, fontSize: 10 }}>
              {c.author_email || "—"} · {fmtDate(c.created_at)}
            </div>
          </div>
          <Button size="small" variant="transparent" onClick={() => remove(c.id)}><Trash /></Button>
        </div>
      ))}
      <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
        <Input
          placeholder="Escribí un comentario…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); post() } }}
        />
        <Button size="small" onClick={post} disabled={loading || !draft.trim()}>Publicar</Button>
      </div>
    </div>
  )
}

// ───── DASHBOARD TAB ──────────────────────────────────────────────────────────
type MultiMonthBucket = {
  month: string
  orders: number
  revenue: { eur: number; bs: number; usdt_theoretical: number }
  cogs_eur: number
  margin_eur: number
  net_eur: number
  splits: Record<
    "restock" | "gastos_fijos" | "marketing" | "ganancia",
    { eur: number; usdt: number; spent_usdt: number }
  >
  expenses_paid_usdt: number
  cashflow: {
    bs_received: number
    bs_converted: number
    usdt_from_conversion: number
  }
}

function downloadAttachment(url: string) {
  // Triggers the admin browser session's auth cookie automatically
  const a = document.createElement("a")
  a.href = url
  a.target = "_blank"
  a.rel = "noopener"
  document.body.appendChild(a)
  a.click()
  setTimeout(() => a.remove(), 100)
}

function DashboardTab({
  month, setMonth, currency, setCurrency, summary, movements, multiMonth,
  profitability, channels, ltv, forecast,
  runway, breakeven, recommender, spreadPl, restock, walletSparklines,
  campaignRevenue, topCities, pendingAging, graduationRate,
  restockDetail, warehouseDist,
  reload,
}: {
  month: string
  setMonth: (m: string) => void
  currency: Currency
  setCurrency: (c: Currency) => void
  summary: Summary | null
  movements: Movement[]
  multiMonth: MultiMonthBucket[]
  profitability: ProfitabilityRow[]
  channels: ChannelRow[]
  ltv: LtvRow[]
  forecast: ForecastPayload | null
  runway: RunwayPayload | null
  breakeven: BreakevenPayload | null
  recommender: RecommenderPayload | null
  spreadPl: SpreadPlPayload | null
  restock: RestockPayload | null
  walletSparklines: Map<string, WalletSparklineData>
  campaignRevenue: CampaignRevenuePayload | null
  topCities: TopCitiesPayload | null
  pendingAging: PendingAgingPayload | null
  graduationRate: GraduationRatePayload | null
  restockDetail: RestockDetailPayload | null
  warehouseDist: WarehouseDistributionPayload | null
  reload: () => void
}) {
  if (!summary) return <Text>Cargando…</Text>
  const { totals, splits, wallets, alerts } = summary

  // pick the right currency value for KPI cards
  const pickRev = currency === "eur" ? totals.revenue_eur : currency === "bs" ? totals.revenue_bs : totals.revenue_usdt_theoretical
  const pickBucketAmount = (b: { eur: number; usdt: number }) => {
    if (currency === "eur") return b.eur
    if (currency === "usdt") return b.usdt
    // bs: derive from eur using avg bcv from all pago_movil rows would need data;
    // we display in USDT for the budget bar when bs is selected (less precise but simpler)
    return b.eur
  }

  // Recent activity = top 8 movements within current month
  const recent = movements.slice(0, 8)

  // Sparklines: revenue per day in month
  const dailyRevenue = useMemo(() => {
    const [y, m] = month.split("-").map(Number)
    const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate()
    const arr = new Array(daysInMonth).fill(0)
    for (const mv of movements) {
      if (mv.type !== "ingreso") continue
      const d = new Date(mv.date)
      if (d.getUTCFullYear() === y && d.getUTCMonth() + 1 === m) {
        const day = d.getUTCDate()
        const v = currency === "eur" ? (mv.amount_eur ?? 0) : currency === "bs" ? (mv.amount_bs ?? 0) : (mv.amount_usdt ?? 0)
        arr[day - 1] += v
      }
    }
    return arr
  }, [movements, month, currency])

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <MonthPicker value={month} onChange={setMonth} />
          <CurrencySwitch value={currency} onChange={setCurrency} />
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Button variant="secondary" size="small" onClick={() => window.open(`${API}/admin/finanzas/reports/pl/print?month=${month}`, "_blank")}>
            P&amp;L PDF
          </Button>
          <Button variant="secondary" size="small" onClick={() => downloadAttachment(`${API}/admin/finanzas/reports/docx?month=${month}`)}>
            DOCX
          </Button>
          <Button variant="secondary" size="small" onClick={() => downloadAttachment(`${API}/admin/finanzas/reports/export?type=movements&month=${month}`)}>
            <ArrowDownTray /> CSV
          </Button>
          <CloseMonthButton month={month} onChanged={reload} />
          <SendCloseEmailButton month={month} />
          <Button variant="secondary" size="small" onClick={reload}><ArrowPathMini /> Refrescar</Button>
          {/* Cmd+K shortcut hint */}
        </div>
      </div>

      {/* Alerts */}
      {(alerts.missing_cost > 0 || alerts.negative_margin > 0 || (pendingAging?.alert ?? false)) && (
        <div style={{
          background: T.warnBg, border: `1px solid ${T.warn}`, borderRadius: 10,
          padding: "10px 14px", color: T.fgBase, fontSize: 13,
          display: "flex", flexDirection: "column", gap: 4,
        }}>
          {alerts.missing_cost > 0 && (
            <div>⚠ <b>{alerts.missing_cost}</b> órden(es) sin costo de algún artículo. Cargá el costo en <b>Configuración → Costos</b> y hacé "Recalcular".</div>
          )}
          {alerts.negative_margin > 0 && (
            <div>⚠ <b>{alerts.negative_margin}</b> órden(es) con margen negativo.</div>
          )}
          {pendingAging?.alert && (
            <div>
              ⏳ Tiempo de cobro alto — P90 = <b>{pendingAging.p90_hours}h</b>
              {" "}({pendingAging.over_12h_count} órdenes &gt;12h sin transacción
              {" · "}últimos 90 días). Revisá pago-móvil pendientes.
            </div>
          )}
        </div>
      )}

      {/* KPI strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
        <KpiCard label="Órdenes" value={String(totals.orders)} accent={T.slate} />
        <KpiCard
          label="Ingresos"
          value={fmtMoney(pickRev, currency)}
          accent={T.green}
          sparkline={<Sparkline values={dailyRevenue} color={T.green} />}
        />
        <KpiCard
          label="Margen bruto"
          value={fmtMoney(currency === "eur" ? totals.margin_eur : (currency === "usdt" ? totals.margin_eur / 1.08 : totals.margin_eur * (totals.revenue_bs && totals.revenue_eur ? totals.revenue_bs / totals.revenue_eur : 0)), currency)}
          accent={T.indigo}
          sub="después de COGS"
        />
        <KpiCard
          label="Bs por convertir"
          value={`Bs ${totals.bs_pending.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          accent={T.amber}
          sub="swap pendiente"
        />
      </div>

      {/* Bucket breakdown with progress (spent vs budget) + donut overview */}
      <div>
        <SectionTitle>Buckets del mes</SectionTitle>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 360px) minmax(0, 1fr)", gap: 16, alignItems: "start", marginBottom: 12 }}>
          <Panel style={{ minWidth: 0 }}>
            <SplitDonut splits={splits} currency={currency} />
          </Panel>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
            {(["restock", "gastos_fijos", "marketing", "ganancia"] as const).map((key) => {
              const b = splits[key]
              const budget = currency === "eur" ? b.eur : currency === "usdt" ? b.usdt : b.eur
              const spent = key === "ganancia" ? 0 : (b.spent_usdt || 0)
              const spentDisplay = currency === "usdt" ? spent : (spent * 1.08)
              const accent = BUCKET_COLORS[key]
              return (
                <div key={key} style={{
                  background: T.bgBase, border: `1px solid ${T.border}`, borderLeft: `4px solid ${accent}`,
                  borderRadius: 10, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 6,
                }}>
                  <div style={{ color: T.fgMuted, fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".06em" }}>
                    {BUCKET_LABELS[key]}
                  </div>
                  <div style={{ color: T.fgBase, fontSize: 16, fontWeight: 700 }}>{fmtMoney(budget, currency)}</div>
                  {key !== "ganancia" && (
                    <>
                      <ProgressBar value={spentDisplay} max={budget} color={accent} />
                      <div style={{ display: "flex", justifyContent: "space-between", color: T.fgSubtle, fontSize: 10 }}>
                        <span>Gastado: {fmtMoney(spent, "usdt")}</span>
                        <span>{budget > 0 ? Math.round((spentDisplay / budget) * 100) : 0}%</span>
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Tesoreria: runway, breakeven, recommender, spread P&L */}
      <TesoreriaSection runway={runway} breakeven={breakeven} recommender={recommender} spread={spreadPl} />

      {/* Multi-month trend */}
      <MonthlyTrend months={multiMonth} currency={currency} currentMonth={month} setMonth={setMonth} />

      {/* Business intelligence: profitability + channels + LTV + forecast */}
      <BiSection
        profitability={profitability}
        channels={channels}
        ltv={ltv}
        forecast={forecast}
        currency={currency}
      />

      {/* Marketing & geografía (FA1: campaigns + cities + graduation) */}
      <MarketingInsightsSection
        campaigns={campaignRevenue}
        cities={topCities}
        graduation={graduationRate}
        currency={currency}
      />

      {/* Restock prediction */}
      <RestockSection data={restock} />

      {/* FA2: per-location stock + warehouse distribution */}
      <OperationsDetailSection
        restockDetail={restockDetail}
        warehouseDist={warehouseDist}
        currency={currency}
      />

      {/* Two-column row: Wallets + Recent activity */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.4fr)", gap: 16 }}>
        <div>
          <SectionTitle>Wallets</SectionTitle>
          <Panel padded={false}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {wallets.map((w, i) => {
                const spark = walletSparklines.get(w.id) || []
                const color = w.currency === "bs" ? T.amber : w.currency === "usdt" ? T.green : T.indigo
                return (
                  <div key={w.id} style={{
                    padding: "12px 14px",
                    borderBottom: i < wallets.length - 1 ? `1px solid ${T.border}` : "none",
                    display: "grid",
                    gridTemplateColumns: "1fr auto auto",
                    gap: 12,
                    alignItems: "center",
                  }}>
                    <div>
                      <div style={{ color: T.fgBase, fontWeight: 600 }}>{w.name}</div>
                      <div style={{ color: T.fgSubtle, fontSize: 11, textTransform: "uppercase" }}>{w.currency}</div>
                    </div>
                    <WalletSparkline daily={spark} color={color} />
                    <div style={{ color: T.fgBase, fontWeight: 700, fontSize: 18, textAlign: "right" }}>
                      {fmtMoney(w.balance, w.currency as Currency)}
                    </div>
                  </div>
                )
              })}
            </div>
          </Panel>
        </div>

        <div>
          <SectionTitle>Actividad reciente</SectionTitle>
          <Panel padded={false}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {recent.length === 0 && (
                <div style={{ padding: 24, color: T.fgSubtle, fontSize: 13, textAlign: "center" }}>
                  Sin movimientos este mes.
                </div>
              )}
              {recent.map((m, i) => (
                <div key={m.key} style={{
                  display: "grid", gridTemplateColumns: "20px 1fr auto", gap: 10, alignItems: "center",
                  padding: "10px 14px",
                  borderBottom: i < recent.length - 1 ? `1px solid ${T.border}` : "none",
                }}>
                  <TypeIcon type={m.type} />
                  <div>
                    <div style={{ color: T.fgBase, fontSize: 13 }}>
                      {m.description}
                    </div>
                    <div style={{ color: T.fgSubtle, fontSize: 11, display: "flex", gap: 6, alignItems: "center" }}>
                      <span>{fmtDate(m.date)}</span>
                      {m.bucket && <BucketPill bucket={m.bucket} />}
                    </div>
                  </div>
                  <div style={{ color: T.fgBase, fontWeight: 600, fontSize: 13, textAlign: "right" }}>
                    {fmtMoney(currency === "eur" ? m.amount_eur : currency === "bs" ? m.amount_bs : m.amount_usdt, currency)}
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  )
}

function KpiCard({ label, value, accent, sub, sparkline }: {
  label: string; value: string; accent: string; sub?: string; sparkline?: React.ReactNode
}) {
  return (
    <div style={{
      background: T.bgBase, border: `1px solid ${T.border}`, borderLeft: `4px solid ${accent}`,
      borderRadius: 12, padding: "14px 16px",
    }}>
      <div style={{ color: T.fgMuted, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".06em" }}>{label}</div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: 6 }}>
        <div style={{ color: T.fgBase, fontSize: 22, fontWeight: 700 }}>{value}</div>
        {sparkline}
      </div>
      {sub && <div style={{ color: T.fgSubtle, fontSize: 11, marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
      <Heading level="h3" style={{ fontSize: 14, color: T.fgBase }}>{children}</Heading>
      {right}
    </div>
  )
}

// ───── MOVIMIENTOS TAB ────────────────────────────────────────────────────────
function MovementsTab({ movements, reload, currency, setCurrency, categories, wallets, splitRules, productCosts, rates, onMovementAction }: {
  movements: Movement[]
  reload: () => void
  currency: Currency
  setCurrency: (c: Currency) => void
  categories: ExpenseCategory[]
  wallets: Wallet[]
  splitRules: SplitRule[]
  productCosts: ProductCost[]
  rates: RateContext | null
  onMovementAction: () => void
}) {
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState<Set<MovementType>>(new Set(["ingreso", "gasto", "conversion"]))
  const [bucketFilter, setBucketFilter] = useState<string>("all")
  const [expandedKey, setExpandedKey] = useState<string | null>(null)
  const [expenseDrawerOpen, setExpenseDrawerOpen] = useState(false)
  const [sortBy, setSortBy] = useState<"date" | "amount">("date")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")
  const [dateRange, setDateRange] = useState<DateRange>({ from: null, to: null })
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkLoading, setBulkLoading] = useState(false)

  const toggleType = (t: MovementType) => {
    const next = new Set(typeFilter)
    if (next.has(t)) next.delete(t); else next.add(t)
    if (next.size === 0) next.add(t) // never empty
    setTypeFilter(next)
  }

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase()
    const fromTs = dateRange.from ? new Date(dateRange.from).getTime() : -Infinity
    const toTs = dateRange.to
      ? new Date(dateRange.to).getTime() + 86400000 // include the "to" day
      : Infinity
    return movements
      .filter((m) => typeFilter.has(m.type))
      .filter((m) => bucketFilter === "all" || m.bucket === bucketFilter)
      .filter((m) => {
        const t = new Date(m.date).getTime()
        return t >= fromTs && t < toTs
      })
      .filter((m) => {
        if (!s) return true
        return (
          m.description.toLowerCase().includes(s) ||
          (m.bucket || "").toLowerCase().includes(s) ||
          (m.category || "").toLowerCase().includes(s) ||
          String(m.related_order || "").includes(s)
        )
      })
      .sort((a, b) => {
        const dir = sortDir === "asc" ? 1 : -1
        if (sortBy === "date") return dir * (new Date(a.date).getTime() - new Date(b.date).getTime())
        const av = currency === "eur" ? (a.amount_eur ?? 0) : currency === "bs" ? (a.amount_bs ?? 0) : (a.amount_usdt ?? 0)
        const bv = currency === "eur" ? (b.amount_eur ?? 0) : currency === "bs" ? (b.amount_bs ?? 0) : (b.amount_usdt ?? 0)
        return dir * (av - bv)
      })
  }, [movements, search, typeFilter, bucketFilter, sortBy, sortDir, currency, dateRange])

  const filteredKeys = filtered.map((m) => m.key)
  const allSelectedFiltered = filteredKeys.length > 0 && filteredKeys.every((k) => selected.has(k))
  const someSelected = selected.size > 0
  const toggleAll = () => {
    if (allSelectedFiltered) {
      setSelected(new Set())
    } else {
      setSelected(new Set(filteredKeys))
    }
  }
  const toggleOne = (k: string) => {
    const next = new Set(selected)
    if (next.has(k)) next.delete(k); else next.add(k)
    setSelected(next)
  }

  /** Run bulk action on selected expenses. Ingresos/conversiones se ignoran. */
  const runBulk = async (action: "delete" | "mark_paid") => {
    const expenseIds = filtered
      .filter((m) => m.type === "gasto" && selected.has(m.key))
      .map((m) => (m.raw as { id: string }).id)
    if (expenseIds.length === 0) {
      alert("Solo se pueden hacer acciones masivas sobre gastos. Seleccioná filas de tipo Gasto.")
      return
    }
    let correctionNote: string | null = null
    if (action === "delete") {
      if (!confirm(`¿Borrar ${expenseIds.length} gasto(s)?`)) return
      // Best-effort: prompt for correction note in case any falls in a closed month
      correctionNote = prompt("Si alguno está en un mes cerrado, escribí motivo (opcional):") || null
    }
    setBulkLoading(true)
    try {
      const r = await api<{ succeeded: number; failed: number; results: Array<{ id: string; ok: boolean; error?: string }> }>(
        "/admin/finanzas/expenses/bulk",
        {
          method: "POST",
          body: JSON.stringify({
            ids: expenseIds, action,
            correction_note: correctionNote || undefined,
          }),
        }
      )
      const failed = r.results.filter((x) => !x.ok)
      if (failed.length > 0) {
        alert(`Hechos: ${r.succeeded} · Fallidos: ${r.failed}\n\n` +
              failed.slice(0, 5).map((f) => `${f.id}: ${f.error}`).join("\n"))
      }
      setSelected(new Set())
      onMovementAction()
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setBulkLoading(false)
    }
  }

  const exportSelectedCsv = () => {
    const rows = filtered.filter((m) => selected.has(m.key))
    if (rows.length === 0) return
    const cells = (vs: Array<unknown>) =>
      vs.map((v) => {
        const s = v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v)
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
      }).join(",")
    const lines = [
      cells(["Tipo", "Fecha", "Descripción", "Bucket/Categoría", "Orden", "EUR", "Bs", "USDT", "Estado"]),
      ...rows.map((m) =>
        cells([
          m.type, fmtDate(m.date), m.description,
          m.bucket || m.category || "", m.related_order || "",
          m.amount_eur ?? "", m.amount_bs ?? "", m.amount_usdt ?? "",
          m.status || "",
        ])
      ),
    ]
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = `seleccion-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a); a.click(); a.remove()
  }

  const totals = useMemo(() => {
    const t = { ingreso: 0, gasto: 0, conversion: 0 }
    for (const m of filtered) {
      const v = currency === "eur" ? (m.amount_eur ?? 0) : currency === "bs" ? (m.amount_bs ?? 0) : (m.amount_usdt ?? 0)
      t[m.type] += v
    }
    return t
  }, [filtered, currency])

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Filter bar */}
      <div style={{
        background: T.bgBase, border: `1px solid ${T.border}`, borderRadius: 12,
        padding: "10px 12px", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap",
      }}>
        <div style={{ position: "relative", flex: "1 1 220px", minWidth: 180 }}>
          <Input placeholder="Buscar por descripción, cliente, orden…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div style={{ display: "inline-flex", border: `1px solid ${T.border}`, borderRadius: 8, overflow: "hidden" }}>
          {(["ingreso", "gasto", "conversion"] as MovementType[]).map((t) => (
            <button
              key={t}
              onClick={() => toggleType(t)}
              style={{
                padding: "6px 12px", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600,
                background: typeFilter.has(t) ? T.bgHover : "transparent",
                color: typeFilter.has(t) ? T.fgBase : T.fgSubtle,
                display: "inline-flex", alignItems: "center", gap: 4,
              }}
            >
              <TypeIcon type={t} /> {t === "ingreso" ? "Ingresos" : t === "gasto" ? "Gastos" : "Conversiones"}
            </button>
          ))}
        </div>
        <Select value={bucketFilter} onValueChange={setBucketFilter}>
          <Select.Trigger style={{ minWidth: 160 }}><Select.Value placeholder="Bucket" /></Select.Trigger>
          <Select.Content>
            <Select.Item value="all">Todos los buckets</Select.Item>
            {Object.keys(BUCKET_LABELS).map((b) => <Select.Item key={b} value={b}>{BUCKET_LABELS[b]}</Select.Item>)}
          </Select.Content>
        </Select>
        <CurrencySwitch value={currency} onChange={setCurrency} />
        <DateRangePicker value={dateRange} onChange={setDateRange} />
        <div style={{ flex: 1 }} />
        <Button size="small" variant="secondary" onClick={() => {
          const ymKey = new Date().toISOString().slice(0, 7)
          downloadAttachment(`${API}/admin/finanzas/reports/export?type=movements&month=${ymKey}`)
        }}><ArrowDownTray /> CSV</Button>
        <Button size="small" variant="primary" onClick={() => setExpenseDrawerOpen(true)}><Plus /> Registrar gasto</Button>
      </div>

      {/* Bulk action toolbar */}
      {someSelected && (
        <div style={{
          background: T.bgHover, border: `1px solid ${T.indigo}`, borderRadius: 10,
          padding: "8px 14px", display: "flex", alignItems: "center", gap: 12,
        }}>
          <span style={{ color: T.fgBase, fontWeight: 600, fontSize: 13 }}>
            {selected.size} seleccionado{selected.size === 1 ? "" : "s"}
          </span>
          <div style={{ flex: 1 }} />
          <Button size="small" variant="secondary" onClick={exportSelectedCsv}>
            <ArrowDownTray /> CSV selección
          </Button>
          <Button size="small" variant="secondary" onClick={() => runBulk("mark_paid")} disabled={bulkLoading}>
            ✓ Marcar pagados
          </Button>
          <Button size="small" variant="danger" onClick={() => runBulk("delete")} disabled={bulkLoading}>
            <Trash /> Borrar
          </Button>
          <Button size="small" variant="transparent" onClick={() => setSelected(new Set())}>
            Limpiar
          </Button>
        </div>
      )}

      {/* Ledger */}
      <Panel padded={false}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead style={{ background: T.bgSubtle, position: "sticky", top: 0, zIndex: 1 }}>
              <tr>
                <th style={thStyle({ width: 28 })}>
                  <input
                    type="checkbox"
                    checked={allSelectedFiltered}
                    onChange={toggleAll}
                    aria-label="Seleccionar todos"
                  />
                </th>
                <th style={thStyle()}></th>
                <SortableTh label="Fecha" sortKey="date" current={sortBy} dir={sortDir} onClick={(k) => {
                  if (sortBy === k) setSortDir(sortDir === "asc" ? "desc" : "asc")
                  else { setSortBy(k); setSortDir("desc") }
                }} />
                <th style={thStyle()}>Tipo</th>
                <th style={thStyle()}>Descripción</th>
                <th style={thStyle()}>Bucket</th>
                <SortableTh label={`Monto (${currency.toUpperCase()})`} sortKey="amount" align="right" current={sortBy} dir={sortDir} onClick={(k) => {
                  if (sortBy === k) setSortDir(sortDir === "asc" ? "desc" : "asc")
                  else { setSortBy(k); setSortDir("desc") }
                }} />
                <th style={thStyle()}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={8} style={{ padding: 24, color: T.fgSubtle, textAlign: "center" }}>Sin movimientos</td></tr>
              )}
              {filtered.map((m) => (
                <MovementRow
                  key={m.key}
                  m={m}
                  currency={currency}
                  rates={rates}
                  expanded={expandedKey === m.key}
                  onToggle={() => setExpandedKey(expandedKey === m.key ? null : m.key)}
                  selected={selected.has(m.key)}
                  onToggleSelect={() => toggleOne(m.key)}
                  wallets={wallets}
                  categories={categories}
                  productCosts={productCosts}
                  onAction={onMovementAction}
                />
              ))}
            </tbody>
            {filtered.length > 0 && (
              <tfoot style={{ background: T.bgSubtle, position: "sticky", bottom: 0 }}>
                <tr>
                  <td colSpan={6} style={{ padding: "10px 14px", color: T.fgMuted, fontSize: 11, textTransform: "uppercase", letterSpacing: ".06em", fontWeight: 600 }}>
                    Totales filtrados ({filtered.length} {filtered.length === 1 ? "fila" : "filas"})
                  </td>
                  <td style={{ padding: "10px 14px", textAlign: "right", color: T.fgBase, fontWeight: 700 }}>
                    <div style={{ color: T.green }}>↑ {fmtMoney(totals.ingreso, currency)}</div>
                    <div style={{ color: T.rose }}>↓ {fmtMoney(totals.gasto, currency)}</div>
                    <div style={{ color: T.indigo }}>↻ {fmtMoney(totals.conversion, currency)}</div>
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Panel>

      <ExpenseDrawer
        open={expenseDrawerOpen}
        onClose={() => setExpenseDrawerOpen(false)}
        categories={categories}
        wallets={wallets}
        onSaved={() => { setExpenseDrawerOpen(false); onMovementAction() }}
      />
    </div>
  )
}

function thStyle(extra?: React.CSSProperties): React.CSSProperties {
  return {
    textAlign: "left",
    padding: "10px 14px",
    color: T.fgMuted,
    fontSize: 11,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: ".06em",
    borderBottom: `1px solid ${T.border}`,
    ...extra,
  }
}

function SortableTh({ label, sortKey, current, dir, onClick, align }: {
  label: string; sortKey: "date" | "amount"; current: string; dir: string; onClick: (k: "date" | "amount") => void; align?: "left" | "right"
}) {
  const active = current === sortKey
  return (
    <th style={thStyle({ cursor: "pointer", textAlign: align || "left", color: active ? T.fgBase : T.fgMuted })} onClick={() => onClick(sortKey)}>
      {label} {active ? (dir === "asc" ? "↑" : "↓") : ""}
    </th>
  )
}

function MovementRow({ m, currency, rates, expanded, onToggle, selected, onToggleSelect, wallets, categories, productCosts, onAction }: {
  m: Movement
  currency: Currency
  rates: RateContext | null
  expanded: boolean
  onToggle: () => void
  selected: boolean
  onToggleSelect: () => void
  wallets: Wallet[]
  categories: ExpenseCategory[]
  productCosts: ProductCost[]
  onAction: () => void
}) {
  const amount = currency === "eur" ? m.amount_eur : currency === "bs" ? m.amount_bs : m.amount_usdt
  const amountColor = m.type === "ingreso" ? T.green : m.type === "gasto" ? T.rose : T.indigo

  return (
    <>
      <tr
        style={{
          borderBottom: `1px solid ${T.border}`, cursor: "pointer",
          background: selected ? `${T.indigo}22` : expanded ? T.bgSubtle : "transparent",
        }}
        onClick={onToggle}
      >
        <td style={{ padding: "10px 14px" }} onClick={(e) => e.stopPropagation()}>
          <input type="checkbox" checked={selected} onChange={onToggleSelect} />
        </td>
        <td style={{ padding: "10px 14px", color: T.fgMuted }}>
          {expanded ? <ChevronDownMini /> : <ChevronRightMini />}
        </td>
        <td style={{ padding: "10px 14px", color: T.fgBase, whiteSpace: "nowrap" }}>{fmtDate(m.date)}</td>
        <td style={{ padding: "10px 14px" }}>
          <TypeIcon type={m.type} />
        </td>
        <td style={{ padding: "10px 14px", color: T.fgBase }}>
          <div>{m.description}</div>
          {m.related_order && <div style={{ color: T.fgSubtle, fontSize: 11 }}>Orden #{m.related_order}</div>}
        </td>
        <td style={{ padding: "10px 14px" }}>{m.bucket && <BucketPill bucket={m.bucket} />}</td>
        <td style={{ padding: "10px 14px", textAlign: "right", color: amountColor, fontWeight: 700, whiteSpace: "nowrap" }}>
          <MoneyTooltip amount={amount} currency={currency} rates={rates}>
            {m.type === "gasto" ? "−" : m.type === "ingreso" ? "+" : ""}{fmtMoney(amount, currency)}
          </MoneyTooltip>
        </td>
        <td style={{ padding: "10px 14px" }}>
          {m.status && (
            <Badge color={
              m.status === "convertido" ? "green" :
              m.status === "parcialmente_convertido" ? "orange" :
              m.status === "verificado" ? "blue" : "grey"
            }>{m.status.replace(/_/g, " ")}</Badge>
          )}
        </td>
      </tr>
      {expanded && (
        <tr style={{ background: T.bgSubtle, borderBottom: `1px solid ${T.border}` }}>
          <td colSpan={8} style={{ padding: 16 }}>
            {m.type === "ingreso" && (
              <IngresoExpanded pm={m.raw as PagoMovil} wallets={wallets} productCosts={productCosts} onAction={onAction} />
            )}
            {m.type === "gasto" && (
              <GastoExpanded e={m.raw as Expense} categories={categories} wallets={wallets} onAction={onAction} />
            )}
            {m.type === "conversion" && (
              <ConversionExpanded c={m.raw as Conversion & { _parent?: PagoMovil }} onAction={onAction} />
            )}
            <CommentsThread
              entityType={m.type === "ingreso" ? "pago_movil" : m.type === "gasto" ? "expense" : "conversion"}
              entityId={
                m.type === "ingreso"
                  ? (m.raw as PagoMovil).id
                  : m.type === "gasto"
                  ? (m.raw as Expense).id
                  : (m.raw as Conversion).id
              }
            />
          </td>
        </tr>
      )}
    </>
  )
}

function IngresoExpanded({ pm, wallets, productCosts, onAction }: { pm: PagoMovil; wallets: Wallet[]; productCosts: ProductCost[]; onAction: () => void }) {
  const [lines, setLines] = useState<PagoMovilLine[]>([])
  const [conversions, setConversions] = useState<Conversion[]>([])
  const [convForm, setConvForm] = useState({ amount_bs: "", amount_usdt: "", source_wallet_id: "", dest_wallet_id: "", note: "" })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const reload = useCallback(async () => {
    const d = await api<{ lines: PagoMovilLine[]; conversions: Conversion[] }>(`/admin/finanzas/pago-movil/${pm.id}`)
    setLines(d.lines || [])
    setConversions(d.conversions || [])
  }, [pm.id])
  useEffect(() => { reload() }, [reload])

  const addConversion = async () => {
    setLoading(true); setError("")
    try {
      await api("/admin/finanzas/conversions", {
        method: "POST",
        body: JSON.stringify({
          pago_movil_id: pm.id,
          amount_bs: Number(convForm.amount_bs),
          amount_usdt: Number(convForm.amount_usdt),
          source_wallet_id: convForm.source_wallet_id || undefined,
          dest_wallet_id: convForm.dest_wallet_id || undefined,
          note: convForm.note || undefined,
        }),
      })
      setConvForm({ amount_bs: "", amount_usdt: "", source_wallet_id: "", dest_wallet_id: "", note: "" })
      onAction()
      await reload()
    } catch (e) { setError((e as Error).message) }
    finally { setLoading(false) }
  }
  const deleteConv = async (id: string) => {
    if (!confirm("¿Borrar esta conversión?")) return
    await api(`/admin/finanzas/conversions/${id}`, { method: "DELETE" })
    onAction(); await reload()
  }
  const recompute = async () => {
    await api(`/admin/finanzas/pago-movil/${pm.id}/recompute`, { method: "POST" })
    onAction(); await reload()
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 16 }}>
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div style={{ color: T.fgBase, fontWeight: 600 }}>Líneas</div>
          <Button size="small" variant="secondary" onClick={recompute}><ArrowPathMini /> Recalcular</Button>
        </div>
        <div style={{ background: T.bgBase, border: `1px solid ${T.border}`, borderRadius: 8 }}>
          <table style={{ width: "100%", fontSize: 12 }}>
            <thead>
              <tr style={{ color: T.fgMuted }}>
                <th style={{ textAlign: "left", padding: "6px 10px" }}>Producto</th>
                <th style={{ textAlign: "right", padding: "6px 10px" }}>Cant</th>
                <th style={{ textAlign: "right", padding: "6px 10px" }}>Pagado</th>
                <th style={{ textAlign: "right", padding: "6px 10px" }}>Costo</th>
                <th style={{ textAlign: "right", padding: "6px 10px" }}>Margen</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => {
                const currentCost = l.variant_id
                  ? productCosts.find((c) => c.variant_id === l.variant_id)?.unit_cost_eur
                  : null
                const snapshotCost = l.unit_cost_eur
                const costDiffPct =
                  currentCost != null && snapshotCost != null && Number(snapshotCost) > 0
                    ? ((Number(currentCost) - Number(snapshotCost)) / Number(snapshotCost))
                    : null
                const showDiffBadge = costDiffPct != null && Math.abs(costDiffPct) > 0.01
                return (
                  <tr key={l.id} style={{ borderTop: `1px solid ${T.border}` }}>
                    <td style={{ padding: "6px 10px", color: T.fgBase }}>
                      {l.title}
                      {showDiffBadge && (
                        <span
                          title={`Costo actual €${currentCost} vs snapshot €${snapshotCost}. Recalcular para usar el nuevo.`}
                          style={{
                            marginLeft: 6, fontSize: 10, padding: "1px 6px",
                            borderRadius: 999, background: `${T.indigo}22`, color: T.indigo,
                            fontWeight: 600, cursor: "help",
                          }}
                        >
                          💡 costo {costDiffPct! >= 0 ? "+" : ""}{(costDiffPct! * 100).toFixed(0)}%
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "6px 10px", textAlign: "right", color: T.fgBase }}>{l.quantity}</td>
                    <td style={{ padding: "6px 10px", textAlign: "right", color: T.fgBase }}>{fmtMoney(l.line_revenue_eur, "eur")}</td>
                    <td style={{ padding: "6px 10px", textAlign: "right", color: l.line_cost_eur == null ? T.amber : T.fgBase }}>
                      {l.line_cost_eur == null ? "⚠ falta" : fmtMoney(l.line_cost_eur, "eur")}
                    </td>
                    <td style={{ padding: "6px 10px", textAlign: "right", color: l.line_margin_eur == null ? T.fgSubtle : ((l.line_margin_eur ?? 0) < 0 ? T.rose : T.green), fontWeight: 600 }}>
                      {l.line_margin_eur == null ? "—" : fmtMoney(l.line_margin_eur, "eur")}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: `1px solid ${T.borderStr}`, color: T.fgBase, fontWeight: 700 }}>
                <td colSpan={2} style={{ padding: "6px 10px" }}>Total</td>
                <td style={{ padding: "6px 10px", textAlign: "right" }}>{fmtMoney(pm.amount_eur_total, "eur")}</td>
                <td style={{ padding: "6px 10px", textAlign: "right" }}>{fmtMoney(pm.amount_eur_cogs, "eur")}</td>
                <td style={{ padding: "6px 10px", textAlign: "right" }}>{fmtMoney(pm.amount_eur_margin, "eur")}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8, fontSize: 12 }}>
          {(["restock", "gastos_fijos", "marketing", "ganancia"] as const).map((b) => (
            <div key={b} style={{
              background: T.bgBase, border: `1px solid ${T.border}`, borderLeft: `3px solid ${BUCKET_COLORS[b]}`,
              borderRadius: 8, padding: "8px 10px",
            }}>
              <div style={{ color: T.fgMuted, fontSize: 10, textTransform: "uppercase", letterSpacing: ".06em" }}>{BUCKET_LABELS[b]}</div>
              <div style={{ color: T.fgBase, fontWeight: 700 }}>{fmtMoney((pm as unknown as Record<string, number>)[`split_${b}_eur`], "eur")}</div>
              <div style={{ color: T.fgSubtle, fontSize: 10 }}>{fmtMoney((pm as unknown as Record<string, number>)[`split_${b}_bs`], "bs")}</div>
              <div style={{ color: T.fgSubtle, fontSize: 10 }}>{fmtMoney((pm as unknown as Record<string, number>)[`split_${b}_usdt`], "usdt")}</div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div style={{ color: T.fgBase, fontWeight: 600, marginBottom: 8 }}>Conversiones Bs → USDT</div>
        <div style={{ background: T.bgBase, border: `1px solid ${T.border}`, borderRadius: 8, padding: 10, marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: T.fgMuted, marginBottom: 6 }}>
            <span>Bs convertidos</span>
            <span style={{ color: T.fgBase, fontWeight: 600 }}>{fmtMoney(pm.bs_converted_total, "bs")} / {fmtMoney(pm.amount_bs_total, "bs")}</span>
          </div>
          <ProgressBar value={pm.bs_converted_total} max={pm.amount_bs_total} color={T.indigo} />
          <div style={{ color: T.fgSubtle, fontSize: 11, marginTop: 4 }}>
            Pendiente: {fmtMoney(pm.bs_pending, "bs")}
          </div>
        </div>

        {conversions.length > 0 && (
          <div style={{ background: T.bgBase, border: `1px solid ${T.border}`, borderRadius: 8, marginBottom: 10 }}>
            {conversions.map((c, i) => (
              <div key={c.id} style={{
                padding: "8px 10px",
                borderBottom: i < conversions.length - 1 ? `1px solid ${T.border}` : "none",
                display: "flex", justifyContent: "space-between", alignItems: "flex-start",
              }}>
                <div>
                  <div style={{ color: T.fgBase, fontSize: 13 }}>{fmtMoney(c.amount_bs, "bs")} → {fmtMoney(c.amount_usdt, "usdt")}</div>
                  <div style={{ color: T.fgSubtle, fontSize: 11 }}>
                    {fmtDateTime(c.converted_at)} · tasa {c.rate_bs_per_usdt.toLocaleString("es-VE")} Bs/USDT
                    {c.note ? ` · ${c.note}` : ""}
                  </div>
                </div>
                <Button size="small" variant="transparent" onClick={() => deleteConv(c.id)}><Trash /></Button>
              </div>
            ))}
          </div>
        )}

        {pm.bs_pending > 0 && (
          <div style={{ background: T.bgBase, border: `1px solid ${T.border}`, borderRadius: 8, padding: 10 }}>
            <div style={{ color: T.fgBase, fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Registrar conversión</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <Input placeholder="Bs convertidos" value={convForm.amount_bs} onChange={(e) => setConvForm({ ...convForm, amount_bs: e.target.value })} />
              <Input placeholder="USDT recibidos" value={convForm.amount_usdt} onChange={(e) => setConvForm({ ...convForm, amount_usdt: e.target.value })} />
              <Select value={convForm.source_wallet_id} onValueChange={(v) => setConvForm({ ...convForm, source_wallet_id: v })}>
                <Select.Trigger><Select.Value placeholder="Origen (Bs)" /></Select.Trigger>
                <Select.Content>
                  {wallets.filter((w) => w.currency === "bs").map((w) => <Select.Item key={w.id} value={w.id}>{w.name}</Select.Item>)}
                </Select.Content>
              </Select>
              <Select value={convForm.dest_wallet_id} onValueChange={(v) => setConvForm({ ...convForm, dest_wallet_id: v })}>
                <Select.Trigger><Select.Value placeholder="Destino (USDT)" /></Select.Trigger>
                <Select.Content>
                  {wallets.filter((w) => w.currency === "usdt").map((w) => <Select.Item key={w.id} value={w.id}>{w.name}</Select.Item>)}
                </Select.Content>
              </Select>
            </div>
            <Input placeholder="Nota (opcional)" value={convForm.note} onChange={(e) => setConvForm({ ...convForm, note: e.target.value })} style={{ marginTop: 8 }} />
            {error && <Text size="small" style={{ color: T.rose, marginTop: 6 }}>{error}</Text>}
            <div style={{ marginTop: 8 }}>
              <Button onClick={addConversion} disabled={loading || !convForm.amount_bs || !convForm.amount_usdt}>
                {loading ? "Guardando…" : "Guardar conversión"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function GastoExpanded({ e, categories, wallets, onAction }: { e: Expense; categories: ExpenseCategory[]; wallets: Wallet[]; onAction: () => void }) {
  const cat = categories.find((c) => c.id === e.category_id)
  const wallet = wallets.find((w) => w.id === e.paid_from_wallet_id)
  const remove = async () => {
    if (!confirm("¿Borrar este gasto?")) return
    await api(`/admin/finanzas/expenses/${e.id}`, { method: "DELETE" })
    onAction()
  }
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 16, fontSize: 13 }}>
      <KV label="Categoría" value={cat ? `${cat.name} (${BUCKET_LABELS[cat.bucket] || cat.bucket})` : e.category_id} />
      <KV label="Pagado desde" value={wallet?.name || "—"} />
      <KV label="Monto USDT" value={fmtMoney(e.amount_usdt, "usdt")} sub={e.amount_bs ? `${fmtMoney(e.amount_bs, "bs")} a ${e.rate_bs_per_usdt} Bs/USDT` : undefined} />
      <KV label="Fecha" value={fmtDateTime(e.expense_date)} />
      {e.notes && <div style={{ gridColumn: "1 / -1" }}><KV label="Notas" value={e.notes} /></div>}
      <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end", gap: 8 }}>
        {e.receipt_url && <a href={e.receipt_url} target="_blank" rel="noreferrer"><Button size="small" variant="secondary">Ver comprobante</Button></a>}
        <Button size="small" variant="danger" onClick={remove}><Trash /> Borrar</Button>
      </div>
    </div>
  )
}

function ConversionExpanded({ c, onAction }: { c: Conversion & { _parent?: PagoMovil }; onAction: () => void }) {
  const remove = async () => {
    if (!confirm("¿Borrar esta conversión? La orden vinculada volverá a tener Bs pendientes.")) return
    await api(`/admin/finanzas/conversions/${c.id}`, { method: "DELETE" })
    onAction()
  }
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 16, fontSize: 13 }}>
      <KV label="Convertido" value={`${fmtMoney(c.amount_bs, "bs")} → ${fmtMoney(c.amount_usdt, "usdt")}`} />
      <KV label="Tasa" value={`${c.rate_bs_per_usdt.toLocaleString("es-VE")} Bs/USDT`} />
      <KV label="Orden vinculada" value={c._parent ? `#${c._parent.order_display_id}` : "—"} sub={c._parent?.customer_name || undefined} />
      <KV label="Fecha" value={fmtDateTime(c.converted_at)} />
      {c.note && <div style={{ gridColumn: "1 / -1" }}><KV label="Nota" value={c.note} /></div>}
      <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end" }}>
        <Button size="small" variant="danger" onClick={remove}><Trash /> Borrar conversión</Button>
      </div>
    </div>
  )
}

function KV({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <div style={{ color: T.fgMuted, fontSize: 10, textTransform: "uppercase", letterSpacing: ".06em" }}>{label}</div>
      <div style={{ color: T.fgBase, fontWeight: 600 }}>{value}</div>
      {sub && <div style={{ color: T.fgSubtle, fontSize: 11 }}>{sub}</div>}
    </div>
  )
}

function ExpenseDrawer({ open, onClose, categories, wallets, onSaved }: {
  open: boolean
  onClose: () => void
  categories: ExpenseCategory[]
  wallets: Wallet[]
  onSaved: () => void
}) {
  const [form, setForm] = useState({
    category_id: "", description: "", amount_usdt: "",
    amount_bs: "", paid_from_wallet_id: "", expense_date: "",
    notes: "", receipt_url: "",
  })
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)
  const [ocrLoading, setOcrLoading] = useState(false)
  const [ocrResult, setOcrResult] = useState<null | {
    confidence: "high" | "medium" | "low"
    raw_notes: string | null
  }>(null)

  const handleOcrFile = async (file: File) => {
    setOcrLoading(true)
    setError("")
    setOcrResult(null)
    try {
      const reader = new FileReader()
      const dataUrl: string = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = () => reject(new Error("read_failed"))
        reader.readAsDataURL(file)
      })
      const base64 = dataUrl.split(",")[1] || ""
      const r = await api<{
        amount_usdt: number | null
        amount_bs: number | null
        merchant: string | null
        expense_date: string | null
        category_id_suggested: string | null
        description: string | null
        confidence: "high" | "medium" | "low"
        raw_notes: string | null
      }>("/admin/finanzas/expenses/ocr", {
        method: "POST",
        body: JSON.stringify({ image_base64: base64, mime_type: file.type || "image/jpeg" }),
      })
      // Auto-fill only fields that are still empty
      setForm((prev) => ({
        ...prev,
        category_id: prev.category_id || r.category_id_suggested || "",
        description:
          prev.description ||
          (r.description
            ? r.description
            : r.merchant
            ? `${r.merchant}`
            : ""),
        amount_usdt: prev.amount_usdt || (r.amount_usdt != null ? String(r.amount_usdt) : ""),
        amount_bs: prev.amount_bs || (r.amount_bs != null ? String(r.amount_bs) : ""),
        expense_date: prev.expense_date || r.expense_date || "",
        notes: prev.notes || (r.raw_notes ?? ""),
      }))
      setOcrResult({ confidence: r.confidence, raw_notes: r.raw_notes })
    } catch (e) {
      setError(`OCR: ${(e as Error).message}`)
    } finally {
      setOcrLoading(false)
    }
  }

  const submit = async () => {
    setSaving(true); setError("")
    try {
      await api("/admin/finanzas/expenses", {
        method: "POST",
        body: JSON.stringify({
          category_id: form.category_id,
          description: form.description,
          amount_usdt: Number(form.amount_usdt),
          amount_bs: form.amount_bs ? Number(form.amount_bs) : undefined,
          paid_from_wallet_id: form.paid_from_wallet_id || undefined,
          expense_date: form.expense_date || undefined,
          notes: form.notes || undefined,
          receipt_url: form.receipt_url || undefined,
        }),
      })
      setForm({ category_id: "", description: "", amount_usdt: "", amount_bs: "", paid_from_wallet_id: "", expense_date: "", notes: "", receipt_url: "" })
      onSaved()
    } catch (e) { setError((e as Error).message) }
    finally { setSaving(false) }
  }

  return (
    <Drawer open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <Drawer.Content>
        <Drawer.Header><Drawer.Title>Registrar gasto</Drawer.Title></Drawer.Header>
        <Drawer.Body>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {/* OCR upload */}
            <div style={{
              background: T.bgSubtle, border: `1px dashed ${T.border}`,
              borderRadius: 10, padding: "10px 12px", display: "flex",
              alignItems: "center", gap: 10,
            }}>
              <span style={{ fontSize: 22 }}>📷</span>
              <div style={{ flex: 1 }}>
                <div style={{ color: T.fgBase, fontSize: 13, fontWeight: 600 }}>
                  Auto-llenar desde foto del comprobante
                </div>
                <div style={{ color: T.fgSubtle, fontSize: 11 }}>
                  Subí una foto y Claude extrae monto, fecha, comercio y sugiere categoría.
                </div>
                {ocrResult && (
                  <div style={{ marginTop: 6, fontSize: 11 }}>
                    <Badge color={ocrResult.confidence === "high" ? "green" : ocrResult.confidence === "medium" ? "orange" : "grey"}>
                      Confianza: {ocrResult.confidence}
                    </Badge>
                    {ocrResult.raw_notes && (
                      <span style={{ color: T.fgSubtle, marginLeft: 6 }}>{ocrResult.raw_notes}</span>
                    )}
                  </div>
                )}
              </div>
              <label style={{
                background: T.indigo, color: "#fff", padding: "6px 12px",
                borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer",
                opacity: ocrLoading ? 0.6 : 1,
              }}>
                {ocrLoading ? "Analizando…" : "Subir"}
                <input
                  type="file" accept="image/*" style={{ display: "none" }}
                  disabled={ocrLoading}
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleOcrFile(file)
                    e.target.value = ""
                  }}
                />
              </label>
            </div>

            <Field label="Categoría">
              <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })}>
                <Select.Trigger><Select.Value placeholder="Elegir categoría" /></Select.Trigger>
                <Select.Content>
                  {categories.filter((c) => c.is_active).map((c) => (
                    <Select.Item key={c.id} value={c.id}>{c.name} — {BUCKET_LABELS[c.bucket] || c.bucket}</Select.Item>
                  ))}
                </Select.Content>
              </Select>
            </Field>
            <Field label="Descripción">
              <Input placeholder="Ej. Anuncios IG septiembre" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </Field>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <Field label="Monto (USDT)">
                <Input type="number" step="0.01" value={form.amount_usdt} onChange={(e) => setForm({ ...form, amount_usdt: e.target.value })} />
              </Field>
              <Field label="Monto (Bs) opcional">
                <Input type="number" step="0.01" value={form.amount_bs} onChange={(e) => setForm({ ...form, amount_bs: e.target.value })} />
              </Field>
            </div>
            <Field label="Pagado desde">
              <Select value={form.paid_from_wallet_id} onValueChange={(v) => setForm({ ...form, paid_from_wallet_id: v })}>
                <Select.Trigger><Select.Value placeholder="Wallet" /></Select.Trigger>
                <Select.Content>
                  {wallets.map((w) => <Select.Item key={w.id} value={w.id}>{w.name} ({w.currency})</Select.Item>)}
                </Select.Content>
              </Select>
            </Field>
            <Field label="Fecha">
              <Input type="date" value={form.expense_date} onChange={(e) => setForm({ ...form, expense_date: e.target.value })} />
            </Field>
            <Field label="URL de comprobante (opcional)">
              <Input value={form.receipt_url} onChange={(e) => setForm({ ...form, receipt_url: e.target.value })} placeholder="https://…" />
            </Field>
            <Field label="Notas">
              <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </Field>
            {error && <Text size="small" style={{ color: T.rose }}>{error}</Text>}
          </div>
        </Drawer.Body>
        <Drawer.Footer>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={saving || !form.category_id || !form.description || !form.amount_usdt}>
            {saving ? "Guardando…" : "Guardar gasto"}
          </Button>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ color: T.fgMuted, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 4 }}>{label}</div>
      {children}
    </div>
  )
}

// ───── CONFIGURACIÓN TAB ──────────────────────────────────────────────────────
type ConfigSection = "splits" | "wallets" | "categories" | "costs"

function ConfigTab({ onChange }: { onChange: () => void }) {
  const [section, setSection] = useState<ConfigSection>("splits")
  const sections: Array<{ id: ConfigSection; label: string; sub: string }> = [
    { id: "splits",     label: "Splits del margen", sub: "Cómo se reparte el margen bruto" },
    { id: "wallets",    label: "Wallets",            sub: "Cuentas Bs / USDT" },
    { id: "categories", label: "Categorías de gasto", sub: "Buckets + recurrentes" },
    { id: "costs",      label: "Costos por producto", sub: "Snapshot por variante" },
  ]
  return (
    <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 16 }}>
      <Panel padded={false}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {sections.map((s) => (
            <button
              key={s.id}
              onClick={() => setSection(s.id)}
              style={{
                textAlign: "left",
                padding: "10px 14px",
                background: section === s.id ? T.bgHover : "transparent",
                border: "none",
                borderLeft: `3px solid ${section === s.id ? T.indigo : "transparent"}`,
                cursor: "pointer",
              }}
            >
              <div style={{ color: T.fgBase, fontWeight: 600, fontSize: 13 }}>{s.label}</div>
              <div style={{ color: T.fgSubtle, fontSize: 11, marginTop: 2 }}>{s.sub}</div>
            </button>
          ))}
        </div>
      </Panel>
      <div>
        {section === "splits"     && <SplitsSection onChange={onChange} />}
        {section === "wallets"    && <WalletsSection onChange={onChange} />}
        {section === "categories" && <CategoriesSection onChange={onChange} />}
        {section === "costs"      && <CostsSection onChange={onChange} />}
      </div>
    </div>
  )
}

function SplitsSection({ onChange }: { onChange: () => void }) {
  const [rules, setRules] = useState<SplitRule[]>([])
  const [error, setError] = useState("")
  const [saved, setSaved] = useState(false)

  const reload = useCallback(async () => {
    const r = await api<{ rules: SplitRule[] }>("/admin/finanzas/split-rules")
    setRules(r.rules)
  }, [])
  useEffect(() => { reload() }, [reload])

  const sum = rules.reduce((s, r) => s + Number(r.percentage), 0)

  return (
    <Panel>
      <Heading level="h2" style={{ fontSize: 16, marginBottom: 4 }}>Splits del margen bruto</Heading>
      <Text size="small" style={{ color: T.fgSubtle, marginBottom: 16 }}>
        Estos % se aplican al <b>margen</b> de cada orden (ingreso − COGS). Restock siempre es el costo literal de los artículos.
      </Text>
      <div style={{ display: "grid", gridTemplateColumns: "max-content 1fr 1fr", gap: 14, alignItems: "center", maxWidth: 600 }}>
        {rules.map((r) => (
          <Fragment key={r.id}>
            <BucketPill bucket={r.bucket} />
            <Input
              type="number" min={0} max={100}
              value={r.percentage}
              onChange={(e) => setRules(rules.map((x) => x.id === r.id ? { ...x, percentage: Number(e.target.value) } : x))}
            />
            <ProgressBar value={Number(r.percentage)} max={100} color={BUCKET_COLORS[r.bucket] || T.indigo} />
          </Fragment>
        ))}
      </div>
      <div style={{ marginTop: 16, color: Math.round(sum) === 100 ? T.green : T.rose, fontWeight: 600 }}>
        Suma: {sum}% {Math.round(sum) === 100 ? "✓" : "(debe sumar 100)"}
      </div>
      {error && <Text size="small" style={{ color: T.rose, marginTop: 6 }}>{error}</Text>}
      {saved && <Text size="small" style={{ color: T.green, marginTop: 6 }}>Guardado ✓</Text>}
      <div style={{ marginTop: 12 }}>
        <Button
          disabled={Math.round(sum) !== 100}
          onClick={async () => {
            setError(""); setSaved(false)
            try {
              await api("/admin/finanzas/split-rules", {
                method: "PUT",
                body: JSON.stringify({ rules: rules.map((r) => ({ bucket: r.bucket, percentage: r.percentage })) }),
              })
              setSaved(true); onChange()
            } catch (e) { setError((e as Error).message) }
          }}
        >Guardar</Button>
      </div>
    </Panel>
  )
}

// React Fragment alias to keep JSX clean inside grid
function Fragment(props: { children: React.ReactNode }) {
  return <>{props.children}</>
}

function WalletsSection({ onChange }: { onChange: () => void }) {
  const [wallets, setWallets] = useState<Wallet[]>([])
  const [form, setForm] = useState({ name: "", currency: "usdt" })

  const reload = useCallback(async () => {
    const r = await api<{ wallets: Wallet[] }>("/admin/finanzas/wallets")
    setWallets(r.wallets)
  }, [])
  useEffect(() => { reload() }, [reload])

  const create = async () => {
    if (!form.name) return
    await api("/admin/finanzas/wallets", { method: "POST", body: JSON.stringify(form) })
    setForm({ name: "", currency: "usdt" }); reload(); onChange()
  }
  const update = async (id: string, patch: Partial<Wallet>) => {
    await api(`/admin/finanzas/wallets/${id}`, { method: "PATCH", body: JSON.stringify(patch) })
    reload(); onChange()
  }
  const remove = async (id: string) => {
    if (!confirm("¿Borrar wallet?")) return
    await api(`/admin/finanzas/wallets/${id}`, { method: "DELETE" })
    reload(); onChange()
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Panel>
        <Heading level="h2" style={{ fontSize: 16, marginBottom: 8 }}>Wallets</Heading>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr auto", gap: 8 }}>
          <Input placeholder="Nombre (ej. Daniel Binance)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v })}>
            <Select.Trigger><Select.Value /></Select.Trigger>
            <Select.Content>
              <Select.Item value="bs">Bs</Select.Item>
              <Select.Item value="usdt">USDT</Select.Item>
              <Select.Item value="eur">EUR</Select.Item>
              <Select.Item value="usd">USD</Select.Item>
            </Select.Content>
          </Select>
          <Button onClick={create} disabled={!form.name}><Plus /> Agregar</Button>
        </div>
      </Panel>
      <Panel padded={false}>
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Nombre</Table.HeaderCell>
              <Table.HeaderCell>Moneda</Table.HeaderCell>
              <Table.HeaderCell>Activa</Table.HeaderCell>
              <Table.HeaderCell></Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {wallets.map((w) => (
              <Table.Row key={w.id}>
                <Table.Cell>{w.name}</Table.Cell>
                <Table.Cell><Badge>{w.currency.toUpperCase()}</Badge></Table.Cell>
                <Table.Cell>
                  <input type="checkbox" checked={w.is_active} onChange={(e) => update(w.id, { is_active: e.target.checked })} />
                </Table.Cell>
                <Table.Cell><Button size="small" variant="transparent" onClick={() => remove(w.id)}><Trash /></Button></Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      </Panel>
    </div>
  )
}

function CategoriesSection({ onChange }: { onChange: () => void }) {
  const [cats, setCats] = useState<ExpenseCategory[]>([])
  const [form, setForm] = useState({ name: "", bucket: "gastos_fijos", is_recurring: false, recurring_amount_usdt: "", recurring_day_of_month: "" })

  const reload = useCallback(async () => {
    const r = await api<{ categories: ExpenseCategory[] }>("/admin/finanzas/expense-categories")
    setCats(r.categories)
  }, [])
  useEffect(() => { reload() }, [reload])

  const create = async () => {
    await api("/admin/finanzas/expense-categories", {
      method: "POST",
      body: JSON.stringify({
        name: form.name,
        bucket: form.bucket,
        is_recurring: form.is_recurring,
        recurring_amount_usdt: form.recurring_amount_usdt ? Number(form.recurring_amount_usdt) : undefined,
        recurring_day_of_month: form.recurring_day_of_month ? Number(form.recurring_day_of_month) : undefined,
      }),
    })
    setForm({ name: "", bucket: "gastos_fijos", is_recurring: false, recurring_amount_usdt: "", recurring_day_of_month: "" })
    reload(); onChange()
  }
  const update = async (id: string, patch: Partial<ExpenseCategory>) => {
    await api(`/admin/finanzas/expense-categories/${id}`, { method: "PATCH", body: JSON.stringify(patch) })
    reload(); onChange()
  }
  const remove = async (id: string) => {
    if (!confirm("¿Borrar categoría?")) return
    await api(`/admin/finanzas/expense-categories/${id}`, { method: "DELETE" })
    reload(); onChange()
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Panel>
        <Heading level="h2" style={{ fontSize: 16, marginBottom: 8 }}>Categorías de gasto</Heading>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8, alignItems: "center" }}>
          <Input placeholder="Nombre" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Select value={form.bucket} onValueChange={(v) => setForm({ ...form, bucket: v })}>
            <Select.Trigger><Select.Value /></Select.Trigger>
            <Select.Content>
              {Object.keys(BUCKET_LABELS).map((b) => <Select.Item key={b} value={b}>{BUCKET_LABELS[b]}</Select.Item>)}
            </Select.Content>
          </Select>
          <label style={{ display: "flex", alignItems: "center", gap: 6, color: T.fgBase, fontSize: 13 }}>
            <input type="checkbox" checked={form.is_recurring} onChange={(e) => setForm({ ...form, is_recurring: e.target.checked })} />
            Recurrente
          </label>
          <Input type="number" step="0.01" placeholder="USDT/mes" value={form.recurring_amount_usdt} onChange={(e) => setForm({ ...form, recurring_amount_usdt: e.target.value })} />
          <Input type="number" placeholder="Día (1-28)" value={form.recurring_day_of_month} onChange={(e) => setForm({ ...form, recurring_day_of_month: e.target.value })} />
          <Button onClick={create} disabled={!form.name}><Plus /> Agregar</Button>
        </div>
      </Panel>
      <Panel padded={false}>
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Nombre</Table.HeaderCell>
              <Table.HeaderCell>Bucket</Table.HeaderCell>
              <Table.HeaderCell>Recurrente</Table.HeaderCell>
              <Table.HeaderCell>$/mes</Table.HeaderCell>
              <Table.HeaderCell>Día</Table.HeaderCell>
              <Table.HeaderCell>Activa</Table.HeaderCell>
              <Table.HeaderCell></Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {cats.map((c) => (
              <Table.Row key={c.id}>
                <Table.Cell>{c.name}</Table.Cell>
                <Table.Cell><BucketPill bucket={c.bucket} /></Table.Cell>
                <Table.Cell>{c.is_recurring ? "Sí" : "—"}</Table.Cell>
                <Table.Cell>{c.recurring_amount_usdt ? fmtMoney(c.recurring_amount_usdt, "usdt") : "—"}</Table.Cell>
                <Table.Cell>{c.recurring_day_of_month || "—"}</Table.Cell>
                <Table.Cell><input type="checkbox" checked={c.is_active} onChange={(e) => update(c.id, { is_active: e.target.checked })} /></Table.Cell>
                <Table.Cell><Button size="small" variant="transparent" onClick={() => remove(c.id)}><Trash /></Button></Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      </Panel>
    </div>
  )
}

function CostsSection({ onChange }: { onChange: () => void }) {
  const [costs, setCosts] = useState<ProductCost[]>([])
  const [variants, setVariants] = useState<ProductVariant[]>([])
  const [edits, setEdits] = useState<Record<string, string>>({})
  const [search, setSearch] = useState("")

  const reload = useCallback(async () => {
    const r = await api<{ costs: ProductCost[]; variants: ProductVariant[] }>("/admin/finanzas/product-costs")
    setCosts(r.costs)
    setVariants(r.variants)
  }, [])
  useEffect(() => { reload() }, [reload])

  const costByVariant = new Map(costs.map((c) => [c.variant_id, c]))

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase()
    return variants.filter((v) =>
      !s ||
      v.product_title.toLowerCase().includes(s) ||
      (v.variant_title || "").toLowerCase().includes(s) ||
      (v.sku || "").toLowerCase().includes(s)
    )
  }, [variants, search])

  const save = async (variantId: string, info: ProductVariant) => {
    const value = edits[variantId]
    if (value === undefined || value === "") return
    await api("/admin/finanzas/product-costs", {
      method: "POST",
      body: JSON.stringify({
        variant_id: variantId,
        product_handle: info.product_handle,
        variant_title: info.variant_title,
        unit_cost_eur: Number(value),
      }),
    })
    const next = { ...edits }; delete next[variantId]; setEdits(next)
    reload(); onChange()
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Panel>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <Heading level="h2" style={{ fontSize: 16 }}>Costos por producto</Heading>
          <div style={{ flex: "0 0 280px" }}>
            <Input placeholder="Buscar producto…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
        <Text size="small" style={{ color: T.fgSubtle, marginTop: 6 }}>
          Editá cualquier costo y presiona Enter para guardar. Las órdenes ya registradas mantienen su snapshot — usá "Recalcular" desde la fila de la orden si querés actualizar.
        </Text>
      </Panel>

      <Panel padded={false}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead style={{ background: T.bgSubtle }}>
            <tr>
              <th style={thStyle()}>Producto</th>
              <th style={thStyle()}>Variante</th>
              <th style={thStyle()}>SKU</th>
              <th style={thStyle({ textAlign: "right" })}>Costo €</th>
              <th style={thStyle()}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((v) => {
              const cost = costByVariant.get(v.variant_id)
              const editing = edits[v.variant_id] !== undefined
              const value = editing ? edits[v.variant_id] : (cost ? String(cost.unit_cost_eur) : "")
              return (
                <tr key={v.variant_id} style={{ borderTop: `1px solid ${T.border}` }}>
                  <td style={{ padding: "8px 14px", color: T.fgBase }}>{v.product_title}</td>
                  <td style={{ padding: "8px 14px", color: T.fgSubtle }}>{v.variant_title || "—"}</td>
                  <td style={{ padding: "8px 14px", color: T.fgSubtle, fontSize: 12 }}>{v.sku || "—"}</td>
                  <td style={{ padding: "8px 14px", textAlign: "right" }}>
                    <input
                      type="number" step="0.0001" value={value}
                      onChange={(e) => setEdits({ ...edits, [v.variant_id]: e.target.value })}
                      onKeyDown={(e) => { if (e.key === "Enter") save(v.variant_id, v) }}
                      placeholder={cost ? "" : "sin costo"}
                      style={{
                        width: 110, textAlign: "right",
                        background: editing ? T.warnBg : T.bgSubtle,
                        border: `1px solid ${editing ? T.warn : T.border}`,
                        color: T.fgBase, borderRadius: 6, padding: "4px 8px", fontSize: 13,
                      }}
                    />
                  </td>
                  <td style={{ padding: "8px 14px" }}>
                    {editing ? (
                      <Button size="small" onClick={() => save(v.variant_id, v)}>Guardar</Button>
                    ) : !cost ? (
                      <Badge color="orange">sin costo</Badge>
                    ) : (
                      <span style={{ color: T.fgSubtle, fontSize: 11 }}>OK</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </Panel>
    </div>
  )
}

// ───── PAGE ROOT ──────────────────────────────────────────────────────────────
const FinanzasPage = () => {
  const today = new Date()
  const [month, setMonth] = useState(`${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, "0")}`)
  const [currency, setCurrency] = useState<Currency>("usdt")

  const [summary, setSummary] = useState<Summary | null>(null)
  const [pagoMovils, setPagoMovils] = useState<PagoMovil[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [conversions, setConversions] = useState<Conversion[]>([])
  const [categories, setCategories] = useState<ExpenseCategory[]>([])
  const [wallets, setWallets] = useState<Wallet[]>([])
  const [splitRules, setSplitRules] = useState<SplitRule[]>([])
  const [productCosts, setProductCosts] = useState<ProductCost[]>([])
  const [multiMonth, setMultiMonth] = useState<MultiMonthBucket[]>([])
  const [profitability, setProfitability] = useState<ProfitabilityRow[]>([])
  const [channelRows, setChannelRows] = useState<ChannelRow[]>([])
  const [ltv, setLtv] = useState<LtvRow[]>([])
  const [forecast, setForecast] = useState<ForecastPayload | null>(null)
  const [runway, setRunway] = useState<RunwayPayload | null>(null)
  const [breakeven, setBreakeven] = useState<BreakevenPayload | null>(null)
  const [recommender, setRecommender] = useState<RecommenderPayload | null>(null)
  const [spreadPl, setSpreadPl] = useState<SpreadPlPayload | null>(null)
  const [restock, setRestock] = useState<RestockPayload | null>(null)
  // FA1: marketing + ops widgets absorbed from analytics
  const [campaignRevenue, setCampaignRevenue] = useState<CampaignRevenuePayload | null>(null)
  const [topCities, setTopCities] = useState<TopCitiesPayload | null>(null)
  const [pendingAging, setPendingAging] = useState<PendingAgingPayload | null>(null)
  const [graduationRate, setGraduationRate] = useState<GraduationRatePayload | null>(null)
  // FA2: per-location restock detail + warehouse distribution
  const [restockDetail, setRestockDetail] = useState<RestockDetailPayload | null>(null)
  const [warehouseDist, setWarehouseDist] = useState<WarehouseDistributionPayload | null>(null)
  const [walletSparklines, setWalletSparklines] = useState<Map<string, WalletSparklineData>>(new Map())
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [compareOpen, setCompareOpen] = useState(false)
  const [compareMonth, setCompareMonth] = useState<Summary | null>(null)

  const reloadAll = useCallback(async () => {
    const [s, pm, ex, cv, cat, w, sr, pc, mm, prof, ch, lt, fc, rw, be, rec, sp, rs, camp, tc, pag, gr, rd, whd] = await Promise.all([
      api<Summary>(`/admin/finanzas/summary?month=${month}`),
      api<{ pago_movils: PagoMovil[] }>("/admin/finanzas/pago-movil?limit=200"),
      api<{ expenses: Expense[] }>("/admin/finanzas/expenses?limit=500"),
      api<{ conversions: Conversion[] }>("/admin/finanzas/conversions"),
      api<{ categories: ExpenseCategory[] }>("/admin/finanzas/expense-categories"),
      api<{ wallets: Wallet[] }>("/admin/finanzas/wallets"),
      api<{ rules: SplitRule[] }>("/admin/finanzas/split-rules"),
      api<{ costs: ProductCost[] }>("/admin/finanzas/product-costs"),
      api<{ months: MultiMonthBucket[] }>("/admin/finanzas/reports/multi-month?months=12"),
      api<{ rows: ProfitabilityRow[] }>(`/admin/finanzas/reports/profitability?month=${month}&group=product&limit=20`),
      api<{ channels: ChannelRow[] }>(`/admin/finanzas/reports/channels?month=${month}`),
      api<{ rows: LtvRow[] }>(`/admin/finanzas/reports/customer-ltv?limit=10`),
      api<ForecastPayload>(`/admin/finanzas/reports/forecast?month=${month}`),
      api<RunwayPayload>("/admin/finanzas/reports/runway"),
      api<BreakevenPayload>("/admin/finanzas/reports/breakeven"),
      api<RecommenderPayload>("/admin/finanzas/reports/recommender"),
      api<SpreadPlPayload>(`/admin/finanzas/reports/spread-pl?month=${month}`),
      api<RestockPayload>("/admin/finanzas/reports/restock-prediction?days=30"),
      // FA1: campaigns + cities scope to the selected month; pending-aging + graduation are lifetime/rolling.
      api<CampaignRevenuePayload>(`/admin/finanzas/reports/campaign-revenue?month=${month}`),
      api<TopCitiesPayload>(`/admin/finanzas/reports/top-cities?month=${month}`),
      api<PendingAgingPayload>("/admin/finanzas/reports/pending-aging"),
      api<GraduationRatePayload>("/admin/finanzas/reports/graduation-rate"),
      // FA2: per-location stock detail + warehouse distribution
      api<RestockDetailPayload>("/admin/finanzas/reports/restock-detail"),
      api<WarehouseDistributionPayload>(`/admin/finanzas/reports/warehouse-distribution?month=${month}`),
    ])
    setSummary(s)
    setPagoMovils(pm.pago_movils)
    setExpenses(ex.expenses)
    setConversions(cv.conversions)
    setCategories(cat.categories)
    setWallets(w.wallets)
    setSplitRules(sr.rules)
    setProductCosts(pc.costs)
    setMultiMonth(mm.months)
    setProfitability(prof.rows)
    setChannelRows(ch.channels)
    setLtv(lt.rows)
    setForecast(fc)
    setRunway(rw)
    setBreakeven(be)
    setRecommender(rec)
    setSpreadPl(sp)
    setRestock(rs)
    setCampaignRevenue(camp)
    setTopCities(tc)
    setPendingAging(pag)
    setGraduationRate(gr)
    setRestockDetail(rd)
    setWarehouseDist(whd)

    // Per-wallet sparkline series (parallel)
    const sparkResults = await Promise.all(
      w.wallets.map(async (wal) => {
        try {
          const led = await api<{ daily: WalletSparklineData }>(`/admin/finanzas/wallets/${wal.id}/ledger?days=30`)
          return [wal.id, led.daily] as const
        } catch {
          return [wal.id, [] as WalletSparklineData] as const
        }
      })
    )
    setWalletSparklines(new Map(sparkResults))
  }, [month])
  useEffect(() => { reloadAll() }, [reloadAll])

  // Build unified movements list (lifetime; the dashboard filters by month, the
  // ledger shows everything by default).
  const movements = useMemo<Movement[]>(() => {
    const out: Movement[] = []
    const pmById = new Map(pagoMovils.map((p) => [p.id, p]))
    for (const pm of pagoMovils) {
      out.push({
        key: `pm:${pm.id}`,
        type: "ingreso",
        date: pm.created_at,
        description: `Orden #${pm.order_display_id} · ${pm.customer_name || "Cliente"}`,
        related_order: pm.order_display_id,
        amount_eur: pm.amount_eur_total,
        amount_bs: pm.amount_bs_total,
        amount_usdt: pm.amount_usdt_theoretical,
        status: pm.status,
        bucket: null,
        raw: pm,
      })
    }
    const catById = new Map(categories.map((c) => [c.id, c]))
    for (const e of expenses) {
      const cat = catById.get(e.category_id)
      out.push({
        key: `ex:${e.id}`,
        type: "gasto",
        date: e.expense_date,
        description: e.description,
        category: cat?.name || null,
        bucket: cat?.bucket || null,
        amount_eur: null,
        amount_bs: e.amount_bs,
        amount_usdt: e.amount_usdt,
        raw: e,
      })
    }
    for (const c of conversions) {
      const parent = pmById.get(c.pago_movil_id)
      out.push({
        key: `cv:${c.id}`,
        type: "conversion",
        date: c.converted_at,
        description: `Conversión Bs → USDT${parent ? ` · #${parent.order_display_id}` : ""}`,
        related_order: parent?.order_display_id || null,
        amount_eur: null,
        amount_bs: c.amount_bs,
        amount_usdt: c.amount_usdt,
        bucket: null,
        raw: { ...c, _parent: parent },
      })
    }
    out.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    return out
  }, [pagoMovils, expenses, conversions, categories])

  // Movements within the selected month (for Dashboard recent activity)
  const monthMovements = useMemo(() => {
    const [y, m] = month.split("-").map(Number)
    return movements.filter((mv) => {
      const d = new Date(mv.date)
      return d.getUTCFullYear() === y && (d.getUTCMonth() + 1) === m
    })
  }, [movements, month])

  // Derive rates context from the latest recommender snapshot
  const rates = useMemo<RateContext | null>(() => {
    const ls = recommender?.latest_snapshot
    if (!ls) return null
    return {
      bcv_eur: Number(ls.bcv_eur) || 567,
      bcv_usd: Number(ls.bcv_usd) || 485,
      paralelo_usdt: ls.paralelo_usdt ? Number(ls.paralelo_usdt) : null,
    }
  }, [recommender])

  // Cmd+K / Ctrl+K listener
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setPaletteOpen((v) => !v)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  // Build palette command items
  const paletteItems = useMemo<CommandItem[]>(() => {
    const items: CommandItem[] = []
    for (const m of movements.slice(0, 50)) {
      const amt = m.amount_eur ?? m.amount_usdt ?? m.amount_bs
      items.push({
        key: m.key,
        label: m.description,
        hint: `${m.type} · ${fmtDate(m.date)}${amt != null ? ` · ${fmtMoney(amt, "eur")}` : ""}`,
        group: "Movimientos",
        onPick: () => {
          // jump to Movements tab + scroll to the row (best effort: just open tab)
          const trigger = document.querySelector('[data-state][value="movements"]') as HTMLElement | null
          trigger?.click()
        },
      })
    }
    for (const c of categories) {
      items.push({
        key: `cat:${c.id}`,
        label: c.name,
        hint: `Categoría · ${c.bucket}${c.is_recurring ? ` · recurrente $${c.recurring_amount_usdt}/mes` : ""}`,
        group: "Categorías",
        onPick: () => {
          const trigger = document.querySelector('[data-state][value="config"]') as HTMLElement | null
          trigger?.click()
        },
      })
    }
    for (const w of wallets) {
      items.push({
        key: `wallet:${w.id}`,
        label: w.name,
        hint: `Wallet · ${w.currency.toUpperCase()}`,
        group: "Wallets",
        onPick: () => {
          const trigger = document.querySelector('[data-state][value="config"]') as HTMLElement | null
          trigger?.click()
        },
      })
    }
    for (const p of profitability.slice(0, 20)) {
      items.push({
        key: `prod:${p.product_id ?? p.variant_id}`,
        label: p.title,
        hint: `Producto · ${p.units_sold} uds · margen ${fmtMoney(p.margin_eur, "eur")}`,
        group: "Productos",
        onPick: () => { /* no detail page yet — stays on Dashboard */ },
      })
    }
    items.push({
      key: "act:expense",
      label: "Registrar gasto…",
      hint: "Movimientos → drawer",
      group: "Acciones",
      onPick: () => {
        const trigger = document.querySelector('[data-state][value="movements"]') as HTMLElement | null
        trigger?.click()
      },
    })
    items.push({
      key: "act:pl",
      label: "Descargar P&L del mes (PDF)",
      hint: `${month} · imprimible`,
      group: "Acciones",
      onPick: () => window.open(`${API}/admin/finanzas/reports/pl/print?month=${month}`, "_blank"),
    })
    items.push({
      key: "act:docx",
      label: "Descargar reporte DOCX",
      hint: `${month} · Word`,
      group: "Acciones",
      onPick: () => downloadAttachment(`${API}/admin/finanzas/reports/docx?month=${month}`),
    })
    items.push({
      key: "act:compare",
      label: "Comparar con otro mes…",
      hint: "Side-by-side",
      group: "Acciones",
      onPick: () => setCompareOpen(true),
    })
    return items
  }, [movements, categories, wallets, profitability, month])

  // When compare is opened, prefetch the previous month
  useEffect(() => {
    if (!compareOpen || compareMonth) return
    const [y, m] = month.split("-").map(Number)
    const prev = new Date(Date.UTC(y, m - 2, 1))
    const prevKey = `${prev.getUTCFullYear()}-${String(prev.getUTCMonth() + 1).padStart(2, "0")}`
    api<Summary>(`/admin/finanzas/summary?month=${prevKey}`)
      .then(setCompareMonth)
      .catch(() => setCompareMonth(null))
  }, [compareOpen, compareMonth, month])

  return (
    <Container className="p-6">
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <CurrencyDollar />
        <Heading level="h1">Finanzas</Heading>
      </div>
      <Tabs defaultValue="dashboard">
        <Tabs.List>
          <Tabs.Trigger value="dashboard">Dashboard</Tabs.Trigger>
          <Tabs.Trigger value="movements">Movimientos</Tabs.Trigger>
          <Tabs.Trigger value="config">Configuración</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="dashboard" style={{ paddingTop: 18 }}>
          <DashboardTab
            month={month} setMonth={setMonth}
            currency={currency} setCurrency={setCurrency}
            summary={summary}
            movements={monthMovements}
            multiMonth={multiMonth}
            profitability={profitability}
            channels={channelRows}
            ltv={ltv}
            forecast={forecast}
            runway={runway}
            breakeven={breakeven}
            recommender={recommender}
            spreadPl={spreadPl}
            restock={restock}
            walletSparklines={walletSparklines}
            campaignRevenue={campaignRevenue}
            topCities={topCities}
            pendingAging={pendingAging}
            graduationRate={graduationRate}
            restockDetail={restockDetail}
            warehouseDist={warehouseDist}
            reload={reloadAll}
          />
        </Tabs.Content>
        <Tabs.Content value="movements" style={{ paddingTop: 18 }}>
          <MovementsTab
            movements={movements}
            reload={reloadAll}
            currency={currency} setCurrency={setCurrency}
            categories={categories} wallets={wallets}
            splitRules={splitRules} productCosts={productCosts}
            rates={rates}
            onMovementAction={reloadAll}
          />
        </Tabs.Content>
        <Tabs.Content value="config" style={{ paddingTop: 18 }}>
          <ConfigTab onChange={reloadAll} />
        </Tabs.Content>
      </Tabs>
      <CommandPalette open={paletteOpen} items={paletteItems} onClose={() => setPaletteOpen(false)} />
      <CompareDrawer
        open={compareOpen}
        onClose={() => { setCompareOpen(false); setCompareMonth(null) }}
        currentSummary={summary}
        currentMonth={month}
        otherSummary={compareMonth}
        currency={currency}
      />
      {/* Cmd+K hint floating chip */}
      <div style={{
        position: "fixed", bottom: 16, right: 16, padding: "6px 10px",
        background: T.bgBase, border: `1px solid ${T.border}`, borderRadius: 999,
        color: T.fgSubtle, fontSize: 11, display: "flex", alignItems: "center", gap: 6,
        boxShadow: "0 4px 12px rgba(0,0,0,0.3)", cursor: "pointer", userSelect: "none",
      }} onClick={() => setPaletteOpen(true)}>
        <span style={{ fontFamily: "monospace", color: T.fgBase }}>⌘K</span>
        <span>buscar</span>
      </div>
    </Container>
  )
}

// ───── B7: Side-by-side compare drawer ───────────────────────────────────────
function CompareDrawer({ open, onClose, currentSummary, currentMonth, otherSummary, currency }: {
  open: boolean
  onClose: () => void
  currentSummary: Summary | null
  currentMonth: string
  otherSummary: Summary | null
  currency: Currency
}) {
  if (!open || !currentSummary) return null
  const otherMonth = otherSummary?.month || "—"

  const pickRev = (s: Summary | null) =>
    !s ? 0 : currency === "eur" ? s.totals.revenue_eur : currency === "bs" ? s.totals.revenue_bs : s.totals.revenue_usdt_theoretical

  const rows = [
    { label: "Órdenes", a: currentSummary.totals.orders, b: otherSummary?.totals.orders ?? 0, fmt: (x: number) => String(x) },
    { label: "Ingresos", a: pickRev(currentSummary), b: pickRev(otherSummary), fmt: (x: number) => fmtMoney(x, currency) },
    { label: "Margen bruto", a: currentSummary.totals.margin_eur, b: otherSummary?.totals.margin_eur ?? 0, fmt: (x: number) => fmtMoney(x, "eur") },
    { label: "COGS", a: currentSummary.totals.cogs_eur, b: otherSummary?.totals.cogs_eur ?? 0, fmt: (x: number) => fmtMoney(x, "eur") },
    { label: "Bs por convertir", a: currentSummary.totals.bs_pending, b: otherSummary?.totals.bs_pending ?? 0, fmt: (x: number) => `Bs ${x.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
    { label: "Restock (split)", a: currentSummary.splits.restock.eur, b: otherSummary?.splits.restock.eur ?? 0, fmt: (x: number) => fmtMoney(x, "eur") },
    { label: "Gastos fijos (split)", a: currentSummary.splits.gastos_fijos.eur, b: otherSummary?.splits.gastos_fijos.eur ?? 0, fmt: (x: number) => fmtMoney(x, "eur") },
    { label: "Marketing (split)", a: currentSummary.splits.marketing.eur, b: otherSummary?.splits.marketing.eur ?? 0, fmt: (x: number) => fmtMoney(x, "eur") },
    { label: "Ganancia (split)", a: currentSummary.splits.ganancia.eur, b: otherSummary?.splits.ganancia.eur ?? 0, fmt: (x: number) => fmtMoney(x, "eur") },
  ]

  const delta = (a: number, b: number) => {
    if (b <= 0) return null
    return (a - b) / b
  }

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
        zIndex: 9999, display: "flex", justifyContent: "center", alignItems: "center", padding: 24,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(720px, 92vw)", background: T.bgBase, border: `1px solid ${T.border}`,
          borderRadius: 12, overflow: "hidden",
        }}
      >
        <div style={{ padding: "14px 16px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ color: T.fgBase, fontWeight: 700, fontSize: 16 }}>Comparativo · {currentMonth} vs {otherMonth}</div>
          <Button size="small" variant="secondary" onClick={onClose}>Cerrar</Button>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead style={{ background: T.bgSubtle }}>
            <tr>
              <th style={thStyle()}>Métrica</th>
              <th style={thStyle({ textAlign: "right" })}>{currentMonth}</th>
              <th style={thStyle({ textAlign: "right" })}>{otherMonth}</th>
              <th style={thStyle({ textAlign: "right" })}>Δ</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const d = delta(r.a, r.b)
              return (
                <tr key={r.label} style={{ borderTop: `1px solid ${T.border}` }}>
                  <td style={{ padding: "8px 14px", color: T.fgBase }}>{r.label}</td>
                  <td style={{ padding: "8px 14px", textAlign: "right", color: T.fgBase, fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>{r.fmt(r.a)}</td>
                  <td style={{ padding: "8px 14px", textAlign: "right", color: T.fgSubtle, fontVariantNumeric: "tabular-nums" }}>{r.fmt(r.b)}</td>
                  <td style={{ padding: "8px 14px", textAlign: "right", fontWeight: 600, color: d == null ? T.fgSubtle : d >= 0 ? T.green : T.rose, fontVariantNumeric: "tabular-nums" }}>
                    {d == null ? "—" : `${d >= 0 ? "+" : ""}${(d * 100).toFixed(1)}%`}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export const config = defineRouteConfig({
  label: "Finanzas",
  icon: CurrencyDollar,
})

export default FinanzasPage
