# Enrola Blueprint — Whitelabel E-commerce Stack

Plantilla completa para lanzar un e-commerce con el stack técnico de Enrola.
Fork este repo, cambia la marca con el script automatizado, y tendrás un
e-commerce con 40+ features custom listo para deploy.

**Stack:** Medusa v2 + Next.js 16 + Postgres + Traefik + Docker Compose
**Mantenido en:** ~5-10 h de setup para una marca nueva (asumiendo tienes servicios externos listos).

---

## 📦 Qué incluye el blueprint

### Backend (Medusa v2 + 15 módulos/librerías custom)

**Core:**
- Medusa v2.13 con productos, colecciones, variants, inventory multi-location
- Módulo `loyalty` (puntos + rewards)
- Módulo `seo-analytics` (13 tablas, integración GSC/GA4/CrUX/Umami/PostHog)
- PostgreSQL con migrations + backups

**Admin dashboard custom (3 entradas laterales):**
- 🏪 **SEO Analytics** (6 tabs): Overview unificado, Keywords, Páginas, Venezuela, Oportunidades, Salud Técnica
- 🔧 **DEV** (6 tabs): Cron Jobs, Feature Flags, Errors, LLM Observability, Services Health, Deploy
- 🔗 **Tools** (68 deep-links a servicios externos)
- Plus: Newsletter (Listmonk), Loyalty, Analytics básico

**Cron jobs (15 automatizaciones):**
- `seo-gsc-sync`, `seo-ga4-sync`, `seo-cwv-sync`, `seo-sitemap-check`, `seo-alerts-compute`, `seo-monthly-snapshot`
- `abandoned-cart`, `birthday-emails`, `graduation`, `pending-payment`, `post-purchase`, `restock`, `stockout-alert`, `whatsapp-session-cleanup`, `win-back`
- Wrapper `wrapJob()` que loggea cada ejecución en `job_run` para observabilidad

**APIs admin custom (30+ endpoints):**
- `/admin/seo/*` — 14 endpoints de SEO
- `/admin/dev/*` — 6 endpoints de ops
- `/admin/loyalty/*`, `/admin/maintenance/*`, `/admin/newsletter/*`, `/admin/orders-live/*`, `/admin/remarketing/*`, `/admin/webmail/*`, `/admin/whatsapp/*`, `/admin/analytics/*`

**Subscribers (event handlers):**
- `order.placed` → PostHog event + email confirmación + WhatsApp notify
- `order.paid` → loyalty points awarded
- `customer.created` → Listmonk newsletter signup + welcome email
- `order.fulfilled` → shipping notifications

**Librerías custom (`backend/src/lib/`):**
- `email-service.ts` (Resend wrapper con templates)
- `whatsapp-bot.ts` (bot conversacional con DeepSeek + tool calls para pricing/orders)
- `whatsapp-templates.ts`, `whatsapp-db.ts`, `whatsapp-wa.ts` (WhatsApp Business API)
- `seo-*` (GSC/GA4/CrUX/Umami/PostHog/Autocomplete clients)
- `fx-rates.ts` (conversión BCV EUR/USD/USDT → bolívares)
- `combo-tiers.ts` (descuentos por volumen)
- `job-runner.ts` + `job-registry.ts` (observabilidad cron)
- `llm-observability.ts` (tracking costo LLM a PostHog)
- `remarketing-db.ts`, `remarketing-wa.ts` (campañas automatizadas)

### Storefront (Next.js 16 App Router)

**Core pages:**
- `/` home con hero, bestsellers, upsell
- `/tienda` catálogo con filtros
- `/productos/[slug]` PDP con variants, combo tier info, cross-sell
- `/carrito` + cart drawer overlay
- `/checkout` one-page checkout con pago manual (upload comprobante)
- `/cuenta`, `/login`, `/registro`, `/recuperar` auth
- `/blog`, `/arma-tu-combo`, `/bundles`, `/contacto`, `/faq`, `/terminos`, `/privacidad`, `/devoluciones`, `/mayoristas`
- `/seguimiento` tracking de orden
- `/juego` gamification extra
- `/mantenimiento` maintenance mode page

