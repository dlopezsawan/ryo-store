/**
 * Exchange rate helper for Venezuela — fetches BCV (EUR/USD) + Binance P2P USDT
 * from alcambio.app, cached in memory for 10 minutes.
 *
 * All rates are quoted as "1 unit of foreign currency = N Bs".
 */

const ALCAMBIO_GQL = "https://api.alcambio.app/graphql"
const CACHE_TTL_MS = 10 * 60 * 1000 // 10 minutes

export type FxRates = {
  eur_to_bs: number   // BCV official EUR rate
  usd_to_bs: number   // BCV official USD rate
  usdt_to_bs: number  // Binance P2P USDT sell average
  source: "alcambio" | "fallback"
  fetched_at: string
}

let cached: { rates: FxRates; expires_at: number } | null = null

async function fetchAlcambioRates(): Promise<FxRates> {
  // 1) BCV rates for VE (EUR + USD)
  const conversionsRes = await fetch(ALCAMBIO_GQL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      operationName: "getCountryConversions",
      variables: { countryCode: "VE" },
      query: `query getCountryConversions($countryCode: String!) {
        getCountryConversions(payload: { countryCode: $countryCode }) {
          conversionRates {
            baseValue
            official
            principal
            rateCurrency { code }
            rateValue
            type
            usesRateValue
          }
        }
      }`,
    }),
  })
  const conversionsJson = await conversionsRes.json() as any
  const rates = conversionsJson?.data?.getCountryConversions?.conversionRates || []

  const eurRate = rates.find(
    (r: any) => r.rateCurrency?.code === "EUR" && r.official === true
  )
  const usdRate = rates.find(
    (r: any) => r.rateCurrency?.code === "USD" && r.official === true && r.type === "SECONDARY"
  ) || rates.find((r: any) => r.rateCurrency?.code === "USD" && r.official === true)

  // 2) Binance P2P USDT average
  const p2pRes = await fetch(ALCAMBIO_GQL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      operationName: "getBinanceP2PAverages",
      query: `query getBinanceP2PAverages {
        getBinanceP2PAverages { sellAverage buyAverage asset }
      }`,
    }),
  })
  const p2pJson = await p2pRes.json() as any
  const p2p = p2pJson?.data?.getBinanceP2PAverages

  const eur_to_bs = Number(eurRate?.baseValue || 0)
  const usd_to_bs = Number(usdRate?.baseValue || 0)
  const usdt_to_bs = Number(p2p?.sellAverage || 0)

  if (!eur_to_bs || !usdt_to_bs) {
    throw new Error(`Alcambio returned invalid rates: EUR=${eur_to_bs}, USDT=${usdt_to_bs}`)
  }

  return {
    eur_to_bs,
    usd_to_bs,
    usdt_to_bs,
    source: "alcambio",
    fetched_at: new Date().toISOString(),
  }
}

/**
 * Returns cached FX rates, refreshing once per CACHE_TTL_MS.
 * Falls back to env var BCV_EUR_RATE if alcambio is unreachable.
 */
export async function getFxRates(): Promise<FxRates> {
  if (cached && cached.expires_at > Date.now()) {
    return cached.rates
  }

  try {
    const rates = await fetchAlcambioRates()
    cached = { rates, expires_at: Date.now() + CACHE_TTL_MS }
    return rates
  } catch (err) {
    console.error("[fx-rates] alcambio fetch failed, using fallback:", (err as Error).message)
    const fallback: FxRates = {
      eur_to_bs: Number(process.env.BCV_EUR_RATE || 0) || 0,
      usd_to_bs: 0,
      usdt_to_bs: 0,
      source: "fallback",
      fetched_at: new Date().toISOString(),
    }
    // Cache fallback briefly so we retry after 1 minute instead of every request
    cached = { rates: fallback, expires_at: Date.now() + 60_000 }
    return fallback
  }
}

/**
 * Convert an amount in EUR to all three display currencies.
 */
export function convertEur(amountEur: number, rates: FxRates) {
  const bs = rates.eur_to_bs > 0 ? amountEur * rates.eur_to_bs : null
  const usdt = bs !== null && rates.usdt_to_bs > 0 ? bs / rates.usdt_to_bs : null
  return { eur: amountEur, bs, usdt }
}
