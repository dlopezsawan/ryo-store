/**
 * Export SEO data as CSV or JSON.
 *
 * GET /admin/seo/export?table=<name>&format=csv|json&days=90
 *
 * Supported tables:
 *   - keywords        (seo_kw_tracked enriched with last-28d GSC stats)
 *   - competitors     (seo_competitor)
 *   - gsc_daily       (seo_gsc_daily raw)
 *   - gsc_totals      (seo_gsc_totals raw)
 *   - ga4_daily       (seo_ga4_daily raw)
 *   - ga4_pages       (seo_ga4_page_daily raw)
 *   - alerts          (seo_alert)
 *   - suggestions_ve  (computed suggestions from rule engine)
 */
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Pool } from "pg"
import { generateSuggestions } from "../../../../lib/seo-kw-research"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

const TABLE_QUERIES: Record<string, { label: string; run: (days: number) => Promise<any[]> }> = {
  keywords: {
    label: "keywords-tracked",
    run: async (days) => {
      const r = await pool.query(
        `
        SELECT kt.keyword, kt.country, kt.device, kt.source, kt.notes, kt.created_at,
          COALESCE(SUM(gd.impressions), 0)::bigint AS impressions_28d,
          COALESCE(SUM(gd.clicks), 0)::bigint AS clicks_28d,
          CASE WHEN SUM(gd.impressions) > 0
            THEN SUM(gd.position * gd.impressions) / SUM(gd.impressions)
            ELSE NULL END AS avg_position_28d
        FROM seo_kw_tracked kt
        LEFT JOIN seo_gsc_daily gd
          ON gd.query = kt.keyword
          AND gd.date >= CURRENT_DATE - ($1::int || ' days')::interval
          AND gd.deleted_at IS NULL
        WHERE kt.active = true AND kt.deleted_at IS NULL
        GROUP BY kt.id, kt.keyword, kt.country, kt.device, kt.source, kt.notes, kt.created_at
        ORDER BY impressions_28d DESC
        `,
        [days]
      )
      return r.rows
    },
  },
  competitors: {
    label: "competitors",
    run: async () => {
      const r = await pool.query(
        `SELECT name, domain, instagram, threat, notes, active, created_at
         FROM seo_competitor WHERE deleted_at IS NULL ORDER BY
         CASE threat WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'watch' THEN 3 ELSE 4 END, name`
      )
      return r.rows
    },
  },
  gsc_daily: {
    label: "gsc-daily",
    run: async (days) => {
      const r = await pool.query(
        `SELECT date::date, query, page, country, device, impressions, clicks, ctr, position
         FROM seo_gsc_daily
         WHERE date >= CURRENT_DATE - ($1::int || ' days')::interval AND deleted_at IS NULL
         ORDER BY date DESC, impressions DESC`,
        [days]
      )
      return r.rows
    },
  },
  gsc_totals: {
    label: "gsc-totals",
    run: async (days) => {
      const r = await pool.query(
        `SELECT date::date, country, device, impressions, clicks, ctr, position
         FROM seo_gsc_totals
         WHERE date >= CURRENT_DATE - ($1::int || ' days')::interval AND deleted_at IS NULL
         ORDER BY date DESC`,
        [days]
      )
      return r.rows
    },
  },
  ga4_daily: {
    label: "ga4-daily",
    run: async (days) => {
      const r = await pool.query(
        `SELECT date::date, channel, source, medium, country, sessions, engaged_sessions, users, new_users, transactions, revenue
         FROM seo_ga4_daily
         WHERE date >= CURRENT_DATE - ($1::int || ' days')::interval AND deleted_at IS NULL
         ORDER BY date DESC, sessions DESC`,
        [days]
      )
      return r.rows
    },
  },
  ga4_pages: {
    label: "ga4-pages",
    run: async (days) => {
      const r = await pool.query(
        `SELECT date::date, page, source, medium, sessions, conversions, revenue
         FROM seo_ga4_page_daily
         WHERE date >= CURRENT_DATE - ($1::int || ' days')::interval AND deleted_at IS NULL
         ORDER BY date DESC, sessions DESC`,
        [days]
      )
      return r.rows
    },
  },
  alerts: {
    label: "alerts",
    run: async (days) => {
      const r = await pool.query(
        `SELECT type, severity, title, message, meta, created_at, acked_at, acked_by
         FROM seo_alert
         WHERE created_at >= CURRENT_DATE - ($1::int || ' days')::interval
           AND deleted_at IS NULL
         ORDER BY created_at DESC`,
        [days]
      )
      return r.rows
    },
  },
  suggestions_ve: {
    label: "suggestions-ve",
    run: async () => {
      const items = await generateSuggestions(pool)
      return items
    },
  },
}

function toCsv(rows: any[]): string {
  if (rows.length === 0) return ""
  const keys = Object.keys(rows[0])
  const header = keys.join(",")
  const lines = rows.map((r) =>
    keys
      .map((k) => {
        const v = r[k]
        if (v == null) return ""
        if (typeof v === "object") return `"${JSON.stringify(v).replace(/"/g, '""')}"`
        const s = String(v)
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
      })
      .join(",")
  )
  return [header, ...lines].join("\n")
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const table = String(req.query.table || "").toLowerCase()
  const format = String(req.query.format || "csv").toLowerCase()
  const days = Math.max(1, Math.min(365, parseInt(String(req.query.days || "90"), 10)))

  const entry = TABLE_QUERIES[table]
  if (!entry) {
    res.status(400).json({
      error: `Unknown table '${table}'. Valid: ${Object.keys(TABLE_QUERIES).join(", ")}`,
    })
    return
  }
  if (!["csv", "json"].includes(format)) {
    res.status(400).json({ error: `format must be 'csv' or 'json'` })
    return
  }

  try {
    const rows = await entry.run(days)
    const dateStr = new Date().toISOString().slice(0, 10)
    const filename = `enrola-${entry.label}-${dateStr}.${format}`

    if (format === "csv") {
      res.setHeader("content-type", "text/csv; charset=utf-8")
      res.setHeader("content-disposition", `attachment; filename="${filename}"`)
      res.send(toCsv(rows))
    } else {
      res.setHeader("content-type", "application/json; charset=utf-8")
      res.setHeader("content-disposition", `attachment; filename="${filename}"`)
      res.send(JSON.stringify({ exported_at: new Date().toISOString(), table, rows }, null, 2))
    }
  } catch (err: any) {
    console.error("[seo/export]", err)
    res.status(500).json({ error: err?.message || "export failed" })
  }
}
