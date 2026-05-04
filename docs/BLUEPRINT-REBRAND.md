# Rebrand Checklist — Enrola Blueprint → Tu marca

Esta guía detalla **cada lugar** donde el código tiene referencias hardcoded
a "Enrola" o "RYO" y cómo reemplazarlas. El script `scripts/rebrand.sh` hace
la mayoría automáticamente; esta checklist es para verificar + casos edge.

---

## 📋 Inventario de brand coupling

Después de auditoría, hay ~200 archivos con referencias a la marca en:

| Categoría | # archivos | Autómatico via script? |
|---|---|---|
| Strings "Enrola" / "ENROLA" / "enrola" | 193 | ✅ sí |
| Strings "RYO" / "ryo" / "ryo-store" | 24 | ✅ sí |
| Dominios (`enrola.shop`, `analytics.enrola.shop`, `api.enrola.shop`) | 40 | ✅ sí |
| Emails (`hola@enrola.shop`, `CONTACT_EMAIL`) | 15 | ✅ sí |
| IDs de servicios (GA4, Umami, Clarity, PostHog) | 8 | ⚠️ manual con nuevos IDs |
| Assets (logo, favicon, mascota) | ~15 | ⚠️ manual (reemplazar archivos) |
| Colores / design tokens (CSS + Tailwind) | ~10 | ⚠️ manual |
| Copy específico del nicho (smoking, rolling papers) | ~30 | ⚠️ revisar uno por uno |
| Venezuela-specific (BCV, bolívares, cedula) | 30 | 🔌 feature flag OFF si no aplica |
| Nombres de containers Docker | 1 | ✅ sí |

---

## Parte 1 — Auto-reemplazables (via `scripts/rebrand.sh`)

Edita `blueprint.config.yml` y corre el script. Los siguientes se reemplazan
por todo el repo con regex case-preserving:

### 1.1 Nombres

| From | To | Encontrado en |
|---|---|---|
| `Enrola` | `${brand.name}` | Copy UI, metadata, emails |
| `ENROLA` | `${brand.name | uppercase}` | Logos ASCII, constantes |
| `enrola` | `${brand.slug}` | Paths, IDs, variables |
| `Enrola Shop` | `${brand.fullName}` | Store name, titles |
| `Ryo Store` / `RYO Store` / `RYO` | `${brand.fullName}` | Restos del rename anterior |
| `ryo-store` | `${brand.slug}-store` | Docker, filenames |

### 1.2 Dominios

| From | To |
|---|---|
| `enrola.shop` | `${brand.domain}` |
| `api.enrola.shop` | `api.${brand.domain}` |
| `analytics.enrola.shop` | `analytics.${brand.domain}` |
| `https://enrola.shop` | `${brand.baseUrl}` |

### 1.3 Emails

| From | To |
|---|---|
| `hola@enrola.shop` | `${brand.email.contact}` |
| `noreply@enrola.shop` | `${brand.email.noreply}` |
| `ventas@enrola.shop` | `${brand.email.sales}` |

### 1.4 Docker

| From | To |
|---|---|
| `ryo-store-medusa-1` | `${brand.slug}-medusa-1` |
| `ryo-store-storefront-1` | `${brand.slug}-storefront-1` |
| `ryo-store-postgres-1` | `${brand.slug}-postgres-1` |
| `ryo-store-redis-1` | `${brand.slug}-redis-1` |
| `ryo-store-umami-1` | `${brand.slug}-umami-1` |
| `ryo-store-listmonk-1` | `${brand.slug}-listmonk-1` |

---

## Parte 2 — Manual (requiere decisiones tuyas)

### 2.1 Assets gráficos

Reemplazar archivos físicos en:

```
storefront/public/
  ├── favicon.svg          ← tu favicon SVG (multi-resolución)
  ├── favicon-ryo.png      ← renombrar + reemplazar
  ├── logo-naranja.svg     ← tu logo principal
  ├── logo-nuevo.svg       ← tu logo alt
  ├── bichito.svg          ← mascota/ilustración (opcional)
  └── ...

storefront/src/app/
  ├── icon.png             ← 512x512 PNG (Next.js auto-detecta)
  ├── apple-icon.png       ← 180x180 Apple touch
  └── favicon.ico          ← multi-tamaño ICO
```

**Script helper para regenerar favicon.ico desde icon.png:**

