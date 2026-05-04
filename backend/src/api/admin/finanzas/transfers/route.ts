/**
 * GET  /admin/finanzas/transfers          — list, ?wallet_id= filters either side
 * POST /admin/finanzas/transfers          — create transfer + ledger entries
 */

import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import FinanzasModuleService from "../../../../modules/finanzas/service"
import { FINANZAS_MODULE } from "../../../../modules/finanzas"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const fin: FinanzasModuleService = req.scope.resolve(FINANZAS_MODULE)
  const wallet = typeof req.query.wallet_id === "string" ? req.query.wallet_id : undefined
  let transfers = await fin.listFinanzasTransfers({}, {
    order: { transferred_at: "DESC" },
    take: 200,
  } as never)
  if (wallet) {
    transfers = transfers.filter(
      (t) => t.from_wallet_id === wallet || t.to_wallet_id === wallet
    )
  }
  res.json({ transfers })
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const fin: FinanzasModuleService = req.scope.resolve(FINANZAS_MODULE)
  const body = (req.body || {}) as {
    from_wallet_id?: string
    to_wallet_id?: string
    amount?: number
    rate?: number
    amount_received?: number
    note?: string
    transferred_at?: string
  }
  if (!body.from_wallet_id || !body.to_wallet_id || !body.amount) {
    return res
      .status(400)
      .json({ error: "from_wallet_id, to_wallet_id, amount required" })
  }
  if (body.from_wallet_id === body.to_wallet_id) {
    return res.status(400).json({ error: "wallets must differ" })
  }
  if (Number(body.amount) <= 0) {
    return res.status(400).json({ error: "amount must be > 0" })
  }
  const result = await fin.createTransfer({
    from_wallet_id: body.from_wallet_id,
    to_wallet_id: body.to_wallet_id,
    amount: Number(body.amount),
    rate: body.rate != null ? Number(body.rate) : null,
    amount_received: body.amount_received != null ? Number(body.amount_received) : null,
    note: body.note ?? null,
    transferred_at: body.transferred_at ? new Date(body.transferred_at) : new Date(),
  })
  const transfer = await fin.retrieveFinanzasTransfer(result.id)
  res.status(201).json({ transfer })
}
