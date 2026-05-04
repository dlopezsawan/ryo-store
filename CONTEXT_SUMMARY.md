# RYO Store — Resumen de Contexto para Continuación

> **Última actualización**: 16 de marzo 2026

---

## Infraestructura

- **VPS IP**: `72.60.114.242` (Hostinger)
- **Root password**: `2H'mvA(qz7'BoA-FBgii` (actualizado marzo 2026)
- **SSH**: `ssh root@72.60.114.242` (puerto **22** estándar)
  - ❌ **INCORRECTO** (NO usar): `ssh -p 2222 root@62.171.139.141` — esa IP y puerto ya NO corresponden a este servidor
- **Deploy storefront** (NO tiene git, se sube por SCP/rsync):
  ```bash
  # Opción 1: rsync completo
  rsync -avz --exclude 'node_modules' --exclude '.medusa' --exclude '.next' --exclude '.env' \
    "/Users/daniellopez/Desktop/ryo store/storefront/" root@72.60.114.242:/root/ryo-store/storefront/

  # Opción 2: archivo individual por SCP
  scp "/Users/daniellopez/Desktop/ryo store/storefront/src/RUTA/ARCHIVO" \
    root@72.60.114.242:/root/ryo-store/storefront/src/RUTA/ARCHIVO

  # Luego rebuild en el VPS:
  cd /root/ryo-store && docker compose build storefront --no-cache && docker compose up -d storefront
  ```
- **Deploy backend** (Medusa): mismo flujo pero con `medusa` en lugar de `storefront`
- **DB directa**: `docker exec ryo-store-postgres-1 psql -U medusa -d medusa`
- **Dominio**: `enrola.shop`
- **IPs antiguas** (NO usar): `62.171.139.141` ni `147.93.55.22`
- **Ruta en VPS**: `/root/ryo-store/` (NO `/opt/ryo-store/`)

## URLs y Servicios

| Servicio | URL |
|----------|-----|
| Storefront | `https://enrola.shop` |
| API Medusa | `https://api.enrola.shop` |
| Dashboard Medusa | `https://enrola.shop/dashboard` |
| n8n | (en el mismo VPS, red compartida `n8n_default`) |
| Listmonk | (newsletter) |
| SnappyMail (webmail) | consultar Notion |

## Usuarios Admin Medusa

| Email | Password | Notas |
|-------|----------|-------|
| (usuario original) | — | Creado con seed |
| `lede495@gmail.com` | `RyoAdmin2026` | Creado manualmente, acceso en `enrola.shop/dashboard` |

## Stack Técnico

- **Backend**: Medusa v2 (módulo loyalty custom) — puerto 9000 dentro de Docker
- **Storefront**: Next.js (App Router), Tailwind CSS v3, next-auth
- **DB**: PostgreSQL (usuario: `medusa`, db: `medusa`), Redis
- **Reverse Proxy**: Traefik (compartido con n8n via red `n8n_default`)
- **Pricing**: Unidades planas (300 = $300, NO centavos)
- **Puntos**: 10 pts por $1 gastado. `100 pts = $1` al canjear

## Variables de Entorno Clave

```
# Storefront (docker-compose)
MEDUSA_BACKEND_URL=http://medusa:9000          # Interno contenedor-a-contenedor (para API routes)
NEXT_PUBLIC_MEDUSA_BACKEND_URL=https://api.enrola.shop  # Para el cliente/browser
NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=...
NEXT_PUBLIC_RECAPTCHA_SITE_KEY=...
RECAPTCHA_SECRET_KEY=...
```

> **IMPORTANTE**: Las rutas API del storefront (`/api/*`) deben usar `MEDUSA_BACKEND_URL` (interno), NO la URL pública.

---

## Sistema de Lealtad (Loyalty)

### Módulo Backend (`backend/src/modules/loyalty/`)
- **Modelos**: `LoyaltyReward` (catálogo de recompensas) + `LoyaltyTransaction` (transacciones de puntos)
- **Servicio**: `LoyaltyModuleService` con `getCustomerPoints()`, `createLoyaltyTransactions()`, `listLoyaltyRewards()`, `updateLoyaltyRewards()`, `deleteLoyaltyRewards()`
- **LOYALTY_MODULE** constant para resolver el servicio

