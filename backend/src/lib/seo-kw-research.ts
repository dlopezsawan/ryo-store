/**
 * Keyword research orchestrator.
 *
 * For a given seed keyword, returns:
 *   - Expanded suggestions (Google Autocomplete)
 *   - Whether we already rank for it (from seo_gsc_daily)
 *   - Our avg position & impressions last 28d
 *   - Intent classification
 *   - Local-VE flag
 *
 * Results cached 30 days in seo_kw_research_cache.
 */

import { Pool } from "pg"
import { randomUUID } from "crypto"
import { expandKeyword, classifyIntent, hasLocalVeIntent, AutocompleteSuggestion } from "./seo-autocomplete-client"

export type ResearchResult = {
  keyword: string
  intent: string
  local_ve: boolean
  already_ranking: {
    yes: boolean
    impressions_28d: number
    clicks_28d: number
    avg_position: number | null
    best_url: string | null
  }
  related: AutocompleteSuggestion[]
  cached_at: string | null
}

const CACHE_TTL_DAYS = 30

export async function researchKeyword(params: {
  pool: Pool
  keyword: string
  country?: string // ISO-2 for autocomplete (e.g. "VE")
  forceFresh?: boolean
}): Promise<ResearchResult> {
  const { pool, keyword, country = "VE", forceFresh = false } = params
  const normalized = keyword.toLowerCase().trim()

  // ── 1. Check cache ───────────────────────────────────────────────────────
  if (!forceFresh) {
    const cached = await pool.query(
      `SELECT * FROM seo_kw_research_cache
       WHERE keyword = $1 AND country = $2 AND deleted_at IS NULL
         AND checked_at > NOW() - INTERVAL '${CACHE_TTL_DAYS} days'
       LIMIT 1`,
      [normalized, country.toLowerCase()]
    )
    if (cached.rows[0]) {
      const row = cached.rows[0]
      const related = (row.related as AutocompleteSuggestion[]) || []
      const gscStats = await queryGscStats(pool, normalized)
      return {
        keyword: normalized,
        intent: row.intent || classifyIntent(normalized),
        local_ve: hasLocalVeIntent(normalized),
        already_ranking: gscStats,
        related,
        cached_at: row.checked_at,
      }
    }
  }

  // ── 2. Fresh fetch ───────────────────────────────────────────────────────
  const related = await expandKeyword({ seed: normalized, gl: country, depth: "shallow" })
  const intent = classifyIntent(normalized)
  const gscStats = await queryGscStats(pool, normalized)

  // ── 3. Store in cache ────────────────────────────────────────────────────
  await pool.query(
    `INSERT INTO seo_kw_research_cache (id, keyword, country, intent, related, checked_at, ttl_days)
     VALUES ($1, $2, $3, $4, $5::jsonb, NOW(), $6)
     ON CONFLICT (keyword, country) WHERE deleted_at IS NULL
     DO UPDATE SET intent = EXCLUDED.intent, related = EXCLUDED.related, checked_at = NOW(), updated_at = NOW()`,
    [randomUUID(), normalized, country.toLowerCase(), intent, JSON.stringify(related), CACHE_TTL_DAYS]
  )

  return {
    keyword: normalized,
    intent,
    local_ve: hasLocalVeIntent(normalized),
    already_ranking: gscStats,
    related,
    cached_at: new Date().toISOString(),
  }
}

/**
 * Aggregate GSC data for a specific keyword across last 28d.
 */
async function queryGscStats(pool: Pool, keyword: string) {
  const result = await pool.query(
    `
    SELECT
      COALESCE(SUM(impressions), 0)::bigint AS impressions,
      COALESCE(SUM(clicks), 0)::bigint AS clicks,
      CASE WHEN SUM(impressions) > 0
        THEN SUM(position * impressions) / SUM(impressions)
        ELSE NULL
      END AS avg_position,
      (SELECT page FROM seo_gsc_daily
        WHERE query = $1 AND date >= CURRENT_DATE - INTERVAL '28 days'
          AND deleted_at IS NULL
        GROUP BY page ORDER BY SUM(clicks) DESC LIMIT 1) AS best_url
    FROM seo_gsc_daily
    WHERE query = $1
      AND date >= CURRENT_DATE - INTERVAL '28 days'
      AND deleted_at IS NULL
    `,
    [keyword]
  )
  const row = result.rows[0] || {}
  const impressions = Number(row.impressions || 0)
  return {
    yes: impressions > 0,
    impressions_28d: impressions,
    clicks_28d: Number(row.clicks || 0),
    avg_position: row.avg_position != null ? Number(row.avg_position) : null,
    best_url: row.best_url || null,
  }
}

// ─── Suggestions engine ────────────────────────────────────────────────────

