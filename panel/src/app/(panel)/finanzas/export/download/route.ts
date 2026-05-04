import { NextResponse } from "next/server"
import { listPagoMovil, listFinanzasExpenses, listFinanzasConversions, MedusaError } from "@/lib/medusa"
import { getSession } from "@/lib/auth"

/**
 * Export contable Seniat-friendly.
 *
 * Query params:
 *   - kind: "income" | "expense" | "conversion" | "all"  (default "all")
 *   - month: "YYYY-MM" para filtrar (opcional)
 *   - format: "csv" (default) o "json"
 *
 * Formato CSV pensado para conciliación contable Venezolana:
 *   - Separador: punto-y-coma (Excel ES-VE lo entiende sin lío)
 *   - Encoding: UTF-8 con BOM (Excel los abre bien)
 *   - Decimal: coma (es-VE locale)
 *   - Fechas: DD/MM/YYYY
 *   - Columnas alineadas con planillas comunes IVA / ISLR
 */
export async function GET(req: Request) {
  const session = await getSession()
  if (!session) {
    return new NextResponse("no_session", { status: 401 })
  }

  const url = new URL(req.url)
  const kind = (url.searchParams.get("kind") ?? "all") as "income" | "expense" | "conversion" | "all"
  const month = url.searchParams.get("month") ?? undefined  // YYYY-MM
  const format = url.searchParams.get("format") === "json" ? "json" : "csv"

  // Filter helper
  const inMonth = (dateStr: string) => {
    if (!month) return true
    const d = new Date(dateStr)
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    return k === month
  }

  try {
    const [pmR, expR, convR] = await Promise.allSettled([
      listPagoMovil({ limit: 1000 }),
      listFinanzasExpenses({ limit: 500 }),
      listFinanzasConversions({ limit: 200 }),
    ])
    const pagoMovils = pmR.status === "fulfilled" ? pmR.value.pago_movils.filter((p) => inMonth(p.created_at)) : []
    const expenses = expR.status === "fulfilled" ? expR.value.expenses.filter((e) => inMonth(e.expense_date)) : []
    const conversions = convR.status === "fulfilled" ? convR.value.conversions.filter((c) => inMonth(c.converted_at)) : []

    if (format === "json") {
      const payload: Record<string, unknown> = {}
      if (kind === "all" || kind === "income") payload.income = pagoMovils
      if (kind === "all" || kind === "expense") payload.expenses = expenses
      if (kind === "all" || kind === "conversion") payload.conversions = conversions
      return NextResponse.json(payload)
    }

    // ─── CSV builder ─────────────────────────────────────────────────
    const fmt = (v: number) => v.toFixed(2).replace(".", ",")
    const fmtDate = (iso: string) => {
      const d = new Date(iso)
      return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`
    }
    const escape = (v: string) => {
      const s = String(v ?? "").replace(/"/g, '""')
      return /[;\n"]/.test(s) ? `"${s}"` : s
    }
    const row = (...cells: (string | number)[]) => cells.map((c) => escape(String(c))).join(";")

    const lines: string[] = []
    // BOM para Excel
    lines.push("﻿# RYO Store · Reporte contable" + (month ? ` · ${month}` : ""))
    lines.push(`# Generado: ${new Date().toLocaleString("es-VE")}`)
    lines.push("")

    if (kind === "all" || kind === "income") {
      lines.push("# INGRESOS (Ventas — Pago Móvil)")
      lines.push(row("Fecha", "N° Pedido", "Cliente", "Cédula", "Email", "Bs total", "EUR total", "Tasa BCV", "EUR margen", "Estado"))
      for (const p of pagoMovils) {
        lines.push(row(
          fmtDate(p.created_at),
          `#${p.order_display_id}`,
          p.customer_name ?? "—",
          p.cedula ?? "",
          p.order_email ?? "",
          fmt(Number(p.amount_bs_total) || 0),
          fmt(Number(p.amount_eur_total) || 0),
          fmt(Number(p.bcv_eur_rate) || 0),
          fmt(Number(p.amount_eur_margin) || 0),
          p.status,
        ))
      }
      lines.push("")
      const totalBs = pagoMovils.reduce((s, p) => s + (Number(p.amount_bs_total) || 0), 0)
      const totalEur = pagoMovils.reduce((s, p) => s + (Number(p.amount_eur_total) || 0), 0)
      lines.push(row("TOTAL INGRESOS", "", "", "", "", fmt(totalBs), fmt(totalEur), "", "", ""))
      lines.push("")
    }

    if (kind === "all" || kind === "expense") {
      lines.push("# EGRESOS (Gastos)")
      lines.push(row("Fecha", "Descripción", "Categoría", "USDT", "Bs", "Estado", "Notas"))
      for (const e of expenses) {
        lines.push(row(
          fmtDate(e.expense_date),
          e.description,
          e.category_id ?? "",
          fmt(Number(e.amount_usdt) || 0),
          fmt(Number(e.amount_bs ?? 0) || 0),
          e.status,
          (e.notes ?? "").replace(/\n/g, " "),
        ))
      }
      lines.push("")
      const totalUsdt = expenses.reduce((s, e) => s + (Number(e.amount_usdt) || 0), 0)
      lines.push(row("TOTAL EGRESOS", "", "", fmt(totalUsdt), "", "", ""))
      lines.push("")
    }

    if (kind === "all" || kind === "conversion") {
      lines.push("# CONVERSIONES Bs → USDT")
      lines.push(row("Fecha", "Bs", "USDT", "Tasa Bs/USDT", "Spread %", "Referencia bancaria", "Notas"))
      for (const c of conversions) {
        const rate = Number(c.amount_usdt) > 0 ? Number(c.amount_bs) / Number(c.amount_usdt) : 0
        lines.push(row(
          fmtDate(c.converted_at),
          fmt(Number(c.amount_bs) || 0),
          fmt(Number(c.amount_usdt) || 0),
          fmt(rate),
          fmt(Number(c.spread_pct) || 0),
          c.reference ?? "",
          (c.note ?? "").replace(/\n/g, " "),
        ))
      }
      lines.push("")
      const totalConvBs = conversions.reduce((s, c) => s + (Number(c.amount_bs) || 0), 0)
      const totalConvUsdt = conversions.reduce((s, c) => s + (Number(c.amount_usdt) || 0), 0)
      lines.push(row("TOTAL CONVERSIONES", fmt(totalConvBs), fmt(totalConvUsdt), "", "", "", ""))
    }

    const filename = `ryo-finanzas-${kind}${month ? `-${month}` : ""}-${new Date().toISOString().slice(0, 10)}.csv`
    return new NextResponse(lines.join("\n"), {
      status: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${filename}"`,
      },
    })
  } catch (e) {
    if (e instanceof MedusaError && e.status === 401) {
      return new NextResponse("session expired", { status: 401 })
    }
    return new NextResponse(`error: ${e instanceof Error ? e.message : "unknown"}`, { status: 500 })
  }
}
