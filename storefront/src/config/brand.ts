/**
 * Centralized brand configuration.
 *
 * THIS FILE IS THE SINGLE SOURCE OF TRUTH for brand-specific values in the
 * storefront. When you rebrand for a new e-commerce, you should only need to
 * edit:
 *
 *   1. This file (or blueprint.config.yml + re-run scripts/rebrand.sh)
 *   2. Static assets (logo, favicon) in public/ + src/app/
 *   3. Color tokens in globals.css + tailwind.config.js
 *
 * Runtime usage:
 *   import { BRAND, FEATURES, isFeatureEnabled } from "@/config/brand"
 *
 *   <h1>{BRAND.fullName}</h1>
 *   {FEATURES.comboTiers && <ComboTierBanner />}
 *   if (isFeatureEnabled("whatsappBot")) { ... }
 *
 * See: docs/BLUEPRINT.md
 */

export const BRAND = {
  name: "Enrola",
  nameUpper: "ENROLA",
  slug: "enrola",
  fullName: "Enrola Shop",
  tagline: "Rolling papers, grinders y accesorios en Venezuela",
  description:
    "Enrola es la tienda de parafernalia #1 en Venezuela. Rolling papers, grinders, conos, filtros. Envíos Caracas mismo día.",
  locale: "es",

  domain: "enrola.shop",
  baseUrl: "https://enrola.shop",
  apiUrl: "https://api.enrola.shop",
  analyticsUrl: "https://analytics.enrola.shop",
  adminPath: "/dashboard",

  email: {
    contact: "hola@enrola.shop",
    noreply: "noreply@enrola.shop",
    sales: "ventas@enrola.shop",
    support: "hola@enrola.shop",
  },

  social: {
    instagram: "ryo.smoke",
    tiktok: "ryo.smoke",
    facebook: "",
    twitter: "",
    youtube: "",
    telegram: "",
    // International format, digits only — used to build wa.me links across
    // the storefront (bio page, contact page, WhatsApp Buy buttons, etc).
    // Source of truth lives here so we don't depend on NEXT_PUBLIC_* envs
    // which require a docker-compose build-arg passthrough we don't have.
    whatsapp: "34689847685",
    // WhatsApp Business "click-to-chat" short link. The greeting message
    // is configured on the WhatsApp Business app side (not URL-encoded
    // here), so we use this for the bio page where we want the cleanest
    // chat handoff. Falls back to wa.me/<phone> for legacy callers.
    whatsappLink: "https://wa.me/message/UUDZVNXBKIAPH1",
  },

  colors: {
    primary: "#ff3b27",
    secondary: "#2a2d34",
    dark: "#1a1a1a",
    cream: "#fef9f4",
    orange: "#ff7a00",
    muted: "#6b6b6b",
    success: "#10b981",
    error: "#ef4444",
    warning: "#f59e0b",
  },

  fonts: {
    heading: "Kanit",
    body: "system-ui",
  },
} as const

export const MARKET = {
  country: "VE",
  currency: "EUR", // stored as EUR, displayed with BCV conversion
  currencySymbol: "€",
  phoneCode: "58",
  timezone: "America/Caracas",
  primaryCity: "Caracas",
  taxRate: 0.0,
} as const

export const FEATURES = {
  comboTiers: true,
  ageGate: true,
  bcvRate: true,
  manualPayment: true,
  loyalty: true,
  whatsappBot: true,
  telegram: true,
  gamification: true,
  newsletter: true,
  stockoutAlerts: true,
  abandonedCart: true,
  utmTracking: true,
  googlePlaces: true,
  cedulaValidation: true,
} as const

export const COMBO_TIERS = [
  { min_items: 3, discount_pct: 10, label: "Combo 3" },
  { min_items: 5, discount_pct: 15, label: "Combo 5" },
  { min_items: 10, discount_pct: 20, label: "Combo 10" },
] as const

export const WHOLESALE = {
  min_qty: 24,
  discount_pct: 30,
} as const

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function isFeatureEnabled(key: keyof typeof FEATURES): boolean {
  return FEATURES[key] === true
}

export function getSocialUrl(platform: keyof typeof BRAND.social): string | null {
  const handle = BRAND.social[platform]
  if (!handle) return null
  const urls: Record<string, string> = {
    instagram: `https://instagram.com/${handle}`,
    tiktok: `https://tiktok.com/@${handle}`,
    facebook: `https://facebook.com/${handle}`,
    twitter: `https://twitter.com/${handle}`,
    youtube: `https://youtube.com/@${handle}`,
    telegram: `https://t.me/${handle}`,
    whatsapp: `https://wa.me/${handle}`,
  }
  return urls[platform] || null
}

export function fmtCurrency(amount: number, opts: { decimals?: number } = {}): string {
  const d = opts.decimals ?? 2
  return `${MARKET.currencySymbol}${amount.toFixed(d)}`
}
