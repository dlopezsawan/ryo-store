/**
 * Delete a tracked keyword (soft delete).
 */
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SEO_ANALYTICS_MODULE } from "../../../../../modules/seo-analytics"

export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const id = (req.params as any).id
  if (!id) {
    res.status(400).json({ error: "id required" })
    return
  }
  const svc: any = req.scope.resolve(SEO_ANALYTICS_MODULE)
  try {
    await svc.deleteSeoKwTrackeds(id)
    res.json({ ok: true, id })
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "delete failed" })
  }
}
