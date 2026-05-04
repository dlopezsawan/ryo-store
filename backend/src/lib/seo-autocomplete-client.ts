/**
 * Google Autocomplete — free, no auth, no rate limit (reasonable use).
 *
 * Returns search suggestions ordered by Google's popularity signal.
 * Two clients available:
 *   - "firefox": simple array of strings
 *   - "chrome": includes relevance scores
 *
 * Geo/language targeting via hl + gl params.
 */

const URL_BASE = "https://suggestqueries.google.com/complete/search"

export type AutocompleteSuggestion = {
  query: string
  /** Optional relevance score (0-1200 range, Chrome client) */
  relevance?: number
}

export async function getAutocompleteSuggestions(params: {
  query: string
  hl?: string // language, e.g. "es"
  gl?: string // country, e.g. "VE" (ISO-2)
}): Promise<AutocompleteSuggestion[]> {
  const { query, hl = "es", gl = "VE" } = params
  const url = `${URL_BASE}?client=firefox&hl=${hl}&gl=${gl}&q=${encodeURIComponent(query)}`

  try {
    const res = await fetch(url, {
      headers: {
        "accept": "application/json, text/javascript, */*",
        "user-agent": "Mozilla/5.0 (compatible; enrola-seo-bot/1.0)",
      },
    })
    if (!res.ok) {
      console.error("[autocomplete] HTTP", res.status, url)
      return []
    }
    const data = await res.json()
    // Firefox client returns: [queryString, [suggestion1, suggestion2, ...]]
    if (Array.isArray(data) && Array.isArray(data[1])) {
      return (data[1] as string[]).map((q) => ({ query: q }))
    }
    return []
  } catch (err) {
    console.error("[autocomplete] fetch failed:", err)
    return []
  }
}

/**
 * Expand a seed keyword with autocomplete from multiple variations:
 *   - seed alone
 *   - seed + each a-z letter (gives "how to..." style suggestions)
 *   - seed as question prefixes ("como", "donde", "que", "cual")
 *
 * Deduplicated, ordered by first appearance.
 */
export async function expandKeyword(params: {
  seed: string
  hl?: string
  gl?: string
  depth?: "shallow" | "deep"
}): Promise<AutocompleteSuggestion[]> {
  const { seed, hl = "es", gl = "VE", depth = "shallow" } = params
  const queries: string[] = [seed]

  if (depth === "deep") {
    const letters = "abcdefghijklmnopqrstuvwxyz".split("")
    letters.forEach((l) => queries.push(`${seed} ${l}`))
    ;["como", "donde", "que", "cual", "por que", "cuanto"].forEach((q) =>
      queries.push(`${q} ${seed}`)
    )
  }

  const results = await Promise.all(
    queries.map((q) =>
      getAutocompleteSuggestions({ query: q, hl, gl }).catch(() => [])
    )
  )

  const seen = new Set<string>()
  const out: AutocompleteSuggestion[] = []
  for (const group of results) {
    for (const s of group) {
      const k = s.query.toLowerCase().trim()
      if (!seen.has(k) && k !== seed.toLowerCase()) {
        seen.add(k)
        out.push(s)
      }
    }
  }
  return out
}

/**
 * Classify intent of a keyword based on lexical signals (cheap heuristic).
 */
export function classifyIntent(keyword: string): "informational" | "transactional" | "navigational" | "commercial" {
  const kw = keyword.toLowerCase()
  // Transactional signals
  if (/\b(comprar|precio|barato|oferta|tienda|pedir|ordenar|donde comprar|enviar)\b/.test(kw)) return "transactional"
  // Commercial investigation
  if (/\b(mejor|mejores|reseña|review|comparar|vs|opiniones|cual es)\b/.test(kw)) return "commercial"
  // Navigational
  if (/\b(enrola|smokerolla|mercadolibre|paralamata)\b/.test(kw)) return "navigational"
  // Informational
  if (/\b(como|que es|por que|cuando|donde|cuanto|guia|tutorial)\b/.test(kw)) return "informational"
  return "commercial"
}

/**
 * Detect local (Venezuela) intent signals.
 */
export function hasLocalVeIntent(keyword: string): boolean {
  const kw = keyword.toLowerCase()
  return /\b(venezuela|caracas|maracaibo|valencia|vzla|ccs|bolivares|bolivar|\bbs\b|bcv|binance|pago movil|zelle)\b/.test(kw)
}
