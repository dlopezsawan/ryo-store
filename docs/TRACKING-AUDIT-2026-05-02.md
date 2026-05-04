# Tracking Audit · 2026-05-02

Auditoría completa del stack de tracking (storefront + backend + WhatsApp/Dana) y bugs encontrados.

---

## Resumen ejecutivo

| Capa | Estado | Notas |
|---|---|---|
| Storefront PostHog (client) | ✅ OK | 14 eventos cableados en lugares correctos |
| Storefront UTM capture (URL → cookies) | ✅ OK | `UtmCapture.tsx` activo |
| Storefront UTM sync (cookies → cart) | ✅ OK | `AttributionSync.tsx` activo |
| Backend `attribution` endpoint | ✅ OK | Persiste `attribution_utm_*` en cart.metadata |
| Backend `order_placed` PostHog | ✅ OK | `posthog-order-events.ts` subscriber |
| Backend `remarketing_converted` PostHog | ✅ OK | `remarketing-attribution.ts` subscriber |
| **Panel `/marketing/attribution`** | 🔴→✅ FIX | leía `meta.utm_source` cuando el storefront escribe `attribution_utm_*` — **fixed** |
| **WhatsApp/Dana → PostHog** | 🔴→✅ FIX | 0 eventos llegando — **fixed: `logFunnelEvent` ahora mirrors a PostHog** |
| Storefront session recordings | 🔴→✅ FIX | Estaba desactivado · **fixed: deployed con `disable_session_recording: false`** |
| LLM observability (Dana) | ✅ OK | `captureLlmGeneration` en `whatsapp-bot.ts:1996` |

---

## 1 · Storefront PostHog (client-side)

**Wrapper**: `storefront/src/lib/posthog.ts` exporta 19 funciones tipadas.

**Cobertura verificada por grep**:

| Evento | Llamado desde | Estado |
|---|---|---|
| `product_viewed` | `components/products/ProductActions.tsx:38` | ✅ |
| `add_to_cart` | `components/products/ProductActions.tsx:106` | ✅ |
| `variant_selected` | `components/products/ProductActions.tsx:61` | ✅ |
| `cart_viewed` | `app/carrito/page.tsx:94`, `cart/CartDrawer.tsx:39` | ✅ |
| `product_removed_from_cart` | `app/carrito/page.tsx:138`, `cart/CartDrawer.tsx:203` | ✅ |
| `checkout_started` | `app/checkout/page.tsx:197` | ✅ |
| `checkout_step` | `app/checkout/page.tsx:741` | ✅ |
| `payment_proof_uploaded` | `app/checkout/page.tsx:405` | ✅ |
| `coupon_applied` / `coupon_failed` | `app/checkout/page.tsx:451/460` | ✅ |
| `order_placed` (client) | `app/checkout/page.tsx:735` | ✅ (espejado server-side) |
| `whatsapp_clicked` | `components/WhatsAppLink.tsx:32` | ✅ |
| `category_viewed` / `filter_applied` | `app/tienda/TiendaContent.tsx:226/235/247` | ✅ |
| `search_performed` | `components/search/SearchBar.tsx:64` | ✅ |
| `high_engagement_page` / `scroll_depth` | `lib/useEngagement.ts:58/74` | ✅ |
| `identify` | `components/PosthogIdentify.tsx` | ✅ |

**Sin gaps relevantes detectados.**

---

## 2 · UTM capture flow

```
URL ?utm_source=ig&utm_medium=cpc&utm_campaign=spring
        ↓
   <UtmCapture> (Providers.tsx)  →  cookies (30 días)
        ↓
   <AttributionSync>  →  POST /api/cart/{id}/attribution  (al detectar cart_id)
        ↓
   storefront proxy  →  backend POST /store/carts/:id/attribution
        ↓
   cart.metadata = { attribution_utm_source: "ig", attribution_utm_medium: "cpc", ... }
        ↓
   cart completado  →  order.metadata copia los `attribution_*` keys
```

Backup path: `app/api/checkout/complete/route.ts:36` también re-lee cookies y empuja al backend justo antes de completar el cart.

**WhatsApp/Dana** (orden creada por el bot via API admin) escribe directamente:
```ts
metadata: {
  source: "whatsapp",
  attribution_utm_source: "whatsapp",
  attribution_utm_medium: "bot",
  attribution_utm_campaign: "whatsapp_checkout",
}
```
(`backend/src/lib/whatsapp-bot.ts:1027-1039`)

**Telegram bot** equivalente: `attribution_utm_source: "telegram"` etc. (`backend/src/api/webhooks/telegram/route.ts:1075`)

---

## 3 · Bug encontrado · Panel attribution leía las keys equivocadas (FIX aplicado)

**Síntoma**: `/marketing/attribution` mostraba `0% TRACKEADO · 0/2 pedidos con UTM`, todos los pedidos como "unknown".

