/**
 * Tracked keywords list + add.
 * GET: list all active, enriched with GSC stats (last 28d) and action hint.
 * POST { keyword, country?, device?, notes? }: add to tracker.
 */
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Pool } from "pg"
import { SEO_ANALYTICS_MODULE } from "../../../../modules/seo-analytics"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

type KwRow = {
  id: string
  keyword: string
  country: string
  device: string
  source: string
  notes?: string | null
  active: boolean
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const svc: any = req.scope.resolve(SEO_ANALYTICS_MODULE)
  const items: KwRow[] = await svc.listSeoKwTrackeds({ active: true })

  if (items.length === 0) {
    res.json({ keywords: [], count: 0 })
    return
  }

  // Enrich each keyword with last-28d GSC stats
  const queries = items.map((k) => k.keyword)
  const statsRes = await pool.query(
    `
    SELECT query,
      SUM(impressions)::bigint AS impressions,
      SUM(clicks)::bigint AS clicks,
      CASE WHEN SUM(impressions) > 0
        THEN SUM(position * impressions) / SUM(impressions)
        ELSE NULL
      END AS avg_position
    FROM seo_gsc_daily
    WHERE query = ANY($1::text[])
      AND date >= CURRENT_DATE - INTERVAL '28 days'
      AND deleted_at IS NULL
    GROUP BY query
    `,
    [queries]
  )
  const statsMap = new Map<string, { impressions: number; clicks: number; position: number | null }>()
  statsRes.rows.forEach((r: any) => {
    statsMap.set(r.query, {
      impressions: Number(r.impressions || 0),
      clicks: Number(r.clicks || 0),
      position: r.avg_position != null ? Number(r.avg_position) : null,
    })
  })

  function actionHint(pos: number | null, impressions: number) {
    if (impressions === 0) return { tag: "sin_datos", label: "Sin impresiones todavía", color: "grey" }
    if (pos == null) return { tag: "sin_datos", label: "Sin posición", color: "grey" }
    if (pos <= 3) return { tag: "defender", label: "✅ Defender (top 3)", color: "green" }
    if (pos <= 10) return { tag: "optimizar", label: "🎯 Optimizar CTR", color: "blue" }
    if (pos <= 20) return { tag: "striking", label: "🔥 Striking distance", color: "orange" }
    return { tag: "alejado", label: "📉 Lejano — crear contenido", color: "red" }
  }

  const enriched = items.map((k) => {
    const stats = statsMap.get(k.keyword) || { impressions: 0, clicks: 0, position: null }
    return {
      ...k,
      ...stats,
      action: actionHint(stats.position, stats.impressions),
    }
  })

  res.json({ keywords: enriched, count: enriched.length })
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const body = (req as any).body || {}
  const keyword = String(body.keyword || "").trim().toLowerCase()
  if (!keyword) {
    res.status(400).json({ error: "keyword required" })
    return
  }
  const country = String(body.country || "ve").toLowerCase()
  const device = String(body.device || "mobile").toLowerCase()
  const notes = body.notes ? String(body.notes) : null
  const source = String(body.source || "manual")

  const svc: any = req.scope.resolve(SEO_ANALYTICS_MODULE)

  // Check duplicate
  const existing = await svc.listSeoKwTrackeds({ keyword, country, device })
  if (existing.length > 0) {
    res.status(409).json({ error: "keyword already tracked", existing: existing[0] })
    return
  }

  const created = await svc.createSeoKwTrackeds([
    { keyword, country, device, notes, source, active: true },
  ])
  res.status(201).json({ keyword: created[0] })
}