**Componentes custom (60+):**
- `<ComboTierBanner>`, `<ComboToast>` (descuentos por volumen)
- `<CartDrawer>` sliding cart
- `<AddressAutocomplete>` (Google Places para VE)
- `<WhatsAppPhoneInput>` (validación VE)
- `<AgeGate>` (+18 gate)
- `<UtmCapture>` (UTM → cookie → order metadata)
- `<QuickView>` (modal de producto)
- `<CostCalculator>` (costo por sesión para consumibles)
- `<UpsellSection>`, `<BestSellerSection>`, `<HeroBanner>`, `<FooterSection>`
- `<PosthogIdentify>` (auto-identify post-login)
- `<MaintenanceToggle>` (admin widget)

**Analytics tags instalados:**
- Google Analytics 4 (gtag.js)
- Umami (self-hosted, script.js)
- Microsoft Clarity (heatmaps + replay)
- PostHog (events + flags + errors + LLM)
- Auto-captura de `$pageview`, `$autocapture`, `$exception` (PostHog)
- Custom events: `product_viewed`, `add_to_cart`, `cart_viewed`, `checkout_started`, `checkout_step_completed`, `payment_method_selected`, `payment_proof_uploaded`, `order_placed`

**SEO built-in:**
- Sitemap.xml dinámico
- robots.ts
- Metadata generation por producto
- JSON-LD Organization + Website + Product schemas
- Canonical URLs + OpenGraph + Twitter cards
- Favicon multi-resolution

**Integraciones externas:**
- Resend (emails transaccionales + marketing)
- Listmonk (newsletter manager)
- Google Places API (autocomplete)
- DeepSeek (LLM del bot WhatsApp)
- Groq (Whisper STT para audio WhatsApp)

---

## 🌐 Servicios externos requeridos

Antes de deployar necesitas cuentas en:

| Servicio | Tier | Costo | Para qué |
|---|---|---|---|
| **Hostinger VPS** (o similar) | KVM 2 / 8GB RAM | ~$10/mes | Host Docker stack |
| **Dominio + Cloudflare** | Gratis | ~$12/año | DNS + cert + CDN |
| **Resend** | Free 3k/mo | $0 | Emails transaccionales |
| **Google Cloud** | Free tier | $0 | Service Account (GSC/GA4/CrUX APIs) |
| **Google Analytics 4** | Free | $0 | Attribution |
| **Google Search Console** | Free | $0 | SEO tracking |
| **Microsoft Clarity** | Free unlimited | $0 | Heatmaps + session replay |
| **PostHog Cloud** | Free 1M events/mo | $0 | Product analytics + flags + errors |
| **DeepSeek API** | Pay-per-use | ~$0.27/1M tokens | WhatsApp bot LLM |
| **Groq API** | Free tier | $0 | Whisper STT audio WhatsApp |
| **WhatsApp Business API** | Meta free | $0 | Bot WhatsApp |
| **Traefik** | Self-host | $0 | Reverse proxy + TLS |

**Opcional:**
- DataForSEO ($20-50/mo) — volumen absoluto de keywords
- SerpAPI ($50/mo) — rank tracking de competidores
- Binance Pay merchant — cripto
- MercadoLibre Partner — marketplace sync

---

## 🚀 Rebrand desde Enrola a "tu marca" — proceso

### 1. Clonar y preparar

```bash
# Fork este repo en GitHub como "mi-ecommerce-blueprint"
git clone <tu-fork>.git mi-tienda
cd mi-tienda
```

### 2. Configurar `blueprint.config.yml`

Copia la plantilla y edita:

```bash
cp docs/blueprint.config.example.yml blueprint.config.yml
$EDITOR blueprint.config.yml
```

Rellena al menos:
- `brand.name` — tu marca
- `brand.domain` — tu dominio
- `brand.email.contact` — email principal
- `brand.colors.*` — colores del brand
- `market.country` — país de operación
- `market.currency` — moneda

Ver `docs/BLUEPRINT-REBRAND.md` para la lista completa de variables.

### 3. Correr el script de rebrand

```bash
./scripts/rebrand.sh blueprint.config.yml
```

