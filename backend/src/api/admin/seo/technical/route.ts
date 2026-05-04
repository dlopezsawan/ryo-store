/**
 * Technical health — CWV + sitemap + alerts summary.
 */
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Pool } from "pg"
import { classifyLcp, classifyInp, classifyCls } from "../../../../lib/seo-cwv-sync"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

export async function GET(_req: MedusaRequest, res: MedusaResponse) {
  // ── Latest CWV snapshots per (url, device) ──────────────────────────────
  const cwv = await pool.query(`
    SELECT DISTINCT ON (url, device)
      url, device, date, lcp_p75, inp_p75, cls_p75, ttfb_p75
    FROM seo_cwv_snapshot
    WHERE deleted_at IS NULL
    ORDER BY url, device, date DESC
  `)

  // ── Aggregate CWV status ────────────────────────────────────────────────
  const byDevice: Record<string, { good: number; ni: number; poor: number; nodata: number; total: number }> = {
    PHONE: { good: 0, ni: 0, poor: 0, nodata: 0, total: 0 },
    DESKTOP: { good: 0, ni: 0, poor: 0, nodata: 0, total: 0 },
  }
  const cwvRows = cwv.rows.map((r: any) => {
    const lcp = r.lcp_p75 != null ? Number(r.lcp_p75) : null
    const inp = r.inp_p75 != null ? Number(r.inp_p75) : null
    const cls = r.cls_p75 != null ? Number(r.cls_p75) : null
    const ttfb = r.ttfb_p75 != null ? Number(r.ttfb_p75) : null
    const lcpStatus = classifyLcp(lcp)
    const inpStatus = classifyInp(inp)
    const clsStatus = classifyCls(cls)
    const bucket = byDevice[r.device] || byDevice.PHONE
    bucket.total++
    const worst = [lcpStatus, inpStatus, clsStatus].reduce((w, s) =>
      s === "poor" ? "poor" : s === "needs_improvement" && w !== "poor" ? "needs_improvement" : s === "no_data" && w === "good" ? "no_data" : w
    , "good" as any)
    if (worst === "good") bucket.good++
    else if (worst === "needs_improvement") bucket.ni++
    else if (worst === "poor") bucket.poor++
    else bucket.nodata++
    return {
      url: r.url,
      device: r.device,
      date: r.date,
      lcp: lcp,
      inp: inp,
      cls: cls,
      ttfb: ttfb,
      lcp_status: lcpStatus,
      inp_status: inpStatus,
      cls_status: clsStatus,
    }
  })

  // ── Latest sitemap snapshot ─────────────────────────────────────────────
  const sitemap = await pool.query(`
    SELECT sitemap_url, urls_total, urls_with_lastmod, oldest_lastmod, date AS checked_at
    FROM seo_sitemap_snapshot
    WHERE deleted_at IS NULL
    ORDER BY date DESC LIMIT 1
  `)

  // ── Alerts summary (unacked) ────────────────────────────────────────────
  const alertsSummary = await pool.query(`
    SELECT severity, COUNT(*)::bigint AS n
    FROM seo_alert
    WHERE acked_at IS NULL AND deleted_at IS NULL
    GROUP BY severity
  `)
  const alertCounts: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 }
  alertsSummary.rows.forEach((r: any) => {
    alertCounts[r.severity] = Number(r.n)
  })

  res.json({
    cwv: {
      by_device: byDevice,
      rows: cwvRows,
      has_data: cwvRows.length > 0,
    },
    sitemap: sitemap.rows[0] || null,
    alerts_unacked: alertCounts,
  })
}
