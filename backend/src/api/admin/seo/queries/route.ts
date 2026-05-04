/**
 * Top queries for the selected window.
 * Query params: country, days, limit, sort (clicks|impressions|position)
 */
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Pool } from "pg"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const country = String(req.query.country || "all")
  const days = Math.max(1, Math.min(365, parseInt(String(req.query.days || "28"), 10)))
  const limit = Math.max(1, Math.min(500, parseInt(String(req.query.limit || "50"), 10)))
  const sort = String(req.query.sort || "clicks")

  const orderBy: Record<string, string> = {
    clicks: "clicks DESC NULLS LAST",
    impressions: "impressions DESC NULLS LAST",
    position: "position ASC NULLS LAST",
    ctr: "ctr DESC NULLS LAST",
  }
  const orderClause = orderBy[sort] || orderBy.clicks

  const countryFilter = country === "all" ? "" : "AND country = $3"
  const args: any[] = [days, limit]
  if (country !== "all") args.push(country)

  const result = await pool.query(
    `
    SELECT query,
      SUM(impressions)::bigint AS impressions,
      SUM(clicks)::bigint AS clicks,
      CASE WHEN SUM(impressions) > 0 THEN SUM(clicks)::float / SUM(impressions) ELSE 0 END AS ctr,
      CASE WHEN SUM(impressions) > 0 THEN SUM(position * impressions) / SUM(impressions) ELSE NULL END AS position
    FROM seo_gsc_daily
    WHERE date >= CURRENT_DATE - ($1::int || ' days')::interval
      AND date < CURRENT_DATE
      ${countryFilter}
      AND deleted_at IS NULL
    GROUP BY query
    HAVING SUM(impressions) > 0
    ORDER BY ${orderClause}
    LIMIT $2
    `,
    args
  )

  res.json({
    filters: { country, days, limit, sort },
    queries: result.rows.map((r: any) => ({
      query: r.query,
      impressions: Number(r.impressions),
      clicks: Number(r.clicks),
      ctr: Number(r.ctr),
      position: r.position != null ? Number(r.position) : null,
    })),
  })
}
