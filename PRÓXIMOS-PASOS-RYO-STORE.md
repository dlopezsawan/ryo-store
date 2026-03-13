# RYO Store – Próximos pasos (según RYO-Store-Setup-Guide.md)

## Estado actual

| Componente | Estado |
|------------|--------|
| **Storefront** | ✅ Next.js (App Router), Tailwind, diseño RYO. Páginas: Home, Tienda, Producto, Carrito, Contacto, Combos. |
| **Datos** | ⚠️ Productos estáticos en `storefront/src/data/products.ts` (sin backend). |
| **Backend Medusa** | ❌ No instalado (no existe carpeta `backend/`). |
| **Pagos Venezuela** | ❌ No implementado. |
| **SEO (Paso 9)** | ❌ Sin `lib/seo.ts`, sitemap, robots, JSON-LD. |
| **Sanity CMS (Paso 10)** | ❌ No integrado. |

---

## Siguiente paso recomendado: **conectar backend Medusa**

Para que la tienda tenga productos reales, órdenes, inventario y después pagos Venezuela, el siguiente paso lógico es **instalar Medusa y conectar el storefront**.

### 1. Instalar Medusa (Paso 1 de la guía)

```bash
# Desde la raíz del proyecto (donde está storefront/)
npx create-medusa-app@latest ryo-store

# Cuando pregunte:
# - Project name: ryo-store
# - Install Next.js storefront: NO (ya tienes tu storefront custom)
```

Eso creará una carpeta `ryo-store/` con solo el backend. Luego:

```bash
# Renombrar/mover para que quede:
# ryo-store-project/
#   backend/   <- lo que creó create-medusa-app (renombrar ryo-store → backend)
#   storefront/  <- tu storefront actual (ya existe)
mv ryo-store backend
```

### 2. Variables de entorno (Paso 2)

- En **backend**: crear `.env` con `DATABASE_URL` (PostgreSQL), `JWT_SECRET`, `COOKIE_SECRET`, `STORE_CORS`, `ADMIN_CORS`.
- En **storefront**: crear `.env.local` con `NEXT_PUBLIC_MEDUSA_BACKEND_URL=http://localhost:9000` y `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` (lo obtienes del admin de Medusa tras el primer run).

### 3. Conectar el storefront a Medusa

- Añadir **cliente Medusa** en `storefront/src/lib/medusa.ts` (fetch a `NEXT_PUBLIC_MEDUSA_BACKEND_URL/store/...`).
- Sustituir el uso de `data/products.ts` por llamadas a la API de Medusa en:
  - Home (productos destacados)
  - Tienda (listado + filtros por categoría/colección)
  - Producto `[slug]` o `[handle]` (detalle desde API).
- Mantener el mismo diseño y componentes; solo cambiar la fuente de datos.

### 4. Después de Medusa conectado (orden sugerido)

| Orden | Paso | Descripción |
|-------|------|-------------|
| 5 | **Paso 3** | Módulo de pagos Venezuela en `backend/src/modules/venezuela-payment/`. |
| 6 | **Paso 4** | API routes: upload comprobante (`/store/payment-proof`), verificación admin (`/admin/verify-payment`). |
| 7 | **Paso 6** | En Admin Medusa: región Venezuela (USD), categorías, envíos. |
| 8 | **Checkout** | Página checkout en storefront: selección de método (Pago Móvil, Zelle, Binance, Transferencia), datos bancarios, subida de comprobante. |
| 9 | **Paso 9** | SEO: `lib/seo.ts`, `sitemap.ts`, `robots.ts`, JSON-LD, `generateMetadata()` en páginas. |
| 10 | **Paso 10** | Sanity CMS: banners, anuncios, páginas editables, integración en home y páginas estáticas. |

---

## Alternativa: hacer SEO primero (sin backend)

Si prefieres **no tocar Medusa todavía** y avanzar solo en el storefront:

- Implementar **Paso 9 (SEO)**:
  - `storefront/src/lib/seo.ts` con helpers de metadata y JSON-LD.
  - `storefront/src/app/sitemap.ts` (con las URLs actuales: home, tienda, productos, contacto, combos).
  - `storefront/src/app/robots.ts`.
  - Componentes JSON-LD (Organization, WebSite, Product, Breadcrumb) y `generateMetadata()` en layout y en páginas de producto/tienda.

Así la tienda actual (con datos estáticos) ya queda con buena base SEO; cuando conectes Medusa, solo habrá que alimentar sitemap y metadata con datos reales de la API.

---

## Resumen

- **Siguiente paso recomendado:** instalar Medusa (Paso 1), configurar env (Paso 2) y conectar el storefront a la API de Medusa para productos y, después, carrito/checkout.
- **Alternativa:** implementar el Paso 9 (SEO) en el storefront actual y dejar Medusa para después.

Cuando decidas si vas por **Medusa primero** o **SEO primero**, se puede bajar esto a tareas concretas (archivos a crear, código de ejemplo y orden de implementación).
