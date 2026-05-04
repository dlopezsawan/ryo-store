/**
 * Opportunities tab — content emergence + detection of SEO signals.
 *
 * All detectors compute on-the-fly from seo_gsc_daily (no extra tables/jobs).
 *
 * Signals:
 *   1. emerging_queries       — queries with impressions last 7d and 0 in the prior 7d
 *   2. pages_entered_top10    — pages avg pos ≤10 last 7d and >10 in prior 7d
 *   3. pages_lost_top10       — pages avg pos >10 last 7d and ≤10 in prior 7d
 *   4. brand_vs_nonbrand      — split of impressions/clicks by presence of "enrola" in query
 *   5. cannibalization        — queries with 2+ of our URLs ranking in the same period
 *   6. striking_distance      — queries in pos 11-20 with impressions ≥10
 */
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Pool } from "pg"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

const BRAND_REGEX = "(enrola|ryo store|ryoshop|ryo\\.shop|enrola\\.shop)"

export async function GET(_req: MedusaRequest, res: MedusaResponse) {
  try {
    const [
      emergingRes,
      enteredRes,
      lostRes,
      brandRes,
      cannibalRes,
      strikingRes,
    ] = await Promise.all([
      emergingQueries(),
      pagesEnteredTop10(),
      pagesLostTop10(),
      brandSplit(),
      cannibalization(),
      strikingDistance(),
    ])

    res.json({
      emerging_queries: emergingRes,
      pages_entered_top10: enteredRes,
      pages_lost_top10: lostRes,
      brand_split: brandRes,
      cannibalization: cannibalRes,
      striking_distance: strikingRes,
    })
  } catch (err: any) {
    console.error("[seo/opportunities]", err)
    res.status(500).json({ error: err?.message || "opportunities failed" })
  }
}

async function emergingQueries() {
  const r = await pool.query(`
    WITH recent AS (
      SELECT query,
        SUM(impressions)::bigint AS impressions,
        SUM(clicks)::bigint AS clicks,
        CASE WHEN SUM(impressions) > 0
          THEN SUM(position * impressions) / SUM(impressions) ELSE NULL END AS avg_position,
        MIN(date::date) AS first_seen
      FROM seo_gsc_daily
      WHERE date >= CURRENT_DATE - INTERVAL '7 days' AND deleted_at IS NULL
      GROUP BY query
    ),
    prior AS (
      SELECT query, SUM(impressions)::bigint AS impressions
      FROM seo_gsc_daily
      WHERE date >= CURRENT_DATE - INTERVAL '21 days'
        AND date < CURRENT_DATE - INTERVAL '7 days'
        AND deleted_at IS NULL
      GROUP BY query
    )
    SELECT r.query, r.impressions, r.clicks, r.avg_position, r.first_seen
    FROM recent r
    LEFT JOIN prior p ON p.query = r.query
    WHERE (p.impressions IS NULL OR p.impressions = 0)
      AND r.impressions >= 3
    ORDER BY r.impressions DESC
    LIMIT 30
  `)
  return r.rows.map((x: any) => ({
    query: x.query,
    impressions: Number(x.impressions),
    clicks: Number(x.clicks),
    avg_position: x.avg_position != null ? Number(x.avg_position) : null,
    first_seen: x.first_seen,
  }))
}

async function pagesEnteredTop10() {
  const r = await pool.query(`
    WITH recent AS (
      SELECT page,
        SUM(impressions)::bigint AS impressions,
        SUM(clicks)::bigint AS clicks,
        CASE WHEN SUM(impressions) > 0 THEN SUM(position * impressions) / SUM(impressions) ELSE NULL END AS pos
      FROM seo_gsc_daily
      WHERE date >= CURRENT_DATE - INTERVAL '7 days' AND deleted_at IS NULL
      GROUP BY page
      HAVING SUM(impressions) >= 5
    ),
    prior AS (
      SELECT page,
        CASE WHEN SUM(impressions) > 0 THEN SUM(position * impressions) / SUM(impressions) ELSE NULL END AS pos
      FROM seo_gsc_daily
      WHERE date >= CURRENT_DATE - INTERVAL '14 days' AND date < CURRENT_DATE - INTERVAL '7 days' AND deleted_at IS NULL
      GROUP BY page
      HAVING SUM(impressions) >= 1
    )
    SELECT r.page, r.impressions, r.clicks, r.pos AS pos_now, p.pos AS pos_prev
    FROM recent r JOIN prior p ON p.page = r.page
    WHERE r.pos <= 10 AND (p.pos IS NULL OR p.pos > 10)
    ORDER BY r.clicks DESC
    LIMIT 20
  `)
  return r.rows.map((x: any) => ({
    page: x.page,
    impressions: Number(x.impressions),
    clicks: Number(x.clicks),
    position_now: Number(x.pos_now),
    position_prev: x.pos_prev != null ? Number(x.pos_prev) : null,
  }))
}

