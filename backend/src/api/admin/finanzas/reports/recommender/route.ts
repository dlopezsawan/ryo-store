/**
 * GET /admin/finanzas/reports/recommender
 *
 * Looks at the rate snapshot history and the current pending Bs balance,
 * then recommends "convertí ahora" / "esperá" / "no hay datos suficientes".
 *
 * Logic:
 *   - Pull last 30 days of snapshots
 *   - Compute avg + stddev of spread_ratio (paralelo / BCV USD)
 *   - Latest spread compared to avg → z-score
 *   - z >= +0.5  → "convertir ahora" (spread is unusually wide)
 *   - z <= -0.5  → "esperar" (spread is below average, paralelo close to BCV)
 *   - otherwise   → "neutral"
 */

import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { Pool } from "pg"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

export async function GET(_req: MedusaRequest, res: MedusaResponse) {
  const snapsR = await pool.query(
    `SELECT taken_at, bcv_eur_to_bs, bcv_usd_to_bs, paralelo_usdt_to_bs, spread_ratio
     FROM finanzas_rate_snapshot
     WHERE deleted_at IS NULL
       AND taken_at >= NOW() - INTERVAL '30 days'
     ORDER BY taken_at DESC`
  )
  const snaps = snapsR.rows.filter((s) => s.spread_ratio != null)

  // Pending bs across all pago_movils
  const pendingR = await pool.query(
    `SELECT
       COALESCE(SUM(bs_pending), 0) AS bs_pending
     FROM finanzas_pago_movil WHERE deleted_at IS NULL`
  )
  const bsPending = Number(pendingR.rows[0].bs_pending) || 0

  if (snaps.length < 5) {
    return res.json({
      recommendation: "no_data",
      message: `Sólo ${snaps.length} snapshots con spread en los últimos 30 días — esperá a que el job junte más historia.`,
      bs_pending: bsPending,
      latest: snaps[0] || null,
    })
  }

  const ratios = snaps.map((s) => Number(s.spread_ratio))
  const avg = ratios.reduce((a, b) => a + b, 0) / ratios.length
  const stddev = Math.sqrt(
    ratios.reduce((a, r) => a + (r - avg) ** 2, 0) / ratios.length
  )
  const latest = snaps[0]
  const latestRatio = Number(latest.spread_ratio)
  const zscore = stddev > 0 ? (latestRatio - avg) / stddev : 0

  let recommendation: "convertir_ahora" | "esperar" | "neutral"
  let message: string
  if (zscore >= 0.5) {
    recommendation = "convertir_ahora"
    message = `Spread paralelo/BCV está en ${(latestRatio * 100 - 100).toFixed(1)}% (avg 30d: ${(avg * 100 - 100).toFixed(1)}%). Buen momento para convertir.`
  } else if (zscore <= -0.5) {
    recommendation = "esperar"
    message = `Spread bajo (${(latestRatio * 100 - 100).toFixed(1)}% vs avg ${(avg * 100 - 100).toFixed(1)}%). Si no urge, esperá un mejor momento.`
  } else {
    recommendation = "neutral"
    message = `Spread cerca del promedio (${(latestRatio * 100 - 100).toFixed(1)}% vs avg ${(avg * 100 - 100).toFixed(1)}%). Convertí cuando lo necesites.`
  }

  // Estimated USDT if converted now at latest paralelo rate
  const paralelo = latest.paralelo_usdt_to_bs ? Number(latest.paralelo_usdt_to_bs) : null
  const estimatedUsdt = paralelo && paralelo > 0 ? bsPending / paralelo : null

  res.json({
    recommendation,
    message,
    bs_pending: bsPending,
    estimated_usdt_at_paralelo:
      estimatedUsdt != null ? Math.round(estimatedUsdt * 100) / 100 : null,
    latest_snapshot: {
      taken_at: latest.taken_at,
      bcv_eur: Number(latest.bcv_eur_to_bs),
      bcv_usd: Number(latest.bcv_usd_to_bs),
      paralelo_usdt: paralelo,
      spread_ratio: latestRatio,
      spread_pct: Math.round((latestRatio - 1) * 10000) / 100,
    },
    stats_30d: {
      samples: snaps.length,
      avg_spread_ratio: Math.round(avg * 10000) / 10000,
      avg_spread_pct: Math.round((avg - 1) * 10000) / 100,
      stddev,
      zscore: Math.round(zscore * 100) / 100,
      min_ratio: Math.min(...ratios),
      max_ratio: Math.max(...ratios),
    },
  })
}
