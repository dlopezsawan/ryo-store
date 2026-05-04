/**
 * Helpers compartidos entre las páginas de Finanzas.
 * Server-side puro (sin "use client").
 */

import type {
  FinanzasPagoMovil, FinanzasExpense, FinanzasConversion, FinanzasRunwayReport,
} from "@/lib/medusa"

// ─── Date helpers ────────────────────────────────────────────────────

export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

export function startOfMonth(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), 1)
  x.setHours(0, 0, 0, 0)
  return x
}

export function lastNMonths(n: number, ref: Date = new Date()): Date[] {
  const out: Date[] = []
  for (let i = n - 1; i >= 0; i--) {
    out.push(new Date(ref.getFullYear(), ref.getMonth() - i, 1))
  }
  return out
}

// ─── Aggregations ────────────────────────────────────────────────────

export interface MonthlyAgg {
  month: string  // YYYY-MM
  label: string  // "Ene"
  revenue: number
  cogs: number
  margin: number
  expenses: number
  net: number
  ordersCount: number
}

export function aggregateByMonth(
  pagoMovils: FinanzasPagoMovil[],
  expenses: FinanzasExpense[],
  months: Date[],
): MonthlyAgg[] {
  return months.map((m) => {
    const next = new Date(m.getFullYear(), m.getMonth() + 1, 1)
    const inMonth = (date: string) => {
      const t = new Date(date).getTime()
      return t >= m.getTime() && t < next.getTime()
    }

    const monthPM = pagoMovils.filter((p) => inMonth(p.created_at))
    const monthExp = expenses.filter((e) => inMonth(e.expense_date))

    const revenue = monthPM.reduce((s, p) => s + (Number(p.amount_eur_total) || 0), 0)
    const cogs    = monthPM.reduce((s, p) => s + (Number(p.amount_eur_cogs)  || 0), 0)
    const margin  = monthPM.reduce((s, p) => s + (Number(p.amount_eur_margin) || 0), 0)
    // Expenses están en USDT ≈ USD ≈ EUR para simplificar (asumimos paridad rough);
    // si quisiéramos exacto deberíamos tener tasa USDT/EUR del momento. Para
    // operación venezolana esto es aceptable.
    const expensesEur = monthExp.reduce((s, e) => s + (Number(e.amount_usdt) || 0), 0)
    const net = margin - expensesEur

    return {
      month: monthKey(m),
      label: m.toLocaleDateString("es-VE", { month: "short" }).toUpperCase().replace(/\.$/, ""),
      revenue,
      cogs,
      margin,
      expenses: expensesEur,
      net,
      ordersCount: monthPM.length,
    }
  })
}

// ─── Forecasting ─────────────────────────────────────────────────────

export interface Forecast {
  /** projected revenue/margin/expenses para el horizonte indicado (días) */
  revenue: number
  margin: number
  expenses: number
  net: number
  /** baseline diario derivado del histórico */
  dailyAvgRevenue: number
  dailyAvgExpenses: number
  /** confianza basada en variancia */
  confidence: "low" | "medium" | "high"
}

/** Linear forecast desde N meses recientes — proyecta horizonte en días. */
export function forecast(
  history: MonthlyAgg[],
  horizonDays: number,
): Forecast {
  if (history.length === 0) {
    return { revenue: 0, margin: 0, expenses: 0, net: 0, dailyAvgRevenue: 0, dailyAvgExpenses: 0, confidence: "low" }
  }
  // Average per month, dividido por 30 días
  const totalRev = history.reduce((s, m) => s + m.revenue, 0)
  const totalMar = history.reduce((s, m) => s + m.margin, 0)
  const totalExp = history.reduce((s, m) => s + m.expenses, 0)
  const dailyAvgRevenue = (totalRev / history.length) / 30
  const dailyAvgMargin  = (totalMar / history.length) / 30
  const dailyAvgExpenses = (totalExp / history.length) / 30

  // Confianza: bajo si <2 meses, medio si 2-3, alto si 4+
  const confidence: Forecast["confidence"] = history.length >= 4 ? "high" : history.length >= 2 ? "medium" : "low"

  return {
    revenue: dailyAvgRevenue * horizonDays,
    margin: dailyAvgMargin * horizonDays,
    expenses: dailyAvgExpenses * horizonDays,
    net: (dailyAvgMargin - dailyAvgExpenses) * horizonDays,
    dailyAvgRevenue,
    dailyAvgExpenses,
    confidence,
  }
}