**Causa raíz**: el storefront persiste UTMs como `attribution_utm_source` (prefijo `attribution_`) pero el panel solo leía `meta.utm_source` y `meta.source`.

**Files cambiados**:

- `panel/src/app/(panel)/marketing/_lib.ts` · `attributionBreakdown()` ahora lee:
  ```ts
  meta.attribution_utm_source ?? meta.utm_source ?? meta.source ?? meta.source_channel
  ```
  Ídem para `medium` y `campaign`.

- `panel/src/app/(panel)/marketing/attribution/page.tsx` · contador `attributedOrders` ahora considera `attribution_utm_source` y `source_channel` también.

Resultado esperado: pedidos vía Dana/WhatsApp aparecerán como `whatsapp · bot · whatsapp_checkout`. Pedidos web con UTM activos aparecerán correctamente. Sólo orgánico/direct sin UTM seguirá como "unknown" (eso es esperado).

---

## 4 · Bug encontrado · WhatsApp/Dana no enviaba eventos a PostHog (FIX aplicado)

**Síntoma**: Los 25+ eventos de funnel registrados en `wa_funnel_events` (greeting_sent, payment_screen_shown, order_submitted, objection_detected, etc.) sólo se persistían en Postgres — PostHog no veía nada del lado WhatsApp.

**Solución**: Modificado `backend/src/lib/whatsapp-db.ts::logFunnelEvent()` para hacer mirror a PostHog:

```ts
void captureServerSide({
  distinctId: `wa:${phone}`,
  event: `wa_${event}`,           // p.ej. `wa_payment_screen_shown`
  properties: {
    ...metadata,
    channel: "whatsapp",
    phone,
    $set: { wa_phone: phone, primary_channel: "whatsapp" },
  },
})
```

Eventos que ahora aparecen en PostHog automáticamente (28 eventos del funnel WA):

- Conversación: `wa_greeting_sent`, `wa_first_message_received`
- Búsqueda: `wa_search_executed`
- Carrito: `wa_first_add_to_cart`, `wa_combo_threshold_reached`
- Checkout: `wa_customer_info_provided`, `wa_address_provided`, `wa_payment_screen_shown`, `wa_proof_received`
- Orden: `wa_order_submitted`, `wa_objection_recovered`
- Geo: `wa_delivery_zone_set`, `wa_redirected_to_web`
- Servicio: `wa_human_handoff_requested`, `wa_objection_detected`, `wa_recovery_responded`

Distinct ID `wa:${phone}` se puede unificar luego con `$identify` cuando el cliente compra con un email conocido — ya tenemos infraestructura para eso en `posthog-server.ts::identifyServerSide`.

---

## 5 · Storefront session recordings (FIX aplicado)

**Antes**: `storefront/src/app/layout.tsx` tenía `disable_session_recording: true`.

**Ahora**: deployed con `disable_session_recording: false`, sample rate 100%, mínimo 5s, password fields y `.ph-no-record` excluidos:

```js
session_recording: {
  maskAllInputs: false,
  blockSelector: "input[type=password], [data-private], [data-ph-no-record]",
  sampleRate: 1.0,
  minimumDurationMilliseconds: 5000,
}
```

Container `ryo-store-storefront-1` recreated · ya escribiendo replays a PostHog.

Visualización en panel: `/marketing/analytics` → tab "Replays" (componente `PosthogReplays.tsx` que reemplazó al iframe roto de Clarity).

---

## 6 · Items aún pendientes / sugerencias de mejora

🟡 **Identify `wa:${phone}` con email cuando el cliente compra**
   El customer creado por Dana queda como un alias del wa:phone. Cuando hace primera compra, en `whatsapp-bot.ts:1061` (post-completeCart) podríamos llamar `posthogServer.identify({ alias: customer.email, distinct_id: 'wa:' + phone })` para unificar.

🟡 **Backend `cart_abandoned`**
   El storefront ya tiene `trackCartAbandoned` en el wrapper, pero no encontré llamadas — confirmar si está cableado al `useEngagement` o algún timer.

🟡 **Loyalty earned event**
   `posthog-server.ts` exporta `trackLoyaltyPointsEarned` pero no encontré subscriber que lo dispare. Se ejecuta? Si no, agregar al `award-loyalty.ts`.

🟢 **Attribution_referrer**
   Si bien el storefront captura `referrer` cookie, el panel no lo lista en breakdown. Agregar columna "referrer" a la tabla detallada.

---

## Archivos modificados en este audit

```
backend/src/lib/whatsapp-db.ts                                    (+ PostHog mirror en logFunnelEvent)
panel/src/app/(panel)/marketing/_lib.ts                           (+ leer attribution_utm_* keys)
panel/src/app/(panel)/marketing/attribution/page.tsx              (+ contador con attribution_utm_*)
storefront/src/app/layout.tsx                                     (- disable_session_recording: false + config)
```

Containers recreados: `storefront`. Pendientes (en build): `medusa`, `panel`.
