/**
 * Remarketing signals — heuristics that scan a user's Medusa + PostHog data
 * and return actionable opportunities.
 *
 * Each signal is self-contained: given aggregated user data, return a list of
 * opportunities this user currently qualifies for. No DB writes — pure read.
 *
 * Used by:
 *   - `/admin/remarketing/user360` → show signals per user in the UI
 *   - Batch B engine (future) → fire rules when signals detected
 */

export type SignalSeverity = "high" | "medium" | "low" | "info"

export type Signal = {
  id: string
  severity: SignalSeverity
  icon: string
  title: string
  description: string
  detected_at: string
  suggested_action: string
  suggested_channel: "email" | "whatsapp" | "both" | "manual"
  /** Optional data payload for the eventual rule engine to build the message */
  context?: Record<string, any>
}

export type UserContext = {
  customer: {
    id?: string
    email?: string
    first_name?: string
    phone?: string
    created_at?: string
    /** Lowercased shipping city from latest order — used for geo overrides */
    city?: string
  }
  /** Optional context about the catalog state — for cross-cutting signals */
  catalog?: {
    /** Products created in last 7 days (for VIP early access) */
    new_products?: Array<{ id: string; title: string; created_at: string; handle?: string }>
    /** Products that recently transitioned 0 → positive stock (for OOS waitlist) */
    recently_restocked?: Array<{ id: string; title: string; handle?: string; stocked_at: string }>
  }
  /** Optional loyalty data — points balance accumulated by customer */
  loyalty?: {
    points_balance: number
  }
  medusa: {
    orders_count: number
    lifetime_revenue: number
    last_order_at: string | null
    days_since_last_order: number | null
    orders: Array<{ id: string; total: number; created_at: string; items: Array<{ product_id: string; title: string; quantity: number }> }>
  }
  posthog: {
    sessions: number
    pageviews: number
    product_views: number
    cart_events: number
    checkout_starts: number
    orders: number
    add_to_carts: number
    whatsapp_clicks: number
    first_seen_at: string | null
    last_seen_at: string | null
    top_products_viewed: Array<{ product_id: string; title: string; views: number; last_viewed_at: string }>
    // Raw events (last 200) to spot micro-patterns
    recent_events: Array<{ timestamp: string; event: string; properties: any }>
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null
  const d = new Date(iso).getTime()
  if (Number.isNaN(d)) return null
  return Math.floor((Date.now() - d) / 86400000)
}

function hoursSince(iso: string | null | undefined): number | null {
  if (!iso) return null
  const d = new Date(iso).getTime()
  if (Number.isNaN(d)) return null
  return Math.floor((Date.now() - d) / 3600000)
}

function last<T>(arr: T[], n = 1): T[] {
  return arr.slice(-n)
}

// ─── Signal detectors ─────────────────────────────────────────────────────────

/**
 * 🥇 #1 — Abandoned checkout (intent-matched)
 *
 * Matches the francisfratta2022 case: checkout_started but no order_placed
 * in the last 72h, identified email, initiated from mobile/Instagram.
 */
function detectAbandonedCheckout(ctx: UserContext): Signal[] {
  const events = ctx.posthog.recent_events || []
  // Find most recent checkout_started
  const checkoutStart = events.find((e) => e.event === "checkout_started")
  if (!checkoutStart) return []
  const orderAfter = events.find(
    (e) => e.event === "order_placed" && new Date(e.timestamp) > new Date(checkoutStart.timestamp)
  )
  if (orderAfter) return []
  const hrs = hoursSince(checkoutStart.timestamp)
  if (hrs == null || hrs < 1 || hrs > 72) return []
  if (!ctx.customer.email) return []

  // Find items the user added in that session
  const addsBeforeCheckout = events
    .filter((e) => e.event === "add_to_cart" && new Date(e.timestamp) < new Date(checkoutStart.timestamp))
    .slice(0, 5)
  const productsInCart = addsBeforeCheckout.map((a) => ({
    product_id: a.properties?.product_id,
    title: a.properties?.title,
  }))

  // Was it mobile? Any event with $device_type = Mobile
  const mobile = events.some((e) => e.properties?.$device_type === "Mobile")
  // Came from Instagram?
  const fromIG = events.some((e) =>
    (e.properties?.$referring_domain || "").includes("instagram") ||
    (e.properties?.utm_source || "").toLowerCase() === "ig"
  )

  return [
    {
      id: "abandoned_checkout",
      severity: "high",
      icon: "🛒",
      title: `Abandonó checkout hace ${hrs}h con ${productsInCart.length} producto${productsInCart.length !== 1 ? "s" : ""}`,
      description: `Inició checkout pero no completó orden. ${mobile ? "Mobile. " : ""}${fromIG ? "Vino de Instagram. " : ""}Productos en carrito: ${productsInCart.map((p) => p.title).join(", ") || "(desconocidos)"}.`,
      detected_at: new Date().toISOString(),
      suggested_action: `Enviar ${mobile && fromIG ? "WhatsApp personal" : "email con link directo al checkout"} con los productos + incentivo ligero (envío gratis u offer de ayuda).`,
      suggested_channel: mobile && fromIG ? "whatsapp" : "email",
      context: {
        hours_since_checkout: hrs,
        products: productsInCart,
        mobile,
        from_instagram: fromIG,
      },
    },
  ]
}

/**
 * 🥈 #2 — Add-to-cart sin compra (clásico, 2-48h)
 */
function detectAddToCartWithoutPurchase(ctx: UserContext): Signal[] {
  const events = ctx.posthog.recent_events || []
  const lastAdd = events.find((e) => e.event === "add_to_cart")
  if (!lastAdd) return []
  const orderAfter = events.find(
    (e) => e.event === "order_placed" && new Date(e.timestamp) > new Date(lastAdd.timestamp)
  )
  if (orderAfter) return []
  const hrs = hoursSince(lastAdd.timestamp)
  if (hrs == null || hrs < 2 || hrs > 168) return [] // 2h–7d window
  const title = lastAdd.properties?.title || "producto"
  return [
    {
      id: "cart_abandoned",
      severity: "medium",
      icon: "🛍",
      title: `Añadió "${title}" al carrito hace ${hrs}h sin comprar`,
      description: `Última acción add_to_cart registrada sin orden posterior. Probable duda sobre precio o método de pago.`,
      detected_at: new Date().toISOString(),
      suggested_action: "Email con los productos, testimonial social y 10% off válido 48h.",
      suggested_channel: "email",
      context: {
        hours_since_add: hrs,
        product_title: title,
        product_id: lastAdd.properties?.product_id,
      },
    },
  ]
}

/**
 * 🥉 #3 — Multi-view sin add_to_cart (intent bloqueado)
 */
function detectMultiViewNoConvert(ctx: UserContext): Signal[] {
  const signals: Signal[] = []
  for (const p of ctx.posthog.top_products_viewed) {
    if (p.views < 3) continue
    // Did they add this to cart ever?
    const addedThis = (ctx.posthog.recent_events || []).some(
      (e) => e.event === "add_to_cart" && e.properties?.product_id === p.product_id
    )
    if (addedThis) continue
    const daysAgo = daysSince(p.last_viewed_at)
    if (daysAgo == null || daysAgo > 14) continue
    signals.push({
      id: `multi_view_no_cart:${p.product_id}`,
      severity: "medium",
      icon: "👀",
      title: `Vio "${p.title}" ${p.views} veces sin agregarlo al carrito`,
      description: `Producto que está explorando repetidamente pero algo lo detiene: precio, descripción, o dudas. Alta oportunidad.`,
      detected_at: new Date().toISOString(),
      suggested_action: "Email con mejor descripción + testimonios + 10% off específico para ese producto.",
      suggested_channel: "email",
      context: { product_id: p.product_id, title: p.title, views: p.views },
    })
  }
  return signals
}

/**
 * #4 — Restock due (basado en ciclo de compra del producto)
 */
function detectRestockDue(ctx: UserContext): Signal[] {
  if (ctx.medusa.orders_count < 2) return [] // necesita al menos 2 órdenes para estimar ciclo
  const signals: Signal[] = []
  // Agrupar items comprados por product_id
  const purchases = new Map<string, { title: string; dates: Date[] }>()
  for (const o of ctx.medusa.orders) {
    for (const it of o.items) {
      const entry = purchases.get(it.product_id) || { title: it.title, dates: [] }
      entry.dates.push(new Date(o.created_at))
      purchases.set(it.product_id, entry)
    }
  }
  // Para cada producto comprado 2+ veces calcular ciclo medio
  for (const [pid, entry] of purchases) {
    if (entry.dates.length < 2) continue
    entry.dates.sort((a, b) => a.getTime() - b.getTime())
    const gaps: number[] = []
    for (let i = 1; i < entry.dates.length; i++) {
      gaps.push((entry.dates[i].getTime() - entry.dates[i - 1].getTime()) / 86400000)
    }
    const avgCycleDays = gaps.reduce((s, g) => s + g, 0) / gaps.length
    const daysSinceLast = daysSince(entry.dates[entry.dates.length - 1].toISOString()) || 0
    // Due si pasó >= cycle (+ grace period 3d)
    if (daysSinceLast >= avgCycleDays - 3) {
      signals.push({
        id: `restock_due:${pid}`,
        severity: daysSinceLast > avgCycleDays ? "medium" : "low",
        icon: "🔁",
        title: `Probablemente necesita reponer "${entry.title}"`,
        description: `Ha comprado este producto ${entry.dates.length} veces con ciclo medio de ${Math.round(avgCycleDays)}d. Última compra hace ${daysSinceLast}d.`,
        detected_at: new Date().toISOString(),
        suggested_action: "Email reorder-1-click con ciclo detectado.",
        suggested_channel: "email",
        context: { product_id: pid, title: entry.title, cycle_days: Math.round(avgCycleDays), days_since_last: daysSinceLast },
      })
    }
  }
  return signals
}

/**
 * #5 — High engagement no convert (browse mucho, compra 0)
 */
function detectHighEngagementNoConvert(ctx: UserContext): Signal[] {
  if (ctx.medusa.orders_count > 0) return [] // ya compró, no aplica
  if (ctx.posthog.sessions < 3) return []
  if (ctx.posthog.pageviews < 15) return []
  return [{
    id: "high_engagement_no_convert",
    severity: "high",
    icon: "🔥",
    title: `${ctx.posthog.sessions} sesiones, ${ctx.posthog.pageviews} pageviews — nunca ha comprado`,
    description: "Usuario altamente engaged que nunca convirtió. Probable fricción técnica, duda de pago, o necesita empuje humano.",
    detected_at: new Date().toISOString(),
    suggested_action: "Alerta al equipo para contacto humano 1:1 por WhatsApp/email (NO automático — demasiado engagement para un mensaje genérico).",
    suggested_channel: "manual",
    context: {
      sessions: ctx.posthog.sessions,
      pageviews: ctx.posthog.pageviews,
    },
  }]
}

/**
 * #6 — Win-back (compró hace 60+ días)
 */
function detectWinBack(ctx: UserContext): Signal[] {
  if (ctx.medusa.orders_count === 0) return []
  const days = ctx.medusa.days_since_last_order
  if (days == null || days < 60) return []
  const days7 = daysSince(ctx.posthog.last_seen_at)
  const recentlyActive = days7 != null && days7 < 14
  return [{
    id: "win_back",
    severity: recentlyActive ? "high" : "medium",
    icon: "💌",
    title: `Cliente inactivo — última compra hace ${days}d`,
    description: recentlyActive
      ? `Ha vuelto a visitar el sitio recientemente (${days7}d) pero no ha vuelto a comprar. Momento ideal para reactivar.`
      : `Sin visitas recientes tampoco. Win-back con oferta agresiva.`,
    detected_at: new Date().toISOString(),
    suggested_action: recentlyActive ? "WhatsApp personalizado" : "Email con 20% off válido 7d",
    suggested_channel: recentlyActive ? "whatsapp" : "email",
    context: {
      days_since_last_order: days,
      days_since_last_visit: days7,
      recently_active: recentlyActive,
    },
  }]
}

/**
 * 📅 F1 — Weekly visitor dropped off
 *
 * Cliente que visitaba semanalmente y desapareció >14d. Más temprano que win-back
 * tradicional. Email gentil — "te extrañamos".
 */
function detectWeeklyVisitorDroppedOff(ctx: UserContext): Signal[] {
  if (!ctx.customer.email) return []
  if (ctx.posthog.sessions < 4) return []
  const last = ctx.posthog.last_seen_at
  if (!last) return []
  const daysSince = Math.floor((Date.now() - new Date(last).getTime()) / 86400000)
  if (daysSince < 14 || daysSince > 60) return []
  // First seen at least 28d ago (was a regular)
  if (!ctx.posthog.first_seen_at) return []
  const ageDays = Math.floor(
    (Date.now() - new Date(ctx.posthog.first_seen_at).getTime()) / 86400000
  )
  if (ageDays < 28) return []
  return [
    {
      id: "weekly_visitor_dropped",
      severity: "low",
      icon: "📅",
      title: `Visitante regular ausente ${daysSince}d`,
      description: `${ctx.posthog.sessions} sesiones acumuladas en ${ageDays}d, sin visitas recientes. Pre-churn temprano.`,
      detected_at: new Date().toISOString(),
      suggested_action: "Email gentil 'te extrañamos' sin descuento agresivo.",
      suggested_channel: "email",
      context: { sessions: ctx.posthog.sessions, days_since_last_visit: daysSince, age_days: ageDays },
    },
  ]
}

/**
 * 🎁 F2 — Post-discount review request
 *
 * Cliente compró usando código de descuento + 7d después. Email pidiendo review
 * + 50 puntos loyalty por reseña.
 */
function detectPostDiscountReviewRequest(ctx: UserContext): Signal[] {
  if (!ctx.customer.email) return []
  // Find the most recent order that used a coupon
  for (const o of ctx.medusa.orders.slice(0, 5)) {
    const meta = (o as any).metadata || {}
    const code = String(meta.discount_code || meta.coupon_code || "")
    if (!code) continue
    const days = Math.floor((Date.now() - new Date(o.created_at).getTime()) / 86400000)
    if (days < 7 || days > 14) continue
    return [
      {
        id: `post_discount_review:${o.id}`,
        severity: "low",
        icon: "🎁",
        title: `¿Cómo te fue con tu compra (#${(o as any).display_id || o.id.slice(0, 8)})?`,
        description: `Compró usando ${code} hace ${days}d. Pedir review + 50pts loyalty para activar UGC.`,
        detected_at: new Date().toISOString(),
        suggested_action: "Email con link a review + bonus de 50 puntos loyalty.",
        suggested_channel: "email",
        context: { order_id: o.id, discount_code: code, days_since_purchase: days },
      },
    ]
  }
  return []
}

/**
 * 🏘 F3 — Geo cluster offer (signal sólo informativo, fires por ciudad acumulan)
 *
 * Indica que el customer está en una ciudad con clustering activo. No dispara
 * mensaje propio — sirve como input para campañas batch geo-localizadas
 * disparadas manualmente desde la UI (futuro).
 */
function detectGeoCluster(ctx: UserContext): Signal[] {
  if (!ctx.customer.city) return []
  if (!ctx.customer.email) return []
  // Solo emite si tiene actividad reciente y vive en una de las ciudades activas
  // (la lista se mantiene en código por simplicidad — futuro: DB-driven)
  const activeCities = ["caracas", "valencia", "maracay", "maracaibo", "cumaná"]
  if (!activeCities.includes(ctx.customer.city)) return []
  if (ctx.posthog.sessions === 0 && ctx.medusa.orders_count === 0) return []
  return [
    {
      id: `geo_cluster:${ctx.customer.city}`,
      severity: "info",
      icon: "🏘",
      title: `Cluster geo: ${ctx.customer.city}`,
      description: `Customer en ciudad activa de campañas geo. Disponible para campañas batch localizadas.`,
      detected_at: new Date().toISOString(),
      suggested_action: "Sin acción inmediata — flag para batch campaigns.",
      suggested_channel: "manual",
      context: { city: ctx.customer.city },
    },
  ]
}

/**
 * 📱 F4 — Mobile-first (informational signal for variant device targeting)
 *
 * Enriquece el contexto con device flag — variants pueden filtrar por mobile.
 * No emite signal propio para evitar ruido; las reglas que quieran filtrar
 * por device leen `ctx.posthog.recent_events[].properties.$device_type`.
 *
 * Implementado como detector vacío — placeholder para evolución futura.
 */
function detectMobileFirstHint(_ctx: UserContext): Signal[] {
  // Intencionalmente vacío — el flag mobile/desktop ya está en ctx para que
  // variants lo usen (futuro: variant.condition = "mobile").
  return []
}

/**
 * 👥 F5 — Repurchase referral nudge
 *
 * Customer con 3+ órdenes + última hace 5-15d (post-purchase fresh). Email
 * con código de referral personalizado.
 */
function detectRepurchaseReferralNudge(ctx: UserContext): Signal[] {
  if (!ctx.customer.email) return []
  if (ctx.medusa.orders_count < 3) return []
  const days = ctx.medusa.days_since_last_order
  if (days == null || days < 5 || days > 15) return []
  const refCode = `REF${(ctx.customer.id || ctx.customer.email).slice(0, 6).toUpperCase()}`
  return [
    {
      id: "repurchase_referral",
      severity: "low",
      icon: "👥",
      title: `Cliente recurrente — ${ctx.medusa.orders_count} órdenes ($${ctx.medusa.lifetime_revenue.toFixed(0)} LTV)`,
      description: `Repeat customer ideal para programa de referrals. Su código: ${refCode}.`,
      detected_at: new Date().toISOString(),
      suggested_action: "Email con código personal de referrals + incentivo doble.",
      suggested_channel: "email",
      context: {
        ref_code: refCode,
        orders_count: ctx.medusa.orders_count,
        ltv: ctx.medusa.lifetime_revenue,
      },
    },
  ]
}

/**
 * 📉 #15 — Cart value decreased (indecisión activa)
 *
 * Caso: usuario tuvo `product_removed_from_cart` event reciente sin completar
 * checkout. Sutil — su carrito BAJÓ de valor sin volverse a llenar.
 *
 * Email amable preguntando si encontró lo que buscaba, sin ofrecer descuento
 * inmediato (puede ser fricción de elección, no de precio).
 */
function detectCartValueDecreased(ctx: UserContext): Signal[] {
  const events = ctx.posthog.recent_events || []
  if (!ctx.customer.email) return []
  const cutoff = Date.now() - 48 * 3600000

  const removed = events.find(
    (e) => e.event === "product_removed_from_cart" &&
           new Date(e.timestamp).getTime() >= cutoff
  )
  if (!removed) return []
  // No hubo recovery (re-add del mismo producto u otro)
  const sinceRemoved = new Date(removed.timestamp).getTime()
  const recovered = events.find((e) => {
    const t = new Date(e.timestamp).getTime()
    return t > sinceRemoved && (e.event === "add_to_cart" || e.event === "order_placed")
  })
  if (recovered) return []
  const hrs = hoursSince(removed.timestamp)
  if (hrs == null || hrs < 1 || hrs > 48) return []
  const removedTitle = String(removed.properties?.title || "el producto")
  return [
    {
      id: "cart_value_decreased",
      severity: "low",
      icon: "📉",
      title: `Removió "${removedTitle}" del carrito hace ${hrs}h`,
      description: `Posible indecisión de elección o precio. Email amable preguntando si encontró lo que buscaba — sin descuento agresivo.`,
      detected_at: new Date().toISOString(),
      suggested_action: "Email gentil: '¿Encontraste lo que buscabas? Estamos aquí si necesitas algo.'",
      suggested_channel: "email",
      context: {
        removed_product: removedTitle,
        removed_product_id: removed.properties?.product_id,
        hours_since_removal: hrs,
      },
    },
  ]
}

/**
 * 🔎 #14 — Search with no result follow-up
 *
 * Caso: usuario hizo `search_performed` event y no hizo click ni add_to_cart
 * en los siguientes 30min. O hizo 2+ búsquedas sin éxito. Email gentil
 * preguntando qué buscaba y sugiriendo alternativas.
 *
 * Este signal también es feedback gratis de catálogo — qué falta o qué
 * términos no resuelven a producto.
 */
function detectSearchNoResultFollowup(ctx: UserContext): Signal[] {
  const events = ctx.posthog.recent_events || []
  if (!ctx.customer.email) return []
  const cutoff = Date.now() - 7 * 86400000

  const searches = events.filter(
    (e) => e.event === "search_performed" && new Date(e.timestamp).getTime() >= cutoff
  )
  if (searches.length < 2) return []  // require 2+ searches for less noise

  // For each search, check if any product/cart action followed within 30min
  const orphanedSearches: string[] = []
  for (const s of searches) {
    const sTime = new Date(s.timestamp).getTime()
    const followup = events.find((e) => {
      const t = new Date(e.timestamp).getTime()
      if (t <= sTime) return false
      if (t - sTime > 30 * 60000) return false
      return ["product_viewed", "add_to_cart", "order_placed"].includes(e.event)
    })
    if (!followup) {
      const q = String(s.properties?.query || s.properties?.search_query || "").trim()
      if (q && !orphanedSearches.includes(q)) orphanedSearches.push(q)
    }
  }
  if (orphanedSearches.length === 0) return []
  return [
    {
      id: "search_no_result_followup",
      severity: "medium",
      icon: "🔎",
      title: `${orphanedSearches.length} búsquedas sin resultado`,
      description: `Buscaste "${orphanedSearches.slice(0, 3).join('", "')}" sin encontrar lo que buscabas. Email gentil ofreciendo ayuda + sugerencias.`,
      detected_at: new Date().toISOString(),
      suggested_action: "Email humano preguntando qué busca, sugiriendo alternativas.",
      suggested_channel: "email",
      context: {
        queries: orphanedSearches.slice(0, 5),
        query_count: orphanedSearches.length,
      },
    },
  ]
}

/**
 * 🤔 #13 — Variant explorer indecision
 *
 * Caso: usuario cambió variantes (variant_selected event) 5+ veces en mismo
 * producto en una sesión sin add_to_cart. Indica indecisión activa — momento
 * ideal para WhatsApp humano (un email genérico no rompe esta barrera).
 */
function detectVariantExplorerIndecision(ctx: UserContext): Signal[] {
  const events = ctx.posthog.recent_events || []
  if (events.length === 0) return []
  if (!ctx.customer.email && !ctx.customer.phone) return []

  // Group variant_selected events by product_id within last 24h
  const cutoff = Date.now() - 24 * 3600000
  const byProduct = new Map<string, { title: string; selections: number; lastAt: string }>()
  for (const ev of events) {
    if (ev.event !== "variant_selected") continue
    if (new Date(ev.timestamp).getTime() < cutoff) continue
    const pid = String(ev.properties?.product_id || "")
    if (!pid) continue
    const cur = byProduct.get(pid) || {
      title: String(ev.properties?.title || pid),
      selections: 0,
      lastAt: ev.timestamp,
    }
    cur.selections++
    if (new Date(ev.timestamp) > new Date(cur.lastAt)) cur.lastAt = ev.timestamp
    byProduct.set(pid, cur)
  }
  const signals: Signal[] = []
  for (const [pid, info] of byProduct) {
    if (info.selections < 5) continue
    // Skip if user already added THIS product to cart
    const added = events.some(
      (e) => e.event === "add_to_cart" && e.properties?.product_id === pid
    )
    if (added) continue
    const hrs = hoursSince(info.lastAt)
    if (hrs == null || hrs > 24) continue
    signals.push({
      id: `variant_explorer:${pid}`,
      severity: "medium",
      icon: "🤔",
      title: `Cambió variantes ${info.selections} veces en "${info.title}" sin agregarlo`,
      description: `Indecisión activa con ${info.title}. WhatsApp humano para resolver dudas (talla, sabor, cantidad).`,
      detected_at: new Date().toISOString(),
      suggested_action: "WhatsApp empático ofreciendo ayuda con la elección.",
      suggested_channel: "whatsapp",
      context: {
        product_id: pid,
        product_title: info.title,
        variant_selections: info.selections,
        hours_since_last: hrs,
      },
    })
  }
  return signals
}

/**
 * 📦 #12 — Out of stock waitlist
 *
 * Caso: usuario vio producto agotado (out_of_stock_view event) en últimos 30d
 * + ese producto ahora está disponible (catalog.recently_restocked).
 * Email de "Volvió!" con código de incentivo.
 */
function detectOutOfStockBackInStock(ctx: UserContext): Signal[] {
  const restocked = ctx.catalog?.recently_restocked || []
  if (restocked.length === 0) return []
  if (!ctx.customer.email) return []
  const events = ctx.posthog.recent_events || []
  const restockedIds = new Set(restocked.map((p) => p.id))

  // Find products the user viewed while OOS in last 30d that are now restocked
  const cutoff = Date.now() - 30 * 86400000
  const matched = new Map<string, { product_id: string; title: string; handle?: string }>()
  for (const ev of events) {
    if (ev.event !== "out_of_stock_view") continue
    if (new Date(ev.timestamp).getTime() < cutoff) continue
    const pid = String(ev.properties?.product_id || "")
    if (!pid || !restockedIds.has(pid)) continue
    if (matched.has(pid)) continue
    const r = restocked.find((p) => p.id === pid)
    matched.set(pid, {
      product_id: pid,
      title: r?.title || String(ev.properties?.title || pid),
      handle: r?.handle,
    })
  }
  if (matched.size === 0) return []
  // Single signal listing all matched products (one email better than N)
  const products = Array.from(matched.values())
  const titles = products.slice(0, 3).map((p) => p.title).join(", ")
  return [
    {
      id: `out_of_stock_back:${products[0].product_id}`,
      severity: "high",
      icon: "📦",
      title: `${products.length} producto${products.length !== 1 ? "s que viste están" : " que viste está"} de vuelta`,
      description: `${titles} volvió al stock. Notificarle 24h antes que público general + 5% off por ser waitlist.`,
      detected_at: new Date().toISOString(),
      suggested_action: "Email con productos disponibles + código BACKINSTOCK5.",
      suggested_channel: "email",
      context: {
        products,
        product_count: products.length,
      },
    },
  ]
}

/**
 * 💎 #11 — Loyalty redemption nudge
 *
 * Cliente con ≥ 500 puntos acumulados + 30+ días sin orden. Email recordando
 * que tiene puntos disponibles antes que expiren / pierda interés.
 */
function detectLoyaltyRedemptionNudge(ctx: UserContext): Signal[] {
  const balance = ctx.loyalty?.points_balance ?? 0
  if (balance < 500) return []
  if (!ctx.customer.email) return []
  const days = ctx.medusa.days_since_last_order
  // Solo si pasaron ≥30d sin orden, OR nunca compró pero acumuló (rare)
  if (days != null && days < 30) return []
  return [
    {
      id: "loyalty_redemption_nudge",
      severity: "low",
      icon: "💎",
      title: `${balance} puntos disponibles sin redimir`,
      description: `Cliente acumuló ${balance} puntos${days ? ` y no compra hace ${days}d` : ""}. Recordatorio amigable para activar la redención.`,
      detected_at: new Date().toISOString(),
      suggested_action: "Email recordando los puntos + valor estimado en Bs.",
      suggested_channel: "email",
      context: {
        points_balance: balance,
        days_since_last_order: days,
      },
    },
  ]
}

/**
 * 🌟 #10 — VIP early access (nuevos productos para clientes top)
 *
 * Caso: customer VIP (LTV ≥ $100, ya tiene signal=vip) + hay productos creados
 * en últimos 7d. Email anunciando acceso anticipado con código exclusivo.
 *
 * Asunción: el catalog.new_products se inyecta antes de computeSignals (lo
 * inyecta el engine al construir contexto, lo verán todos los detectores
 * cross-cutting).
 */
function detectVipEarlyAccess(ctx: UserContext): Signal[] {
  if (ctx.medusa.lifetime_revenue < 100) return []
  if (!ctx.customer.email) return []
  const newProducts = ctx.catalog?.new_products || []
  if (newProducts.length === 0) return []
  const titles = newProducts.slice(0, 3).map((p) => p.title).join(", ")
  return [
    {
      id: "vip_early_access",
      severity: "medium",
      icon: "🌟",
      title: `Acceso VIP — ${newProducts.length} producto${newProducts.length !== 1 ? "s" : ""} nuevo${newProducts.length !== 1 ? "s" : ""}`,
      description: `Cliente VIP (LTV $${ctx.medusa.lifetime_revenue.toFixed(0)}) y hay nuevos productos: ${titles}. Acceso anticipado 24h antes que el público general.`,
      detected_at: new Date().toISOString(),
      suggested_action: "Email exclusivo con código VIP15 + lista de productos nuevos.",
      suggested_channel: "email",
      context: {
        new_products: newProducts.slice(0, 5),
        ltv: ctx.medusa.lifetime_revenue,
      },
    },
  ]
}

/**
 * 🚨 #9 — Multiple abandoned checkouts (lead caliente para humano)
 *
 * Caso: mismo usuario con 2+ checkout_started en 14d sin order_placed.
 * El mensaje #N automático va a hartar; mejor escalar a humano.
 *
 * No despacha al cliente — emite signal con channel='manual' (rule.channel
 * será 'team_alert' para notificar al equipo en Telegram).
 */
function detectMultipleAbandonedCheckouts(ctx: UserContext): Signal[] {
  const events = ctx.posthog.recent_events || []
  const cutoff = Date.now() - 14 * 86400000
  const checkoutStarts = events.filter(
    (e) => e.event === "checkout_started" && new Date(e.timestamp).getTime() >= cutoff
  )
  if (checkoutStarts.length < 2) return []
  // Order placed at any point after 14d? Not a current lead — skip.
  const recentOrder = events.find(
    (e) => e.event === "order_placed" && new Date(e.timestamp).getTime() >= cutoff
  )
  if (recentOrder) return []
  if (!ctx.customer.email) return []
  // Skip extreme outliers (>20 starts is probably bot or test)
  if (checkoutStarts.length > 20) return []

  const products = new Set<string>()
  for (const ev of events) {
    if (ev.event === "add_to_cart" && ev.properties?.title) {
      products.add(String(ev.properties.title))
    }
  }
  return [
    {
      id: "multiple_abandoned_checkouts",
      severity: "high",
      icon: "🚨",
      title: `Lead caliente — ${checkoutStarts.length} checkouts abandonados en 14d`,
      description: `Mismo usuario inició checkout ${checkoutStarts.length} veces sin completar. Algo le impide comprar — el mensaje automático ya no va a romper la barrera. Necesita atención humana.`,
      detected_at: new Date().toISOString(),
      suggested_action:
        "Notificar al equipo vía Telegram con link al User 360 + invitarlos a contactar al usuario directamente.",
      suggested_channel: "manual",
      context: {
        checkout_starts_count: checkoutStarts.length,
        latest_attempt_at: checkoutStarts[0]?.timestamp,
        products_attempted: Array.from(products).slice(0, 5),
        ltv_potential: ctx.medusa.lifetime_revenue,
      },
    },
  ]
}

/**
 * 🎟 #8 — Coupon failed without purchase (rescate de frustración)
 *
 * Caso: usuario intentó aplicar un código en checkout, falló, no completó la compra.
 * Es un momento explícito de alta intención + emoción negativa (frustración).
 * Captura > 10% típica en e-commerce porque ya querían comprar.
 *
 * Ventana: 30 min - 24 h. Antes es muy pronto (deja al user reintentar);
 * después es muy tarde (perdió el momentum).
 */
function detectCouponFailedNoPurchase(ctx: UserContext): Signal[] {
  const events = ctx.posthog.recent_events || []
  const lastFail = events.find((e) => e.event === "coupon_failed")
  if (!lastFail) return []
  const orderAfter = events.find(
    (e) => e.event === "order_placed" && new Date(e.timestamp) > new Date(lastFail.timestamp)
  )
  if (orderAfter) return []
  const hrs = hoursSince(lastFail.timestamp)
  if (hrs == null || hrs < 0.5 || hrs > 24) return []
  if (!ctx.customer.email && !ctx.customer.phone) return []

  const code = String(lastFail.properties?.code || "")
  const reason = String(lastFail.properties?.reason || "")
  // Was it mobile? Emotional rescue is best served on the device they're already on.
  const mobile = events.some((e) => e.properties?.$device_type === "Mobile")

  return [
    {
      id: "coupon_failed_no_purchase",
      severity: "high",
      icon: "🎟",
      title: `Intentó usar el código "${code}" hace ${hrs}h y no compró`,
      description: `El cupón ${code} falló (${reason || "razón no registrada"}) y no completó la orden. Momento ideal para rescatar con un código que SÍ funcione.`,
      detected_at: new Date().toISOString(),
      suggested_action: `Enviar ${mobile && ctx.customer.phone ? "WhatsApp" : "email"} con código válido (VUELVE10 o similar) + mensaje empático.`,
      suggested_channel: mobile && ctx.customer.phone ? "whatsapp" : "email",
      context: {
        failed_code: code,
        failed_reason: reason,
        hours_since_fail: hrs,
        mobile,
      },
    },
  ]
}

/**
 * #7 — Loyalty VIP (top revenue)
 */
function detectVIP(ctx: UserContext): Signal[] {
  if (ctx.medusa.lifetime_revenue < 100) return []
  return [{
    id: "vip",
    severity: "info",
    icon: "⭐",
    title: `Cliente VIP — €${ctx.medusa.lifetime_revenue.toFixed(0)} LTV`,
    description: `${ctx.medusa.orders_count} órdenes. Priorizar en atención y perks.`,
    detected_at: new Date().toISOString(),
    suggested_action: "Incluir en lista VIP, ofertas exclusivas, early access a nuevos productos.",
    suggested_channel: "email",
    context: { lifetime_revenue: ctx.medusa.lifetime_revenue, orders_count: ctx.medusa.orders_count },
  }]
}

// ─── Main API ─────────────────────────────────────────────────────────────────

export function computeSignals(ctx: UserContext): Signal[] {
  const detectors = [
    detectAbandonedCheckout,
    detectAddToCartWithoutPurchase,
    detectMultiViewNoConvert,
    detectRestockDue,
    detectHighEngagementNoConvert,
    detectWinBack,
    detectVIP,
    detectCouponFailedNoPurchase,
    detectMultipleAbandonedCheckouts,
    detectVipEarlyAccess,
    detectLoyaltyRedemptionNudge,
    detectOutOfStockBackInStock,
    detectVariantExplorerIndecision,
    detectSearchNoResultFollowup,
    detectCartValueDecreased,
    detectWeeklyVisitorDroppedOff,
    detectPostDiscountReviewRequest,
    detectGeoCluster,
    detectMobileFirstHint,
    detectRepurchaseReferralNudge,
  ]
  const out: Signal[] = []
  for (const d of detectors) {
    try {
      out.push(...d(ctx))
    } catch (err) {
      console.warn(`[signals] ${d.name} failed:`, (err as Error).message)
    }
  }
  // Ordenar por severity: high → medium → low → info
  const rank: Record<SignalSeverity, number> = { high: 0, medium: 1, low: 2, info: 3 }
  out.sort((a, b) => rank[a.severity] - rank[b.severity])
  return out
}