```bash
python3 <<EOF
from PIL import Image
img = Image.open('storefront/src/app/icon.png').convert('RGBA')
sizes = [(16,16),(24,24),(32,32),(48,48),(64,64),(96,96),(128,128),(256,256)]
img.save('storefront/src/app/favicon.ico', format='ICO', sizes=sizes)
print('✓ favicon.ico regenerated')
EOF
```

### 2.2 Colores y tokens de diseño

**`storefront/src/app/globals.css`** — CSS custom properties:
```css
:root {
  --primary: #ff3b27;      ← tu color principal
  --secondary: #2a2d34;    ← color de acento
  --dark: #1a1a1a;
  --cream: #fef9f4;        ← fondo claro
  --orange: #ff7a00;       ← accent vivo
  --muted: #6b6b6b;
}
```

**`storefront/tailwind.config.js`** — colores custom:
```js
theme: {
  extend: {
    colors: {
      primary: "#ff3b27",
      secondary: "#2a2d34",
      // ...
    }
  }
}
```

**`storefront/tailwind.css`** — clases utility custom del tema.

### 2.3 Fonts

Si usas fuente custom: `storefront/Kanit/` — reemplaza o cambia a otra.

### 2.4 Copy específico del nicho

Estos strings están hardcoded en componentes y reflejan Enrola (smoke shop VE).
Revisar caso por caso:

**Homepage:**
- `storefront/src/app/page.tsx` — hero copy
- `storefront/src/components/HeroBannerSection.tsx` — banner principal

**Categories/tienda:**
- `storefront/src/app/tienda/page.tsx` — headings + copy
- Menciones de "rolling papers", "grinders", "papel para fumar", "parafernalia"

**FAQ:**
- `storefront/src/app/faq/page.tsx` — 100% rewrite (preguntas específicas del nicho)

**Legales:**
- `storefront/src/app/terminos/page.tsx`
- `storefront/src/app/privacidad/page.tsx`
- `storefront/src/app/devoluciones/page.tsx`
- Revisar jurisdicción, leyes aplicables, disclaimers

**Contact:**
- `storefront/src/app/contacto/page.tsx` — social handles hardcoded (@ryo.smoke, @enrola)

**Blog:**
- `storefront/src/app/blog/*` — posts específicos al nicho; borrar y crear nuevos

**Juego (gamification):**
- `storefront/src/app/juego/*` — Enrola Legends specific; desactivar vía `features.gamification=false`

**WhatsApp bot system prompt:**
- `backend/src/lib/whatsapp-bot.ts` buscar `SYSTEM_PROMPT` o constantes con el prompt. Rewrite completo al nicho de la nueva marca.

**Email templates:**
- `backend/src/lib/email-service.ts` — templates HTML con copy
- Subject lines específicos del nicho

### 2.5 Feature flags a decidir

En `blueprint.config.yml` decide qué mantener:

```yaml
features:
  comboTiers: true            # Descuentos por volumen (útil para consumibles)
  ageGate: false              # +18 gate (solo si vendes productos para adultos)
  bcvRate: false              # Bolívares (solo VE)
  manualPayment: false        # Pago Móvil/Zelle/Binance (solo VE)
  loyalty: true               # Puntos + rewards
  whatsappBot: false          # Bot conversacional con LLM
  telegram: false             # Telegram webhook
  gamification: false         # Juego custom (muy específico a Enrola)
  newsletter: true            # Listmonk sign-ups
  stockoutAlerts: true        # Remarketing preventivo
  utmTracking: true           # UTM → order metadata
```

OFF = el módulo/ruta/componente se deshabilita y el código queda dormant sin errores.

### 2.6 Productos y categorías

Los seeds de productos en `backend/src/scripts/seed.ts` son específicos del nicho:
- Rolling papers, grinders, pipas, filtros, conos, etc.

**Opciones:**
- **a)** Correr `seed.ts` original y luego limpiar + crear productos reales vía admin
- **b)** Reescribir `seed.ts` con tus productos
- **c)** Importar desde CSV/JSON si tienes catálogo existente

Recomendado: correr seed mínimo (solo categorías genéricas) y crear productos vía admin/import.

### 2.7 Shipping options

Las shipping options en Enrola son VE-específicas:
- `Inmediato (Valencia) - Gratis`
- `Inmediato (Valencia) - $3`
- `MRW - Cobro a destino`

**Rehacer en:**
- `backend/src/scripts/add-venezuela-shipping.ts` (renombrar archivo a `add-<tu-pais>-shipping.ts`)
- Adaptar: nombre de ciudad, precios, región, carriers

### 2.8 Payment options