### APIs Backend
- `GET /store/loyalty` — puntos y transacciones del cliente autenticado
- `GET /store/loyalty/rewards` — catálogo público de recompensas
- `POST /store/loyalty/redeem` — canjear recompensas (descuenta puntos, decrementa stock)
- `DELETE /store/loyalty/redeem` — reversar canje (restaura puntos y stock)
- `GET /admin/loyalty/rewards` — listar recompensas (admin)
- `POST /admin/loyalty/rewards` — crear recompensa (admin)
- `PUT /admin/loyalty/rewards/[id]` — actualizar recompensa (admin)
- `DELETE /admin/loyalty/rewards/[id]` — eliminar recompensa (admin)

### APIs Storefront (Next.js proxy)
- `/api/cuenta/loyalty` — proxy a GET /store/loyalty (con token de sesión)
- `/api/cuenta/rewards` — proxy a GET /store/loyalty/rewards
- `/api/cuenta/loyalty/redeem` — proxy POST/DELETE a /store/loyalty/redeem
- `/api/checkout/discount` — POST/DELETE para aplicar/quitar códigos promo al carrito Medusa

### Subscriber (`backend/src/subscribers/award-loyalty-points.ts`)
- Escucha `order.placed` → calcula `subtotalDollars * 10` = puntos (SIN dividir entre 100, es unidad plana)

### Flujo de Canje en Checkout
1. Usuario ve premios canjeables en sidebar "Resumen" (filtrados por stock > 0 y puntos suficientes)
2. Selecciona premios con checkbox
3. Al hacer submit del pedido, PRIMERO llama POST `/api/cuenta/loyalty/redeem` con `{ reward_ids, order_id }`
4. Si el pedido falla después, llama DELETE `/api/cuenta/loyalty/redeem` para reversar
5. Metadata del pedido incluye `redeemed_rewards` y `total_points_redeemed`

### Advertencia de Carrito Vacío
- **Checkout**: `rewardWarning` state — si `cart.items.length === 0` al hacer toggle reward, muestra caja RYO oscura
- **Mi Cuenta**: botón "Canjear" verifica carrito vía `localStorage.getItem("ryo_cart_id")` → fetch `/api/cart?cartId=...` → si vacío muestra advertencia RYO con link a tienda

---

## Diseño y Estética RYO

### Paleta de Colores
- **Primary (rojo)**: `#BB3B2E`
- **Secondary (verde oliva)**: `#4D5431`
- **Cream**: `#F5F2E8`
- **Dark**: `#1A1A1A`
- **Orange (acento)**: `#FF6B35` aprox. (usado en botones, barras, filtros)

### Tipografía
- **Kanit** (Google Fonts)

### Estilo Visual
- Estética retro/3D: bordes gruesos negros (3px), sombras desplazadas
- Botones con hover animado
- Acentos en mayúsculas con tilde (MÁS, ÚNETE, NAVEGACIÓN)
- Nav links con underline animado en hover

---

## Archivos Clave Modificados

### `storefront/src/app/layout.tsx`
- `<html>` y `<body>` tienen `overflow-x-hidden` (fix para Safari iOS)

### `storefront/src/app/checkout/page.tsx`
- Form grid: `grid md:grid-cols-3 gap-4 md:gap-8 w-full`
- Grid children: `min-w-0 overflow-hidden` (fix CSS Grid overflow)
- Cards: `p-4 md:p-6` + sombras responsive (inline style removido para box-shadow)
- `borderWidth: "3px"` se mantiene como inline style
- Direcciones guardadas: `grid grid-cols-2 gap-2` con botones compactos `p-2.5`
- Código descuento: `flex gap-2 min-w-0 w-full` con botón OK `shrink-0 w-14`
- Loyalty: estados `loyaltyPoints`, `loyaltyRewards`, `selectedRewards`, `rewardWarning`
- `toggleReward()`: verifica `cart.items.length` antes de permitir selección
- Submit: primero redeem, luego complete, catch hace reversal