async function pagesLostTop10() {
  const r = await pool.query(`
    WITH recent AS (
      SELECT page,
        SUM(impressions)::bigint AS impressions,
        SUM(clicks)::bigint AS clicks,
        CASE WHEN SUM(impressions) > 0 THEN SUM(position * impressions) / SUM(impressions) ELSE NULL END AS pos
      FROM seo_gsc_daily
      WHERE date >= CURRENT_DATE - INTERVAL '7 days' AND deleted_at IS NULL
      GROUP BY page
    ),
    prior AS (
      SELECT page,
        CASE WHEN SUM(impressions) > 0 THEN SUM(position * impressions) / SUM(impressions) ELSE NULL END AS pos,
        SUM(clicks)::bigint AS clicks
      FROM seo_gsc_daily
      WHERE date >= CURRENT_DATE - INTERVAL '14 days' AND date < CURRENT_DATE - INTERVAL '7 days' AND deleted_at IS NULL
      GROUP BY page
      HAVING SUM(impressions) >= 5
    )
    SELECT p.page, r.impressions, r.clicks AS clicks_now, p.clicks AS clicks_prev, r.pos AS pos_now, p.pos AS pos_prev
    FROM prior p LEFT JOIN recent r ON r.page = p.page
    WHERE p.pos <= 10 AND (r.pos IS NULL OR r.pos > 10)
    ORDER BY p.clicks DESC
    LIMIT 20
  `)
  return r.rows.map((x: any) => ({
    page: x.page,
    position_now: x.pos_now != null ? Number(x.pos_now) : null,
    position_prev: Number(x.pos_prev),
    clicks_now: x.clicks_now != null ? Number(x.clicks_now) : 0,
    clicks_prev: Number(x.clicks_prev),
    impressions: x.impressions != null ? Number(x.impressions) : 0,
  }))
}

async function brandSplit() {
  const r = await pool.query(`
    SELECT
      CASE WHEN query ~* '${BRAND_REGEX}' THEN 'brand' ELSE 'non_brand' END AS bucket,
      SUM(impressions)::bigint AS impressions,
      SUM(clicks)::bigint AS clicks,
      COUNT(DISTINCT query) AS unique_queries
    FROM seo_gsc_daily
    WHERE date >= CURRENT_DATE - INTERVAL '28 days' AND deleted_at IS NULL
    GROUP BY bucket
  `)
  const brand = r.rows.find((x: any) => x.bucket === "brand")
  const nonBrand = r.rows.find((x: any) => x.bucket === "non_brand")
  const total = r.rows.reduce((s: number, x: any) => s + Number(x.impressions || 0), 0)
  return {
    brand: brand ? {
      impressions: Number(brand.impressions),
      clicks: Number(brand.clicks),
      unique_queries: Number(brand.unique_queries),
      pct_of_impressions: total > 0 ? (Number(brand.impressions) / total) * 100 : 0,
    } : null,
    non_brand: nonBrand ? {
      impressions: Number(nonBrand.impressions),
      clicks: Number(nonBrand.clicks),
      unique_queries: Number(nonBrand.unique_queries),
      pct_of_impressions: total > 0 ? (Number(nonBrand.impressions) / total) * 100 : 0,
    } : null,
  }
}

async function cannibalization() {
  const r = await pool.query(`
    SELECT query,
      COUNT(DISTINCT page) AS url_count,
      SUM(impressions)::bigint AS impressions,
      json_agg(json_build_object(
        'page', page,
        'impressions', p_imp,
        'clicks', p_clk,
        'position', p_pos
      ) ORDER BY p_imp DESC) AS urls
    FROM (
      SELECT query, page,
        SUM(impressions)::bigint AS p_imp,
        SUM(clicks)::bigint AS p_clk,
        CASE WHEN SUM(impressions) > 0 THEN SUM(position * impressions) / SUM(impressions) ELSE NULL END AS p_pos
      FROM seo_gsc_daily
      WHERE date >= CURRENT_DATE - INTERVAL '28 days' AND deleted_at IS NULL
      GROUP BY query, page
    ) t
    GROUP BY query
    HAVING COUNT(DISTINCT page) >= 2 AND SUM(impressions) >= 10
    ORDER BY SUM(impressions) DESC
    LIMIT 20
  `)
  return r.rows.map((x: any) => ({
    query: x.query,
    url_count: Number(x.url_count),
    impressions: Number(x.impressions),
    urls: (x.urls || []).map((u: any) => ({
      page: u.page,
      impressions: Number(u.impressions),
      clicks: Number(u.clicks),
      position: u.position != null ? Number(u.position) : null,
    })),
  }))
}

async function strikingDistance() {
  const r = await pool.query(`
    SELECT query,
      SUM(impressions)::bigint AS impressions,
      SUM(clicks)::bigint AS clicks,
      CASE WHEN SUM(impressions) > 0 THEN SUM(position * impressions) / SUM(impressions) ELSE NULL END AS avg_position,
      (SELECT page FROM seo_gsc_daily d2
        WHERE d2.query = d1.query AND d2.date >= CURRENT_DATE - INTERVAL '28 days' AND d2.deleted_at IS NULL
        GROUP BY page ORDER BY SUM(d2.impressions) DESC LIMIT 1) AS top_url
    FROM seo_gsc_daily d1
    WHERE date >= CURRENT_DATE - INTERVAL '28 days' AND deleted_at IS NULL
    GROUP BY query
    HAVING SUM(impressions) >= 10
    ORDER BY avg_position ASC
    LIMIT 50
  `)
  return r.rows
    .map((x: any) => ({
      query: x.query,
      impressions: Number(x.impressions),
      clicks: Number(x.clicks),
      avg_position: x.avg_position != null ? Number(x.avg_position) : null,
      top_url: x.top_url || null,
    }))
    .filter((x: any) => x.avg_position != null && x.avg_position >= 11 && x.avg_position <= 20)
    .slice(0, 25)
}
