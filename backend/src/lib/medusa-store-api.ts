/**
 * Medusa Store API Client — used by WhatsApp bot to create orders programmatically.
 * Mirrors the storefront checkout flow: cart → items → address → shipping → payment → complete.
 */

import { Pool } from "pg"

const MEDUSA_URL = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || process.env.MEDUSA_BACKEND_URL || "https://api.enrola.shop"
const PUB_KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || "pk_a277839f4a63af29bdaee190774723048476d993a048fdd5544761cafe50ca37"
const pool = new Pool({ connectionString: process.env.DATABASE_URL })

function headers(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "x-publishable-api-key": PUB_KEY,
  }
}

async function storeApi(path: string, opts: RequestInit = {}): Promise<Response> {
  const url = `${MEDUSA_URL}${path}`
  const res = await fetch(url, { ...opts, headers: { ...headers(), ...(opts.headers || {}) } })
  if (!res.ok) {
    const body = await res.text().catch(() => "")
    console.error(`[medusa-api] ${opts.method || "GET"} ${path} → ${res.status}: ${body.substring(0, 300)}`)
    throw new Error(`Medusa API ${res.status}: ${body.substring(0, 200)}`)
  }
  return res
}

// ─── Region ─────────────────────────────────────────────────────────────────

export async function getDefaultRegionId(): Promise<string> {
  // Direct DB query is more reliable than API (avoids publishable key intermittency)
  const r = await pool.query("SELECT id FROM region WHERE deleted_at IS NULL LIMIT 1")
  if (r.rows[0]) return r.rows[0].id
  // Fallback to API
  const res = await storeApi("/store/regions?limit=1&fields=id")
  const data = await res.json()
  return data.regions?.[0]?.id || "reg_01KKKY6BGV511PKKHK3WRK3VN8"
}

// ─── Cart ───────────────────────────────────────────────────────────────────

export async function createCart(regionId: string): Promise<{ id: string }> {
  const res = await storeApi("/store/carts", {
    method: "POST",
    body: JSON.stringify({ region_id: regionId }),
  })
  const data = await res.json()
  console.log("[medusa-api] Cart created:", data.cart?.id)
  return { id: data.cart?.id }
}

export async function addLineItem(cartId: string, variantId: string, quantity: number) {
  const res = await storeApi(`/store/carts/${cartId}/line-items`, {
    method: "POST",
    body: JSON.stringify({ variant_id: variantId, quantity }),
  })
  const data = await res.json()
  console.log(`[medusa-api] Added ${quantity}x ${variantId} to cart ${cartId}`)
  return data.cart
}

export async function removeLineItem(cartId: string, lineItemId: string) {
  const res = await storeApi(`/store/carts/${cartId}/line-items/${lineItemId}`, {
    method: "DELETE",
  })
  return res.json()
}

export async function updateCart(cartId: string, data: {
  email?: string
  shipping_address?: {
    first_name: string
    last_name: string
    address_1: string
    city: string
    province: string
    postal_code: string
    country_code: string
    phone: string
  }
  billing_address?: typeof data.shipping_address
  metadata?: Record<string, string>
}) {
  const res = await storeApi(`/store/carts/${cartId}`, {
    method: "POST",
    body: JSON.stringify(data),
  })
  const result = await res.json()
  console.log(`[medusa-api] Cart ${cartId} updated (email: ${data.email || "-"})`)
  return result.cart
}

export async function getCart(cartId: string) {
  const fields = "id,region_id,email,currency_code,total,subtotal,shipping_total,discount_total,metadata,items.*,items.variant.*,items.variant.product.*"
  const res = await storeApi(`/store/carts/${cartId}?fields=${fields}`)
  const data = await res.json()
  return data.cart
}

// ─── Shipping ───────────────────────────────────────────────────────────────

export async function getShippingOptions(cartId: string) {
  const res = await storeApi(`/store/shipping-options?cart_id=${cartId}`)
  const data = await res.json()
  return data.shipping_options || []
}

export async function setShippingMethod(cartId: string, optionId: string) {
  const res = await storeApi(`/store/carts/${cartId}/shipping-methods`, {
    method: "POST",
    body: JSON.stringify({ option_id: optionId }),
  })
  console.log(`[medusa-api] Shipping set on cart ${cartId}: ${optionId}`)
  return res.json()
}

