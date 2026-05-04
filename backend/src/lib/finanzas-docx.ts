/**
 * Finanzas → DOCX generator.
 *
 * Builds a branded Word document (P&L, cashflow, top productos, top clientes,
 * runway/breakeven) for a given month. Used by:
 *   - the Telegram /docx command
 *   - the monthly close email job (attached)
 *   - the admin "Descargar DOCX" button
 *
 * Returns a Buffer ready to send.
 */

import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType,
} from "docx"
import { Pool } from "pg"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const EUR_PER_USDT = 1.08

// ─── Brand palette ──────────────────────────────────────────────────────────
const COLOR = {
  ink: "1A1A1A",
  muted: "6B7280",
  brand: "FF3B27",
  green: "10B981",
  rose: "EF4444",
  bg: "F5F2E8",
  line: "E5E7EB",
}

// ─── Format helpers ─────────────────────────────────────────────────────────
const fmtEur = (n: number) =>
  `€${(Number(n) || 0).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmtUsdt = (n: number) =>
  `$${(Number(n) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmtPct = (n: number) =>
  `${(Number(n) * 100).toFixed(1)}%`

function bounds(month: string) {
  const [y, m] = month.split("-").map(Number)
  return {
    from: new Date(Date.UTC(y, m - 1, 1)),
    to: new Date(Date.UTC(y, m, 1)),
    monthName: new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("es-ES", {
      month: "long",
      year: "numeric",
    }),
  }
}

function txt(text: string, opts?: { bold?: boolean; size?: number; color?: string; align?: typeof AlignmentType[keyof typeof AlignmentType] }) {
  return new Paragraph({
    alignment: opts?.align,
    children: [
      new TextRun({
        text,
        bold: opts?.bold,
        size: opts?.size ?? 22, // half-points: 22 = 11pt
        color: opts?.color ?? COLOR.ink,
        font: "Helvetica",
      }),
    ],
  })
}

function heading(text: string, level: typeof HeadingLevel[keyof typeof HeadingLevel]) {
  return new Paragraph({
    heading: level,
    spacing: { before: 240, after: 120 },
    children: [new TextRun({ text, bold: true, color: COLOR.ink, font: "Helvetica" })],
  })
}

function row(cells: Array<{ text: string; bold?: boolean; align?: "left" | "right"; color?: string; bg?: string }>) {
  return new TableRow({
    children: cells.map(
      (c) =>
        new TableCell({
          width: { size: 100 / cells.length, type: WidthType.PERCENTAGE },
          shading: c.bg ? { type: ShadingType.CLEAR, color: "auto", fill: c.bg } : undefined,
          children: [
            new Paragraph({
              alignment:
                c.align === "right" ? AlignmentType.RIGHT : AlignmentType.LEFT,
              children: [
                new TextRun({
                  text: c.text,
                  bold: c.bold,
                  color: c.color ?? COLOR.ink,
                  size: 20,
                  font: "Helvetica",
                }),
              ],
            }),
          ],
        })
    ),
  })
}

function tableNoBorder(rows: TableRow[]): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows,
    borders: {
      top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      bottom: { style: BorderStyle.SINGLE, size: 6, color: COLOR.line },
      left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: COLOR.line },
      insideVertical: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    },
  })
}

// ─── Data fetchers ──────────────────────────────────────────────────────────
async function fetchPL(from: Date, to: Date) {
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
  const expR = await pool.query(
    `SELECT ec.bucket, COALESCE(SUM(e.amount_usdt), 0) AS usdt
     FROM finanzas_expense e
     JOIN finanzas_expense_category ec ON ec.id = e.category_id
     WHERE e.deleted_at IS NULL AND e.status = 'paid'
       AND e.expense_date >= $1 AND e.expense_date < $2
     GROUP BY ec.bucket`,
    [from, to]
  )
  return { pm: pmR.rows[0], byBucket: expR.rows as Array<{ bucket: string; usdt: number }> }
}

