/**
 * GET  /admin/finanzas/product-costs        — costs joined with all variants
 * POST /admin/finanzas/product-costs        — upsert (with history + audit)
 */

import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import FinanzasModuleService from "../../../../modules/finanzas/service"
import { FINANZAS_MODULE } from "../../../../modules/finanzas"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const fin: FinanzasModuleService = req.scope.resolve(FINANZAS_MODULE)
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const costs = await fin.listFinanzasProductCosts({}, {
    order: { product_handle: "ASC" },
  } as never)

  const { data: products } = await query.graph({
    entity: "product",
    fields: ["id", "handle", "title", "variants.id", "variants.title", "variants.sku"],
  })
  const variantsFlat: Array<{
    variant_id: string
    sku: string | null
    variant_title: string | null
    product_id: string
    product_handle: string
    product_title: string
  }> = []
  for (const p of products || []) {
    for (const v of p.variants || []) {
      variantsFlat.push({
        variant_id: v.id,
        sku: v.sku || null,
        variant_title: v.title || null,
        product_id: p.id,
        product_handle: p.handle || "",
        product_title: p.title || "",
      })
    }
  }
  res.json({ costs, variants: variantsFlat })
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const fin: FinanzasModuleService = req.scope.resolve(FINANZAS_MODULE)
  const body = (req.body || {}) as {
    variant_id?: string
    product_id?: string
    product_handle?: string
    variant_title?: string
    unit_cost_eur?: number
    notes?: string
  }
  if (!body.variant_id || body.unit_cost_eur == null) {
    return res
      .status(400)
      .json({ error: "variant_id and unit_cost_eur are required" })
  }
  const userEmail =
    typeof (req as unknown as { auth_context?: { actor_id?: string } }).auth_context?.actor_id ===
      "string"
      ? (req as unknown as { auth_context: { actor_id: string } }).auth_context.actor_id
      : null

  const result = await fin.upsertProductCost({
    variant_id: body.variant_id,
    unit_cost_eur: Number(body.unit_cost_eur),
    product_id: body.product_id,
    product_handle: body.product_handle,
    variant_title: body.variant_title,
    notes: body.notes,
    changed_by: userEmail,
  })
  res.status(201).json({ cost_id: result.id, previous: result.previous })
}
