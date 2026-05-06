/**
 * PostHog client-side wrapper.
 *
 * Safe to import anywhere; every call no-ops if PostHog hasn't loaded yet
 * (e.g. during SSR, with ad-blockers, before the snippet finishes init).
 *
 * Event naming: `<domain>_<action>` in snake_case.
 *   product_viewed, add_to_cart, checkout_started, payment_method_selected, ...
 *
 * Properties: snake_case, include whatever context helps segmentation.
 */

type PostHogGlobal = {
  capture: (event: string, props?: Record<string, unknown>) => void
  identify: (distinctId: string, userProperties?: Record<string, unknown>) => void
  reset: () => void
  register: (props: Record<string, unknown>) => void
  get_distinct_id: () => string | undefined
  onFeatureFlags?: (cb: (flags: string[]) => void) => void
  isFeatureEnabled?: (key: string) => boolean
  getFeatureFlag?: (key: string) => string | boolean | undefined
}

function ph(): PostHogGlobal | null {
  if (typeof window === "undefined") return null
  const g = (window as unknown as { posthog?: PostHogGlobal }).posthog
  if (!g || typeof g.capture !== "function") return null
  return g
}

export function track(event: string, properties?: Record<string, unknown>): void {
  try {
    ph()?.capture(event, properties)
  } catch {
    /* never break UX on analytics failure */
  }
}

export function identify(
  distinctId: string,
  userProperties?: Record<string, unknown>
): void {
  try {
    ph()?.identify(distinctId, userProperties)
  } catch {
    /* noop */
  }
}

export function registerGlobalProps(props: Record<string, unknown>): void {
  try {
    ph()?.register(props)
  } catch {
    /* noop */
  }
}

export function resetPosthog(): void {
  try {
    ph()?.reset()
  } catch {
    /* noop */
  }
}

export function isFeatureEnabled(key: string, fallback = false): boolean {
  try {
    const p = ph()
    if (!p || typeof p.isFeatureEnabled !== "function") return fallback
    return !!p.isFeatureEnabled(key)
  } catch {
    return fallback
  }
}

export function getFeatureFlag(key: string): string | boolean | undefined {
  try {
    const p = ph()
    return p?.getFeatureFlag?.(key)
  } catch {
    return undefined
  }
}

// ─── Domain helpers (typed payloads per event) ──────────────────────────────

export type ProductContext = {
  product_id: string
  variant_id?: string
  title: string
  price?: number
  category?: string
}

export function trackProductViewed(p: ProductContext) {
  track("product_viewed", { ...p })
}

export function trackAddToCart(p: ProductContext & { quantity: number; cart_size_after?: number }) {
  track("add_to_cart", { ...p })
}

export function trackCartViewed(p: { item_count: number; subtotal: number; source?: "drawer" | "page" }) {
  track("cart_viewed", { ...p })
}

export function trackCheckoutStarted(p: { item_count: number; subtotal: number }) {
  track("checkout_started", { ...p })
}

export function trackCheckoutStep(p: { step: string; item_count?: number; subtotal?: number }) {
  track("checkout_step_completed", { ...p })
}

export function trackPaymentMethodSelected(p: {
  method: "pago_movil" | "zelle" | "binance" | "crypto" | "bank_transfer" | "other"
  total?: number
}) {
  track("payment_method_selected", { ...p })
}

export function trackPaymentProofUploaded(p: { method?: string; file_size_kb?: number }) {
  track("payment_proof_uploaded", { ...p })
}

export function trackOrderPlaced(p: { order_id: string; total: number; items: number; payment_method?: string }) {
  track("order_placed", { ...p })
}

export function trackComboTierUnlocked(p: { tier: string; discount_pct: number; item_count: number }) {
  track("combo_tier_unlocked", { ...p })
}

export function trackWhatsAppClicked(p: { source_page: string; context?: string }) {
  track("whatsapp_clicked", { ...p })
}

// ─── Remarketing-enrichment events (Batch A1) ───────────────────────────────

export function trackSearchPerformed(p: { query: string; results_count?: number; source?: "header" | "page" }) {
  track("search_performed", { ...p })
}

export function trackCategoryViewed(p: { category?: string; filters?: Record<string, unknown>; results_count?: number }) {
  track("category_viewed", { ...p })
}

export function trackFilterApplied(p: { filter_type: string; value: string | number | boolean; category?: string }) {
  track("filter_applied", { ...p })
}

export function trackProductRemovedFromCart(p: {
  product_id?: string
  variant_id?: string
  title?: string
  quantity: number
  reason?: string
  cart_size_after: number
}) {
  track("product_removed_from_cart", { ...p })
}

export function trackVariantSelected(p: ProductContext & { option_values?: Record<string, string> }) {
  track("variant_selected", { ...p })
}

export function trackCouponApplied(p: { code: string; discount_pct?: number; discount_amount?: number }) {
  track("coupon_applied", { ...p })
}

export function trackCouponFailed(p: { code: string; reason?: string }) {
  track("coupon_failed", { ...p })
}

export function trackHighEngagement(p: { page: string; duration_s: number; product_id?: string }) {
  track("high_engagement_page", { ...p })
}

export function trackScrollDepth(p: { page: string; depth_pct: 25 | 50 | 75 | 100; product_id?: string }) {
  track("scroll_depth", { ...p })
}

export function trackCartAbandoned(p: { item_count: number; subtotal: number; time_in_cart_s?: number }) {
  track("cart_abandoned", { ...p })
}

export function trackOutOfStockView(p: { product_id: string; title?: string; handle?: string }) {
  track("out_of_stock_view", { ...p })
}

// ─── User identification ────────────────────────────────────────────────────

/**
 * Call after login / registration to tie anonymous events to the real customer.
 */
export function identifyCustomer(customer: {
  id: string
  email?: string
  phone?: string
  first_name?: string
  last_name?: string
  country?: string
  city?: string
  has_cedula?: boolean
}) {
  identify(customer.id, {
    email: customer.email,
    phone: customer.phone,
    first_name: customer.first_name,
    last_name: customer.last_name,
    country: customer.country,
    city: customer.city,
    has_cedula: customer.has_cedula,
  })
}
