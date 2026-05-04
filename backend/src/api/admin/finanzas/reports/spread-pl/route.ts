/**
 * GET /admin/finanzas/reports/spread-pl?month=YYYY-MM
 *
 * For each Bs→USDT conversion in the period, compares:
 *   - actual_usdt        — what the user really received
 *   - bcv_usdt           — what they would have received at the BCV USD rate
 *                          captured by the rate-snapshot job nearest to the
 *                          conversion's timestamp
 *
 * Difference is the "spread cambiario" gain/loss (we usually win because
 * paralelo > BCV in Venezuela). Returns per-conversion detail + period totals.
 */

import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { Pool } from "pg"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

function bounds(month?: string) {
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [y, m] = month.split("-").map(Number)
    return { from: new Date(Date.UTC(y, m - 1, 1)), to: new Date(Date.UTC(y, m, 1)), label: month }
  }
  return { from: new Date(0), to: new Date(Date.now() + 86400000), label: "all" }
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const { from, to, label } = bounds(
    typeof req.query.month === "string" ? req.query.month : undefined
  )

  const r = await pool.query(
    `SELECT c.id, c.amount_bs, c.amount_usdt, c.rate_bs_per_usdt, c.converted_at,
            c.note, pm.order_display_id, pm.customer_name,
            (SELECT bcv_usd_to_bs FROM finanzas_rate_snapshot rs
              WHERE rs.deleted_at IS NULL
                AND rs.bcv_usd_to_bs IS NOT NULL
                AND ABS(EXTRACT(EPOCH FROM (rs.taken_at - c.converted_at))) < 86400 * 7
              ORDER BY ABS(EXTRACT(EPOCH FROM (rs.taken_at - c.converted_at))) ASC
              LIMIT 1) AS bcv_usd_at_conversion
     FROM finanzas_conversion c
     LEFT JOIN finanzas_pago_movil pm ON pm.id = c.pago_movil_id
     WHERE c.deleted_at IS NULL
       AND c.converted_at >= $1 AND c.converted_at < $2
     ORDER BY c.converted_at DESC`,
    [from, to]
  )

  const conversions = r.rows.map((x) => {
    const amountBs = Number(x.amount_bs)
    const actualUsdt = Number(x.amount_usdt)
    const bcvUsd = x.bcv_usd_at_conversion ? Number(x.bcv_usd_at_conversion) : null
    const theoreticalUsdt = bcvUsd && bcvUsd > 0 ? amountBs / bcvUsd : null
    const gainUsdt = theoreticalUsdt != null ? actualUsdt - theoreticalUsdt : null
    return {
      id: x.id,
      converted_at: x.converted_at,
      order_display_id: x.order_display_id,
      customer_name: x.customer_name,
      amount_bs: amountBs,
      actual_usdt: actualUsdt,
      actual_rate: Number(x.rate_bs_per_usdt),
      bcv_usd_at_conversion: bcvUsd,
      theoretical_usdt_at_bcv: theoreticalUsdt != null ? Math.round(theoreticalUsdt * 100) / 100 : null,
      spread_gain_usdt: gainUsdt != null ? Math.round(gainUsdt * 100) / 100 : null,
      spread_gain_pct:
        theoreticalUsdt && theoreticalUsdt > 0 && gainUsdt != null
          ? gainUsdt / theoreticalUsdt
          : null,
      note: x.note,
    }
  })

  const totalGain = conversions.reduce(
    (s, c) => s + (c.spread_gain_usdt ?? 0),
    0
  )
  const totalActual = conversions.reduce((s, c) => s + c.actual_usdt, 0)
  const totalTheoretical = conversions.reduce(
    (s, c) => s + (c.theoretical_usdt_at_bcv ?? 0),
    0
  )

  res.json({
    period: label,
    conversions,
    totals: {
      conversions: conversions.length,
      bs_converted: conversions.reduce((s, c) => s + c.amount_bs, 0),
      actual_usdt: Math.round(totalActual * 100) / 100,
      theoretical_usdt_at_bcv: Math.round(totalTheoretical * 100) / 100,
      spread_gain_usdt: Math.round(totalGain * 100) / 100,
      spread_gain_pct:
        totalTheoretical > 0 ? totalGain / totalTheoretical : 0,
    },
  })
}
