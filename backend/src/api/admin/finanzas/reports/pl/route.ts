/**
 * GET /admin/finanzas/reports/pl?month=YYYY-MM
 *
 * Profit & Loss statement for a single month, structured for direct
 * presentation (PDF/CSV/UI). All amounts in EUR + USDT for legibility.
 *
 *   Ingresos brutos (subtotal pre-discount)
 *   − Descuentos (combo + cupones)
 *   = Ingresos netos
 *   − COGS
 *   = Margen bruto
 *   − Gastos fijos pagados
 *   − Marketing pagado
 *   − Otros (envíos, comisiones)
 *   = EBITDA
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
  const from = new Date(Date.UTC(y, m - 1, 1))
  const to = new Date(Date.UTC(y, m, 1))
  return { from, to, label: `${y}-${String(m).padStart(2, "0")}` }
}

const EUR_PER_USDT = 1.08

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const monthArg = typeof req.query.month === "string" ? req.query.month : undefined
  const { from, to, label } = bounds(monthArg)

  const pmR = await pool.query(
    `SELECT
       COUNT(*) AS orders,
       COALESCE(SUM(amount_eur_subtotal), 0) AS gross_eur,
       COALESCE(SUM(amount_eur_discount), 0) AS discount_eur,
       COALESCE(SUM(amount_eur_total), 0)    AS net_eur,
       COALESCE(SUM(amount_eur_cogs), 0)     AS cogs_eur,
       COALESCE(SUM(amount_eur_margin), 0)   AS margin_eur
     FROM finanzas_pago_movil
     WHERE deleted_at IS NULL
       AND created_at >= $1 AND created_at < $2`,
    [from, to]
  )
  const pm = pmR.rows[0]

  const expR = await pool.query(
    `SELECT ec.bucket, ec.name, COALESCE(SUM(e.amount_usdt), 0) AS spent_usdt
     FROM finanzas_expense e
     JOIN finanzas_expense_category ec ON ec.id = e.category_id
     WHERE e.deleted_at IS NULL
       AND e.status = 'paid'
       AND e.expense_date >= $1 AND e.expense_date < $2
     GROUP BY ec.bucket, ec.name
     ORDER BY ec.bucket, ec.name`,
    [from, to]
  )

  const expensesByBucket: Record<string, { items: Array<{ name: string; usdt: number }>; total_usdt: number }> = {}
  for (const r of expR.rows) {
    if (!expensesByBucket[r.bucket]) {
      expensesByBucket[r.bucket] = { items: [], total_usdt: 0 }
    }
    expensesByBucket[r.bucket].items.push({ name: r.name, usdt: Number(r.spent_usdt) })
    expensesByBucket[r.bucket].total_usdt += Number(r.spent_usdt)
  }

  const grossEur = Number(pm.gross_eur)
  const discountEur = Number(pm.discount_eur)
  const netEur = Number(pm.net_eur)
  const cogsEur = Number(pm.cogs_eur)
  const marginEur = Number(pm.margin_eur)

  const gfPaidUsdt = expensesByBucket.gastos_fijos?.total_usdt || 0
  const mktPaidUsdt = expensesByBucket.marketing?.total_usdt || 0
  const restockExpUsdt = expensesByBucket.restock?.total_usdt || 0
  const otrosUsdt = (expensesByBucket.envios?.total_usdt || 0) +
                    (expensesByBucket.comisiones_pago?.total_usdt || 0) +
                    (expensesByBucket.otros?.total_usdt || 0)

  const totalExpensesUsdt = gfPaidUsdt + mktPaidUsdt + restockExpUsdt + otrosUsdt
  const totalExpensesEur = totalExpensesUsdt * EUR_PER_USDT
  const ebitdaEur = marginEur - totalExpensesEur
  const ebitdaUsdt = ebitdaEur / EUR_PER_USDT

  res.json({
    month: label,
    orders: Number(pm.orders),
    income: {
      gross_eur: grossEur,
      discount_eur: discountEur,
      net_eur: netEur,
    },
    cogs_eur: cogsEur,
    gross_margin_eur: marginEur,
    expenses: {
      gastos_fijos: expensesByBucket.gastos_fijos || { items: [], total_usdt: 0 },
      marketing: expensesByBucket.marketing || { items: [], total_usdt: 0 },
      restock_paid: expensesByBucket.restock || { items: [], total_usdt: 0 },
      otros: {
        items: [
          ...(expensesByBucket.envios?.items || []),
          ...(expensesByBucket.comisiones_pago?.items || []),
          ...(expensesByBucket.otros?.items || []),
        ],
        total_usdt: otrosUsdt,
      },
      total_paid_usdt: totalExpensesUsdt,
      total_paid_eur: totalExpensesEur,
    },
    ebitda: {
      eur: ebitdaEur,
      usdt: ebitdaUsdt,
    },
    margin_pct: netEur > 0 ? marginEur / netEur : 0,
    ebitda_pct: netEur > 0 ? ebitdaEur / netEur : 0,
  })
}