// ─── Anomaly detection ───────────────────────────────────────────────

export interface Anomaly {
  kind: "revenue_drop" | "revenue_spike" | "expense_spike" | "margin_compression" | "negative_margin" | "no_orders"
  severity: "info" | "warning" | "critical"
  title: string
  detail: string
  delta_pct?: number
  reference_month?: string
  current_month?: string
}

export function detectAnomalies(history: MonthlyAgg[]): Anomaly[] {
  if (history.length < 2) return []
  const out: Anomaly[] = []
  const current = history[history.length - 1]
  const previous = history[history.length - 2]

  // Revenue drop > 25% vs previous month
  if (previous.revenue > 0) {
    const delta = ((current.revenue - previous.revenue) / previous.revenue) * 100
    if (delta < -25) {
      out.push({
        kind: "revenue_drop",
        severity: delta < -50 ? "critical" : "warning",
        title: `Revenue cayó ${Math.abs(delta).toFixed(1)}% vs ${previous.label}`,
        detail: `Mes pasado: €${previous.revenue.toFixed(0)} · Este mes: €${current.revenue.toFixed(0)}`,
        delta_pct: delta,
        reference_month: previous.month,
        current_month: current.month,
      })
    } else if (delta > 50) {
      out.push({
        kind: "revenue_spike",
        severity: "info",
        title: `Revenue subió ${delta.toFixed(1)}% vs ${previous.label} · 🎉`,
        detail: `Mes pasado: €${previous.revenue.toFixed(0)} · Este mes: €${current.revenue.toFixed(0)}`,
        delta_pct: delta,
      })
    }
  }

  // Expense spike: gastos > 150% del promedio histórico
  const avgExp = history.slice(0, -1).reduce((s, m) => s + m.expenses, 0) / Math.max(1, history.length - 1)
  if (avgExp > 0 && current.expenses > avgExp * 1.5) {
    const delta = ((current.expenses - avgExp) / avgExp) * 100
    out.push({
      kind: "expense_spike",
      severity: current.expenses > avgExp * 2 ? "critical" : "warning",
      title: `Gastos ${delta.toFixed(0)}% sobre promedio histórico`,
      detail: `Promedio: €${avgExp.toFixed(0)} · Este mes: €${current.expenses.toFixed(0)}`,
      delta_pct: delta,
    })
  }

  // Margin compression: margen actual <70% del promedio
  const avgMarginPct = history.slice(0, -1).reduce((s, m) => {
    return s + (m.revenue > 0 ? (m.margin / m.revenue) * 100 : 0)
  }, 0) / Math.max(1, history.length - 1)
  const currentMarginPct = current.revenue > 0 ? (current.margin / current.revenue) * 100 : 0
  if (avgMarginPct > 0 && currentMarginPct < avgMarginPct * 0.7) {
    out.push({
      kind: "margin_compression",
      severity: currentMarginPct < avgMarginPct * 0.5 ? "critical" : "warning",
      title: `Margen comprimido a ${currentMarginPct.toFixed(1)}%`,
      detail: `Promedio histórico: ${avgMarginPct.toFixed(1)}% · Esto sugiere COGS subió o precios bajaron`,
    })
  }

  // Negative margin
  if (current.margin < 0) {
    out.push({
      kind: "negative_margin",
      severity: "critical",
      title: `Margen NEGATIVO este mes`,
      detail: `Revenue €${current.revenue.toFixed(0)} - COGS €${current.cogs.toFixed(0)} = €${current.margin.toFixed(0)}`,
    })
  }

  // No orders this month (only flag if not first day of month)
  const today = new Date()
  if (current.ordersCount === 0 && today.getDate() > 5) {
    out.push({
      kind: "no_orders",
      severity: "warning",
      title: `Sin pedidos en ${current.label}`,
      detail: `Llevamos ${today.getDate()} días sin movimiento. Revisa storefront, ads y stock.`,
    })
  }

  return out
}

