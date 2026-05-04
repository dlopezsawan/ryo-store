/**
 * GET /admin/finanzas/wallets/:id/ledger?days=30
 *
 *   wallet     — basic info
 *   balance    — current balance (sum of all entries)
 *   entries    — last N entries (limit query, default 200)
 *   daily      — last N days bucketed by date for sparkline:
 *                [{ date: "YYYY-MM-DD", balance_eod, daily_change }]
 *
 * `daily` is computed by walking entries newest-first, subtracting per-day
 * deltas from the current balance to recover the closing balance per day.
 */

import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import FinanzasModuleService from "../../../../../../modules/finanzas/service"
import { FINANZAS_MODULE } from "../../../../../../modules/finanzas"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const fin: FinanzasModuleService = req.scope.resolve(FINANZAS_MODULE)
  const id = req.params.id
  const wallet = await fin.retrieveFinanzasWallet(id).catch(() => null)
  if (!wallet) return res.status(404).json({ error: "wallet_not_found" })

  const limit = Math.min(Number(req.query.limit) || 200, 1000)
  const offset = Number(req.query.offset) || 0
  const days = Math.min(Math.max(Number(req.query.days) || 30, 7), 90)

  const entries = await fin.listFinanzasWalletEntries({ wallet_id: id }, {
    take: limit,
    skip: offset,
    order: { entry_at: "DESC" },
  } as never)

  const balance = await fin.getWalletBalance(id)

  // Build daily series: walk all entries (not just the page), bucket by ISO date.
  const allEntries = await fin.listFinanzasWalletEntries({ wallet_id: id }, {
    order: { entry_at: "ASC" },
  } as never)
  const byDay = new Map<string, number>()
  let running = 0
  const dailyMap = new Map<string, { balance_eod: number; daily_change: number }>()
  for (const e of allEntries) {
    const day = new Date(e.entry_at).toISOString().slice(0, 10)
    const amt = Number(e.amount)
    running += amt
    byDay.set(day, (byDay.get(day) || 0) + amt)
    dailyMap.set(day, { balance_eod: running, daily_change: byDay.get(day)! })
  }

  // Fill in last `days` days with last-known balance for missing days
  const now = new Date()
  const series: Array<{ date: string; balance_eod: number; daily_change: number }> = []
  let lastKnown = 0
  // Determine starting balance before the window
  const startCutoff = new Date(now.getTime() - days * 86400000).toISOString().slice(0, 10)
  for (const [day, val] of dailyMap.entries()) {
    if (day < startCutoff) lastKnown = val.balance_eod
  }
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86400000).toISOString().slice(0, 10)
    const cell = dailyMap.get(d)
    if (cell) lastKnown = cell.balance_eod
    series.push({
      date: d,
      balance_eod: Math.round(lastKnown * 100) / 100,
      daily_change: cell?.daily_change ?? 0,
    })
  }

  res.json({ wallet, balance, entries, daily: series })
}