async function fetchTopProducts(from: Date, to: Date, limit = 5) {
  const r = await pool.query(
    `SELECT
       l.product_id,
       MAX(l.title)                       AS title,
       SUM(l.quantity)                    AS units_sold,
       SUM(l.line_revenue_eur)             AS revenue_eur,
       COALESCE(SUM(l.line_margin_eur), 0) AS margin_eur
     FROM finanzas_pago_movil_line l
     JOIN finanzas_pago_movil pm ON pm.id = l.pago_movil_id
     WHERE l.deleted_at IS NULL AND pm.deleted_at IS NULL
       AND pm.created_at >= $1 AND pm.created_at < $2
     GROUP BY l.product_id
     ORDER BY margin_eur DESC
     LIMIT $3`,
    [from, to, limit]
  )
  return r.rows
}

async function fetchTopCustomers(from: Date, to: Date, limit = 5) {
  const r = await pool.query(
    `SELECT
       MAX(customer_name)        AS name,
       MAX(cedula)               AS cedula,
       COUNT(*)                  AS orders,
       SUM(amount_eur_total)     AS revenue_eur,
       SUM(amount_eur_margin)    AS margin_eur
     FROM finanzas_pago_movil
     WHERE deleted_at IS NULL
       AND created_at >= $1 AND created_at < $2
     GROUP BY COALESCE(NULLIF(cedula, ''), order_email, order_id)
     ORDER BY revenue_eur DESC
     LIMIT $3`,
    [from, to, limit]
  )
  return r.rows
}

async function fetchRunwayBreakeven() {
  const walletR = await pool.query(
    `SELECT COALESCE((
       SELECT SUM(amount) FROM finanzas_wallet_entry e
       JOIN finanzas_wallet w ON w.id = e.wallet_id
       WHERE w.currency = 'usdt' AND w.is_active = true AND e.deleted_at IS NULL
     ), 0) AS usdt`
  )
  const usdtBalance = Math.max(0, Number(walletR.rows[0].usdt))

  const burnR = await pool.query(
    `SELECT COALESCE(SUM(recurring_amount_usdt), 0) AS target
     FROM finanzas_expense_category
     WHERE deleted_at IS NULL AND is_active = true AND is_recurring = true`
  )
  const burn = Number(burnR.rows[0].target) || 0

  const marginR = await pool.query(
    `SELECT COALESCE(AVG(amount_eur_margin), 0) AS avg_margin
     FROM finanzas_pago_movil
     WHERE deleted_at IS NULL`
  )
  const avgMargin = Number(marginR.rows[0].avg_margin) || 0
  const breakevenOrders =
    avgMargin > 0 ? Math.ceil((burn * EUR_PER_USDT) / avgMargin) : null
  const runwayMonths = burn > 0 ? Math.round((usdtBalance / burn) * 10) / 10 : null

  return { usdtBalance, burn, avgMargin, breakevenOrders, runwayMonths }
}