### `storefront/src/components/layout/Footer.tsx`
- **Mobile**: grid 2-col compacto, brand + social icons en fila, nav links al lado, contacto oculto
- **Desktop**: grid 3-col, logo+desc | nav | contacto+social icons al final
- Barras decorativas: `bg-orange` (no `bg-primary`)
- Bottom bar: horizontal siempre, 18+ badge con shadow retro

### `storefront/src/app/tienda/page.tsx` (NUEVO)
- **Filtros inline** (no colapsables): categoría, material, precio
- Botones de categoría y material con estilo `bg-orange` naranja RYO
- **Slider de precios** dual con 2 thumbs (min/max):
  - Barra naranja muestra rango activo
  - Thumbs cuadrados con borde grueso negro (estética retro)
- Layout móvil compacto: scroll horizontal, labels abreviados ("Cat.", "Mat."), scrollbar oculto
- Contador de resultados, botón "Limpiar", estado vacío personalizado

### `storefront/src/app/cuenta/page.tsx`
- `ClubRYOTab`: tiene `handleCanjear()` que verifica carrito antes de redirigir a checkout
- Warning box estilo RYO con link "Ir a la tienda →"

### `storefront/src/app/page.tsx`
- Newsletter: mascota centrada con opacity
- Mascota pequeña inline en móvil

### `storefront/src/app/contacto/page.tsx`
- Título estilo RYO estándar: barra roja + título negro grande
- reCAPTCHA integrado

### `storefront/src/components/layout/HeroSlider.tsx`
- Flechas con estilo retro 3D (border + shadow `#FF3B27`)
- Barra de progreso con dots `w-10` activo, `w-4` inactivo, `h-2.5`

### `storefront/src/lib/cart.ts`
- `addToCart` usa respuesta directa de Medusa (no hace segundo GET)
- `normalizeCart()` compartido
- Thumbnails: `item.thumbnail` → `item.variant?.product?.thumbnail` → `item.variant?.product?.images?.[0]?.url`

### `storefront/src/app/api/cart/` y `/api/checkout/`
- Todas las rutas API usan `MEDUSA_BACKEND_URL` (interno), NO la URL pública
- POST de line-items NO usa `expand` (Medusa no lo acepta en POST)

### `backend/src/api/store/loyalty/redeem/route.ts`
- POST: valida auth, rewards existen, stock > 0, puntos suficientes → descuenta puntos, decrementa stock
- DELETE: reversa puntos, restaura stock

---

## Documentación en Notion

Se creó documentación completa en el workspace **"RYO Shop"** de Notion con las siguientes páginas:

1. **Página principal** — Índice con links a cada sección
2. **Accesos y Credenciales** — VPS, Dashboard Medusa, Listmonk, Webmail (IMAP/SMTP), Resend, Telegram bot, reCAPTCHA, todas las env vars
3. **URLs y Servicios** — URLs públicas e internas
4. **Features y Guía de Uso** — Explicación de cada feature del sistema
5. **Stack Técnico** — Tecnologías usadas
6. **Development (Board)** — Tablero estilo Trello con:
   - 4 columnas: Reported (rojo), Assigned (amarillo), In Progress (azul), Done (verde)
   - Propiedades: Priority, Type, Assignee, Due Date, Task ID (RYO-1, RYO-2...)

### Banner Notion
- Logo RYO naranja sobre fondo oscuro con bordes rojos
- Archivo servido como estático: `enrola.shop/notion-banner.png`

---

## Tareas Completadas

