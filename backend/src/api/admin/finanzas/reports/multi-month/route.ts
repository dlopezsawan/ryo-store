/**
 * GET /admin/finanzas/reports/multi-month?months=12
 *
 * Returns per-month aggregates for the last N months (default 12). Used by
 * the Dashboard "tendencia" chart and the MoM/YoY delta chips.
 *
 * Each month bucket includes:
 *   - revenue_eur / revenue_bs / revenue_usdt_theoretical (sum of pago_movil)
 *   - cogs_eur, margin_eur
 *   - expenses_paid_usdt (sum of paid expenses by bucket)
 *   - splits per bucket (eur + usdt) — what was *budgeted* from order margins
 *   - orders count
 *   - bs_received, bs_converted (cash flow)
 */

import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { Pool } from "pg"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

function monthRanges(monthsBack: number): Array<{ key: string; from: Date; to: Date }> {
  const out: Array<{ key: string; from: Date; to: Date }> = []
  const now = new Date()
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))
    const next = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))
    out.push({
      key: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`,
      from: d,
      to: next,
    })
  }
  return out
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const months = Math.min(Math.max(Number(req.query.months) || 12, 1), 36)
  const ranges = monthRanges(months)

  const buckets: any[] = []
  for (const r of ranges) {
    const pmR = await pool.query(
      `SELECT
         COUNT(*)                                           AS orders,
         COALESCE(SUM(amount_eur_total), 0)                 AS rev_eur,
         COALESCE(SUM(amount_bs_total), 0)                  AS rev_bs,
         COALESCE(SUM(amount_usdt_theoretical), 0)          AS rev_usdt,
         COALESCE(SUM(amount_eur_cogs), 0)                  AS cogs_eur,
         COALESCE(SUM(amount_eur_margin), 0)                AS margin_eur,
         COALESCE(SUM(split_restock_eur), 0)                AS split_restock_eur,
         COALESCE(SUM(split_restock_usdt), 0)               AS split_restock_usdt,
         COALESCE(SUM(split_gastos_fijos_eur), 0)           AS split_gf_eur,
         COALESCE(SUM(split_gastos_fijos_usdt), 0)          AS split_gf_usdt,
         COALESCE(SUM(split_marketing_eur), 0)              AS split_mkt_eur,
         COALESCE(SUM(split_marketing_usdt), 0)             AS split_mkt_usdt,
         COALESCE(SUM(split_ganancia_eur), 0)               AS split_gan_eur,
         COALESCE(SUM(split_ganancia_usdt), 0)              AS split_gan_usdt
       FROM finanzas_pago_movil
       WHERE deleted_at IS NULL
         AND created_at >= $1 AND created_at < $2`,
      [r.from, r.to]
    )
    const pm = pmR.rows[0]

    const expR = await pool.query(
      `SELECT ec.bucket, COALESCE(SUM(e.amount_usdt), 0) AS spent_usdt, COUNT(e.*) AS count
       FROM finanzas_expense e
       JOIN finanzas_expense_category ec ON ec.id = e.category_id
       WHERE e.deleted_at IS NULL
         AND e.status = 'paid'
         AND e.expense_date >= $1 AND e.expense_date < $2
       GROUP BY ec.bucket`,
      [r.from, r.to]
    )
    const expByBucket: Record<string, number> = {}
    let totalExpensesUsdt = 0
    for (const row of expR.rows) {
      expByBucket[row.bucket] = Number(row.spent_usdt)
      totalExpensesUsdt += Number(row.spent_usdt)
    }

    // Cashflow Bs: received = pm.amount_bs_total / converted = conversion.amount_bs
    const cfR = await pool.query(
      `SELECT
         COALESCE((SELECT SUM(amount_bs_total) FROM finanzas_pago_movil
                    WHERE deleted_at IS NULL AND created_at >= $1 AND created_at < $2), 0) AS bs_received,
         COALESCE((SELECT SUM(amount_bs) FROM finanzas_conversion
                    WHERE deleted_at IS NULL AND converted_at >= $1 AND converted_at < $2), 0) AS bs_converted,
         COALESCE((SELECT SUM(amount_usdt) FROM finanzas_conversion
                    WHERE deleted_at IS NULL AND converted_at >= $1 AND converted_at < $2), 0) AS usdt_received_from_conversion`,
      [r.from, r.to]
    )
    const cf = cfR.rows[0]

    buckets.push({
      month: r.key,
      orders: Number(pm.orders),
      revenue: {
        eur: Number(pm.rev_eur),
        bs: Number(pm.rev_bs),
        usdt_theoretical: Number(pm.rev_usdt),
      },
      cogs_eur: Number(pm.cogs_eur),
      margin_eur: Number(pm.margin_eur),
      net_eur: Number(pm.margin_eur) - totalExpensesUsdt * 1.08, // rough EUR
      splits: {
        restock:      { eur: Number(pm.split_restock_eur),   usdt: Number(pm.split_restock_usdt),   spent_usdt: expByBucket.restock || 0 },
        gastos_fijos: { eur: Number(pm.split_gf_eur),         usdt: Number(pm.split_gf_usdt),         spent_usdt: expByBucket.gastos_fijos || 0 },
        marketing:    { eur: Number(pm.split_mkt_eur),        usdt: Number(pm.split_mkt_usdt),        spent_usdt: expByBucket.marketing || 0 },
        ganancia:     { eur: Number(pm.split_gan_eur),        usdt: Number(pm.split_gan_usdt),        spent_usdt: 0 },
      },
      expenses_paid_usdt: totalExpensesUsdt,
      cashflow: {
        bs_received: Number(cf.bs_received),
        bs_converted: Number(cf.bs_converted),
        usdt_from_conversion: Number(cf.usdt_received_from_conversion),
      },
    })
  }

  res.json({ months: buckets })
}
