/**
 * GET /admin/finanzas/reports/pl/print?month=YYYY-MM
 *
 * Returns a print-ready HTML page (Enrola-branded) for the P&L of a given
 * month. The page auto-fires `window.print()` on load so a click on the UI
 * "Descargar PDF" button feels native: opens a new tab, browser shows the
 * print dialog with "Save as PDF" preselected.
 *
 * Avoids server-side PDF deps (pdfkit/puppeteer) until B5 lands the proper
 * docx pipeline.
 */

import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { Pool } from "pg"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const EUR_PER_USDT = 1.08

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
    monthName: new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("es-ES", {
      month: "long",
      year: "numeric",
    }),
  }
}

const fmtEur = (n: number) =>
  `€${(Number(n) || 0).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmtUsdt = (n: number) =>
  `$${(Number(n) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmtPct = (n: number) =>
  `${(Number(n) * 100).toFixed(1)}%`

function escape(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;"
  )
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const { from, to, label, monthName } = bounds(
    typeof req.query.month === "string" ? req.query.month : undefined
  )

  const pmR = await pool.query(
    `SELECT
       COUNT(*) AS orders,
       COALESCE(SUM(amount_eur_subtotal), 0) AS gross_eur,
       COALESCE(SUM(amount_eur_discount), 0) AS discount_eur,
       COALESCE(SUM(amount_eur_total), 0)    AS net_eur,
       COALESCE(SUM(amount_eur_cogs), 0)     AS cogs_eur,
       COALESCE(SUM(amount_eur_margin), 0)   AS margin_eur
     FROM finanzas_pago_movil
     WHERE deleted_at IS NULL AND created_at >= $1 AND created_at < $2`,
    [from, to]
  )
  const pm = pmR.rows[0]

  const expR = await pool.query(
    `SELECT ec.bucket, ec.name, COALESCE(SUM(e.amount_usdt), 0) AS usdt
     FROM finanzas_expense e
     JOIN finanzas_expense_category ec ON ec.id = e.category_id
     WHERE e.deleted_at IS NULL AND e.status = 'paid'
       AND e.expense_date >= $1 AND e.expense_date < $2
     GROUP BY ec.bucket, ec.name ORDER BY ec.bucket, ec.name`,
    [from, to]
  )
  const expensesByBucket: Record<string, Array<{ name: string; usdt: number }>> = {}
  for (const r of expR.rows) {
    expensesByBucket[r.bucket] ??= []
    expensesByBucket[r.bucket].push({ name: r.name, usdt: Number(r.usdt) })
  }
  const bucketTotal = (b: string) =>
    (expensesByBucket[b] || []).reduce((s, x) => s + x.usdt, 0)

  const grossEur = Number(pm.gross_eur)
  const discountEur = Number(pm.discount_eur)
  const netEur = Number(pm.net_eur)
  const cogsEur = Number(pm.cogs_eur)
  const marginEur = Number(pm.margin_eur)
  const gfPaid = bucketTotal("gastos_fijos")
  const mktPaid = bucketTotal("marketing")
  const restockPaid = bucketTotal("restock")
  const otrosPaid =
    bucketTotal("envios") + bucketTotal("comisiones_pago") + bucketTotal("otros")
  const totalExp = gfPaid + mktPaid + restockPaid + otrosPaid
  const ebitdaEur = marginEur - totalExp * EUR_PER_USDT
  const marginPct = netEur > 0 ? marginEur / netEur : 0
  const ebitdaPct = netEur > 0 ? ebitdaEur / netEur : 0

  const renderItems = (bucket: string) => {
    const items = expensesByBucket[bucket] || []
    if (items.length === 0)
      return `<tr><td colspan="2" class="muted">— sin gastos —</td></tr>`
    return items
      .map(
        (i) => `<tr>
          <td class="indent">${escape(i.name)}</td>
          <td class="num">${fmtUsdt(i.usdt)}</td>
        </tr>`
      )
      .join("")
  }

  const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<title>P&amp;L ${label} — Enrola Shop</title>
<style>
  :root {
    --ink: #1a1a1a;
    --muted: #6b7280;
    --line: #e5e7eb;
    --brand: #FF3B27;
    --green: #10b981;
    --rose: #ef4444;
  }
  * { box-sizing: border-box; }
  html, body {
    margin: 0; padding: 0;
    font: 14px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
    color: var(--ink);
    background: #fff;
  }
  .page { max-width: 780px; margin: 24px auto; padding: 0 28px; }
  header.brand {
    display: flex; align-items: center; justify-content: space-between;
    border-bottom: 3px solid var(--brand); padding: 14px 0; margin-bottom: 24px;
  }
  header.brand h1 { margin: 0; font-size: 20px; font-weight: 800; letter-spacing: -.01em; }
  header.brand .meta { color: var(--muted); font-size: 12px; text-align: right; }
  h2 { font-size: 13px; text-transform: uppercase; letter-spacing: .08em;
       color: var(--muted); margin: 24px 0 10px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 6px 0; text-align: left; border-bottom: 1px solid var(--line); }
  th { font-size: 11px; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); }
  td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  td.indent { padding-left: 18px; color: #444; }
  tr.total td { border-top: 2px solid var(--ink); border-bottom: none; padding-top: 10px; font-weight: 700; }
  tr.subtotal td { font-weight: 600; }
  .muted { color: var(--muted); font-style: italic; }
  .pos { color: var(--green); }
  .neg { color: var(--rose); }
  .grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin: 16px 0; }
  .kpi { border: 1px solid var(--line); border-radius: 6px; padding: 10px; }
  .kpi .label { color: var(--muted); font-size: 11px; text-transform: uppercase; letter-spacing: .06em; }
  .kpi .value { font-size: 18px; font-weight: 700; margin-top: 4px; }
  .footer { color: var(--muted); font-size: 11px; margin-top: 36px; border-top: 1px solid var(--line); padding-top: 12px; text-align: center; }
  @media print {
    .no-print { display: none; }
    .page { margin: 0; padding: 18px; }
    header.brand { padding-top: 0; }
  }
  .toolbar { background: #f7f7f9; border: 1px solid var(--line); border-radius: 6px; padding: 10px 14px;
    display: flex; gap: 8px; align-items: center; margin-bottom: 18px; }
  .toolbar button { padding: 6px 12px; background: var(--brand); color: white;
    border: none; border-radius: 4px; font-weight: 600; cursor: pointer; }
</style>
</head>
<body onload="setTimeout(()=>window.print(), 250)">
<div class="page">
  <div class="toolbar no-print">
    💡 Usá <b>Cmd/Ctrl+P → Guardar como PDF</b> para descargar.
    <button onclick="window.print()">Imprimir</button>
    <span style="margin-left:auto; color: var(--muted); font-size: 12px;">
      Si la ventana de impresión no se abrió sola, hacé clic en Imprimir.
    </span>
  </div>

  <header class="brand">
    <div>
      <h1>Enrola Shop · Estado de Resultados</h1>
      <div class="meta">${escape(monthName)} · ${escape(label)}</div>
    </div>
    <div class="meta">
      Generado ${new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" })}
      <br>${pm.orders} órdenes
    </div>
  </header>

  <div class="grid">
    <div class="kpi">
      <div class="label">Ingresos netos</div>
      <div class="value">${fmtEur(netEur)}</div>
    </div>
    <div class="kpi">
      <div class="label">Margen bruto</div>
      <div class="value ${marginEur >= 0 ? "pos" : "neg"}">${fmtEur(marginEur)} (${fmtPct(marginPct)})</div>
    </div>
    <div class="kpi">
      <div class="label">EBITDA</div>
      <div class="value ${ebitdaEur >= 0 ? "pos" : "neg"}">${fmtEur(ebitdaEur)} (${fmtPct(ebitdaPct)})</div>
    </div>
  </div>

  <h2>Ingresos</h2>
  <table>
    <tbody>
      <tr><td>Ingresos brutos (subtotal)</td><td class="num">${fmtEur(grossEur)}</td></tr>
      <tr><td>(−) Descuentos aplicados</td><td class="num neg">${fmtEur(-discountEur)}</td></tr>
      <tr class="subtotal"><td>Ingresos netos</td><td class="num">${fmtEur(netEur)}</td></tr>
    </tbody>
  </table>

  <h2>Costo de Ventas</h2>
  <table>
    <tbody>
      <tr><td>Costo de mercadería vendida (COGS)</td><td class="num neg">${fmtEur(-cogsEur)}</td></tr>
      <tr class="subtotal"><td>Margen bruto</td><td class="num ${marginEur >= 0 ? "pos" : "neg"}">${fmtEur(marginEur)} (${fmtPct(marginPct)})</td></tr>
    </tbody>
  </table>

  <h2>Gastos operativos (pagados)</h2>
  <table>
    <thead><tr><th>Concepto</th><th class="num">USDT</th></tr></thead>
    <tbody>
      <tr><td><b>Gastos fijos</b></td><td class="num">${fmtUsdt(gfPaid)}</td></tr>
      ${renderItems("gastos_fijos")}
      <tr><td><b>Marketing</b></td><td class="num">${fmtUsdt(mktPaid)}</td></tr>
      ${renderItems("marketing")}
      <tr><td><b>Restock pagado</b></td><td class="num">${fmtUsdt(restockPaid)}</td></tr>
      ${renderItems("restock")}
      <tr><td><b>Otros (envíos, comisiones, otros)</b></td><td class="num">${fmtUsdt(otrosPaid)}</td></tr>
      ${renderItems("envios")}
      ${renderItems("comisiones_pago")}
      ${renderItems("otros")}
      <tr class="subtotal"><td>Total gastos pagados</td><td class="num neg">${fmtUsdt(-totalExp)}</td></tr>
      <tr class="subtotal"><td class="muted">≈ EUR (a 1 USDT = €${EUR_PER_USDT})</td><td class="num muted">${fmtEur(-totalExp * EUR_PER_USDT)}</td></tr>
    </tbody>
  </table>

  <h2>Resultado del período</h2>
  <table>
    <tbody>
      <tr class="total">
        <td>EBITDA (Ganancia operativa)</td>
        <td class="num ${ebitdaEur >= 0 ? "pos" : "neg"}">${fmtEur(ebitdaEur)} · ${fmtUsdt(ebitdaEur / EUR_PER_USDT)}</td>
      </tr>
      <tr><td class="muted">Margen sobre ingresos netos</td><td class="num muted">${fmtPct(ebitdaPct)}</td></tr>
    </tbody>
  </table>

  <div class="footer">
    Documento generado automáticamente por el módulo Finanzas · enrola.shop · ${label}
  </div>
</div>
</body>
</html>`

  res.setHeader("Content-Type", "text/html; charset=utf-8")
  res.send(html)
}
