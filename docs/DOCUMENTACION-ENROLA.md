# Documentación técnica — Enrola.shop

> Documento maestro consolidado del estado actual del proyecto en producción.
> **VPS**: `72.60.114.242` · **Dominio**: [enrola.shop](https://enrola.shop) · **API**: [api.enrola.shop](https://api.enrola.shop)
> Última auditoría: 2026-04-21

---

## Índice

1. [Visión general](#1-visión-general)
2. [Infraestructura y despliegue](#2-infraestructura-y-despliegue)
3. [Backend Medusa v2](#3-backend-medusa-v2)
4. [Base de datos](#4-base-de-datos)
5. [Storefront (Next.js)](#5-storefront-nextjs)
6. [Flujo de compras / checkout](#6-flujo-de-compras--checkout)
7. [Bot de Telegram](#7-bot-de-telegram)
8. [Bot de WhatsApp (Dana)](#8-bot-de-whatsapp-dana)
9. [Inventario real](#9-inventario-real)
10. [Sistema de lealtad (Club Enrola)](#10-sistema-de-lealtad-club-enrola)
11. [Remarketing y jobs automáticos](#11-remarketing-y-jobs-automáticos)
12. [Admin dashboard](#12-admin-dashboard)
13. [Integraciones externas](#13-integraciones-externas)
14. [Seguridad / notas operativas](#14-seguridad--notas-operativas)
15. [Hallazgos y deuda técnica](#15-hallazgos-y-deuda-técnica)

---

## 1. Visión general

**Enrola.shop** es un e-commerce de productos para fumadores (rolling papers, conos, filtros, grinders, bongs y pipas) con despacho desde **Valencia, Venezuela**. El modelo opera con:

- **Storefront web** en Next.js 16 (App Router).
- **Backend Medusa v2** con módulos custom (loyalty, WhatsApp bot, remarketing).
- **Bot de WhatsApp con IA** (Dana, DeepSeek V3) para atención 24/7 y cierre de ventas directo por chat.
- **Bot de Telegram** para que el equipo operativo gestione el flujo completo de órdenes (aprobar pago → asignar almacén → marcar enviado → cerrar) desde un grupo, más el comando `/venta` para registrar ventas presenciales.
- **Red de 3 almacenes distribuidos** en Valencia (Grimuca, Daniel, Leo) para entregas inmediatas, + MRW a nivel nacional.
- **Pago manual** (Pago Móvil del Banco de Venezuela) con captura por comprobante subido o enviado por WhatsApp.
- **Programa de puntos** (Club Enrola) con canje de recompensas.
- **Sistema de remarketing automático** (emails + WhatsApp) con 9 campañas recurrentes.

La tienda también aloja **Enrola Legends**, un minijuego Phaser estilo Pokémon/Stardew en `/juego`.

---

## 2. Infraestructura y despliegue

### Stack Docker (`/root/ryo-store/docker-compose.yml`)

Red: `n8n_default` (compartida con el stack n8n externo). Reverse proxy: **Traefik** con TLS automático (Let's Encrypt, `certresolver=mytlschallenge`).

| Servicio | Imagen | Puerto | Host público | Volumen | Notas |
|---|---|---|---|---|---|
| `postgres` | `postgres:16-alpine` | 5432 | — | `postgres_data` | DBs: `medusa` + `listmonk` |
| `redis` | `redis:7-alpine` | 6379 | — | — | Sin persistencia |
| `medusa` | build `./backend` | 9000 | `api.enrola.shop` + `enrola.shop/{dashboard,admin,auth,bot}` | `medusa_uploads:/app/static` | Traefik priority 200-300 para que `/dashboard` gane sobre el storefront |
| `storefront` | build `./storefront` | 3000 | `enrola.shop` (redirect 301 `www→non-www`) | `payment_proofs:/app/public/uploads` | Next.js |
| `listmonk` | `listmonk/listmonk:latest` | 9000 | `newsletter.enrola.shop` | logo/favicon ro | Usa la misma Postgres |

### Dominios activos

| Dominio | Apunta a | Propósito |
|---|---|---|
| `enrola.shop` | storefront | Tienda pública |
| `api.enrola.shop` | medusa | API Medusa + webhooks + admin |
| `enrola.shop/dashboard` | medusa | Medusa Admin UI |
| `enrola.shop/bot` | medusa | Panel admin del bot (`/bot/config`, `/bot/stats`, `/bot/conversations`) |
| `newsletter.enrola.shop` | listmonk | Panel Listmonk |

### Acceso VPS

```bash
ssh root@72.60.114.242
cd /root/ryo-store
```

Proceso de deploy estándar:
```bash
# local (desde proyecto)
rsync -avz --delete ./backend/ root@72.60.114.242:/root/ryo-store/backend/
rsync -avz --delete ./storefront/ root@72.60.114.242:/root/ryo-store/storefront/

# VPS
cd /root/ryo-store
docker compose build --no-cache medusa       # o storefront
docker compose up -d medusa                  # o storefront
docker logs ryo-store-medusa-1 -f --tail 100 # verificar
```

DB shell:
```bash
docker exec -it ryo-store-postgres-1 psql -U medusa -d medusa
```

Ver `docs/PASO-A-PASO-DEPLOY.md` para el flujo detallado.

---

## 3. Backend Medusa v2

### Estructura (`/root/ryo-store/backend/src/`)

```
admin/       # Admin UI extensions (routes + widgets)
api/         # HTTP routes (admin, store, webhooks, bot, hooks)
jobs/        # Tareas programadas (cron-like)
lib/         # Librerías compartidas (WhatsApp bot, email, FX, Instagram, Telegram...)
links/       # Vacío (solo README)
modules/     # Módulos Medusa custom (loyalty)
scripts/     # Scripts utilitarios
subscribers/ # Event handlers
workflows/   # Vacío (solo README)
```

### Configuración (`medusa-config.ts`)

- `admin.path = "/dashboard"` servido desde el mismo backend.
- `admin.backendUrl = "https://api.enrola.shop"`, `vite.base = "/dashboard/"`.
- CORS, JWT y cookies leídos de env.
- **Módulos registrados**:
  - Custom: `./src/modules/loyalty`.
  - `@medusajs/medusa/file` con provider `@medusajs/medusa/file-local` (`upload_dir: static`, expuesto en `https://api.enrola.shop/static`).

**Providers:**
- Payment: solo `pp_system_default` (manual). No hay Stripe/MP.
- Fulfillment: solo `manual_manual`. Todas las shipping options usan este provider.

### API routes custom

#### Admin (`/admin/*`)
| Ruta | Método | Propósito |
|---|---|---|
| `/admin/analytics` | GET | Dashboard analítico (ventas, órdenes, FX, funnel Telegram) |
| `/admin/loyalty/rewards[/:id]` | GET/POST/PUT/DELETE | CRUD recompensas |
| `/admin/maintenance` | GET/POST | Toggle modo mantenimiento (flag en `wa_bot_config`) |
| `/admin/newsletter` | GET | Estado Listmonk (bypass SQL directo) |
| `/admin/orders-live` | GET | Monitor de órdenes en tiempo real |
| `/admin/remarketing` | GET/POST | Stats + settings de campañas |
| `/admin/webmail/*` | varios | Cliente IMAP/SMTP embebido (auth, folders, messages, flags, reply, move) |
| `/admin/whatsapp/{config,conversations,stats,webhook}` | GET/POST | Panel bot |
| `/bot/*` | GET/POST | Alias de `/admin/whatsapp/*` (Traefik priority 300) |

#### Store (`/store/*`)
| Ruta | Método | Propósito |
|---|---|---|
| `/store/auth/google-signin` | POST | Puente NextAuth→Medusa (Google OAuth). Crea/vincula customer + auth_identity, emite JWT. Protegido por `GOOGLE_BRIDGE_SECRET` |
| `/store/carts/[id]/attribution` | POST | Persiste UTMs en el cart |
| `/store/carts/[id]/discount-check` | POST | Evalúa promo code y devuelve razones por las que no aplica |
| `/store/loyalty` | GET | Puntos + últimas 30 transacciones |
| `/store/loyalty/redeem` | POST | Canjea rewards |
| `/store/loyalty/rewards` | GET | Rewards activos |
| `/store/maintenance` | GET | Flag público de mantenimiento |

#### Webhooks públicos
| Ruta | Propósito |
|---|---|
| `/webhooks/telegram` | Callbacks inline keyboard + `/venta` |
| `/webhooks/whatsapp` | Recibe mensajes WaSenderAPI (texto/audio/imagen/ubicación) |
| `/webhooks/instagram` | GET challenge Meta, POST DMs y comentarios (HMAC-SHA256) |
| `/maintenance` | Flag público |

### Módulos custom

#### `loyalty` (`LOYALTY_MODULE`)
Servicio: `LoyaltyModuleService extends MedusaService({LoyaltyReward, LoyaltyTransaction})`.

Método custom: `getCustomerPoints(customerId)` → suma de `points` del ledger.

**Modelos:**
- `LoyaltyReward`: `id`, `name`, `description?`, `points_required`, `image_url?`, `is_active`, `stock?`
- `LoyaltyTransaction`: `id`, `customer_id`, `points` (+/−), `type`, `order_id?`, `reward_id?`, `description?`

### Subscribers (`src/subscribers/`)

| Archivo | Evento(s) | Acción |
|---|---|---|
| `award-loyalty-points.ts` | `order.placed`/completed | Otorga puntos al customer |
| `customer-listmonk.ts` | `customer.created` | Suscribe el email a Listmonk |
| `fulfillment-notifications.ts` | `shipment.created`, `delivery.created` | Emails "enviado"/"entregado" (Resend) |
| `order-confirmation.ts` | `order.placed` | Email de confirmación (SQL directo por temas de unidades) |
| `order-customer-whatsapp.ts` | `order.placed`, `order.completed`, `shipment.created` | WhatsApp al cliente por etapa |
| `order-display-id.ts` | `order.placed` | Setea `custom_display_id` (últimos 6 chars del UUID) |
| `order-whatsapp-notify.ts` | `order.placed` | WhatsApp al dueño |
| `welcome-email.ts` | `customer.created` | Email + WhatsApp de bienvenida, log en `remarketing_log` |

**⚠️ Hallazgo**: no existe un subscriber que envíe el mensaje a Telegram con botones al crearse una orden web. Ese mensaje solo lo dispara el bot de WhatsApp al completar `submit_order`. Las órdenes del storefront solo generan WhatsApp al dueño + email al cliente.

### Jobs programados (`src/jobs/`)

| Job | Frecuencia | Propósito |
|---|---|---|
| `abandoned-cart.ts` | cada 2h | Recuperación de carritos sin convertir (dedupe 48h) |
| `birthday-emails.ts` | diario 9am | Descuento de cumpleaños |
| `graduation.ts` | diario 10am | Graduar customers Telegram/WhatsApp a compra web |
| `pending-payment.ts` | cada hora | Recordatorio pagos pendientes (dedupe 7d) |
| `post-purchase.ts` | diario 11am | Follow-up 3 días tras delivered |
| `restock.ts` | diario 12pm | Recordatorio de reposición |
| `stockout-alert.ts` | diario 9:30am | Alerta stock bajo |
| `whatsapp-session-cleanup.ts` | cada 5 min | Cierra sesiones (`human_active >30min`, `bot_active >2h`) |
| `win-back.ts` | lunes 10am | Customers sin comprar hace 60+ días |

### Librerías (`src/lib/`)

| Archivo | Tamaño | Propósito |
|---|---|---|
| `email-service.ts` | ~26KB | Resend + templates HTML (welcome, birthday, win-back, abandoned, post-purchase, restock, graduation, pending-payment, stockout-alert, order-confirmation, shipped, delivered) |
| `email-template.ts` | — | Base HTML reutilizable (Kanit, paleta cream/crimson/olive) |
| `fx-rates.ts` | ~4KB | BCV EUR/USD + Binance P2P USDT (`api.alcambio.app`), cache 10min |
| `instagram-sender.ts` | ~3.4KB | Meta Graph API v21 (DMs) |
| `medusa-store-api.ts` | ~9KB | Cliente Store API para el bot WA (carrito → order programático) |
| `remarketing-db.ts` | ~9.5KB | `logEmail`, `wasRecentlySent`, `getSetting`, `alreadyNotified`, geo overrides |
| `remarketing-wa.ts` | ~3KB | WhatsApp sender para remarketing |
| `telegram-log.ts` | ~3KB | Log `telegram_command_log` (creación lazy) + `classifyVentaError` |
| `whatsapp-bot.ts` | ~59KB | Núcleo LLM del bot (DeepSeek V3 + 14 tools) |
| `whatsapp-db.ts` | ~14KB | DAO del bot (schema wa_*) |
| `whatsapp-sender.ts` | ~3KB | Cliente WaSenderAPI |
| `whatsapp-templates.ts` | ~4KB | Templates WA cortos por campaña |

---

## 4. Base de datos

PostgreSQL 16 en contenedor `ryo-store-postgres-1`, DB `medusa`. Total: 143 tablas. Además de las nativas de Medusa, existen estas tablas custom:

| Tabla | Propósito |
|---|---|
| `wa_bot_config` | KV store del bot (32 keys: credenciales, config, JIDs cacheados) |
| `wa_conversations` | 1 fila por (channel, phone). Columnas: `phone`, `session_status`, `customer_name/email`, `order_data jsonb`, `channel`, `welcomed_at` |
| `wa_messages` | Historial (role `user`/`assistant`/`human`, `message_id` anti-eco) |
| `wa_bot_msg_ids` | `msg_id (PK)` para detectar eco |
| `ig_comment_dms` | Dedupe de private-replies Instagram |
| `loyalty_reward` | Catálogo canjeable |
| `loyalty_transaction` | Ledger de puntos |
| `remarketing_log` | Log de envíos (email/WA) |
| `remarketing_settings` | Config por campaña (KV jsonb) |
| `telegram_command_log` | (creada lazy) Log de `/venta` con clasificación de errores |
| `view_configuration` | Plugin de vistas guardadas del admin |
| `user_rbac_role` | Plugin RBAC |

**Claves relevantes en `wa_bot_config`:**
```
enabled, bot_name (="Dana"), bot_timeout (120min), human_timeout (30min)
owner_phone (34689847685), delivery_whatsapp_group (120363423768077575@g.us)
wasender_key, deepseek_key, groq_key, google_maps_key
telegram_bot_token, telegram_chat_id (-1003636474581)
pago_movil_banco (Banco de Venezuela), pago_movil_cedula (21028734), pago_movil_telefono (04244043276)
meta_page_token, meta_app_secret, meta_verify_token, ig_business_id, ig_enabled, ig_comment_trigger, ig_welcome_message
maintenance_mode
jid_<phone>  (cache de JIDs WhatsApp por número)
```

---

## 5. Storefront (Next.js)

### Stack

- **Next.js 16.1.6** (App Router, `output: "standalone"`, Dockerfile)
- **React 19.2.3** + TypeScript 5.9.3
- **Tailwind CSS v4** + variables CSS custom
- **NextAuth v4** (JWT strategy)
- **Resend** para emails transaccionales
- **Phaser 3.90** para el juego
- **Google Maps JS API** para autocompletado

### Variables de entorno

```
NEXT_PUBLIC_MEDUSA_BACKEND_URL=https://api.enrola.shop
NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=pk_a277839f...
NEXT_PUBLIC_STORE_URL=https://enrola.shop
RESEND_API_KEY=...
RESEND_FROM=hola@enrola.shop
FROM_PEDIDOS=pedidos@enrola.shop
NEXT_PUBLIC_RECAPTCHA_SITE_KEY=...
RECAPTCHA_SECRET_KEY=...
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=-5113342381
BCV_EUR_RATE=510.49   # fallback
NEXT_PUBLIC_GOOGLE_MAPS_KEY=...
GOOGLE_CLIENT_ID/SECRET=...
NEXTAUTH_SECRET=...
GOOGLE_BRIDGE_SECRET=...
LISTMONK_URL/ADMIN_USER/ADMIN_PASSWORD/LIST_ID=...
```

### Rutas de páginas

**Públicas / marketing:**
| Ruta | Propósito |
|---|---|
| `/` | Home (hero slider, best sellers, Club CTA, FAQ, newsletter) |
| `/tienda` | Catálogo con filtros (categoría, material, precio, sort) |
| `/productos/[slug]` | Detalle de producto (SSR, JSON-LD, breadcrumb) |
| `/arma-tu-combo` | Constructor libre de combos |
| `/bundles` | Combos preconfigurados |
| `/carrito` | Vista completa del carrito |
| `/checkout` | Formulario unificado envío + pago manual |
| `/checkout/gracias` | Confirmación post-orden |
| `/seguimiento` | Tracking de pedido |
| `/blog`, `/blog/[slug]` | Blog estático (array TS) |
| `/faq`, `/contacto`, `/mayoristas` | Páginas varias |
| `/terminos`, `/privacidad`, `/devoluciones` | Legales |
| `/mantenimiento` | Modo mantenimiento (rewrite desde middleware) |
| `/juego` | Enrola Legends (Phaser) |

**Cuenta y auth:**
| Ruta | Propósito |
|---|---|
| `/login`, `/registro`, `/recuperar`, `/reset-password` | Flujo de auth |
| `/cuenta` | Dashboard con tabs: Club, Pedidos, Referidos, Datos, Direcciones |

### API routes (`src/app/api/*`)

Todas las rutas Next actúan como **proxy** al backend Medusa para ocultar la publishable key y evitar CORS. Grupos:

- **Auth**: `/api/auth/[...nextauth]`, `/api/auth/register`, `/forgot-password`, `/reset-password`
- **Carrito**: `/api/cart`, `/api/cart/regions`, `/api/cart/line-items[/:lineId]`, `/api/cart/link-customer`
- **Checkout**: `/api/checkout/{update,upload-proof,discount,shipping-options,shipping,payment-providers,payment-collection,payment-session,complete,send-confirmation}`
- **Cuenta**: `/api/cuenta/{loyalty,rewards,addresses,orders,profile}`
- **Catálogo**: `/api/categories`, `/api/product`, `/api/product-variant`, `/api/upsell`, `/api/search/suggestions`
- **Otros**: `/api/contact` (reCAPTCHA), `/api/newsletter` (Listmonk), `/api/bcv-rate` (4 fuentes en cascada, cache 1h)

### Auth (`src/auth.ts`)

NextAuth con dos providers:

1. **`credentials`** (email/contraseña) → `medusaLogin` → `POST /auth/customer/emailpass`.
2. **`google`** (OAuth) → callback `signIn` → `POST /store/auth/google-signin` con `{email, firstName, lastName, googleId, bridgeSecret}`.

El backend crea/vincula `customer` + `auth_identity` y devuelve un token Medusa que se guarda como `session.medusaToken`.

**Helpers en `src/lib/medusaAuth.ts`:**
- `medusaLogin/Register/GetMe/GetOrders/UpdateProfile/GetAddresses/AddAddress/DeleteAddress`
- `medusaGetOrders` deriva `effectiveStatus` de los timestamps de fulfillments porque Medusa v2 no sincroniza `order.status` automáticamente.

### Middleware (`src/middleware.ts`)

Consulta `GET {BACKEND}/maintenance` (cache en memoria 15s). Si true → `rewrite('/mantenimiento')` salvo APIs y assets.

### Estilo y diseño

- **Fuente**: Kanit (self-hosted, 5 pesos: 400/500/600/700/900)
- **Paleta**: `--primary #BB3B2E` (terracota), `--orange #FF3B27`, `--secondary #4D5431` (oliva), `--cream #F5F2E8`, `--dark #1A1A1A`
- **Estética vintage/retro**: `.vintage-border` (3px), `.retro-shadow` (sombras hard 6px 6px 0 0), `btn-vintage` (hover translate + lose-shadow)
- **Animaciones**: `ticker-scroll` 30s linear, `hero-stamp-in/out` (cubic-bezier)

### Caching

| Recurso | Cache |
|---|---|
| `/_next/static/*` | immutable, 1 año |
| `/_next/image` | 86400s, swr 604800s |
| Fuentes/imágenes | 1 semana + swr 1 mes |
| `/`, `/tienda` | s-maxage 60s, swr 300s |
| `/productos/:handle` | 120s + swr 600s |
| Legales | 1h + swr 1d |

Home usa `revalidate = 60` (ISR).

---

## 6. Flujo de compras / checkout

### Arquitectura del cart

- **ID** en `localStorage['ryo_cart_id']`
- **Estado global** vía Context API (`src/context/CartContext.tsx`) — no hay Zustand/Redux
- **Helpers** en `src/lib/cart.ts` y `src/lib/medusa.ts` (fetch directo, sin SDK)
- **Auto-linking** al customer autenticado (`POST /api/cart/link-customer`) para activar promociones con regla `customer_id`
- **Fallback region ID** hardcoded: `reg_01KKKY6BGV511PKKHK3WRK3VN8` (Venezuela)

### Flujo paso a paso (`src/app/checkout/page.tsx`, 1282 líneas)

1. **Validaciones cliente**: cart presente, region_id cargado, comprobante subido, TOS aceptados, honeypot vacío, tiempo >3s desde load.
2. **Upload comprobante** → `/api/checkout/upload-proof` (JPG/PNG ≤5MB) → `/uploads/payment-proofs/proof-*.ext`
3. **Update cart** → email, shipping_address, billing_address, metadata (`payment_proof_url`, `shipping_type`, `shipping_cost`, `tos_accepted_at`, `maps_url`, `redeemed_rewards`)
4. **Payment collection** → crea si no existe
5. **Shipping options** → selecciona:
   - `mrw` → primera opción con "mrw" en nombre
   - `inmediato` → opción con monto 0 si subtotal ≥$10 (gratis), o $3 si menor
6. **Shipping method** → `POST /store/carts/{id}/shipping-methods`
7. **Payment providers** → primero de la región (típicamente `pp_system_default`)
8. **Payment session** → con `data.payment_proof_url`
9. **Redeem loyalty** → `POST /api/cuenta/loyalty/redeem` (con rollback en DELETE si falla el complete)
10. **Complete** → lee cookies UTM → `POST /store/carts/{id}/attribution` → `POST /store/carts/{id}/complete`
11. **Post-orden**:
    - Limpia `localStorage`
    - `POST /api/checkout/send-confirmation` (fire-and-forget): email cliente + email pedidos@ + Telegram text + Telegram photo
    - Newsletter opt-in → Listmonk
    - Redirect a `/checkout/gracias?order=…`

### Métodos de pago

**Solo pago manual por comprobante** (Pago Móvil, Banco de Venezuela):
- Cédula: 21028734
- Teléfono: 04244043276

No hay Stripe, Mercado Pago, PayPal. El provider Medusa usado es el genérico `pp_system_default`.

### Shipping options configurados

| ID | Nombre | Tipo | Precio |
|---|---|---|---|
| `so_01KKKY1MS54VQE3CV1JXB5MMD9` | MRW | Standard | 10 |
| `so_01KKKY1MS5RJ2JCR3ZQYJZHAPE` | Inmediato | Express | 10 |
| `so_01KKM2QVVHQ3YYBYPZR7NQ6AMB` | Inmediato (Valencia) - Gratis | Inmediato | 0 |
| `so_01KKM2QVVNBYBRF6W8HZ0A09W4` | Inmediato (Valencia) - $3 | Inmediato | 300 |
| `so_01KKM2QVVPB9P34B0QA8WXAVF9` | MRW - Cobro a destino | MRW | 0 |

### Promociones

- **Única promoción real en DB**: `ENROLAWELCOME` — descuento fijo €2.50 sobre 1 unidad (standard, activa, no automática). Se promociona en comentarios de Instagram.
- **Combos por volumen** (hardcodeados en `src/lib/combo-tiers.ts`, **no son Promotions de Medusa**):
  - 3+ productos → 10%
  - 5+ → 15%
  - 10+ → 20%
  - 24+ mismo SKU → 30% (mayorista)
- **Envío gratis** desde $10 (lógica de selección de shipping option, no promotion).

### UX extras

- **UTM tracking**: `UtmCapture` guarda cookies 30d; se envían al backend en `complete`.
- **Cupones con feedback**: si Medusa acepta pero no aplica, llama a `/discount-check` para explicar por qué (ej: "necesitas subtotal mínimo de X").
- **Age Gate**: modal +18 una vez por device.
- **Cart drawer** con progress bar hacia envío gratis, `ComboTierBanner`, `UpsellSection`.
- **Calculadora de costo por sesión** para consumibles.
- **Sticky buy bar** en mobile.
- **Bot protection checkout**: honeypot + time check >3s. No CAPTCHA.

---

## 7. Bot de Telegram

### Arquitectura

**Webhook HTTP** (no polling) en `POST https://api.enrola.shop/webhooks/telegram`.

Archivo: `/root/ryo-store/backend/src/api/webhooks/telegram/route.ts` (884 líneas).

Procesa dos tipos de eventos:
1. **`callback_query`** — botones inline (flujo de órdenes)
2. **`message`** — texto; solo `/venta` se procesa, el resto se ignora silenciosamente

Helper único `tgApi(method, body)` para llamar cualquier Bot API. Token leído de `wa_bot_config.telegram_bot_token` en cada request (sin cache).

Siempre responde 200 (incluso en error) para evitar reintentos de Telegram.

### Configuración

En `wa_bot_config`:
- `telegram_bot_token`
- `telegram_chat_id` → `-1003636474581` (supergrupo)
- `delivery_whatsapp_group` → grupo WA de delivery

Set webhook (manual):
```bash
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
     -d url=https://api.enrola.shop/webhooks/telegram
```

Privacy mode: **desactivar** en BotFather (`/setprivacy → Disable`) para que reciba todos los mensajes del grupo.

### Flujo de notificación de órdenes (solo desde bot WhatsApp)

Disparador: `sendTelegramNotification(od)` en `whatsapp-bot.ts:1149-1199`. Se llama solo al completar `submit_order` del bot. **Las órdenes del storefront web NO disparan este mensaje**.

Formato del mensaje inicial:
```
🛒 <b>NUEVO PEDIDO WhatsApp #1234</b>
⚡ Envío inmediato

👤 Nombre Apellido
📱 +58412...
📧 cliente@...
🏠 Calle, Valencia, Carabobo
📍 Ver en Google Maps (link)

📦 Productos:
• Producto x2 — €10.00

💰 €10.00 = Bs 400.00
🧾 Comprobante: Ver imagen (link)
```

Botones: `[✅ Aprobar Pago]` `[🔍 Revisar Pago]` (callback_data `ap:<displayId>` y `rv:<displayId>`; usan display_id porque callback_data está limitado a 64 bytes).

**Máquina de estados del bot:**

```
(orden creada por bot WA)
      │
      ▼ mensaje "NUEVO PEDIDO" [Aprobar] [Revisar]
  pending, payment=awaiting
      │
      ├─ [🔍 Revisar]  → solo avisa al cliente por WA
      └─ [✅ Aprobar]  → capturePaymentWorkflow → WA cliente
      │
      ▼ "PAGO CAPTURADO" [Grimuca] [Daniel] [Leo]
  payment=captured
      │
      └─ [Almacén X]  → createOrderFulfillmentWorkflow + createReservationItems
                       + WA al grupo delivery con direcciones pickup/destino
      │
      ▼ "EN PREPARACIÓN" [🚚 Pedido Salió]
  fulfilled
      │
      └─ [🚚]  → createOrderShipmentWorkflow → WA cliente "en camino"
      │
      ▼ "ENVIADO" [📦 Pedido Recibido]
  shipped
      │
      └─ [📦]  → UPDATE fulfillment.delivered_at + completeOrderWorkflow
      │
      ▼ "COMPLETADO" (sin botones)
  status=completed
```

### Callbacks (botones inline)

| Callback | Handler | Workflow afectado |
|---|---|---|
| `rv:<id>` | `handleReviewPayment` | WhatsApp cliente; editMessage |
| `ap:<id>` | `handleApprovePayment` | `capturePaymentWorkflow` |
| `wh:<id>:<idx>` | `handleWarehouseSelect` | `createOrderFulfillmentWorkflow` + `createReservationItems` + WA delivery |
| `sh:<id>` | `handleShipped` | `createOrderShipmentWorkflow` |
| `rc:<id>` | `handleReceived` | `UPDATE fulfillment.delivered_at` + `completeOrderWorkflow` |

### Comando `/venta`

Registra una venta manual instantánea completa (payment capturado + fulfillment + shipment + delivered + completed) en una sola invocación.

**Sintaxis:**
```
/venta [cantidad] [producto] para [nombre], [kv opcionales], almacen [almacen]
```

Ejemplos:
```
/venta 1 rolling paper cañamo para douglas hidalgo, almacen daniel
/venta 2 conos sabores para maria garcia, cedula 12345678, tel +584121234567, email maria@ejemplo.com, almacen leo
```

**Aliases de producto** (en `PRODUCT_ALIASES`):
| Alias | Búsqueda |
|---|---|
| `rp`, `rolling paper cañamo/hemp` | rolling paper hemp |
| `rp sabores` | rolling paper sabores |
| `rp celulosa` | rolling paper celulosa |
| `conos`, `conos hemp`, `conos brown` | conos hemp |
| `conos sabores`, `conos saborizados` | conos saborizados |
| `conos celulosa` | conos celulosa |
| `grinder eléctrico/electrico` | grinder eléctrico |
| `grinder plástico/plastico` | grinder plástico |
| `filtro carbon`, `filtros` | filtro carbón |
| `tips`, `tips puffman` | filter tips |

**Pipeline SQL que ejecuta** (14 pasos):
1. Resolver producto (LIKE)
2. Resolver almacén (LIKE)
3. Obtener precio (`price` ↔ `price_set` ↔ `product_variant_price_set`)
4. Región default
5. Cliente (lookup/create con email `manual+<slug>@enrola.shop`)
6. Next display_id
7. INSERT `order` con metadata (`manual_sale`, `utm_source=telegram`)
8. INSERT `order_address` (Valencia, `ve`) shipping + billing
9. INSERT `order_line_item` con `raw_unit_price` (formato `{value, precision:20}`)
10. INSERT `order_item` con `raw_quantity`/`raw_unit_price`
11. INSERT `order_summary` con totales
12. Payment: `createPaymentCollections` → `link.create` → `createPaymentSession` → `authorizePaymentSession` → `capturePaymentWorkflow`
13. Reservation: `createReservationItems` con `line_item_id` + `location_id`
14. Fulfillment → Shipment → `UPDATE fulfillment.delivered_at` → `completeOrderWorkflow`

Cada invocación se loggea en `telegram_command_log` con clasificación de error (`product_not_found`, `warehouse_not_found`, `stock_insufficient`, `payment_error`, etc.).

### Permisos

**⚠️ Sin autenticación**: cualquiera en el grupo puede ejecutar `/venta` o apretar botones. No hay whitelist por `user.id`.

---

## 8. Bot de WhatsApp (Dana)

### Estado actual

- **En producción activo**.
- 6 conversaciones totales, 73 mensajes, 42 en últimas 24h, 47 en últimos 7 días.
- Todas las sesiones en `bot_active` (ningún humano tomó el control).
- Bot: `Dana` (`enabled=true` en `wa_bot_config`).
- Webhook: `POST https://api.enrola.shop/webhooks/whatsapp`.
- Instagram DM preparado pero **desactivado** (`ig_enabled=false`, sin `meta_page_token`).

### Proveedores externos

| Servicio | Uso |
|---|---|
| **WaSenderAPI** | Webhook entrante + envío texto/imagen + `decrypt-media` |
| **DeepSeek V3** (`deepseek-chat`) | LLM principal con function calling |
| **Groq Whisper** (`whisper-large-v3`, `language=es`) | Transcripción de notas de voz OGG |
| **Google Maps Geocoding** | Reverse geocode de ubicaciones |
| **Telegram Bot API** | Notificaciones de pedido tras `submit_order` |
| **pydolarve.org** + `ve.dolarapi.com` | Tasa BCV EUR/Bs (cache 10min, fallback 40.0) |

### Flujo de mensajes entrantes

1. `ensureTables()` idempotente
2. Parseo multi-formato del payload WaSenderAPI
3. **Filtros**: ignora grupos (`@g.us`), vacíos, bot apagado, eco del propio bot (doble check: `msg_id` + contenido idéntico <60s)
4. **Extracción de media**:
   - **Texto**: `message.conversation` / `extendedTextMessage.text`
   - **Audio**: descarga → Groq Whisper → transcripción español
   - **Imagen**: `wasenderapi.com/api/decrypt-media` → descarga → valida magic bytes (JPEG/PNG) → guarda en `static/wa-proofs/proof-<phone>-<ts>.{jpg|png}` → URL pública `https://api.enrola.shop/static/wa-proofs/...`. Fallback: token `ENCRYPTED_IMAGE`.
   - **Ubicación**: extrae lat/lng → Google reverse geocode → inyecta `[UBICACION: lat=..., lng=..., address="...", maps_url="..."]`
5. **Lock por teléfono** (`phoneLocks: Map<string, Promise>`) para evitar race conditions
6. Si `fromMe=true` → `session_status='human_active'`, bot silente
7. **Fast-path saludos**: regex → responde con catálogo estático (sin llamar LLM)
8. **Caso general** → `chat(phone, text)`:
   - Recupera histórico (últimos 20 msgs)
   - Construye prompt sistema + 14 tools
   - Loop function-calling DeepSeek V3 hasta respuesta en texto

### 14 tools del LLM (function calling)

| Tool | Propósito |
|---|---|
| `search_products` | Búsqueda por texto/categoría con mapeo de jerga VE (`esmoñador`→grinder, `papelillo`→rolling paper) + Levenshtein ≤2 |
| `get_product_details` | Detalles + todas las variantes con `variant_id` |
| `list_categories` | Categorías activas con conteo |
| `check_order` | Estado de pedido por `display_id` o email |
| `lookup_customer` | Cliente por email (nombre, direcciones, puntos) |
| `add_to_order` | Añade item a `order_data` JSONB + envía imagen del producto |
| `remove_from_order` | Quita por posición (1, 2, 3...) |
| `view_order_summary` | Resumen con productos, descuento combo, envío, subtotal € |
| `set_customer_info` | Guarda nombre, email, teléfono |
| `set_address` | Guarda dirección manual o compartida (lat/lng/maps_url) |
| `get_price_in_bs` | Total en Bs (tasa BCV) + datos Pago Móvil |
| `save_payment_proof` | Registra URL del comprobante recibido |
| `submit_order` | Crea orden real: `createCart`→`addLineItem`(xN)→`updateCart`→`setShippingMethod`→`createPaymentCollection`→`createPaymentSession`→`completeCart` → dispara Telegram |
| `cancel_order_flow` | Limpia `order_data` |

**Cross-sell mapeado** en constante `CROSS_SELL` del bot:
- `grinder` ↔ `rolling paper/filtro/cono`
- `bong` ↔ `grinder`
- etc.

### Descuentos en `order_data`

Los cálculos de tiers combo (3+=10%, 5+=15%, 10+=20%) y envío gratis desde €10 son lógica aplicativa del bot, no Promotions de Medusa. Se persisten en `wa_conversations.order_data.{combo_tier, discount_pct}`.

### Dashboard admin (`/admin/whatsapp`)

3 pestañas:
1. **Dashboard**: 4 stat cards (conversaciones totales, mensajes totales, activas 24h, mensajes 24h), webhook URL, health checks
2. **Conversaciones**: lista + visor de chat (burbujas user/bot/human, timestamps)
3. **Configuración**: formulario con `bot_name`, keys (enmascaradas), `owner_phone`, timeouts, Telegram, Groq, Pago Móvil, Google Maps

Botón "Activar/Desactivar" togglea `enabled`. Endpoints backend: `/bot/config`, `/bot/stats`, `/bot/conversations`.

---

## 9. Inventario real

### Almacenes (`stock_location`)

| ID | Nombre | Ciudad | Coordenadas | Maps |
|---|---|---|---|---|
| `sloc_grimuca_001` | **Grimuca** | Valencia, Carabobo | 10.212262, -68.005456 | Grifería Múltiples Grimuca C.A. |
| `sloc_daniel_001` | **Daniel** | Valencia, Carabobo | 10.197218, -68.015360 | Conj. Res. Palma de Oro |
| `sloc_leo_001` | **Leo** | Valencia, Carabobo | 10.202041, -67.998799 | Res. Las Chimeneas, Av. 91 |
| `sloc_01KKKY1MPA9AXX7TQX0ZBR8SJ8` | Venezuela | Valencia | — | Almacén virtual/origen |

Coordenadas en `stock_location_address.metadata` JSONB `{lat, lng, maps_url}`.

### Region / Sales Channel

| Region | Moneda | Países |
|---|---|---|
| `reg_01KKKY6BGV511PKKHK3WRK3VN8` — Venezuela | **USD** | ve |

Sales channel único: `sc_01KKKXS41ERWFG6G7DSMEFP4JT` (Default Sales Channel).

### Colecciones

- `pcol_01KKPR9CHBAR5KRXAC252VYTFJ` — **Combo**
- `pcol_01KKPRA2PKEWQ41SX13ZNKFGT2` — **Featured**
- `pcol_01KKPRAA5BT4ZBZ1PV2TZ17XBR` — **Best**

### Categorías (todas raíz, sin padre)

| Categoría | # productos |
|---|---|
| **Bongs** | 2 (ambos draft) |
| **Conos** | 3 published |
| **Filtros** | 2-3 published |
| **Grinders** | 2 published |
| **Pipas** | 3 (todos draft) |
| **Rolling Paper** | 3 published |

### Catálogo (15 productos, 20 variantes)

#### Bongs (draft)
| Producto | Handle | Stock |
|---|---|---|
| Bong Electro | `bong-electro` | 0 |
| Bong de Vidrio | `bong-de-vidrio` | 0 |

#### Conos (published)
| Producto | Handle | Stock total |
|---|---|---|
| Conos Celulosa Alien Puff — 12 uds | `conos-alien-puff-celulosa` | 33 |
| Conos Rolling Paper — 12 uds | `conos-hemp-natural` | 20 |
| Conos Saborizados Alien Puff — 12 uds | `conos-alien-puff-saborizados` | 33 |

#### Filtros (published)
| Producto | Handle | Stock total |
|---|---|---|
| Filtro Carbón Activo Alien Puff — 10 uds | `filtro-carbon-activo` | 30 |
| Filtros de Cartón Perforado Puff Man | `filtros-carton-perforado` | 250 |

#### Grinders (published)
| Producto | Variantes | Stock /variante |
|---|---|---|
| Grinder Plástico 60mm | Azul, Rojo, Transparente, Verde | 6 c/u |
| Grinder Rellenador de Conos con Portaconos | — | 12 |

#### Pipas (draft)
| Producto | Stock |
|---|---|
| Pipa Vidrio Peq | 0 |
| Pipa de mano de vidrio | 0 |
| Pipa de mano wig-wag | 0 |

#### Rolling Paper (published)
| Producto | Handle | Variantes | Stock total |
|---|---|---|---|
| Rolling Paper Celulosa Transparente | `papel-celulosa-transparente` | — | 360 |
| Rolling Paper Marrón | `rolling-paper` | — | 600 |
| **Rolling Paper Sabores Alien Puff** | `papel-sabores-alien-puff` | Aromáticos, Frutales, Frutos del Bosque | 96/108/96 |

### Precios por categoría (USD, región activa)

| Categoría | Min | Max |
|---|---|---|
| Bongs | $25 | $30 |
| Conos | $12 | $20 |
| Filtros | $1 | $7 |
| Grinders | $6 | $17 |
| Pipas | $5 | $10 |
| Rolling Paper | $2.50 | $3 |

**⚠️ Discrepancia moneda**: la región es USD pero el bot habla en €. Hay precios duplicados en `price` para `eur` y `usd`. Revisar que el storefront y el bot muestren la misma cifra.

### Stock crítico

- **Grinders plásticos**: 2 uds por color por almacén (6 totales). Stock bajo.
- **Conos / Filtro Carbón / Frutos del Bosque (sabor)**: 0 en almacén virtual "Venezuela", solo en los 3 distribuidos.
- **Productos draft**: Bongs + Pipas todos en 0 (sin fotos/descripciones terminadas).

---

## 10. Sistema de lealtad (Club Enrola)

### Backend (módulo `loyalty`)

- **Modelo `LoyaltyReward`**: `id`, `name`, `description`, `points_required`, `image_url`, `is_active`, `stock`
- **Modelo `LoyaltyTransaction`**: `id`, `customer_id`, `points` (+/−), `type`, `order_id?`, `reward_id?`, `description?`
- **Servicio**: `getCustomerPoints(customerId)` → suma del ledger

### Mecánica

- **10 puntos por cada $1** gastado (subscriber `award-loyalty-points.ts` en `order.placed`).
- **Canje en checkout**: se seleccionan rewards, se descuentan puntos antes de completar la orden; si el complete falla, se reversan (DELETE `/api/cuenta/loyalty/redeem`).
- Admin UI en `/admin/loyalty` para CRUD de rewards.

### Frontend

Tab "Club" en `/cuenta` — puntos totales + histórico (últimas 30 transacciones) + catálogo canjeable.

---

## 11. Remarketing y jobs automáticos

Sistema completo de campañas recurrentes (email + WhatsApp) con:
- **Tabla `remarketing_log`** (dedupe por tipo + recipient + reference_id, índices compuestos)
- **Tabla `remarketing_settings`** (KV jsonb por campaña)
- **Helpers** `logEmail`, `wasRecentlySent`, `alreadyNotified`, `applyGeoOverrides`

### 9 campañas activas

| Job | Disparo | Audiencia |
|---|---|---|
| **Abandoned cart** | cada 2h | Carts sin convertir (dedupe 48h) |
| **Birthday** | diario 9am | Customers en su cumpleaños |
| **Graduation** | diario 10am | Customers Telegram/WhatsApp sin compra web |
| **Pending payment** | cada hora | Órdenes con pago pendiente (dedupe 7d) |
| **Post-purchase** | diario 11am | Customers 3 días tras delivered |
| **Restock** | diario 12pm | Reposición basada en cadencia del producto |
| **Stockout alert** | diario 9:30am | Cohortes cuando SKU cae bajo days-of-cover crítico |
| **Welcome** | subscriber `customer.created` | Nuevos clientes (email + WhatsApp si consienten) |
| **Win-back** | lunes 10am | Customers sin compra >60 días |

### Templates

- **Email**: templates HTML en `lib/email-service.ts` (26KB), identidad visual cream/crimson/olive/Kanit con helper `withUtm()` para tracking
- **WhatsApp**: templates cortos en `lib/whatsapp-templates.ts`

### Admin

Ruta `/admin/remarketing` — stats por campaña + settings editables.

---

## 12. Admin dashboard

### Rutas Medusa Admin custom (`src/admin/routes/`)

| Ruta | Propósito |
|---|---|
| **Analytics** | Dashboard con filtros (today/week/month/year), ventas/órdenes/FX, funnel `/venta` |
| **Loyalty** | CRUD recompensas |
| **Newsletter** | Estado Listmonk (subs, listas, campañas) |
| **Orders Live** | Monitor órdenes tiempo real con refresh |
| **Remarketing** | Config + métricas |
| **Webmail** | Cliente IMAP/SMTP embebido (auth, folders, messages, flags, reply, move) |
| **WhatsApp Bot** | Dashboard + conversaciones + config |

### Widgets

- **Maintenance toggle** (global)
- **Order payment proof** (detalle de orden) — muestra `metadata.payment_proof_url`
- **Order rewards** (detalle de orden) — rewards canjeados
- **Product slider image** (detalle de producto)
- **RYO branding** (global/dashboard) — logo SVG inline, CSS custom, paleta

---

## 13. Integraciones externas

| Integración | Uso | Acceso |
|---|---|---|
| **Medusa Store API** | Backend principal | `https://api.enrola.shop` + header `x-publishable-api-key` |
| **Medusa Admin** | Dashboard | `https://enrola.shop/dashboard` |
| **NextAuth** | Auth storefront | Credentials + Google OAuth |
| **WaSenderAPI** | WhatsApp (enviar/recibir, decrypt-media) | `wasenderapi.com` |
| **DeepSeek V3** | LLM bot WA | `api.deepseek.com/chat/completions` |
| **Groq Whisper** | Transcripción audio | `api.groq.com/openai/v1/audio/transcriptions` |
| **Telegram Bot API** | Gestión de órdenes | `api.telegram.org/bot<TOKEN>/*` |
| **Meta Graph API v21** | Instagram DMs (stand-by) | `graph.facebook.com` |
| **Google Maps** | Geocoding + Places Autocomplete | Browser SDK + server API |
| **Google OAuth** | Login social | `accounts.google.com` |
| **reCAPTCHA v3** | Protección formulario contacto | `google.com/recaptcha` |
| **Resend** | Emails transaccionales | `api.resend.com` |
| **Listmonk** | Newsletter / suscriptores | `newsletter.enrola.shop` (interno `http://listmonk:9000`) |
| **BCV EUR rate** | Conversión a Bs | Cascada: elcamb.io → bcvapi.tech → api-bcvcurs → env fallback |
| **Binance P2P** | USDT/Bs | `api.alcambio.app/graphql` |
| **pydolarve.org** / `ve.dolarapi.com` | BCV para bot WA | Cache 10min |
| **Google Analytics 4** | Tracking | `G-BP5HL3X1WH` (env `NEXT_PUBLIC_GA4_MEASUREMENT_ID`) |

---

## 14. Seguridad / notas operativas

### Secretos en DB vs env

La mayoría de credenciales del bot/Instagram/Telegram viven en **`wa_bot_config`** (no en env) para que sean editables desde la UI admin. Ventaja: edición sin redeploy. Desventaja: backups de DB contienen secretos en claro.

### CORS

Configurado vía env (`STORE_CORS`, `ADMIN_CORS`, `AUTH_CORS`). El storefront usa rutas Next `/api/*` como proxy → no hay CORS cliente↔Medusa.

### Acceso al VPS

SSH por clave (no password). Clave configurada para el usuario `root`.

### Publishable key del frontend

`pk_a277839f...` commiteada en `.env.local`. Es diseño Medusa: es pública, scopeada al sales channel. Sin riesgo.

### Uploads de comprobantes

Guardados en `public/uploads/payment-proofs/` dentro del contenedor Next. **Volumen `payment_proofs` montado** en el compose → persisten entre rebuilds.

Los del bot WA se guardan en `backend/static/wa-proofs/` (volumen `medusa_uploads`).

### Bot Telegram sin autenticación

Cualquiera en el grupo `-1003636474581` puede ejecutar `/venta` o apretar botones. Si un miembro se va del equipo pero sigue en el grupo, mantiene acceso total. **Riesgo medio** — mitigable con una whitelist de `user.id`.

### reCAPTCHA

Solo en `/contacto`. Checkout usa honeypot + time check (>3s).

### Maintenance mode

Flag global en `wa_bot_config.maintenance_mode`. El middleware del storefront cachea 15s. El bot WA también lo respeta.

---

## 15. Hallazgos y deuda técnica

### Bugs / gaps identificados

1. **Telegram no recibe órdenes del sitio web**: el mensaje con botones de gestión solo se dispara desde `submit_order` del bot WhatsApp. Las órdenes del storefront sólo mandan WhatsApp al dueño + email. **Fix**: convertir `sendTelegramNotification` en subscriber `order.placed`.

2. **Discrepancia USD/EUR**: región activa es USD pero bot y storefront hablan de €. Los precios están duplicados en `price` para ambas monedas, pero sólo una se asocia al price_set activo. **Fix**: unificar criterio (o cambiar región a EUR, o traducir consistentemente en UI).

3. **Combos no son Promotions reales de Medusa**: los tiers 3+/5+/10+/24+ están hardcoded en el storefront (`combo-tiers.ts`) y en el bot WA. El descuento es puramente visual; Medusa no lo aplica al total. **Fix**: crear Promotions automáticas con reglas `item_count >= 3/5/10/24`.

4. **`/venta` sin autorización**: cualquier miembro del grupo Telegram puede disparar órdenes que capturan pago e inventario. Añadir whitelist de `from.id`.

5. **Fallback region ID hardcoded**: `reg_01KKKY6BGV511PKKHK3WRK3VN8` en `src/lib/medusa.ts:74`. Si cambia la región se rompe el storefront.

6. **`telegram_command_log` no existe aún**: la tabla se crea lazy al primer error/éxito de `/venta`. El dashboard analytics ya la consume — verificar que se haya creado al menos una vez.

7. **Instagram DM apagado**: tablas e infra listas, sólo falta configurar `ig_business_id`, `meta_page_token`, `meta_app_secret` en `wa_bot_config`.

8. **Media del WA en contenedor**: los comprobantes (`backend/static/wa-proofs/`) están en volumen `medusa_uploads` — persisten, pero no hay rotación ni backup externo.

9. **Helpers paralelos DB vs Modules**: la mayoría de subscribers, jobs y rutas usan `pg.Pool` con SQL crudo (bypass de los módulos Medusa). Justificado en comentarios por temas de unidades/centavos, pero aumenta el riesgo de que cambios al schema core rompan queries sin tests.

10. **No hay tests automatizados** visibles en el proyecto (`package.json` no lista Jest/Vitest).

### Nice-to-haves

- **Subscriber `order.placed` unificado** que dispare Telegram + email + WhatsApp (hoy están dispersos).
- **Payment provider real** (Mercado Pago, Binance Pay, zinli) en lugar de pago manual.
- **Backup automático de DB** (pg_dump diario a S3/Backblaze).
- **Rate limiting** en el webhook de WhatsApp (prevenir spam/abuso).
- **Observabilidad**: Sentry para errores + Prometheus/Grafana para métricas.
- **Schema de migraciones versionadas** (hoy es `ensureTables` lazy).

---

## Archivos de referencia rápida

### Backend
- `/root/ryo-store/docker-compose.yml`
- `/root/ryo-store/backend/medusa-config.ts`
- `/root/ryo-store/backend/src/api/webhooks/telegram/route.ts` — Bot Telegram
- `/root/ryo-store/backend/src/api/webhooks/whatsapp/route.ts` — Bot WhatsApp webhook
- `/root/ryo-store/backend/src/lib/whatsapp-bot.ts` — LLM (59KB)
- `/root/ryo-store/backend/src/lib/whatsapp-db.ts` — DAO bot
- `/root/ryo-store/backend/src/lib/email-service.ts` — Templates
- `/root/ryo-store/backend/src/modules/loyalty/` — Módulo lealtad
- `/root/ryo-store/backend/src/subscribers/` — 8 handlers
- `/root/ryo-store/backend/src/jobs/` — 9 jobs

### Storefront
- `/root/ryo-store/storefront/src/app/checkout/page.tsx` — Checkout (1282 líneas)
- `/root/ryo-store/storefront/src/app/cuenta/page.tsx` — Dashboard cuenta (767 líneas)
- `/root/ryo-store/storefront/src/lib/medusa.ts` — Cliente Medusa público
- `/root/ryo-store/storefront/src/lib/medusaAuth.ts` — Helpers auth
- `/root/ryo-store/storefront/src/context/CartContext.tsx` — Cart state
- `/root/ryo-store/storefront/src/lib/combo-tiers.ts` — Lógica combos
- `/root/ryo-store/storefront/src/middleware.ts` — Maintenance mode
- `/root/ryo-store/storefront/src/auth.ts` — NextAuth config

### Docs relacionadas
- `docs/PASO-A-PASO-DEPLOY.md` — deploy paso a paso
- `docs/CHECKOUT-PAGO-MOVIL.md` — Pago Móvil
- `docs/PRECIOS-MEDUSA-ADMIN.md` — precios
- `docs/SEO-GSC-GA4-SETUP.md` — SEO
- `docs/BUSQUEDA-SUGERENCIAS.md` — search
- `docs/ENROLA-LEGENDS-SESSION-CONTEXT.md` + `docs/GDD-ENROLA-LEGENDS.md` — juego