Enrola usa pago manual con upload de comprobante. Configurar en:
- `storefront/src/app/checkout/page.tsx` — formulario
- Imágenes `pago-movil-qr.png`, etc. — reemplazar QRs
- Copy en checkout describiendo los métodos

**Si usas payment provider real (Stripe/Paypal):**
- Instalar módulo Medusa correspondiente
- Desactivar upload de comprobante custom

### 2.9 Competidores (SEO Analytics)

Los 10 competidores pre-cargados en el seed son smoking-VE:
- `backend/src/scripts/seed-seo-analytics.ts` — array `COMPETITORS` — **borrar todos** y poner los tuyos

### 2.10 Starter keywords

Similar — `STARTER_KEYWORDS` en el mismo archivo. Reemplazar por queries de tu nicho.

### 2.11 Cedula/phone validation (VE-specific)

Si NO estás en Venezuela:
- Desactivar `features.bcvRate`
- Buscar validaciones de cédula en `storefront/src/components/form/` y reemplazar
- Buscar `+58` en componentes de teléfono y cambiar código de país

---

## Parte 3 — IDs de servicios externos

Estos requieren crear cuentas nuevas y actualizar env vars (NO se pueden auto-replacear):

### `.env` en VPS (copy de `docs/BLUEPRINT-ENV.example`)

```bash
# Google Service Account (rehacer según SEO-ANALYTICS-GOOGLE-SETUP.md)
GSC_PROPERTY=sc-domain:tu-dominio.com
GA4_PROPERTY_ID=XXXXXXXXX                # tu nuevo GA4 ID
GOOGLE_SERVICE_ACCOUNT_EMAIL=seo-analytics@tu-proyecto.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_KEY_BASE64=...    # tu nuevo JSON key base64
CRUX_API_KEY=...                         # nuevo API key

# Analytics tags
NEXT_PUBLIC_GA4_MEASUREMENT_ID=G-XXXXX   # tu nuevo GA4 measurement ID
NEXT_PUBLIC_CLARITY_ID=xxxxxxxx          # tu nuevo Clarity project ID

# Umami — crear website tras deploy
NEXT_PUBLIC_UMAMI_WEBSITE_ID=<uuid>      # post-deploy via API
UMAMI_WEBSITE_ID=<uuid>                  # igual
UMAMI_APP_SECRET=<openssl rand base64 32>
UMAMI_USERNAME=admin
UMAMI_PASSWORD=<cámbialo post-deploy>

# PostHog
POSTHOG_PROJECT_ID=XXXXXX
POSTHOG_PROJECT_API_KEY=phc_...
POSTHOG_PERSONAL_API_KEY=phx_...
NEXT_PUBLIC_POSTHOG_KEY=phc_...
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com  # o eu

# Resend
RESEND_API_KEY=re_...

# DeepSeek (si usas WhatsApp bot con LLM)
# Ya se configura vía admin UI en /dashboard/whatsapp

# Groq (si usas transcripción audio WA)
GROQ_API_KEY=gsk_...
```

---

## Parte 4 — Verificación post-rebrand

### Checklist de 30 min

1. **Search obvious residues** — que el script no haya dejado pasar nada:
   ```bash
   grep -rln "enrola\|Enrola\|ENROLA\|ryo-store\|RYO\|ryo\.smoke" \
     --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=.git \
     --exclude-dir=docs/BLUEPRINT* .
   # Debería retornar cero resultados (excepto docs del blueprint)
   ```

2. **Assets** — todos los logos/favicons reemplazados:
   ```bash
   find . -name "favicon*" -o -name "logo*" -o -name "icon.png" -o -name "apple-icon*" \
     | grep -v node_modules | xargs file
   ```

3. **Build local** — `npm run build` en backend y storefront, sin errores.

4. **Docker build** — `docker compose build` limpio.

5. **Deploy a staging** (si tienes) o directo a prod.

6. **Smoke test prod:**
   - Home carga con nueva marca
   - Checkout flow completo con orden de prueba
   - Admin login + navegación por todas las tabs
   - Sidebar muestra 🏪 SEO + 🔧 DEV + 🔗 Tools sin errores
   - `/dashboard/seo/overview` carga (puede estar vacío si es día 1)
   - `/dashboard/dev/services` todos UP
   - Umami, Clarity, PostHog, GA4 recibiendo eventos (ver Realtime en cada uno)

7. **Legales + compliance:**
   - Términos ajustados a tu jurisdicción
   - Privacy policy menciona tus herramientas (PostHog, Clarity, etc.)
   - Cookie banner si tu mercado lo requiere (Enrola no lo tiene por ser VE; en EU sí es mandatorio)