export async function getDefaultShippingOptionId(cartId: string): Promise<string> {
  const options = await getShippingOptions(cartId)
  if (!options.length) throw new Error("No shipping options available")
  return options[0].id
}

// ─── Payment ────────────────────────────────────────────────────────────────

export async function createPaymentCollection(cartId: string): Promise<string> {
  const res = await storeApi("/store/payment-collections", {
    method: "POST",
    body: JSON.stringify({ cart_id: cartId }),
  })
  const data = await res.json()
  const id = data.payment_collection?.id
  console.log(`[medusa-api] Payment collection created: ${id}`)
  return id
}

export async function getPaymentProviders(regionId: string): Promise<string[]> {
  const res = await storeApi(`/store/payment-providers?region_id=${regionId}`)
  const data = await res.json()
  return (data.payment_providers || []).map((p: { id: string }) => p.id)
}

export async function createPaymentSession(collectionId: string, providerId: string) {
  const res = await storeApi(`/store/payment-collections/${collectionId}/payment-sessions`, {
    method: "POST",
    body: JSON.stringify({ provider_id: providerId }),
  })
  console.log(`[medusa-api] Payment session created for collection ${collectionId}`)
  return res.json()
}

export async function getDefaultPaymentProviderId(regionId: string): Promise<string> {
  const providers = await getPaymentProviders(regionId)
  if (!providers.length) throw new Error("No payment providers available")
  // Prefer manual payment if available
  return providers.find((p) => p.includes("manual")) || providers[0]
}

// ─── Complete ───────────────────────────────────────────────────────────────

export async function completeCart(cartId: string): Promise<{ order_id: string; display_id: number }> {
  const res = await storeApi(`/store/carts/${cartId}/complete`, {
    method: "POST",
    body: "{}",
  })
  const data = await res.json()
  console.log(`[medusa-api] Cart ${cartId} completed → order ${data.order?.display_id || data.order?.id}`)
  return {
    order_id: data.order?.id || "",
    display_id: data.order?.display_id || 0,
  }
}

// ─── BCV Rate ───────────────────────────────────────────────────────────────

// Cache BCV rate for 10 minutes to avoid inconsistencies mid-order
let bcvCache: { rate: number; ts: number } | null = null
const BCV_CACHE_TTL = 600_000 // 10 minutes

export async function fetchBcvRate(): Promise<number> {
  if (bcvCache && Date.now() - bcvCache.ts < BCV_CACHE_TTL) return bcvCache.rate

  const sources = [
    // Source 1: pydolarve — try EUR direct first
    async () => {
      const r = await fetch("https://pydolarve.org/api/v2/dollar?page=bcv", { signal: AbortSignal.timeout(5000) })
      const d = await r.json() as { monitors?: { eur?: { price?: number }, usd?: { price?: number } } }
      const eurVes = d?.monitors?.eur?.price
      if (eurVes && eurVes > 0) return eurVes
      const usdVes = d?.monitors?.usd?.price
      if (!usdVes) throw new Error("no price")
      return usdVes * 1.15 // EUR/USD ≈ 1.15
    },
    // Source 2: dolarapi USD * 1.15
    async () => {
      const r = await fetch("https://ve.dolarapi.com/v1/dolares/oficial", { signal: AbortSignal.timeout(5000) })
      const d = await r.json() as { promedio?: number }
      if (!d?.promedio) throw new Error("no price")
      return d.promedio * 1.15 // EUR/USD ≈ 1.15
    },
  ]

  for (const src of sources) {
    try {
      const rate = await src()
      if (rate > 0) {
        bcvCache = { rate, ts: Date.now() }
        return rate
      }
    } catch { /* try next */ }
  }

  return bcvCache?.rate || 40.0
}

// ─── Promotions ─────────────────────────────────────────────────────────────

export async function applyPromoCode(cartId: string, code: string) {
  const res = await storeApi(`/store/carts/${cartId}/promotions`, {
    method: "POST",
    body: JSON.stringify({ promo_codes: [code] }),
  })
  return res.json()
}