export type SuggestionItem = {
  keyword: string
  reason: string
  category: "striking_distance" | "local_intent" | "brand_gap" | "rising_query" | "already_tracked"
  priority: "high" | "medium" | "low"
  impressions_28d?: number
  position?: number | null
  action: string
}

/**
 * Compute actionable suggestions for the Venezuela market from available signals:
 *   - Striking distance: GSC queries in pos 11-20 with impressions
 *   - Local intent queries rankeadas not yet tracked
 *   - Brand gaps: hard-coded missing premium brands (Elements, Juicy Jay, Purize, Santa Cruz)
 *   - Already-tracked keywords with insights
 */
export async function generateSuggestions(pool: Pool): Promise<SuggestionItem[]> {
  const suggestions: SuggestionItem[] = []

  // 1. Striking distance (pos 11-20 with significant impressions)
  const striking = await pool.query(`
    SELECT query,
      SUM(impressions)::bigint AS impressions,
      CASE WHEN SUM(impressions) > 0
        THEN SUM(position * impressions) / SUM(impressions)
        ELSE NULL
      END AS avg_position
    FROM seo_gsc_daily
    WHERE date >= CURRENT_DATE - INTERVAL '28 days'
      AND deleted_at IS NULL
    GROUP BY query
    HAVING SUM(impressions) >= 10
    ORDER BY avg_position ASC
    LIMIT 30
  `)
  striking.rows
    .filter((r: any) => {
      const pos = Number(r.avg_position || 0)
      return pos >= 11 && pos <= 20
    })
    .forEach((r: any) => {
      suggestions.push({
        keyword: r.query,
        reason: `Rankeando pos ${Number(r.avg_position).toFixed(1)} con ${r.impressions} impresiones — empujón a top 10 puede duplicar clics.`,
        category: "striking_distance",
        priority: Number(r.impressions) >= 50 ? "high" : "medium",
        impressions_28d: Number(r.impressions),
        position: Number(r.avg_position),
        action: "Añadir internal linking desde páginas de autoridad. Actualizar meta title/description para aumentar CTR.",
      })
    })

  // 2. Local-intent queries ranking
  const local = await pool.query(`
    SELECT query,
      SUM(impressions)::bigint AS impressions,
      CASE WHEN SUM(impressions) > 0
        THEN SUM(position * impressions) / SUM(impressions)
        ELSE NULL
      END AS avg_position
    FROM seo_gsc_daily
    WHERE date >= CURRENT_DATE - INTERVAL '28 days'
      AND deleted_at IS NULL
      AND (
        query ILIKE '%venezuela%' OR query ILIKE '%caracas%' OR
        query ILIKE '%maracaibo%' OR query ILIKE '%vzla%' OR
        query ILIKE '%bolivares%' OR query ILIKE '%bcv%'
      )
    GROUP BY query
    ORDER BY SUM(impressions) DESC
    LIMIT 10
  `)
  local.rows.forEach((r: any) => {
    const pos = Number(r.avg_position || 0)
    suggestions.push({
      keyword: r.query,
      reason: `Query con intent local VE — el tipo de tráfico que más convierte. Posición actual: ${pos.toFixed(1)}.`,
      category: "local_intent",
      priority: "high",
      impressions_28d: Number(r.impressions),
      position: pos,
      action: pos > 10
        ? "Crear landing dedicada con schema LocalBusiness + mención Caracas/Venezuela."
        : "Ya rankea bien. Reforzar con reseñas y contenido local.",
    })
  })

  // 3. Hard-coded brand gaps from competitive analysis 2026-04-21
  const brandGaps = [
    { keyword: "elements rolling papers venezuela", brand: "Elements", why: "Top global en arroz, invisible en MLV. Ventaja de primer mover." },
    { keyword: "juicy jay papers venezuela", brand: "Juicy Jay's", why: "Demanda alta de sabores, oferta en VE = solo Hornet." },
    { keyword: "purize filtros carbon venezuela", brand: "Purize", why: "Filtro activated carbon — cero competencia en VE." },
    { keyword: "santa cruz shredder venezuela", brand: "Santa Cruz Shredder", why: "Grinder premium sin alternativa local." },
    { keyword: "kannastor grinder venezuela", brand: "Kannastör", why: "Nicho premium sin cobertura en el mercado." },
  ]
  brandGaps.forEach((g) => {
    suggestions.push({
      keyword: g.keyword,
      reason: `Gap de catálogo detectado: ${g.why}`,
      category: "brand_gap",
      priority: "medium",
      action: `Crear PDP para ${g.brand} + blog post "alternativa a [competidor] para ${g.brand} en Venezuela" + fotos de producto.`,
    })
  })

  return suggestions
}
