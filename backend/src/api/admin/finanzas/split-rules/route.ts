/**
 * GET  /admin/finanzas/split-rules     — list current rules
 * PUT  /admin/finanzas/split-rules     — replace all rules at once + recompute
 *                                         every existing pago_movil so past
 *                                         orders reflect the new percentages.
 *   body: { rules: [{ bucket, percentage }, ...] }   sum must = 100
 */

import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import FinanzasModuleService from "../../../../modules/finanzas/service"
import { FINANZAS_MODULE } from "../../../../modules/finanzas"

const ALLOWED_BUCKETS = new Set(["gastos_fijos", "marketing", "ganancia"])

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const fin: FinanzasModuleService = req.scope.resolve(FINANZAS_MODULE)
  const rules = await fin.listFinanzasSplitRules({}, {
    order: { bucket: "ASC" },
  } as never)
  res.json({ rules })
}

export async function PUT(req: MedusaRequest, res: MedusaResponse) {
  const fin: FinanzasModuleService = req.scope.resolve(FINANZAS_MODULE)
  const body = (req.body || {}) as {
    rules?: Array<{ bucket: string; percentage: number; description?: string }>
  }
  if (!Array.isArray(body.rules) || body.rules.length === 0) {
    return res.status(400).json({ error: "rules array required" })
  }
  for (const r of body.rules) {
    if (!ALLOWED_BUCKETS.has(r.bucket)) {
      return res
        .status(400)
        .json({ error: `bucket "${r.bucket}" no permitido. Usa: ${Array.from(ALLOWED_BUCKETS).join(", ")}` })
    }
  }
  const sum = body.rules.reduce((s, r) => s + Number(r.percentage || 0), 0)
  if (Math.round(sum) !== 100) {
    return res
      .status(400)
      .json({ error: `Los porcentajes deben sumar 100, suman ${sum}` })
  }

  for (const r of body.rules) {
    const existing = await fin.listFinanzasSplitRules({ bucket: r.bucket })
    if (existing.length > 0) {
      await fin.updateFinanzasSplitRules({
        id: existing[0].id,
        percentage: Number(r.percentage),
        description: r.description ?? existing[0].description,
        is_active: true,
      })
    } else {
      await fin.createFinanzasSplitRules({
        bucket: r.bucket,
        percentage: Number(r.percentage),
        description: r.description ?? null,
        is_active: true,
      })
    }
  }
  const allRules = await fin.listFinanzasSplitRules({})
  const submittedBuckets = new Set(body.rules.map((r) => r.bucket))
  for (const r of allRules) {
    if (!submittedBuckets.has(r.bucket) && r.is_active) {
      await fin.updateFinanzasSplitRules({ id: r.id, is_active: false })
    }
  }
  await fin.assertSplitRulesSumTo100()

  // Auto-recompute every past order so the dashboard reflects the new splits.
  const recomputed = await fin.recomputeAllPagoMovils()

  const fresh = await fin.listFinanzasSplitRules({}, { order: { bucket: "ASC" } } as never)
  res.json({ rules: fresh, recomputed_orders: recomputed })
}
