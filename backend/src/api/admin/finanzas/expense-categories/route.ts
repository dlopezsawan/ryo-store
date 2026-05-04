import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import FinanzasModuleService from "../../../../modules/finanzas/service"
import { FINANZAS_MODULE } from "../../../../modules/finanzas"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const fin: FinanzasModuleService = req.scope.resolve(FINANZAS_MODULE)
  const categories = await fin.listFinanzasExpenseCategories(
    {},
    { order: { name: "ASC" } } as never
  )
  res.json({ categories })
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const fin: FinanzasModuleService = req.scope.resolve(FINANZAS_MODULE)
  const body = (req.body || {}) as {
    name?: string
    bucket?: string
    description?: string
    is_recurring?: boolean
    recurring_amount_usdt?: number
    recurring_day_of_month?: number
    is_active?: boolean
  }
  if (!body.name || !body.bucket) {
    return res.status(400).json({ error: "name and bucket are required" })
  }
  const category = await fin.createFinanzasExpenseCategories({
    name: body.name,
    bucket: body.bucket,
    description: body.description ?? null,
    is_recurring: body.is_recurring ?? false,
    recurring_amount_usdt:
      body.recurring_amount_usdt != null ? Number(body.recurring_amount_usdt) : null,
    recurring_day_of_month:
      body.recurring_day_of_month != null ? Number(body.recurring_day_of_month) : null,
    is_active: body.is_active ?? true,
  })
  res.status(201).json({ category })
}