Esto hace:
1. Find/replace case-insensitive en todos los archivos `*.ts|*.tsx|*.json|*.yml|*.md|*.env`
2. Rename de directorios y assets con el nombre de marca
3. Actualiza docker-compose.yml con nuevos nombres de containers y dominios
4. Regenera `storefront/src/config/brand.ts` desde la config
5. Log de cambios en `docs/REBRAND-LOG.md`

### 4. Preparar servicios externos

Sigue `docs/SEO-ANALYTICS-GOOGLE-SETUP.md` para crear:
- Google Cloud Service Account
- GSC property
- GA4 property
- CrUX API key

Plus crear cuentas en: Resend, PostHog Cloud, Microsoft Clarity, Cloudflare DNS.

### 5. Configurar `.env` del VPS

Usar `docs/BLUEPRINT-ENV.example` como plantilla. Cada variable explicada.

### 6. Deploy inicial

```bash
# En el VPS
cd /root/mi-tienda
docker compose build
docker compose up -d
docker exec <medusa-container> npx medusa user -e admin@mi-tienda.com -p <password>
docker exec <medusa-container> npx medusa db:migrate
docker exec <medusa-container> npx medusa exec ./src/scripts/seed.js
docker exec <medusa-container> npx medusa exec ./src/scripts/seed-seo-analytics.js  # starter competitors + keywords
```

### 7. Verificar (15 min checklist)

- [ ] `https://tu-dominio.com` carga
- [ ] `https://api.tu-dominio.com/health` responde 200
- [ ] Admin en `https://tu-dominio.com/dashboard` — login OK
- [ ] Sidebar muestra 🏪 SEO Analytics + 🔧 DEV + 🔗 Tools
- [ ] `https://analytics.tu-dominio.com` — Umami login `admin`/cambiar password
- [ ] GA4 recibe pageviews (ver Realtime)
- [ ] PostHog recibe eventos (check Persons)
- [ ] Tab "🔧 DEV → Services Health" — todos UP
- [ ] Crear producto de prueba + completar orden de prueba

---

## 📐 Arquitectura

```
┌─ tu-dominio.com ──────────────────────────────────────────────┐
│                                                               │
│  /           → Next.js storefront (PDP, checkout, blog)       │
│  /dashboard  → Medusa admin SPA                               │
│  /admin/*    → Medusa admin API (proxy a medusa container)    │
│                                                               │
├─ api.tu-dominio.com ──────────────────────────────────────────┤
│  /store/*    → Medusa storefront API (product, cart, order)   │
│  /admin/*    → Medusa admin API (SEO, DEV, Tools, etc.)       │
│  /bot/*      → WhatsApp bot webhook                           │
│                                                               │
├─ analytics.tu-dominio.com ────────────────────────────────────┤
│  Umami self-hosted                                            │
│                                                               │
└───────────────────────────────────────────────────────────────┘
         │                     │                     │
         ▼                     ▼                     ▼
   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
   │   Next.js    │   │   Medusa     │   │   Umami      │
   │   Storefront │   │   Backend    │   │              │
   └──────────────┘   └──────────────┘   └──────────────┘
         │                     │                     │
         └─────────┬───────────┴──────────┬──────────┘
                   ▼                      ▼
            ┌─────────────┐        ┌─────────────┐
            │ PostgreSQL  │        │   Redis     │
            │  (shared)   │        │  (shared)   │
            └─────────────┘        └─────────────┘
                   │
                   ├── medusa    (core tables)
                   ├── listmonk  (newsletter)
                   └── umami     (analytics)

External:
  Google APIs (GSC, GA4, CrUX) ── Service Account
  PostHog Cloud ────────────── Project + Personal API keys
  Microsoft Clarity ────────── Project token (cloud)
  Resend ───────────────────── API key
  DeepSeek ─────────────────── API key (bot LLM)
  Cloudflare ───────────────── DNS management
```

---

## 📁 Estructura del repo

