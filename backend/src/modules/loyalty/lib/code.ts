/**
 * Deterministic, human-friendly referral code derivation.
 *
 * - Source of truth is `customer_id` (immutable per account); email could
 *   change but the customer keeps the same code.
 * - Format: `ENR-XXXXXX` — 6 alnum chars, uppercase, easy to read aloud.
 * - Avoids ambiguous chars (0/O, 1/I/L) by using a controlled alphabet so the
 *   code can be transcribed from a screenshot without errors.
 */

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789" // no 0/O, 1/I/L
const LEN = 6

// Stable, simple FNV-1a 32-bit hash. Pure function, no Node deps required.
function fnv1a(input: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0
  }
  return h >>> 0
}

/**
 * Derive a 6-char base from customer_id. We fold the hash into the alphabet
 * deterministically — same id always maps to the same code.
 */
function deriveBase(customerId: string): string {
  let h = fnv1a(customerId)
  // Mix with a second pass over a salted version to spread out collisions
  let h2 = fnv1a(`enrola:${customerId}:salt`)
  let out = ""
  for (let i = 0; i < LEN; i++) {
    // alternate bytes from h and h2 for more entropy than 32 bits would give
    const source = i % 2 === 0 ? h : h2
    out += ALPHABET[source % ALPHABET.length]
    if (i % 2 === 0) h = Math.floor(h / ALPHABET.length)
    else h2 = Math.floor(h2 / ALPHABET.length)
  }
  return out
}

export function deriveReferralCode(customerId: string): string {
  return `ENR-${deriveBase(customerId)}`
}

/**
 * Normalize user-typed codes: strip whitespace, uppercase, ensure ENR- prefix.
 * Returns null if obviously not a code (too short, etc.) so callers can fail
 * fast without hitting the DB.
 */
export function normalizeReferralCode(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== "string") return null
  const cleaned = raw.trim().toUpperCase().replace(/\s+/g, "")
  if (!cleaned) return null
  // Accept both ENR-XXXXXX and bare XXXXXX
  const withPrefix = cleaned.startsWith("ENR-") ? cleaned : `ENR-${cleaned}`
  // Final shape: ENR- + 4..10 alnum (be lenient — we check against DB)
  if (!/^ENR-[A-Z0-9]{3,10}$/.test(withPrefix)) return null
  return withPrefix
}
