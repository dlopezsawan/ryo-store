/**
 * Fuzzy comparison between the name the user typed in checkout and the name
 * CNE has on file for that cedula. We don't fail hard on minor differences
 * (typos, missing middle names, accents) but warn loudly on real mismatches.
 *
 * Strategy:
 *   1. Normalize both strings: lowercase, strip accents, collapse whitespace,
 *      remove honorifics ("sra", "lic", "ing", etc.)
 *   2. Tokenize into name parts.
 *   3. Compare token sets — typed-name tokens should be a subset (or near-subset)
 *      of CNE-name tokens.
 *
 * Returns:
 *   "match"        — every typed token has a close match in CNE name
 *   "partial"      — at least 1 typed token matches; some don't
 *   "mismatch"     — almost no overlap → likely wrong cedula or typo'd name
 */

export type NameMatchResult = "match" | "partial" | "mismatch"

const HONORIFICS = new Set([
  "sr", "sra", "srta", "lic", "ing", "dr", "dra", "prof", "tlga",
])

function normalize(s: string): string[] {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t && t.length >= 2 && !HONORIFICS.has(t))
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  const dp: number[] = new Array(b.length + 1)
  for (let j = 0; j <= b.length; j++) dp[j] = j
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0]
    dp[0] = i
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j]
      dp[j] = a[i - 1] === b[j - 1]
        ? prev
        : Math.min(prev, dp[j], dp[j - 1]) + 1
      prev = tmp
    }
  }
  return dp[b.length]
}

function tokenIsClose(typedToken: string, cneTokens: string[]): boolean {
  for (const t of cneTokens) {
    if (t === typedToken) return true
    // Allow tiny typos: 1 edit per 4 chars (e.g. "perez" vs "peres")
    const allow = Math.max(1, Math.floor(typedToken.length / 4))
    if (levenshtein(typedToken, t) <= allow) return true
  }
  return false
}

export function compareNameToCne(typedName: string, cneName: string): NameMatchResult {
  const typed = normalize(typedName)
  const cne = normalize(cneName)
  if (typed.length === 0 || cne.length === 0) return "mismatch"

  let matched = 0
  for (const t of typed) {
    if (tokenIsClose(t, cne)) matched++
  }
  const ratio = matched / typed.length
  if (ratio >= 0.99) return "match"      // every token matches
  if (ratio >= 0.5) return "partial"     // most match — likely missing middle names or one typo
  return "mismatch"
}