- ✅ Checkout overflow en móvil (Safari iOS)
- ✅ RYO-2: Optimizar imágenes de productos (lazy loading + priority)
- ✅ RYO-3: Filtro por precio y material en /tienda (slider dual, botones inline)
- ✅ Rediseño storefront V2 (paleta, tipografía, header, footer, hero)
- ✅ Fix carrito: URLs backend internas, thumbnails, mensajes de error reales
- ✅ reCAPTCHA en formulario de contacto
- ✅ Sistema de lealtad completo (backend + storefront + checkout + mi cuenta)
- ✅ Documentación completa en Notion (accesos, features, stack, board de desarrollo)
- ✅ Banner personalizado para Notion
- ✅ Usuario admin adicional (`lede495@gmail.com`)
- ✅ **RYO-7**: Fix Bot de Telegram (Corrección de chat ID para el grupo Ryo Pedidos)
- ✅ **RYO-6**: Agregar sección de Upsell en el carrito
- ✅ **RYO-9**: Filtros en barra lateral izquierda (Sticky sidebar en desktop, Drawer flotante en mobile)
- ✅ **RYO-8**: Mejoras SEO (Metadatos por página estática, H1 únicos, corrección estructural de ruta `/bundles`)
- ✅ **RYO-4**: Restock reminder system (cron job diario + email template + admin UI tabla de reglas + cross-sell UI)
- ✅ **RYO-10**: Bug: precio envío inmediato 300$ en vez de 3$
- ✅ **RYO-11**: Fix crítico de "Shipping Profile" en checkout para productos con canje
- ✅ **RYO-12**: Widget Admin de Recompensas (nativo, responsive, Dark Mode)
- ✅ Deploy a producción con todos los cambios y fixes administrativos

---

## Sistema de Remarketing

### Job de Restock (`backend/src/jobs/restock.ts`)
- Cron: `0 12 * * *` (diario al mediodía)
- Lee reglas de `remarketing_settings.restock_products` → `{ rules: [{ product_id, product_title, days }] }`
- Fallback: `product.metadata.restock_enabled = true` si no hay reglas configuradas
- Cross-sell: busca primero en `remarketing_settings.crosssell_map`, luego en `product.metadata.crosssell_product_ids`
- Email: `restockEmailHtml()` — asunto `¿Ya se te acabó [producto]? 🔥`

### Admin UI Remarketing (`backend/src/admin/routes/remarketing/page.tsx`)
- `RestockProductsSection`: tabla de reglas (ProductSelector + días), guarda en `remarketing_settings.restock_products`
- `CrossSellSection`: mapeo producto origen → productos destino (max 4), guarda en `remarketing_settings.crosssell_map`
- `CampaignCard`: toggle enabled/disabled por tipo de campaña

### API Admin (`backend/src/api/admin/remarketing/route.ts`)
- GET: devuelve `{ stats, settings, products }` (lista de productos publicados)
- POST actions: `update_setting`, `save_crosssell`, `save_restock_rules`, `test_email`

### DB Requerida
```sql
-- Insertar si no existe:
INSERT INTO remarketing_settings (key, value, updated_at)
VALUES ('restock', '{"enabled": true, "default_days": 30}', NOW())
ON CONFLICT (key) DO NOTHING;
```

---

## Historial de Sesiones

### Sesión 4: Fixes Administrativos y Widgets (16 de marzo 2026)

#### Fix de Perfiles de Envío (RYO-11)
- **Problema**: Mensaje "The cart items require shipping profiles..." en checkout.
- **Causa**: Producto "Rolling Paper Sabores Alien Puff" no tenía perfil de envío.
- **Resolución**: SQL directo en VPS + script preventivo `fix-shipping-profiles.ts`.

#### Widget de Recompensas en el Admin (RYO-12)
- **Componente**: `order-rewards.tsx` en `order.details.before`.
- **Funcionalidad**: Visualización nativa de canjes del Club RYO.
- **Ajustes**: Soporte Modo Oscuro (Medusa UI) y bypass de dependencias con `--legacy-peer-deps` en build.

---

## Tareas Pendientes (Assigned en Notion DEV)

| ID | Tarea | Prioridad | Tipo |
|----|-------|-----------|------|
| RYO-12 | Feature: zona + cálculo distancia en checkout Envío inmediato | — | Feature |
| RYO-13 | Feature: checkout condicional + WhatsApp post-compra Envío inmediato | — | Feature |

---

## Cómo Retomar el Proyecto

1. Leer este documento y `RESUMEN-CONVERSACION.md`
2. Revisar el tablero de Development en Notion para tareas pendientes
3. Para cambios en storefront: rsync → rebuild → restart (ver sección Infraestructura)
4. Si SSH no conecta, usar consola web de Hostinger
5. **DB**: usuario `medusa` (no `postgres`)
6. Revisar logs: `docker compose logs medusa` / `docker compose logs storefront`
