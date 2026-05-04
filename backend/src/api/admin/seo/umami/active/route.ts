/**
 * Umami realtime active visitors. Cheap endpoint, used for the "live pulse"
 * widget that polls every 30s.
 */
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { getActive, isConfigured } from "../../../../../lib/seo-umami-client"

export async function GET(_req: MedusaRequest, res: MedusaResponse) {
  if (!isConfigured()) {
    res.json({ visitors: 0, configured: false })
    return
  }
  try {
    const r = await getActive()
    res.json({ visitors: r?.visitors ?? 0, configured: true })
  } catch (err: any) {
    res.status(500).json({ error: err?.message })
  }
}
