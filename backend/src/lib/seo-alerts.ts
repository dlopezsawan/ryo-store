/**
 * SEO alerts engine.
 *
 * Runs 6 rules hourly:
 *   1. page_lost_top10      — page pos ≤10 last 7d vs 14-7d, now >10
 *   2. page_entered_top10   — opposite (informational)
 *   3. cwv_regressed        — metric passed from "good" to "needs_improvement" week-over-week
 *   4. sitemap_stale        — oldest lastmod >7d
 *   5. revenue_organic_drop — organic revenue 7d < 60% of previous 7d
 *   6. query_impressions_drop — query top 20 loses >40% impressions WoW
 *
 * Each rule is idempotent: emits a new alert row ONLY if not already emitted
 * for the same (type, meta_key) combination in the last 24h.
 */

import { Pool } from "pg"
import { randomUUID } from "crypto"
import { sendEmail } from "./email-service"
import { classifyLcp, classifyInp, classifyCls, CwvStatus } from "./seo-cwv-sync"

export type AlertSeverity = "critical" | "high" | "medium" | "low"

const ADMIN_EMAIL = process.env.CONTACT_EMAIL || "hola@enrola.shop"

async function emitAlert(params: {
  pool: Pool
  type: string
  severity: AlertSeverity
  title: string
  message: string
  meta: Record<string, any>
  /** Stable dedupe key — prevents re-firing within 24h */
  dedupeKey: string
  sendMail?: boolean
}): Promise<boolean> {
  const { pool, type, severity, title, message, meta, dedupeKey, sendMail = true } = params

  const existing = await pool.query(
    `SELECT id FROM seo_alert
     WHERE type = $1 AND meta->>'dedupe_key' = $2
       AND created_at > NOW() - INTERVAL '24 hours'
       AND deleted_at IS NULL
     LIMIT 1`,
    [type, dedupeKey]
  )
  if (existing.rows.length > 0) return false

  await pool.query(
    `INSERT INTO seo_alert (id, type, severity, title, message, meta)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
    [randomUUID(), type, severity, title, message, JSON.stringify({ ...meta, dedupe_key: dedupeKey })]
  )

  if (sendMail && (severity === "critical" || severity === "high")) {
    try {
      await sendEmail({
        to: ADMIN_EMAIL,
        subject: `[SEO ${severity.toUpperCase()}] ${title}`,
        html: `<h2>${title}</h2><p>${message}</p><pre style="background:#f5f5f5;padding:10px;border-radius:4px">${JSON.stringify(meta, null, 2)}</pre><p><a href="https://enrola.shop/dashboard/seo">Ver en el dashboard</a></p>`,
      } as any)
    } catch (err) {
      console.error("[alerts] email send failed:", err)
    }
  }
  return true
}

// ── Rule 1 & 2: top-10 transitions ───────────────────────────────────────────
async function ruleTop10Transitions(pool: Pool): Promise<number> {
  let count = 0
  // Lost
  const lost = await pool.query(`
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
    SELECT p.page, p.pos AS pos_prev, p.clicks AS clicks_prev,
           r.pos AS pos_now, r.clicks AS clicks_now
    FROM prior p LEFT JOIN recent r ON r.page = p.page
    WHERE p.pos <= 10 AND (r.pos IS NULL OR r.pos > 10)
  `)
  for (const row of lost.rows) {
    const did = await emitAlert({
      pool,
      type: "page_lost_top10",
      severity: "high",
      title: `Página cayó del top 10: ${String(row.page).slice(0, 80)}`,
      message: `La URL ${row.page} tenía posición ${Number(row.pos_prev).toFixed(1)} la semana pasada y ahora está en ${row.pos_now != null ? Number(row.pos_now).toFixed(1) : "fuera del top 20"}. Clics cayeron de ${row.clicks_prev} a ${row.clicks_now || 0}.`,
      meta: { page: row.page, pos_prev: row.pos_prev, pos_now: row.pos_now, clicks_prev: row.clicks_prev, clicks_now: row.clicks_now || 0 },
      dedupeKey: `lost:${row.page}`,
    })
    if (did) count++
  }

  // Entered (informational only)
  const entered = await pool.query(`
    WITH recent AS (
      SELECT page,
        SUM(impressions)::bigint AS impressions,
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
    )
    SELECT r.page, r.pos AS pos_now, p.pos AS pos_prev
    FROM recent r LEFT JOIN prior p ON p.page = r.page
    WHERE r.pos <= 10 AND (p.pos IS NULL OR p.pos > 10)
  `)
  for (const row of entered.rows) {
    const did = await emitAlert({
      pool,
      type: "page_entered_top10",
      severity: "medium",
      title: `Página entró al top 10: ${String(row.page).slice(0, 80)}`,
      message: `${row.page} ahora rankea en pos ${Number(row.pos_now).toFixed(1)}. Momento clave — internal linking acelera crecimiento.`,
      meta: { page: row.page, pos_now: row.pos_now, pos_prev: row.pos_prev },
      dedupeKey: `entered:${row.page}`,
      sendMail: false,
    })
    if (did) count++
  }
  return count
}

// ── Rule 3: CWV regressed ─────────────────────────────────────────────────────
async function ruleCwvRegressed(pool: Pool): Promise<number> {
  let count = 0
  const rows = await pool.query(`
    SELECT DISTINCT ON (url, device) url, device, date, lcp_p75, inp_p75, cls_p75
    FROM seo_cwv_snapshot
    WHERE deleted_at IS NULL
    ORDER BY url, device, date DESC
  `)
  // For each URL/device, compare latest to the snapshot closest to 14d ago
  for (const row of rows.rows) {
    const prior = await pool.query(
      `SELECT lcp_p75, inp_p75, cls_p75 FROM seo_cwv_snapshot
       WHERE url = $1 AND device = $2 AND deleted_at IS NULL
         AND date <= NOW() - INTERVAL '7 days'
       ORDER BY date DESC LIMIT 1`,
      [row.url, row.device]
    )
    if (prior.rows.length === 0) continue
    const p = prior.rows[0]
    const metrics: Array<["LCP" | "INP" | "CLS", number | null, number | null, CwvStatus, CwvStatus]> = [
      ["LCP", Number(p.lcp_p75 ?? null), Number(row.lcp_p75 ?? null), classifyLcp(Number(p.lcp_p75)), classifyLcp(Number(row.lcp_p75))],
      ["INP", Number(p.inp_p75 ?? null), Number(row.inp_p75 ?? null), classifyInp(Number(p.inp_p75)), classifyInp(Number(row.inp_p75))],
      ["CLS", Number(p.cls_p75 ?? null), Number(row.cls_p75 ?? null), classifyCls(Number(p.cls_p75)), classifyCls(Number(row.cls_p75))],
    ]
    for (const [name, prevVal, currVal, prevBand, currBand] of metrics) {
      if (prevBand === "good" && (currBand === "needs_improvement" || currBand === "poor")) {
        const did = await emitAlert({
          pool,
          type: "cwv_regressed",
          severity: "high",
          title: `${name} degradado en ${row.url} (${row.device})`,
          message: `${name} pasó de "${prevBand}" (${prevVal}) a "${currBand}" (${currVal}) en los últimos 7-14d.`,
          meta: { url: row.url, device: row.device, metric: name, prev_band: prevBand, curr_band: currBand, prev_value: prevVal, curr_value: currVal },
          dedupeKey: `cwv:${row.url}:${row.device}:${name}`,
        })
        if (did) count++
      }
    }
  }
  return count
}

// ── Rule 4: sitemap stale ────────────────────────────────────────────────────
async function ruleSitemapStale(pool: Pool): Promise<number> {
  const latest = await pool.query(`
    SELECT sitemap_url, oldest_lastmod, urls_total
    FROM seo_sitemap_snapshot
    WHERE deleted_at IS NULL
    ORDER BY date DESC LIMIT 1
  `)
  if (latest.rows.length === 0) return 0
  const row = latest.rows[0]
  if (!row.oldest_lastmod) return 0
  const daysOld = (Date.now() - new Date(row.oldest_lastmod).getTime()) / (1000 * 60 * 60 * 24)
  if (daysOld > 7) {
    const did = await emitAlert({
      pool,
      type: "sitemap_stale",
      severity: "medium",
      title: `Sitemap con lastmod desactualizado`,
      message: `El sitemap tiene URLs con lastmod de hace ${daysOld.toFixed(0)}d. Google puede no re-crawlear.`,
      meta: { sitemap_url: row.sitemap_url, oldest_lastmod: row.oldest_lastmod, urls_total: row.urls_total },
      dedupeKey: `sitemap:${row.sitemap_url}`,
    })
    return did ? 1 : 0
  }
  return 0
}

// ── Rule 5: organic revenue drop ─────────────────────────────────────────────
async function ruleOrganicRevenueDrop(pool: Pool): Promise<number> {
  const curr = await pool.query(`
    SELECT COALESCE(SUM(revenue), 0)::numeric AS rev, COALESCE(SUM(sessions), 0)::bigint AS sess
    FROM seo_ga4_daily
    WHERE date >= CURRENT_DATE - INTERVAL '7 days' AND deleted_at IS NULL
      AND channel = 'Organic Search'
  `)
  const prev = await pool.query(`
    SELECT COALESCE(SUM(revenue), 0)::numeric AS rev, COALESCE(SUM(sessions), 0)::bigint AS sess
    FROM seo_ga4_daily
    WHERE date >= CURRENT_DATE - INTERVAL '14 days' AND date < CURRENT_DATE - INTERVAL '7 days'
      AND deleted_at IS NULL AND channel = 'Organic Search'
  `)
  const currRev = Number(curr.rows[0]?.rev || 0)
  const prevRev = Number(prev.rows[0]?.rev || 0)
  if (prevRev < 50) return 0 // too small, skip
  if (currRev / prevRev < 0.6) {
    const did = await emitAlert({
      pool,
      type: "revenue_organic_drop",
      severity: "high",
      title: `Revenue orgánico cayó ${((1 - currRev / prevRev) * 100).toFixed(0)}%`,
      message: `Revenue de Organic Search esta semana: €${currRev.toFixed(0)}. Semana pasada: €${prevRev.toFixed(0)}. Revisar páginas que perdieron posición y CWV.`,
      meta: { curr_revenue: currRev, prev_revenue: prevRev, curr_sessions: Number(curr.rows[0]?.sess || 0), prev_sessions: Number(prev.rows[0]?.sess || 0) },
      dedupeKey: `rev_drop:${new Date().toISOString().slice(0, 10)}`,
    })
    return did ? 1 : 0
  }
  return 0
}

// ── Rule 6: query impressions drop ───────────────────────────────────────────
async function ruleQueryImpressionsDrop(pool: Pool): Promise<number> {
  const rows = await pool.query(`
    WITH curr AS (
      SELECT query, SUM(impressions)::bigint AS imp,
        CASE WHEN SUM(impressions) > 0 THEN SUM(position * impressions) / SUM(impressions) ELSE NULL END AS pos
      FROM seo_gsc_daily
      WHERE date >= CURRENT_DATE - INTERVAL '7 days' AND deleted_at IS NULL
      GROUP BY query
    ),
    prev AS (
      SELECT query, SUM(impressions)::bigint AS imp
      FROM seo_gsc_daily
      WHERE date >= CURRENT_DATE - INTERVAL '14 days' AND date < CURRENT_DATE - INTERVAL '7 days' AND deleted_at IS NULL
      GROUP BY query
      HAVING SUM(impressions) >= 50
    )
    SELECT c.query, c.imp AS curr_imp, p.imp AS prev_imp, c.pos
    FROM prev p LEFT JOIN curr c ON c.query = p.query
    WHERE (c.imp IS NULL OR c.imp::float / p.imp::float < 0.6)
      AND (c.pos IS NULL OR c.pos <= 20)
  `)
  let count = 0
  for (const row of rows.rows) {
    const drop = row.prev_imp ? (1 - Number(row.curr_imp || 0) / Number(row.prev_imp)) * 100 : 0
    const did = await emitAlert({
      pool,
      type: "query_impressions_drop",
      severity: "high",
      title: `Query perdió ${drop.toFixed(0)}% de impresiones`,
      message: `La query "${row.query}" cayó de ${row.prev_imp} a ${row.curr_imp || 0} impresiones semanales. Posición actual: ${row.pos != null ? Number(row.pos).toFixed(1) : "fuera"}.`,
      meta: { query: row.query, curr_impressions: Number(row.curr_imp || 0), prev_impressions: Number(row.prev_imp), position: row.pos },
      dedupeKey: `query_drop:${row.query}`,
    })
    if (did) count++
  }
  return count
}

export async function computeAllAlerts(pool: Pool): Promise<{ [rule: string]: number }> {
  const results: { [rule: string]: number } = {}
  results.top10_transitions = await ruleTop10Transitions(pool).catch((e) => {
    console.error("[alerts] top10 failed:", e); return 0
  })
  results.cwv_regressed = await ruleCwvRegressed(pool).catch((e) => {
    console.error("[alerts] cwv failed:", e); return 0
  })
  results.sitemap_stale = await ruleSitemapStale(pool).catch((e) => {
    console.error("[alerts] sitemap failed:", e); return 0
  })
  results.revenue_organic_drop = await ruleOrganicRevenueDrop(pool).catch((e) => {
    console.error("[alerts] revenue failed:", e); return 0
  })
  results.query_impressions_drop = await ruleQueryImpressionsDrop(pool).catch((e) => {
    console.error("[alerts] query drop failed:", e); return 0
  })
  const total = Object.values(results).reduce((s, n) => s + n, 0)
  console.log(`[alerts] Fired ${total} alerts:`, results)
  return results
}
