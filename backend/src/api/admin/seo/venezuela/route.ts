/**
 * Venezuela-focused SEO view.
 *
 * Returns:
 *   - VE KPIs (impressions, clicks, CTR, pos) vs rest-of-world comparison
 *   - Top VE queries + top VE pages (from seo_gsc_daily when dimensioned data exists)
 *   - Geo queries (near me / local intent detected via regex)
 *   - Weekday distribution of impressions (seasonality signal)
 *   - VE vs global CTR comparison (useful to detect title/meta mismatch)
 *   - Competitors list with SERP-check helper URLs
 *
 * Days param: default 28.
 */
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Pool } from "pg"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

const LOCAL_REGEX = `(venezuela|vzla|caracas|maracaibo|valencia|barquisimeto|maracay|guayana|merida|ccs|bolivares|bolivar|bcv|binance|pago movil|zelle|cerca de mi|cerca mio|near me)`

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const days = Math.max(1, Math.min(365, parseInt(String(req.query.days || "28"), 10)))

  // ── VE vs Rest-of-world from totals ─────────────────────────────────────
  const compareRes = await pool.query(
    `
    SELECT
      SUM(CASE WHEN country = 'ven' THEN impressions ELSE 0 END)::bigint AS ve_impressions,
      SUM(CASE WHEN country = 'ven' THEN clicks ELSE 0 END)::bigint AS ve_clicks,
      CASE WHEN SUM(CASE WHEN country = 'ven' THEN impressions ELSE 0 END) > 0
        THEN SUM(CASE WHEN country = 'ven' THEN clicks ELSE 0 END)::float /
             SUM(CASE WHEN country = 'ven' THEN impressions ELSE 0 END)
        ELSE 0 END AS ve_ctr,
      CASE WHEN SUM(CASE WHEN country = 'ven' THEN impressions ELSE 0 END) > 0
        THEN SUM(CASE WHEN country = 'ven' THEN position * impressions ELSE 0 END) /
             SUM(CASE WHEN country = 'ven' THEN impressions ELSE 0 END)
        ELSE NULL END AS ve_position,
      SUM(CASE WHEN country <> 'ven' THEN impressions ELSE 0 END)::bigint AS row_impressions,
      SUM(CASE WHEN country <> 'ven' THEN clicks ELSE 0 END)::bigint AS row_clicks,
      CASE WHEN SUM(CASE WHEN country <> 'ven' THEN impressions ELSE 0 END) > 0
        THEN SUM(CASE WHEN country <> 'ven' THEN clicks ELSE 0 END)::float /
             SUM(CASE WHEN country <> 'ven' THEN impressions ELSE 0 END)
        ELSE 0 END AS row_ctr
    FROM seo_gsc_totals
    WHERE date >= CURRENT_DATE - ($1::int || ' days')::interval
      AND deleted_at IS NULL
    `,
    [days]
  )
  const c = compareRes.rows[0] || {}

  // ── Top VE queries (from dimensioned table — may be empty for small sites) ──
  const topQueries = await pool.query(
    `
    SELECT query,
      SUM(impressions)::bigint AS impressions,
      SUM(clicks)::bigint AS clicks,
      CASE WHEN SUM(impressions) > 0 THEN SUM(clicks)::float / SUM(impressions) ELSE 0 END AS ctr,
      CASE WHEN SUM(impressions) > 0 THEN SUM(position * impressions) / SUM(impressions) ELSE NULL END AS position
    FROM seo_gsc_daily
    WHERE date >= CURRENT_DATE - ($1::int || ' days')::interval
      AND deleted_at IS NULL
      AND country = 'ven'
    GROUP BY query
    ORDER BY impressions DESC
    LIMIT 20
    `,
    [days]
  )

  // ── Top VE pages ─────────────────────────────────────────────────────────
  const topPages = await pool.query(
    `
    SELECT page,
      SUM(impressions)::bigint AS impressions,
      SUM(clicks)::bigint AS clicks,
      CASE WHEN SUM(impressions) > 0 THEN SUM(clicks)::float / SUM(impressions) ELSE 0 END AS ctr,
      CASE WHEN SUM(impressions) > 0 THEN SUM(position * impressions) / SUM(impressions) ELSE NULL END AS position
    FROM seo_gsc_daily
    WHERE date >= CURRENT_DATE - ($1::int || ' days')::interval
      AND deleted_at IS NULL
      AND country = 'ven'
    GROUP BY page
    ORDER BY impressions DESC
    LIMIT 20
    `,
    [days]
  )

  // ── Geo/local intent queries (regex over our tracked + GSC) ─────────────
  const geoQueries = await pool.query(
    `
    SELECT DISTINCT query,
      SUM(impressions)::bigint AS impressions,
      SUM(clicks)::bigint AS clicks,
      CASE WHEN SUM(impressions) > 0 THEN SUM(position * impressions) / SUM(impressions) ELSE NULL END AS position
    FROM seo_gsc_daily
    WHERE date >= CURRENT_DATE - ($1::int || ' days')::interval
      AND deleted_at IS NULL
      AND query ~* $2
    GROUP BY query
    ORDER BY impressions DESC
    LIMIT 30
    `,
    [days, LOCAL_REGEX]
  )

  // ── Weekday pattern (seasonality — VE impressions by day of week) ───────
  const weekdayRes = await pool.query(
    `
    SELECT EXTRACT(DOW FROM date)::int AS dow,
      SUM(impressions)::bigint AS impressions,
      SUM(clicks)::bigint AS clicks
    FROM seo_gsc_totals
    WHERE date >= CURRENT_DATE - ($1::int || ' days')::interval
      AND country = 'ven'
      AND deleted_at IS NULL
    GROUP BY dow
    ORDER BY dow ASC
    `,
    [days]
  )
  const dowLabels = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]
  const weekdayMap = new Map<number, { impressions: number; clicks: number }>()
  weekdayRes.rows.forEach((r: any) => {
    weekdayMap.set(Number(r.dow), { impressions: Number(r.impressions), clicks: Number(r.clicks) })
  })
  const weekdayPattern = [0, 1, 2, 3, 4, 5, 6].map((d) => ({
    dow: d,
    label: dowLabels[d],
    impressions: weekdayMap.get(d)?.impressions || 0,
    clicks: weekdayMap.get(d)?.clicks || 0,
  }))

  // ── Tracked keywords performance in VE ──────────────────────────────────
  const trackedVe = await pool.query(`
    SELECT kt.keyword, kt.source,
      COALESCE(SUM(gd.impressions), 0)::bigint AS impressions,
      COALESCE(SUM(gd.clicks), 0)::bigint AS clicks,
      CASE WHEN SUM(gd.impressions) > 0
        THEN SUM(gd.position * gd.impressions) / SUM(gd.impressions)
        ELSE NULL END AS position
    FROM seo_kw_tracked kt
    LEFT JOIN seo_gsc_daily gd
      ON gd.query = kt.keyword
      AND gd.country = 'ven'
      AND gd.date >= CURRENT_DATE - INTERVAL '28 days'
      AND gd.deleted_at IS NULL
    WHERE kt.country = 've' AND kt.active = true AND kt.deleted_at IS NULL
    GROUP BY kt.keyword, kt.source
    ORDER BY impressions DESC
  `)

  // ── Competitors for SERP gap checks ─────────────────────────────────────
  const competitors = await pool.query(`
    SELECT id, name, domain, instagram, threat
    FROM seo_competitor
    WHERE active = true AND deleted_at IS NULL AND domain IS NOT NULL
    ORDER BY
      CASE threat WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'watch' THEN 3 ELSE 4 END
  `)

  // ── Analysis: flag queries where VE CTR < global CTR ────────────────────
  const ctrMismatch: Array<{ query: string; ve_ctr: number; global_ctr: number; ve_impressions: number }> = []
  // (Only works when dimensioned data exists — skipped quietly otherwise)
  if (topQueries.rows.length > 0) {
    const queries = topQueries.rows.map((r: any) => r.query)
    const globalCtrRes = await pool.query(
      `
      SELECT query,
        CASE WHEN SUM(impressions) > 0 THEN SUM(clicks)::float / SUM(impressions) ELSE 0 END AS ctr,
        SUM(impressions)::bigint AS impressions
      FROM seo_gsc_daily
      WHERE query = ANY($1::text[])
        AND date >= CURRENT_DATE - ($2::int || ' days')::interval
        AND deleted_at IS NULL
      GROUP BY query
      `,
      [queries, days]
    )
    const globalMap = new Map<string, number>()
    globalCtrRes.rows.forEach((r: any) => globalMap.set(r.query, Number(r.ctr)))
    topQueries.rows.forEach((r: any) => {
      const veCtr = Number(r.ctr)
      const globalCtr = globalMap.get(r.query) || 0
      if (globalCtr > 0 && veCtr > 0 && veCtr < globalCtr * 0.7 && Number(r.impressions) >= 20) {
        ctrMismatch.push({
          query: r.query,
          ve_ctr: veCtr,
          global_ctr: globalCtr,
          ve_impressions: Number(r.impressions),
        })
      }
    })
  }

  res.json({
    filters: { days },
    ve: {
      impressions: Number(c.ve_impressions || 0),
      clicks: Number(c.ve_clicks || 0),
      ctr: Number(c.ve_ctr || 0),
      position: c.ve_position != null ? Number(c.ve_position) : null,
    },
    rest_of_world: {
      impressions: Number(c.row_impressions || 0),
      clicks: Number(c.row_clicks || 0),
      ctr: Number(c.row_ctr || 0),
    },
    top_queries_ve: topQueries.rows.map((r: any) => ({
      query: r.query,
      impressions: Number(r.impressions),
      clicks: Number(r.clicks),
      ctr: Number(r.ctr),
      position: r.position != null ? Number(r.position) : null,
    })),
    top_pages_ve: topPages.rows.map((r: any) => ({
      page: r.page,
      impressions: Number(r.impressions),
      clicks: Number(r.clicks),
      ctr: Number(r.ctr),
      position: r.position != null ? Number(r.position) : null,
    })),
    geo_queries: geoQueries.rows.map((r: any) => ({
      query: r.query,
      impressions: Number(r.impressions),
      clicks: Number(r.clicks),
      position: r.position != null ? Number(r.position) : null,
    })),
    weekday_pattern: weekdayPattern,
    tracked_keywords_ve: trackedVe.rows.map((r: any) => ({
      keyword: r.keyword,
      source: r.source,
      impressions: Number(r.impressions),
      clicks: Number(r.clicks),
      position: r.position != null ? Number(r.position) : null,
    })),
    competitors: competitors.rows,
    ctr_mismatch_vs_global: ctrMismatch,
  })
}
