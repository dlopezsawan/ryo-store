/**
 * GET /admin/finanzas/reports/export?type=movements|expenses|conversions|pl&month=YYYY-MM
 *
 * Returns a CSV stream you can pipe to a file or pop open in Sheets/Excel.
 * No external CSV lib — generate by hand and escape doublequotes per RFC 4180.
 */

import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { Pool } from "pg"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

function bounds(month?: string) {
  const now = new Date()
  let y = now.getUTCFullYear()
  let m = now.getUTCMonth() + 1
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [yy, mm] = month.split("-").map(Number)
    y = yy
    m = mm
  }
  return {
    from: new Date(Date.UTC(y, m - 1, 1)),
    to: new Date(Date.UTC(y, m, 1)),
    label: `${y}-${String(m).padStart(2, "0")}`,
  }
}

function csvCell(v: unknown): string {
  if (v == null) return ""
  const s = typeof v === "object" ? JSON.stringify(v) : String(v)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}
function row(values: unknown[]): string {
  return values.map(csvCell).join(",")
}
function csv(headers: string[], rows: unknown[][]): string {
  return [headers.join(","), ...rows.map(row)].join("\n") + "\n"
}

async function csvMovements(from: Date, to: Date): Promise<string> {
  const r = await pool.query(
    `SELECT
       'ingreso' AS type, pm.created_at AS at,
       'Orden #'||pm.order_display_id AS description,
       pm.customer_name AS counterparty, pm.cedula,
       pm.amount_eur_total AS amount_eur, pm.amount_bs_total AS amount_bs,
       pm.amount_usdt_theoretical AS amount_usdt, NULL::text AS bucket, pm.status
     FROM finanzas_pago_movil pm
     WHERE pm.deleted_at IS NULL AND pm.created_at >= $1 AND pm.created_at < $2
     UNION ALL
     SELECT
       'gasto', e.expense_date,
       e.description, ec.name, NULL,
       NULL, e.amount_bs, e.amount_usdt, ec.bucket, e.status
     FROM finanzas_expense e
     JOIN finanzas_expense_category ec ON ec.id = e.category_id
     WHERE e.deleted_at IS NULL AND e.expense_date >= $1 AND e.expense_date < $2
     UNION ALL
     SELECT
       'conversion', c.converted_at,
       'Conversión Bs → USDT', NULL, NULL,
       NULL, c.amount_bs, c.amount_usdt, NULL, NULL
     FROM finanzas_conversion c
     WHERE c.deleted_at IS NULL AND c.converted_at >= $1 AND c.converted_at < $2
     ORDER BY at DESC`,
    [from, to]
  )
  return csv(
    ["Tipo", "Fecha", "Descripción", "Cliente/Categoría", "Cédula", "EUR", "Bs", "USDT", "Bucket", "Estado"],
    r.rows.map((x) => [
      x.type,
      new Date(x.at).toISOString().slice(0, 10),
      x.description,
      x.counterparty,
      x.cedula,
      x.amount_eur,
      x.amount_bs,
      x.amount_usdt,
      x.bucket,
      x.status,
    ])
  )
}

async function csvExpenses(from: Date, to: Date): Promise<string> {
  const r = await pool.query(
    `SELECT e.expense_date, ec.name AS category, ec.bucket, e.description,
            e.amount_usdt, e.amount_bs, e.rate_bs_per_usdt, e.status,
            w.name AS wallet, e.receipt_url, e.notes
     FROM finanzas_expense e
     JOIN finanzas_expense_category ec ON ec.id = e.category_id
     LEFT JOIN finanzas_wallet w ON w.id = e.paid_from_wallet_id
     WHERE e.deleted_at IS NULL
       AND e.expense_date >= $1 AND e.expense_date < $2
     ORDER BY e.expense_date DESC`,
    [from, to]
  )
  return csv(
    ["Fecha", "Categoría", "Bucket", "Descripción", "USDT", "Bs", "Tasa", "Estado", "Wallet", "Comprobante", "Notas"],
    r.rows.map((x) => [
      new Date(x.expense_date).toISOString().slice(0, 10),
      x.category,
      x.bucket,
      x.description,
      x.amount_usdt,
      x.amount_bs,
      x.rate_bs_per_usdt,
      x.status,
      x.wallet,
      x.receipt_url,
      x.notes,
    ])
  )
}

async function csvConversions(from: Date, to: Date): Promise<string> {
  const r = await pool.query(
    `SELECT c.converted_at, pm.order_display_id, pm.customer_name,
            c.amount_bs, c.amount_usdt, c.rate_bs_per_usdt,
            sw.name AS source_wallet, dw.name AS dest_wallet, c.note
     FROM finanzas_conversion c
     LEFT JOIN finanzas_pago_movil pm ON pm.id = c.pago_movil_id
     LEFT JOIN finanzas_wallet sw ON sw.id = c.source_wallet_id
     LEFT JOIN finanzas_wallet dw ON dw.id = c.dest_wallet_id
     WHERE c.deleted_at IS NULL AND c.converted_at >= $1 AND c.converted_at < $2
     ORDER BY c.converted_at DESC`,
    [from, to]
  )
  return csv(
    ["Fecha", "Orden #", "Cliente", "Bs convertidos", "USDT recibidos", "Tasa Bs/USDT", "Wallet origen", "Wallet destino", "Nota"],
    r.rows.map((x) => [
      new Date(x.converted_at).toISOString().slice(0, 10),
      x.order_display_id,
      x.customer_name,
      x.amount_bs,
      x.amount_usdt,
      x.rate_bs_per_usdt,
      x.source_wallet,
      x.dest_wallet,
      x.note,
    ])
  )
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const type =
    typeof req.query.type === "string" ? req.query.type : "movements"
  const { from, to, label } = bounds(
    typeof req.query.month === "string" ? req.query.month : undefined
  )

  let body = ""
  let filename = "export.csv"
  if (type === "movements") {
    body = await csvMovements(from, to)
    filename = `movimientos-${label}.csv`
  } else if (type === "expenses") {
    body = await csvExpenses(from, to)
    filename = `gastos-${label}.csv`
  } else if (type === "conversions") {
    body = await csvConversions(from, to)
    filename = `conversiones-${label}.csv`
  } else {
    return res.status(400).json({ error: `unknown type "${type}". Allowed: movements|expenses|conversions` })
  }

  res.setHeader("Content-Type", "text/csv; charset=utf-8")
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`)
  // BOM so Excel detects UTF-8 properly
  res.send("\uFEFF" + body)
}
