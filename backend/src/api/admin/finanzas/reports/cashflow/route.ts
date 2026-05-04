/**
 * GET /admin/finanzas/reports/cashflow?month=YYYY-MM
 *
 * Cashflow statement for a single month, broken into 3 sections:
 *
 *   OPERATIVO   — cobros (Bs received from orders) − gastos pagados (USDT)
 *   INVERSIÓN   — restock spend (out) — proxy for inventory acquisition
 *   FINANCIERO  — transfers between wallets, manual adjustments, withdrawals
 *
 * Returns per-section ledger entries + totals, in both Bs and USDT
 * (depending on which wallet the entry hits).
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

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const monthArg = typeof req.query.month === "string" ? req.query.month : undefined
  const { from, to, label } = bounds(monthArg)

  // Pull all ledger entries in this month
  const r = await pool.query(
    `SELECT we.id, we.wallet_id, we.amount, we.currency, we.source_type, we.source_id,
            we.note, we.entry_at, w.name AS wallet_name
     FROM finanzas_wallet_entry we
     JOIN finanzas_wallet w ON w.id = we.wallet_id
     WHERE we.deleted_at IS NULL
       AND we.entry_at >= $1 AND we.entry_at < $2
     ORDER BY we.entry_at ASC`,
    [from, to]
  )
  const entries = r.rows

  // Classify each entry into operativo / inversion / financiero
  type Section = "operativo" | "inversion" | "financiero"
  function classify(entry: { source_type: string; note: string | null }): Section {
    const t = entry.source_type
    if (t === "pago_movil" || t === "expense" || t === "conversion_out" || t === "conversion_in") {
      // conversions are operativo (we're swapping working capital, but keep
      // it visible there since it's the day-to-day cash movement).
      // pago_movil + expense = obvious operativo.
      // Restock-bucketed expenses we'd ideally split into "inversion" — for
      // v1 we keep them all in operativo and add a note.
      return "operativo"
    }
    if (t === "transfer_in" || t === "transfer_out" || t === "adjustment") return "financiero"
    return "operativo"
  }

  const sections: Record<Section, {
    entries: typeof entries
    totals: { eur: number; bs: number; usdt: number }
  }> = {
    operativo: { entries: [], totals: { eur: 0, bs: 0, usdt: 0 } },
    inversion: { entries: [], totals: { eur: 0, bs: 0, usdt: 0 } },
    financiero: { entries: [], totals: { eur: 0, bs: 0, usdt: 0 } },
  }

  for (const e of entries) {
    const sec = classify(e)
    sections[sec].entries.push(e)
    const amt = Number(e.amount)
    if (e.currency === "bs") sections[sec].totals.bs += amt
    else if (e.currency === "usdt") sections[sec].totals.usdt += amt
    else if (e.currency === "eur") sections[sec].totals.eur += amt
  }

  // Restock paid expenses → reclassify to inversion (best-effort)
  const restockR = await pool.query(
    `SELECT e.id, e.amount_usdt, e.description, e.expense_date
     FROM finanzas_expense e
     JOIN finanzas_expense_category ec ON ec.id = e.category_id
     WHERE e.deleted_at IS NULL
       AND e.status = 'paid'
       AND ec.bucket = 'restock'
       AND e.expense_date >= $1 AND e.expense_date < $2`,
    [from, to]
  )
  for (const re of restockR.rows) {
    sections.inversion.entries.push({
      id: re.id,
      wallet_id: null,
      amount: -Math.abs(Number(re.amount_usdt)),
      currency: "usdt",
      source_type: "expense_restock",
      source_id: re.id,
      note: re.description,
      entry_at: re.expense_date,
      wallet_name: null,
    })
    sections.inversion.totals.usdt -= Math.abs(Number(re.amount_usdt))
    // Remove from operativo if it was added
    const idx = sections.operativo.entries.findIndex(
      (x) => x.source_type === "expense" && x.source_id === re.id
    )
    if (idx >= 0) {
      sections.operativo.entries.splice(idx, 1)
      sections.operativo.totals.usdt += Math.abs(Number(re.amount_usdt))
    }
  }

  res.json({
    month: label,
    range: { from, to },
    sections: {
      operativo: sections.operativo,
      inversion: sections.inversion,
      financiero: sections.financiero,
    },
    net_change: {
      bs:
        sections.operativo.totals.bs +
        sections.inversion.totals.bs +
        sections.financiero.totals.bs,
      usdt:
        sections.operativo.totals.usdt +
        sections.inversion.totals.usdt +
        sections.financiero.totals.usdt,
    },
  })
}