```
mi-tienda/
├── backend/                    # Medusa v2
│   ├── src/
│   │   ├── admin/
│   │   │   ├── routes/         # Admin UI custom (seo, dev, tools, etc.)
│   │   │   └── widgets/        # Admin UI widgets
│   │   ├── api/
│   │   │   ├── admin/          # Admin REST endpoints
│   │   │   ├── store/          # Store REST endpoints
│   │   │   └── webhooks/       # External webhooks
│   │   ├── jobs/               # 15 cron jobs
│   │   ├── lib/                # Shared libs
│   │   ├── modules/            # Custom Medusa modules (loyalty, seo-analytics)
│   │   ├── scripts/            # CLI scripts (seed, backfill, etc.)
│   │   └── subscribers/        # Event handlers
│   ├── medusa-config.ts
│   ├── Dockerfile
│   └── package.json
│
├── storefront/                 # Next.js 16 App Router
│   ├── src/
│   │   ├── app/                # Routes (file-based)
│   │   ├── components/         # UI components (60+)
│   │   ├── context/            # React context (cart, quickview)
│   │   ├── lib/                # Utils (brand, seo, posthog, price, etc.)
│   │   └── config/
│   │       └── brand.ts        # ⭐ Centralized brand config
│   ├── public/                 # Static assets (logo, favicon, etc.)
│   └── package.json
│
├── listmonk-static/            # Newsletter assets
├── docs/                       # All documentation
│   ├── BLUEPRINT.md            # This file
│   ├── BLUEPRINT-REBRAND.md    # Detailed rebrand checklist
│   ├── BLUEPRINT-ENV.example
│   ├── SEO-ANALYTICS.md        # Feature manual
│   ├── SEO-ANALYTICS-SPEC.md   # Technical spec
│   └── ... (deployment + troubleshooting guides)
│
├── scripts/
│   ├── rebrand.sh              # ⭐ Automated rebrand
│   └── ... (deploy helpers)
│
├── docker-compose.yml          # 5 services: postgres, redis, medusa, storefront, umami, listmonk
├── blueprint.config.yml        # ⭐ Single source of truth for brand config (NOT in git by default)
└── blueprint.config.example.yml
```

---

## 🎨 Centralized brand config

Para evitar que los valores se dispersen por todo el código, el storefront lee
la marca desde UN solo archivo: `storefront/src/config/brand.ts`.

Incluye:
- Nombre, tagline, idioma
- Colores + tokens de diseño
- Emails, teléfonos, redes sociales
- URLs (main, api, analytics)
- Feature flags (qué módulos habilitar)
- Copy (strings que cambian entre marcas)
- Payment methods disponibles
- Shipping options configurables

El rebrand script regenera este archivo desde `blueprint.config.yml` cada vez.

---

## 📋 Feature toggles — activa/desactiva módulos

Algunos features de Enrola son específicos del nicho (smoke shop en Venezuela).
Para otras marcas pueden no aplicar. Toggles disponibles en `brand.ts`:

| Feature | Toggle | Descripción |
|---|---|---|
| Combo tiers (descuentos por volumen) | `features.comboTiers` | 3→10%, 5→15%, 10→20% + wholesale 24+ |
| Age gate (+18) | `features.ageGate` | Verificación de edad en primera visita |
| BCV rate (bolívares) | `features.bcvRate` | Conversión USD/EUR → VES para VE |
| Pago manual (transferencia + upload) | `features.manualPayment` | Pago Móvil / Zelle / Binance para VE |
| Loyalty points | `features.loyalty` | Sistema de puntos + rewards |
| WhatsApp bot | `features.whatsappBot` | Bot conversacional con LLM |
| UTM capture → order metadata | `features.utmTracking` | Atribución de marketing |
| Telegram integration | `features.telegram` | Webhooks Telegram |
| Enrola Legends (juego) | `features.gamification` | Sistema de gamificación |
| Newsletter (Listmonk) | `features.newsletter` | Sign-up + campañas |
| Stockout remarketing | `features.stockoutAlerts` | Alerta preventiva a clientes |

Feature OFF = las rutas/componentes/jobs asociados no se cargan y el código queda dormant.

---

## 📞 Contacto / soporte

- Docs completa: `docs/`
- Issues: GitHub del fork
- Blueprint original mantenido por: Daniel López (autor de Enrola)
- Versiones probadas: Node 20, Medusa 2.13.1, Next.js 16.2

---

## 📝 Changelog del blueprint

**v1.0 (2026-04-22)** — Primera release del blueprint extraído de Enrola en producción:
- 40+ features custom catalogados
- Script de rebrand automatizado
- Centralización de brand config
- Toggle de features condicionales
- Docs end-to-end
