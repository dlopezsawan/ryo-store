/**
 * PostHog server-side capture.
 *
 * Uses the public `/capture/` endpoint with the Project API Key (not the
 * Personal API Key — that one is for queries only).
 *
 * Events are queued internally and flushed async; failures never block the
 * caller.
 */

const API_HOST = process.env.POSTHOG_HOST || "https://us.i.posthog.com"
const PROJECT_KEY = process.env.POSTHOG_PROJECT_API_KEY || ""

type CaptureParams = {
  /** Unique per-user id. Use the Medusa customer.id when available, or the email for anonymous-ish tracking */
  distinctId: string
  event: string
  properties?: Record<string, unknown>
  timestamp?: Date
}

export async function captureServerSide(params: CaptureParams): Promise<boolean> {
  if (!PROJECT_KEY) {
    // Not configured yet — do not warn on every call in loops
    return false
  }
  try {
    const payload = {
      api_key: PROJECT_KEY,
      event: params.event,
      distinct_id: params.distinctId,
      properties: {
        ...(params.properties || {}),
        $lib: "medusa-backend",
        $lib_version: "1.0.0",
      },
      timestamp: (params.timestamp || new Date()).toISOString(),
    }
    const res = await fetch(`${API_HOST}/capture/`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      console.warn(`[posthog-server] capture '${params.event}' failed:`, res.status)
      return false
    }
    return true
  } catch (err) {
    console.warn(`[posthog-server] capture '${params.event}' error:`, (err as Error).message)
    return false
  }
}

export async function identifyServerSide(params: {
  distinctId: string
  userProperties: Record<string, unknown>
}): Promise<boolean> {
  // PostHog $identify event with $set properties merges user attributes
  return captureServerSide({
    distinctId: params.distinctId,
    event: "$identify",
    properties: {
      $set: params.userProperties,
    },
  })
}

// ─── Domain helpers ─────────────────────────────────────────────────────────

export async function trackOrderPlaced(params: {
  distinctId: string
  order: {
    id: string
    display_id?: number
    total: number
    currency_code: string
    item_count: number
    source_channel?: string // 'web' | 'manual' | 'whatsapp' | 'telegram'
    payment_method?: string
    shipping_city?: string
    items?: Array<{ product_id: string; variant_id?: string; quantity: number; unit_price: number }>
  }
}) {
  return captureServerSide({
    distinctId: params.distinctId,
    event: "order_placed",
    properties: {
      order_id: params.order.id,
      display_id: params.order.display_id,
      total: params.order.total,
      currency: params.order.currency_code,
      item_count: params.order.item_count,
      source_channel: params.order.source_channel,
      payment_method: params.order.payment_method,
      shipping_city: params.order.shipping_city,
      products: params.order.items?.map((i) => i.product_id),
      revenue: params.order.total, // PostHog convention
    },
  })
}

export async function trackOrderPaid(params: {
  distinctId: string
  order_id: string
  total: number
  payment_method?: string
  time_to_payment_ms?: number
}) {
  return captureServerSide({
    distinctId: params.distinctId,
    event: "order_paid",
    properties: { ...params },
  })
}

export async function trackOrderShipped(params: {
  distinctId: string
  order_id: string
  shipping_method?: string
  tracking_number?: string
}) {
  return captureServerSide({
    distinctId: params.distinctId,
    event: "order_shipped",
    properties: { ...params },
  })
}

export async function trackLoyaltyPointsEarned(params: {
  distinctId: string
  points: number
  order_id?: string
  total_points_after?: number
}) {
  return captureServerSide({
    distinctId: params.distinctId,
    event: "loyalty_points_earned",
    properties: { ...params },
  })
}

export function isPosthogConfigured(): boolean {
  return !!PROJECT_KEY
}