// ─── Generator ──────────────────────────────────────────────────────────────
export async function generateMonthlyDocx(month: string): Promise<Buffer> {
  const { from, to, monthName } = bounds(month)

  const [pl, topProducts, topCustomers, rbb] = await Promise.all([
    fetchPL(from, to),
    fetchTopProducts(from, to, 5),
    fetchTopCustomers(from, to, 5),
    fetchRunwayBreakeven(),
  ])

  const grossEur = Number(pl.pm.gross_eur)
  const discountEur = Number(pl.pm.discount_eur)
  const netEur = Number(pl.pm.net_eur)
  const cogsEur = Number(pl.pm.cogs_eur)
  const marginEur = Number(pl.pm.margin_eur)
  const expByBucket: Record<string, number> = {}
  let totalExp = 0
  for (const r of pl.byBucket) {
    expByBucket[r.bucket] = Number(r.usdt)
    totalExp += Number(r.usdt)
  }
  const ebitdaEur = marginEur - totalExp * EUR_PER_USDT
  const marginPct = netEur > 0 ? marginEur / netEur : 0
  const ebitdaPct = netEur > 0 ? ebitdaEur / netEur : 0

  const doc = new Document({
    creator: "Enrola Shop · Finanzas",
    title: `Estado de Resultados ${month}`,
    styles: {
      default: {
        document: {
          run: { font: "Helvetica", size: 22, color: COLOR.ink },
        },
      },
    },
    sections: [
      {
        properties: {
          page: { margin: { top: 720, right: 720, bottom: 720, left: 720 } },
        },
        children: [
          // ─── COVER ────────────────────────────────────────────────────
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: "ENROLA SHOP",
                bold: true,
                size: 48,
                color: COLOR.brand,
                font: "Helvetica",
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: "Estado Financiero",
                size: 32,
                color: COLOR.ink,
                font: "Helvetica",
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 120, after: 240 },
            children: [
              new TextRun({
                text: monthName,
                size: 28,
                color: COLOR.muted,
                font: "Helvetica",
                italics: true,
              }),
            ],
          }),

          // ─── KPI summary ──────────────────────────────────────────────
          heading("Resumen ejecutivo", HeadingLevel.HEADING_1),
          tableNoBorder([
            row([
              { text: "Órdenes", bold: true },
              { text: String(Number(pl.pm.orders) || 0), align: "right" },
            ]),
            row([
              { text: "Ingresos netos", bold: true },
              { text: fmtEur(netEur), align: "right" },
            ]),
            row([
              { text: "Margen bruto", bold: true },
              {
                text: `${fmtEur(marginEur)} (${fmtPct(marginPct)})`,
                align: "right",
                color: marginEur >= 0 ? COLOR.green : COLOR.rose,
              },
            ]),
            row([
              { text: "EBITDA", bold: true },
              {
                text: `${fmtEur(ebitdaEur)} (${fmtPct(ebitdaPct)})`,
                align: "right",
                color: ebitdaEur >= 0 ? COLOR.green : COLOR.rose,
              },
            ]),
            row([
              { text: "Saldo USDT (todas las wallets)", bold: true },
              { text: fmtUsdt(rbb.usdtBalance), align: "right" },
            ]),
            row([
              { text: "Runway (meses)", bold: true },
              {
                text: rbb.runwayMonths != null ? String(rbb.runwayMonths) : "—",
                align: "right",
                color:
                  rbb.runwayMonths != null && rbb.runwayMonths < 1
                    ? COLOR.rose
                    : rbb.runwayMonths != null && rbb.runwayMonths < 3
                    ? COLOR.brand
                    : COLOR.green,
              },
            ]),
            row([
              { text: "Breakeven (órdenes/mes)", bold: true },
              {
                text: rbb.breakevenOrders ? String(rbb.breakevenOrders) : "—",
                align: "right",
              },
            ]),
          ]),

          // ─── P&L ──────────────────────────────────────────────────────
          heading("Estado de Resultados", HeadingLevel.HEADING_1),
          tableNoBorder([
            row([{ text: "Concepto", bold: true, bg: COLOR.bg }, { text: "Monto", bold: true, bg: COLOR.bg, align: "right" }]),
            row([{ text: "Ingresos brutos (subtotal)" }, { text: fmtEur(grossEur), align: "right" }]),
            row([
              { text: "(−) Descuentos aplicados" },
              { text: fmtEur(-discountEur), align: "right", color: COLOR.rose },
            ]),
            row([
              { text: "Ingresos netos", bold: true },
              { text: fmtEur(netEur), bold: true, align: "right" },
            ]),
            row([
              { text: "(−) COGS" },
              { text: fmtEur(-cogsEur), align: "right", color: COLOR.rose },
            ]),
            row([
              { text: "Margen bruto", bold: true },
              {
                text: `${fmtEur(marginEur)} (${fmtPct(marginPct)})`,
                bold: true,
                align: "right",
                color: marginEur >= 0 ? COLOR.green : COLOR.rose,
              },
            ]),
            row([
              { text: "(−) Gastos fijos" },
              {
                text: fmtUsdt(-(expByBucket.gastos_fijos || 0)),
                align: "right",
                color: COLOR.rose,
              },
            ]),
            row([
              { text: "(−) Marketing" },
              {
                text: fmtUsdt(-(expByBucket.marketing || 0)),
                align: "right",
                color: COLOR.rose,
              },
            ]),
            row([
              { text: "(−) Restock pagado" },
              {
                text: fmtUsdt(-(expByBucket.restock || 0)),
                align: "right",
                color: COLOR.rose,
              },
            ]),
            row([
              { text: "(−) Otros (envíos, comisiones)" },
              {
                text: fmtUsdt(
                  -((expByBucket.envios || 0) +
                    (expByBucket.comisiones_pago || 0) +
                    (expByBucket.otros || 0))
                ),
                align: "right",
                color: COLOR.rose,
              },
            ]),
            row([
              { text: "EBITDA", bold: true },
              {
                text: `${fmtEur(ebitdaEur)} · ${fmtUsdt(ebitdaEur / EUR_PER_USDT)}`,
                bold: true,
                align: "right",
                color: ebitdaEur >= 0 ? COLOR.green : COLOR.rose,
              },
            ]),
          ]),

          // ─── Top productos ────────────────────────────────────────────
          heading("Top productos por margen", HeadingLevel.HEADING_1),
          topProducts.length > 0
            ? tableNoBorder([
                row([
                  { text: "Producto", bold: true, bg: COLOR.bg },
                  { text: "Uds", bold: true, bg: COLOR.bg, align: "right" },
                  { text: "Ingresos", bold: true, bg: COLOR.bg, align: "right" },
                  { text: "Margen", bold: true, bg: COLOR.bg, align: "right" },
                ]),
                ...topProducts.map((p: { title: string; units_sold: number; revenue_eur: number; margin_eur: number }) =>
                  row([
                    { text: p.title || "—" },
                    { text: String(p.units_sold), align: "right" },
                    { text: fmtEur(Number(p.revenue_eur)), align: "right" },
                    {
                      text: fmtEur(Number(p.margin_eur)),
                      align: "right",
                      color: Number(p.margin_eur) >= 0 ? COLOR.green : COLOR.rose,
                    },
                  ])
                ),
              ])
            : txt("Sin ventas en el período.", { color: COLOR.muted }),

          // ─── Top clientes ─────────────────────────────────────────────
          heading("Top clientes", HeadingLevel.HEADING_1),
          topCustomers.length > 0
            ? tableNoBorder([
                row([
                  { text: "Cliente", bold: true, bg: COLOR.bg },
                  { text: "Cédula", bold: true, bg: COLOR.bg },
                  { text: "Órdenes", bold: true, bg: COLOR.bg, align: "right" },
                  { text: "Ingresos", bold: true, bg: COLOR.bg, align: "right" },
                ]),
                ...topCustomers.map((c: { name: string; cedula: string; orders: number; revenue_eur: number }) =>
                  row([
                    { text: c.name || "—" },
                    { text: c.cedula || "—" },
                    { text: String(c.orders), align: "right" },
                    { text: fmtEur(Number(c.revenue_eur)), align: "right" },
                  ])
                ),
              ])
            : txt("Sin clientes en el período.", { color: COLOR.muted }),

          // ─── Footer ───────────────────────────────────────────────────
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 480 },
            children: [
              new TextRun({
                text: `Generado automáticamente · enrola.shop · ${month}`,
                size: 18,
                color: COLOR.muted,
                italics: true,
                font: "Helvetica",
              }),
            ],
          }),
        ],
      },
    ],
  })

  return Packer.toBuffer(doc)
}