// ─── Gateway / payment method breakdown ──────────────────────────────

export interface GatewayBreakdown {
  gateway: string
  label: string
  count: number
  amount_eur: number
  pct: number
  color: string
}

/** Agrupa pago_movils por método. Como el plugin sólo guarda P. Móvil,
 *  derivamos las otras columnas desde patrones (cedula presente = p_movil,
 *  bs_pending=0 + bs_converted_total>0 = ya convertido a USDT, etc.).
 *  Fallback simple cuando solo hay una fuente. */
export function gatewayBreakdown(pagoMovils: FinanzasPagoMovil[], conversions: FinanzasConversion[]): GatewayBreakdown[] {
  const total = pagoMovils.reduce((s, p) => s + (Number(p.amount_eur_total) || 0), 0)
  if (total === 0) return []

  // P. Móvil = todos los pago_movils (esos representan ingresos en Bs)
  const pmTotal = total
  const pmCount = pagoMovils.length

  // USDT directo: si hubiera otro endpoint sería mejor; por ahora derivamos
  // de conversions (asumiendo cada conversion = monto que entró ya como USDT).
  // Para no duplicar: las conversiones representan flujo de entrada de USDT
  // que viene desde Bs ya capturados, así que NO lo sumamos como gateway.

  const out: GatewayBreakdown[] = [
    {
      gateway: "pago_movil",
      label: "Pago Móvil (Bs)",
      count: pmCount,
      amount_eur: pmTotal,
      pct: 100,
      color: "#FF3B27",
    },
  ]

  // Si hay órdenes con bs_converted_total > 0, marcamos cuántas ya están reconciliadas
  const reconciled = pagoMovils.filter((p) => Number(p.bs_converted_total) > 0 && Number(p.bs_pending) === 0).length
  if (reconciled > 0) {
    out.push({
      gateway: "reconciled",
      label: "↳ Reconciliados USDT",
      count: reconciled,
      amount_eur: 0,
      pct: 0,
      color: "#4D5431",
    })
  }
  return out
}

// ─── Cash flow timeline (semanal últimas 12 semanas) ─────────────────

export interface WeeklyFlow {
  week: string  // "Sem 12"
  weekStart: Date
  in_eur: number
  out_eur: number
  net_eur: number
}

export function weeklyFlow(
  pagoMovils: FinanzasPagoMovil[],
  expenses: FinanzasExpense[],
  weeks = 12,
): WeeklyFlow[] {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const dow = (today.getDay() + 6) % 7
  const thisMonday = new Date(today)
  thisMonday.setDate(today.getDate() - dow)

  const out: WeeklyFlow[] = []
  for (let i = weeks - 1; i >= 0; i--) {
    const start = new Date(thisMonday)
    start.setDate(thisMonday.getDate() - i * 7)
    const end = new Date(start); end.setDate(start.getDate() + 7)

    const inMs = start.getTime(), outMs = end.getTime()
    const inAmt = pagoMovils
      .filter((p) => { const t = new Date(p.created_at).getTime(); return t >= inMs && t < outMs })
      .reduce((s, p) => s + (Number(p.amount_eur_total) || 0), 0)
    const outAmt = expenses
      .filter((e) => { const t = new Date(e.expense_date).getTime(); return t >= inMs && t < outMs })
      .reduce((s, e) => s + (Number(e.amount_usdt) || 0), 0)

    const weekNum = Math.ceil(((start.getTime() - new Date(start.getFullYear(), 0, 1).getTime()) / 86400000 + new Date(start.getFullYear(), 0, 1).getDay() + 1) / 7)
    out.push({
      week: `S${weekNum}`,
      weekStart: start,
      in_eur: inAmt,
      out_eur: outAmt,
      net_eur: inAmt - outAmt,
    })
  }
  return out
}

// ─── Re-export types ─────────────────────────────────────────────────

export type { FinanzasPagoMovil, FinanzasExpense, FinanzasConversion, FinanzasRunwayReport }
