/**
 * SEO Overview — aggregated KPIs + time-series for sparklines.
 *
 * Uses seo_gsc_totals (date+country+device) as source of truth for KPIs and
 * sparkline. Falls back to seo_gsc_daily (dimensioned) when totals are empty.
 *
 * Query params:
 *   country: ISO code (ve, us, all) — default 'all'
 *   days: int — default 28
 */
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Pool } from "pg"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const country = String(req.query.country || "all")
  const days = Math.max(1, Math.min(365, parseInt(String(req.query.days || "28"), 10)))

  const countryFilter = country === "all" ? "" : "AND country = $3"
  const args: any[] = [days, days * 2]
  if (country !== "all") args.push(country)

  // ── KPIs (current + previous period from seo_gsc_totals) ─────────────────
  const kpiQuery = await pool.query(
    `
    WITH current_period AS (
      SELECT
        COALESCE(SUM(impressions), 0)::bigint AS impressions,
        COALESCE(SUM(clicks), 0)::bigint AS clicks,
        CASE WHEN SUM(impressions) > 0 THEN SUM(clicks)::float / SUM(impressions) ELSE 0 END AS ctr,
        CASE WHEN SUM(impressions) > 0 THEN SUM(position * impressions) / SUM(impressions) ELSE NULL END AS position
      FROM seo_gsc_totals
      WHERE date >= CURRENT_DATE - ($1::int || ' days')::interval
        AND date < CURRENT_DATE
        ${countryFilter}
        AND deleted_at IS NULL
    ),
    previous_period AS (
      SELECT
        COALESCE(SUM(impressions), 0)::bigint AS impressions,
        COALESCE(SUM(clicks), 0)::bigint AS clicks,
        CASE WHEN SUM(impressions) > 0 THEN SUM(clicks)::float / SUM(impressions) ELSE 0 END AS ctr,
        CASE WHEN SUM(impressions) > 0 THEN SUM(position * impressions) / SUM(impressions) ELSE NULL END AS position
      FROM seo_gsc_totals
      WHERE date >= CURRENT_DATE - ($2::int || ' days')::interval
        AND date < CURRENT_DATE - ($1::int || ' days')::interval
        ${countryFilter}
        AND deleted_at IS NULL
    )
    SELECT
      c.impressions AS c_impressions,
      c.clicks AS c_clicks,
      c.ctr AS c_ctr,
      c.position AS c_position,
      p.impressions AS p_impressions,
      p.clicks AS p_clicks,
      p.ctr AS p_ctr,
      p.position AS p_position
    FROM current_period c, previous_period p
    `,
    args
  )
  const k = kpiQuery.rows[0] || {}

  // ── Daily series for sparkline ───────────────────────────────────────────
  const seriesQuery = await pool.query(
    `
    SELECT
      date::date AS date,
      SUM(impressions)::bigint AS impressions,
      SUM(clicks)::bigint AS clicks,
      CASE WHEN SUM(impressions) > 0 THEN SUM(clicks)::float / SUM(impressions) ELSE 0 END AS ctr,
      CASE WHEN SUM(impressions) > 0 THEN SUM(position * impressions) / SUM(impressions) ELSE NULL END AS position
    FROM seo_gsc_totals
    WHERE date >= CURRENT_DATE - ($1::int || ' days')::interval
      AND date < CURRENT_DATE
      ${countryFilter}
      AND deleted_at IS NULL
    GROUP BY date::date
    ORDER BY date::date ASC
    `,
    args
  )

  // ── Top countries (always from totals — no query dim so no anonymization) ─
  const countriesQuery = await pool.query(
    `
    SELECT country,
      SUM(impressions)::bigint AS impressions,
      SUM(clicks)::bigint AS clicks
    FROM seo_gsc_totals
    WHERE date >= CURRENT_DATE - ($1::int || ' days')::interval
      AND date < CURRENT_DATE
      AND deleted_at IS NULL
    GROUP BY country
    ORDER BY impressions DESC
    LIMIT 10
    `,
    [days]
  )

  // ── Extra context: is there ANY query-level data? (used by UI to toggle empty states) ──
  const dimHas = await pool.query(
    `SELECT COUNT(*) AS n FROM seo_gsc_daily WHERE date >= CURRENT_DATE - ($1::int || ' days')::interval AND deleted_at IS NULL`,
    [days]
  )
  const hasDimensionedData = Number(dimHas.rows[0]?.n || 0) > 0

  function delta(curr: number | null, prev: number | null): number | null {
    if (curr == null || prev == null || prev === 0) return null
    return ((curr - prev) / prev) * 100
  }

  res.json({
    status: "live",
    config: {
      gsc_property: process.env.GSC_PROPERTY || null,
      ga4_property_id: process.env.GA4_PROPERTY_ID || null,
      sync_enabled: process.env.SEO_SYNC_ENABLED === "true",
      service_account_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || null,
      crux_api_key_set: !!process.env.CRUX_API_KEY,
    },
    filters: { country, days },
    has_dimensioned_data: hasDimensionedData,
    summary: {
      impressions: Number(k.c_impressions || 0),
      clicks: Number(k.c_clicks || 0),
      ctr: Number(k.c_ctr || 0),
      position: k.c_position != null ? Number(k.c_position) : null,
      delta_impressions_pct: delta(Number(k.c_impressions), Number(k.p_impressions)),
      delta_clicks_pct: delta(Number(k.c_clicks), Number(k.p_clicks)),
      delta_ctr_pct: delta(Number(k.c_ctr), Number(k.p_ctr)),
      delta_position_pct:
        k.c_position != null && k.p_position != null
          ? delta(Number(k.c_position), Number(k.p_position))
          : null,
    },
    series: seriesQuery.rows.map((r: any) => ({
      date: r.date,
      impressions: Number(r.impressions),
      clicks: Number(r.clicks),
      ctr: Number(r.ctr),
      position: r.position != null ? Number(r.position) : null,
    })),
    top_countries: countriesQuery.rows.map((r: any) => ({
      country: r.country,
      impressions: Number(r.impressions),
      clicks: Number(r.clicks),
    })),
  })
}