---

## Parte 5 — Casos especiales que el script NO maneja

### 5.1 `docker-compose.yml` nombre del proyecto

Docker compose usa el nombre del directorio como proyecto por default. Si renombras la carpeta de `ryo-store` a `mi-tienda`, los containers se llamarán `mi-tienda-medusa-1` automáticamente. El script asume que harás esto.

### 5.2 Rutas absolutas en el VPS

El docker-compose tiene paths como `/root/ryo-store/`. Si tu deploy usa otra ruta, editar:
- `docs/PASO-A-PASO-DEPLOY.md`
- `docs/SUBIR-A-VPS.sh`
- `docs/DEPLOY.md`

### 5.3 Cloudflare DNS records

No automatizable. Crear A records manualmente:
- `tu-dominio.com` → IP del VPS
- `api.tu-dominio.com` → IP del VPS
- `analytics.tu-dominio.com` → IP del VPS

Todos con proxy OFF (Traefik necesita HTTP-01 challenge directo).

### 5.4 Google Search Console verification

Después de cambiar el dominio, verificar propiedad de nuevo:
- Añadir TXT record en Cloudflare con el token de Google
- Resubmit sitemap

### 5.5 OAuth redirects

Si usas OAuth (Google, etc.) en el storefront, actualizar redirect URIs en la consola del proveedor al nuevo dominio.

---

## Parte 6 — Cronograma recomendado

**Día 1 (2-3h) — Setup mecánico:**
- Fork repo, configurar `blueprint.config.yml`, correr `rebrand.sh`
- Reemplazar assets gráficos (logo, favicon, etc.)
- Ajustar colores en CSS/Tailwind

**Día 1 (2-3h) — Servicios externos:**
- Crear cuentas Resend, PostHog, Clarity, Umami (post-deploy)
- Google Cloud Service Account + GSC + GA4
- DNS en Cloudflare

**Día 1-2 (2-3h) — Deploy:**
- Deploy docker-compose al VPS
- Admin user + migrations + seeds
- Verificar todos los servicios UP

**Día 2-3 (3-5h) — Copy + contenido:**
- Reescribir hero, FAQ, términos, privacidad
- Revisar WhatsApp bot prompt (si aplica)
- Email templates
- Blog posts iniciales (si aplica)

**Día 3 (2-3h) — Productos:**
- Crear productos reales (o importar catálogo)
- Configurar shipping options
- Configurar payment methods
- Probar orden end-to-end

**Día 4+ — Launch + iteración:**
- SEO crece orgánicamente (14-30 días para datos GSC)
- A/B tests desde PostHog
- Monitorear alertas + dashboards

**Total: 10-15h activas + tiempo de espera para indexación.**

---

## Troubleshooting común

| Síntoma | Causa probable | Fix |
|---|---|---|
| Storefront build falla TS error | Variables de `brand.ts` mal referenciadas | Revisar `grep "brand\." storefront/src` |
| Admin UI no muestra nuevas tabs | Cache Vite | `docker compose build --no-cache medusa` |
| GSC retorna "Property not found" | DNS no propagado o SA no autorizada | Verify property + GSC users settings |
| Umami no crea events | Website ID hardcoded viejo | Actualizar `NEXT_PUBLIC_UMAMI_WEBSITE_ID` en build args |
| PostHog Cloud region wrong | `NEXT_PUBLIC_POSTHOG_HOST` apunta a us cuando el proyecto está en eu | Cambiar a `https://eu.i.posthog.com` |
| Containers no levantan | Env vars missing | Revisar `docker compose config` output |
| Shipping no aparece en checkout | Fulfillment set no vinculado a stock location | Correr `npm run add-shipping` |
| Alertas no emails | `RESEND_API_KEY` mal configurado | Verificar + resetear |

---

## Links útiles

- `docs/BLUEPRINT.md` — overview del stack
- `docs/SEO-ANALYTICS.md` — manual SEO Analytics
- `docs/SEO-ANALYTICS-SPEC.md` — spec técnica SEO module
- `docs/SEO-ANALYTICS-GOOGLE-SETUP.md` — setup credenciales Google
- `docs/DEPLOY.md` — deploy VPS
- `docs/PASO-A-PASO-DEPLOY.md` — deploy paso a paso
- Medusa v2 docs: https://docs.medusajs.com/v2
- Next.js 16 docs: https://nextjs.org/docs
