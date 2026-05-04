# Google Search Console + GA4 — pasos manuales

Este batch es 90% manual (requiere acceso a tu cuenta de Google). Acá los pasos exactos.

---

## 1. Google Search Console

### 1.1 Añadir propiedad

1. Ir a https://search.google.com/search-console
2. Click en dropdown de propiedad → **"Añadir propiedad"**
3. Elegir tipo **"Prefijo de URL"** → `https://enrola.shop`
4. Método de verificación: **"Etiqueta HTML"** (la más simple dado nuestro setup)

### 1.2 Verificación — 2 opciones

**Opción A — DNS (recomendado, verificación a nivel dominio)**
- En tu proveedor DNS (Cloudflare): agregar registro TXT
  - **Tipo:** TXT
  - **Nombre:** `@` (raíz)
  - **Valor:** `google-site-verification=<código-que-te-da-GSC>`
- Esperar 5-30 min → volver a GSC → "Verificar"

**Opción B — Meta tag (más rápido si necesitas confirmar YA)**
- GSC te dará una línea como: `<meta name="google-site-verification" content="XXXXX" />`
- Editar `storefront/src/app/layout.tsx`, agregar dentro del `<head>` (o en `metadata.verification.google`)
- Deploy storefront
- Volver a GSC → "Verificar"

### 1.3 Enviar sitemap

Una vez verificado:
1. Sidebar → **Sitemaps**
2. Añadir nuevo: `sitemap.xml`
3. Enviar → debería procesar en minutos

### 1.4 Configurar ajustes

- **Settings → Ownership verification:** añadir respaldo (DNS + Meta tag) para no perder acceso
- **Users and permissions:** agregar al equipo con rol "Restricted" o "Full"
- **Removals:** solo si necesitas remover URLs específicas (no debería aplicar)

---

## 2. Google Analytics 4

### 2.1 Crear propiedad (si no existe)

1. Ir a https://analytics.google.com
2. **Admin → Create → Property** → "Enrola Shop"
3. Zona horaria: **America/Caracas**, moneda: **USD**
4. Industry category: **Shopping**
5. Business size: Small
6. Crear data stream: **Web** → `https://enrola.shop`
7. Copiar el **Measurement ID** (formato `G-XXXXXXXXXX`)

### 2.2 Instalar en el storefront

Ya existe la estructura GA4 en Next.js. Para instalar:

1. Agregar a `.env` del storefront (en VPS):
   ```
   NEXT_PUBLIC_GA4_ID=G-XXXXXXXXXX
   ```

2. Si no hay componente GA4 aún, agregar a `storefront/src/app/layout.tsx`:

   ```tsx
   import Script from 'next/script'

   // dentro del <body>:
   {process.env.NEXT_PUBLIC_GA4_ID && (
     <>
       <Script
         src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA4_ID}`}
         strategy="afterInteractive"
       />
       <Script id="ga4-init" strategy="afterInteractive">{`
         window.dataLayer = window.dataLayer || [];
         function gtag(){dataLayer.push(arguments);}
         gtag('js', new Date());
         gtag('config', '${process.env.NEXT_PUBLIC_GA4_ID}', { anonymize_ip: true });
       `}</Script>
     </>
   )}
   ```

3. Deploy storefront.

### 2.3 Linkear GA4 con Search Console

1. En GA4 → **Admin → Property → Product links → Search Console links**
2. Link propiedad existente de GSC
3. Autorizar para el Data Stream web de Enrola

### 2.4 Eventos ecommerce (recomendado, opcional)

Usar los eventos estándar de GA4 en el storefront:
- `view_item` en página de producto
- `add_to_cart` en botón comprar
- `begin_checkout` al ir al checkout
- `purchase` al confirmar pedido (usar `/api/checkout/complete` hook)

Cada evento debe incluir `value`, `currency`, y `items[]` con SKU/price/quantity.

---

## 3. Post-install checklist

- [ ] GSC propiedad verificada
- [ ] Sitemap submitted + processing status OK
- [ ] GA4 Measurement ID configurado en ENV
- [ ] Script GA4 inyectado (inspeccionar con DevTools → Network → buscar `gtag`)
- [ ] Realtime en GA4 muestra actividad (abrir enrola.shop en incógnito → GA4 Reports → Realtime)
- [ ] Link GSC ↔ GA4 completado

Una vez todo OK, esperar 48h para que GSC empiece a acumular data en Performance report. Después de 2-3 semanas hay suficiente data para hacer el re-audit del Batch 10 con insights reales.
