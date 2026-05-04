import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import FinanzasModuleService from "../../../../modules/finanzas/service"
import { FINANZAS_MODULE } from "../../../../modules/finanzas"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const fin: FinanzasModuleService = req.scope.resolve(FINANZAS_MODULE)
  const wallets = await fin.listFinanzasWallets({}, { order: { sort_order: "ASC" } } as never)
  res.json({ wallets })
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const fin: FinanzasModuleService = req.scope.resolve(FINANZAS_MODULE)
  const body = (req.body || {}) as {
    name?: string
    currency?: string
    description?: string
    sort_order?: number
    is_active?: boolean
  }
  if (!body.name || !body.currency) {
    return res.status(400).json({ error: "name and currency are required" })
  }
  const wallet = await fin.createFinanzasWallets({
    name: body.name,
    currency: body.currency.toLowerCase(),
    description: body.description ?? null,
    sort_order: body.sort_order ?? 0,
    is_active: body.is_active ?? true,
  })
  res.status(201).json({ wallet })
}
