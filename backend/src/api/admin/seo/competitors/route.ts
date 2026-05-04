/**
 * SEO Competitors list — Batch 1.
 */
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SEO_ANALYTICS_MODULE } from "../../../../modules/seo-analytics"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const svc: any = req.scope.resolve(SEO_ANALYTICS_MODULE)
  const items = await svc.listSeoCompetitors({ active: true })
  res.json({ competitors: items, count: items.length })
}
