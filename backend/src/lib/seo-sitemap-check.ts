/**
 * Sitemap freshness check.
 * Fetches sitemap.xml, counts <url>, checks <lastmod> coverage + oldest date.
 */

import { Pool } from "pg"
import { randomUUID } from "crypto"
import { createHash } from "crypto"

export type SitemapSnapshot = {
  sitemap_url: string
  urls_total: number
  urls_with_lastmod: number
  oldest_lastmod: Date | null
  checksum: string
}

async function fetchSitemap(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: { accept: "application/xml, text/xml" } })
    if (!res.ok) {
      console.error(`[sitemap-check] HTTP ${res.status} for ${url}`)
      return null
    }
    return await res.text()
  } catch (err) {
    console.error(`[sitemap-check] fetch failed ${url}:`, err)
    return null
  }
}

function parseSitemap(xml: string): { total: number; withLastmod: number; oldest: Date | null } {
  const urlBlocks = xml.match(/<url>[\s\S]*?<\/url>/g) || []
  const total = urlBlocks.length
  let withLastmod = 0
  let oldest: Date | null = null
  for (const block of urlBlocks) {
    const m = block.match(/<lastmod>([^<]+)<\/lastmod>/)
    if (m) {
      withLastmod++
      const d = new Date(m[1].trim())
      if (!Number.isNaN(d.getTime())) {
        if (!oldest || d < oldest) oldest = d
      }
    }
  }
  return { total, withLastmod, oldest }
}

export async function checkSitemap(params: {
  pool: Pool
  sitemapUrl?: string
}): Promise<SitemapSnapshot | null> {
  const url = params.sitemapUrl || "https://enrola.shop/sitemap.xml"
  const xml = await fetchSitemap(url)
  if (!xml) return null

  const parsed = parseSitemap(xml)
  const checksum = createHash("md5").update(xml).digest("hex")

  const today = new Date().toISOString().slice(0, 10)
  await params.pool.query(
    `DELETE FROM seo_sitemap_snapshot WHERE date = $1 AND sitemap_url = $2`,
    [today, url]
  )
  await params.pool.query(
    `INSERT INTO seo_sitemap_snapshot (id, date, sitemap_url, urls_total, urls_with_lastmod, oldest_lastmod, checksum)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [randomUUID(), today, url, parsed.total, parsed.withLastmod, parsed.oldest, checksum]
  )

  return {
    sitemap_url: url,
    urls_total: parsed.total,
    urls_with_lastmod: parsed.withLastmod,
    oldest_lastmod: parsed.oldest,
    checksum,
  }
}
