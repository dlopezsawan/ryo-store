# RYO Store - Guia de Setup para Claude Code

## Stack Tecnologico

| Componente | Tecnologia | Proposito |
|---|---|---|
| **Commerce Engine** | Medusa.js 2.0 | Backend de comercio (productos, ordenes, inventario, admin panel) |
| **Storefront** | Next.js 15 (App Router) | Frontend de la tienda |
| **Estilos** | Tailwind CSS + shadcn/ui | Sistema de diseno |
| **Base de Datos** | PostgreSQL | Incluido con Medusa |
| **Lenguaje** | TypeScript | Todo el proyecto |
| **Pagos** | Modulo custom Medusa | Pago Movil, Zelle, Binance Pay, transferencias |
| **CMS Editorial** | Sanity | Banners, paginas, promos, info de tienda (editable sin codigo) |
| **Emails** | Resend o Nodemailer | Confirmaciones de orden, notificaciones |
| **Deploy** | Railway / VPS | Backend Medusa + Storefront Next.js |

---

## Arquitectura del Proyecto

```
ryo-store/
├── backend/                    # Medusa.js 2.0 application
│   ├── src/
│   │   ├── admin/              # Customizaciones del admin dashboard
│   │   │   └── widgets/        # Widgets custom (ej: verificacion de pagos)
│   │   ├── api/                # API Routes custom
│   │   │   ├── store/          # Endpoints publicos del storefront
│   │   │   │   └── payment-proof/
│   │   │   │       └── route.ts    # Upload de comprobantes de pago
│   │   │   └── admin/          # Endpoints del admin
│   │   │       └── verify-payment/
│   │   │           └── route.ts    # Verificacion manual de pagos
│   │   ├── modules/            # Modulos custom
│   │   │   └── venezuela-payment/ # Payment provider custom
│   │   │       ├── models/     # Data models (comprobantes, metodos)
│   │   │       ├── migrations/ # DB migrations
│   │   │       ├── service.ts  # Logica del modulo
│   │   │       └── index.ts    # Entry point
│   │   ├── workflows/          # Workflows custom
│   │   │   └── verify-payment/ # Flujo de verificacion de pago
│   │   │       └── index.ts
│   │   ├── subscribers/        # Event subscribers
│   │   │   └── payment-verified.ts  # Notificar cuando se verifica pago
│   │   └── jobs/               # Scheduled jobs
│   │       └── expire-unpaid-orders.ts  # Cancelar ordenes sin pago
│   ├── medusa-config.ts        # Configuracion de Medusa
│   ├── package.json
│   ├── tsconfig.json
│   └── .env
│
├── storefront/                 # Next.js 15 Starter Storefront
│   ├── src/
│   │   ├── app/                # App Router pages
│   │   │   ├── (main)/        # Layout principal
│   │   │   │   ├── page.tsx           # Homepage
│   │   │   │   ├── products/          # Catalogo
│   │   │   │   │   ├── page.tsx       # Listado
│   │   │   │   │   └── [handle]/
│   │   │   │   │       └── page.tsx   # Detalle producto
│   │   │   │   ├── cart/
│   │   │   │   │   └── page.tsx       # Carrito
│   │   │   │   ├── checkout/
│   │   │   │   │   └── page.tsx       # Checkout + seleccion de pago
│   │   │   │   └── account/
│   │   │   │       ├── page.tsx       # Mi cuenta
│   │   │   │       └── orders/
│   │   │   │           └── page.tsx   # Mis ordenes
│   │   │   ├── layout.tsx      # Root layout
│   │   │   └── globals.css     # Tailwind globals
│   │   ├── components/         # Componentes React
│   │   │   ├── ui/             # shadcn/ui components
│   │   │   ├── layout/         # Header, Footer, Nav
│   │   │   ├── products/       # ProductCard, ProductGrid, etc
│   │   │   ├── cart/           # CartDrawer, CartItem, etc
│   │   │   ├── checkout/       # CheckoutForm, PaymentSelector
│   │   │   └── payment/        # Componentes de pago Venezuela
│   │   │       ├── PagoMovilForm.tsx
│   │   │       ├── ZelleForm.tsx
│   │   │       ├── BinancePayForm.tsx
│   │   │       ├── TransferForm.tsx
│   │   │       └── PaymentProofUpload.tsx
│   │   ├── lib/                # Utilidades
│   │   │   ├── medusa.ts       # Cliente Medusa SDK
│   │   │   ├── config.ts       # Configuracion
│   │   │   └── utils.ts        # Helpers
│   │   └── styles/             # Estilos adicionales
│   ├── public/                 # Assets estaticos
│   │   ├── images/
│   │   └── fonts/
│   ├── next.config.js
│   ├── tailwind.config.ts
│   ├── package.json
│   └── .env.local
│
└── README.md
```

---

## Paso 1: Instalar Medusa Backend

### Prerequisitos
- Node.js v20+ (menor a v25)
- PostgreSQL instalado y corriendo
- Git

### Comandos de instalacion

```bash
# Crear el proyecto Medusa con storefront incluido
npx create-medusa-app@latest ryo-store

# Cuando pregunte:
# - Project name: ryo-store
# - Install Next.js storefront: YES
```

Esto crea dos directorios:
- `ryo-store/` - Backend Medusa (admin en http://localhost:9000/app)
- `ryo-store-storefront/` - Next.js storefront (http://localhost:8000)

### Reorganizar estructura

```bash
# Crear estructura unificada
mkdir ryo-store-project
mv ryo-store ryo-store-project/backend
mv ryo-store-storefront ryo-store-project/storefront
cd ryo-store-project
git init
```

---

## Paso 2: Configurar Variables de Entorno

### Backend (.env)

```env
# Database
DATABASE_URL=postgres://localhost/ryo-store

# Admin
MEDUSA_ADMIN_ONBOARDING_TYPE=default

# JWT & Cookie
JWT_SECRET=tu-jwt-secret-super-seguro-cambiar-en-produccion
COOKIE_SECRET=tu-cookie-secret-super-seguro-cambiar-en-produccion

# CORS
STORE_CORS=http://localhost:8000
ADMIN_CORS=http://localhost:9000

# Email (Resend)
RESEND_API_KEY=re_xxxxxxxxxxxx
RESEND_FROM=RYO Store <noreply@ryostore.com>

# File storage
BACKEND_URL=http://localhost:9000
```

### Storefront (.env.local)

```env
# Medusa Backend
NEXT_PUBLIC_MEDUSA_BACKEND_URL=http://localhost:9000
NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=pk_xxxxxxxxxxxxxxxxxxxxxxxx

# Store info
NEXT_PUBLIC_STORE_NAME="RYO Store"
NEXT_PUBLIC_DEFAULT_REGION=ven

# Revalidation
REVALIDATE_WINDOW=3600
```

---

## Paso 3: Modulo de Pagos Venezuela

Este es el componente custom mas importante. Medusa 2.0 permite crear Payment Providers personalizados.

### Estructura del modulo

```
backend/src/modules/venezuela-payment/
├── index.ts                    # Module definition
├── service.ts                  # AbstractPaymentProvider implementation
├── models/
│   └── payment-proof.ts        # Modelo para comprobantes de pago
└── migrations/
    └── Migration_CreatePaymentProof.ts
```

### service.ts - Payment Provider

```typescript
import { AbstractPaymentProvider } from "@medusajs/framework/utils"
import {
  CreatePaymentProviderSession,
  UpdatePaymentProviderSession,
  ProviderWebhookPayload,
  PaymentProviderError,
  PaymentProviderSessionResponse,
  PaymentSessionStatus,
} from "@medusajs/framework/types"

type VenezuelaPaymentMethod = "pago_movil" | "zelle" | "binance_pay" | "transferencia"

interface VenezuelaPaymentData {
  method: VenezuelaPaymentMethod
  proof_url?: string      // URL del comprobante subido
  reference?: string      // Numero de referencia
  verified: boolean       // Verificado por admin
  verified_at?: string
  verified_by?: string
}

class VenezuelaPaymentProviderService extends AbstractPaymentProvider<{}> {
  static identifier = "venezuela-payment"

  async initiatePayment(
    input: CreatePaymentProviderSession
  ): Promise<PaymentProviderSessionResponse> {
    return {
      data: {
        method: input.context?.method || "pago_movil",
        verified: false,
      } as VenezuelaPaymentData,
    }
  }

  async authorizePayment(
    paymentSessionData: Record<string, unknown>
  ): Promise<{ status: PaymentSessionStatus; data: Record<string, unknown> }> {
    const data = paymentSessionData as unknown as VenezuelaPaymentData

    // Solo autorizar si el admin verifico el pago
    if (data.verified) {
      return {
        status: PaymentSessionStatus.AUTHORIZED,
        data: paymentSessionData,
      }
    }

    // Pendiente de verificacion
    return {
      status: PaymentSessionStatus.PENDING,
      data: paymentSessionData,
    }
  }

  async capturePayment(
    paymentSessionData: Record<string, unknown>
  ): Promise<Record<string, unknown> | PaymentProviderError> {
    return paymentSessionData
  }

  async refundPayment(
    paymentSessionData: Record<string, unknown>,
    refundAmount: number
  ): Promise<Record<string, unknown> | PaymentProviderError> {
    return {
      ...paymentSessionData,
      refunded: true,
      refund_amount: refundAmount,
    }
  }

  async cancelPayment(
    paymentSessionData: Record<string, unknown>
  ): Promise<Record<string, unknown> | PaymentProviderError> {
    return {
      ...paymentSessionData,
      cancelled: true,
    }
  }

  async deletePayment(
    paymentSessionData: Record<string, unknown>
  ): Promise<Record<string, unknown> | PaymentProviderError> {
    return paymentSessionData
  }

  async getPaymentStatus(
    paymentSessionData: Record<string, unknown>
  ): Promise<PaymentSessionStatus> {
    const data = paymentSessionData as unknown as VenezuelaPaymentData
    if (data.verified) return PaymentSessionStatus.AUTHORIZED
    return PaymentSessionStatus.PENDING
  }

  async retrievePayment(
    paymentSessionData: Record<string, unknown>
  ): Promise<Record<string, unknown> | PaymentProviderError> {
    return paymentSessionData
  }

  async updatePayment(
    input: UpdatePaymentProviderSession
  ): Promise<PaymentProviderSessionResponse | PaymentProviderError> {
    return { data: input.data }
  }

  async getWebhookActionAndData(
    payload: ProviderWebhookPayload
  ): Promise<{ action: string; data: Record<string, unknown> }> {
    return { action: "not_supported", data: {} }
  }
}

export default VenezuelaPaymentProviderService
```

### Registrar en medusa-config.ts

```typescript
module.exports = defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    http: {
      storeCors: process.env.STORE_CORS!,
      adminCors: process.env.ADMIN_CORS!,
      authCors: process.env.AUTH_CORS!,
      jwtSecret: process.env.JWT_SECRET!,
      cookieSecret: process.env.COOKIE_SECRET!,
    },
  },
  modules: [
    {
      resolve: "@medusajs/medusa/payment",
      options: {
        providers: [
          {
            resolve: "./src/modules/venezuela-payment",
            id: "venezuela-payment",
            options: {},
          },
        ],
      },
    },
  ],
})
```

---

## Paso 4: API Routes Custom

### Upload de comprobante de pago

```
backend/src/api/store/payment-proof/route.ts
```

```typescript
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
) {
  // Logica para:
  // 1. Recibir imagen del comprobante
  // 2. Guardar en storage (S3/local)
  // 3. Asociar con la orden/payment session
  // 4. Notificar al admin

  res.json({
    success: true,
    message: "Comprobante recibido. Tu pago sera verificado pronto.",
  })
}
```

### Verificacion de pago (Admin)

```
backend/src/api/admin/verify-payment/route.ts
```

```typescript
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
) {
  // Logica para:
  // 1. Admin marca el pago como verificado
  // 2. Actualizar payment session data (verified: true)
  // 3. Autorizar el pago
  // 4. Notificar al cliente

  res.json({
    success: true,
    message: "Pago verificado exitosamente.",
  })
}
```

---

## Paso 5: Datos de Pago para el Storefront

Estos son los datos que se mostraran al cliente en el checkout:

### Pago Movil
```
Banco: [Tu banco]
Telefono: 0412-XXXXXXX
Cedula: V-XXXXXXXX
Monto: [calculado en Bs]
```

### Zelle
```
Email: ryostore@email.com
Nombre: [Nombre del titular]
Monto: $XX.XX USD
```

### Binance Pay
```
Binance ID: XXXXXXXXX
Email: ryostore@email.com
Monto: $XX.XX USDT
```

### Transferencia Bancaria
```
Banco: [Tu banco]
Cuenta: XXXX-XXXX-XX-XXXXXXXXXX
RIF/CI: X-XXXXXXXX
Monto: [calculado en Bs]
```

---

## Paso 6: Configuracion Inicial en Admin

Una vez corriendo el backend, ir a http://localhost:9000/app y:

1. **Crear Region "Venezuela"**
   - Moneda: USD (precios en dolares, conversion a Bs en storefront)
   - Paises: VE
   - Payment provider: venezuela-payment

2. **Crear categorias de productos**
   - Pipas y Bongs
   - Papers y Filtros
   - Grinders
   - Accesorios
   - Almacenamiento
   - Vaporizadores
   - Rolling Trays
   - Kits

3. **Configurar shipping**
   - Envio en Caracas
   - Envio nacional (MRW, Zoom, Tealca)
   - Pickup en tienda (si aplica)

---

## Paso 7: Comandos para Desarrollo

```bash
# Terminal 1: Backend Medusa
cd backend
npm run dev
# Admin: http://localhost:9000/app
# API:   http://localhost:9000

# Terminal 2: Storefront Next.js
cd storefront
npm run dev
# Tienda: http://localhost:8000
```

---

## Paso 8: Deploy a Produccion

### Opcion A: Railway (recomendado para empezar)
- Backend Medusa: Railway service con PostgreSQL addon
- Storefront: Vercel (gratis)

### Opcion B: VPS (mas control, mas barato a largo plazo)
- DigitalOcean / Hetzner / Contabo
- Docker Compose con Medusa + PostgreSQL + Nginx
- Storefront en Vercel o mismo VPS

### Variables de entorno en produccion
```env
DATABASE_URL=postgresql://user:pass@host:5432/ryo-store
STORE_CORS=https://ryostore.com
ADMIN_CORS=https://admin.ryostore.com
JWT_SECRET=[generar-con-openssl]
COOKIE_SECRET=[generar-con-openssl]
```

---

## Prompt para Claude Code

Copia y pega esto en Claude Code para iniciar el proyecto:

```
Soy Daniel y estoy construyendo RYO Store, un ecommerce de parafernalia
canabica en Venezuela. El stack es:

- Backend: Medusa.js 2.0
- Storefront: Next.js 15 (App Router) con Tailwind CSS + shadcn/ui
- Pagos: Modulo custom para Pago Movil, Zelle, Binance Pay y transferencias
- DB: PostgreSQL

Necesito que:
1. Inicialices el proyecto con `npx create-medusa-app@latest ryo-store`
   (con storefront incluido)
2. Crees el modulo de pagos Venezuela en
   src/modules/venezuela-payment/ que extienda AbstractPaymentProvider
3. Crees las API routes para upload de comprobantes y verificacion de pagos
4. Configures el storefront con el branding de RYO Store
5. Instales y configures shadcn/ui en el storefront
6. Implementes la capa SEO completa:
   - lib/seo.ts con helpers de metadata y JSON-LD
   - app/sitemap.ts dinamico que genere URLs de productos y colecciones
   - app/robots.ts con reglas de indexacion
   - Componentes ProductJsonLd, BreadcrumbJsonLd, OrganizationJsonLd
   - generateMetadata() en cada page.tsx con Open Graph y Twitter Cards
7. Integres Sanity CMS como gestor de contenido editorial:
   - Instalar next-sanity y configurar con `npx sanity@latest init`
   - Crear schemas: heroBanner, announcement, page, promoSection, storeInfo
   - Configurar Sanity Studio embebido en /studio
   - Crear queries GROQ centralizadas en sanity/lib/queries.ts
   - Conectar homepage para consumir banners y promos desde Sanity

La tienda opera con precios en USD y muestra equivalencia en Bs.
Los metodos de pago son todos manuales con verificacion por admin.
El flujo es: cliente hace pedido -> selecciona metodo de pago ->
ve datos bancarios -> sube comprobante -> admin verifica -> orden confirmada.
```

---

## Paso 9: Capa SEO Completa (Reemplaza Yoast/All in One SEO)

Next.js 15 App Router tiene SEO de primera clase integrado. Con los siguientes archivos
cubres todo lo que Yoast hace en WordPress: metadata dinamica, Open Graph, Twitter Cards,
sitemap XML, robots.txt, JSON-LD structured data, y canonical URLs.

### Archivos SEO a crear en el storefront

```
storefront/src/
├── app/
│   ├── sitemap.ts              # Sitemap XML dinamico
│   ├── robots.ts               # robots.txt
│   └── (main)/
│       └── products/
│           └── [handle]/
│               └── page.tsx    # generateMetadata + JSON-LD por producto
├── lib/
│   └── seo.ts                  # Utilidades SEO centralizadas
└── components/
    └── seo/
        ├── ProductJsonLd.tsx    # Schema.org Product
        ├── BreadcrumbJsonLd.tsx # Schema.org BreadcrumbList
        ├── OrganizationJsonLd.tsx # Schema.org Organization
        └── CollectionJsonLd.tsx # Schema.org CollectionPage
```

### lib/seo.ts - Utilidades SEO centralizadas

```typescript
import { Metadata } from "next"

const STORE_NAME = "RYO Store"
const STORE_URL = process.env.NEXT_PUBLIC_STORE_URL || "https://ryostore.com"
const STORE_DESCRIPTION = "Tu tienda de parafernalia canabica en Venezuela. Pipas, bongs, grinders, papers y mas."

// ============================================================
// METADATA HELPERS
// ============================================================

interface ProductSEO {
  title: string
  description: string
  handle: string
  image?: string
  price?: number
  currency?: string
  availability?: boolean
  category?: string
}

interface CollectionSEO {
  title: string
  description: string
  handle: string
  image?: string
}

/**
 * Genera metadata para la homepage
 */
export function getHomeMetadata(): Metadata {
  return {
    title: `${STORE_NAME} | Parafernalia Canabica en Venezuela`,
    description: STORE_DESCRIPTION,
    keywords: [
      "parafernalia canabica", "headshop venezuela",
      "pipas", "bongs", "grinders", "papers",
      "rolling papers", "accesorios fumador",
      "tienda canabica caracas",
    ],
    openGraph: {
      title: `${STORE_NAME} | Parafernalia Canabica en Venezuela`,
      description: STORE_DESCRIPTION,
      url: STORE_URL,
      siteName: STORE_NAME,
      type: "website",
      locale: "es_VE",
      images: [
        {
          url: `${STORE_URL}/images/og-home.jpg`,
          width: 1200,
          height: 630,
          alt: `${STORE_NAME} - Parafernalia Canabica`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${STORE_NAME} | Parafernalia Canabica en Venezuela`,
      description: STORE_DESCRIPTION,
      images: [`${STORE_URL}/images/og-home.jpg`],
    },
    alternates: {
      canonical: STORE_URL,
    },
  }
}

/**
 * Genera metadata para una pagina de producto
 */
export function getProductMetadata(product: ProductSEO): Metadata {
  const title = `${product.title} | ${STORE_NAME}`
  const url = `${STORE_URL}/products/${product.handle}`

  return {
    title,
    description: product.description,
    openGraph: {
      title,
      description: product.description,
      url,
      siteName: STORE_NAME,
      type: "website",  // og:type product requiere namespace, usar website
      locale: "es_VE",
      images: product.image
        ? [{ url: product.image, width: 800, height: 800, alt: product.title }]
        : [],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: product.description,
      images: product.image ? [product.image] : [],
    },
    alternates: {
      canonical: url,
    },
  }
}

/**
 * Genera metadata para una pagina de coleccion/categoria
 */
export function getCollectionMetadata(collection: CollectionSEO): Metadata {
  const title = `${collection.title} | ${STORE_NAME}`
  const url = `${STORE_URL}/collections/${collection.handle}`

  return {
    title,
    description: collection.description,
    openGraph: {
      title,
      description: collection.description,
      url,
      siteName: STORE_NAME,
      type: "website",
      locale: "es_VE",
      images: collection.image
        ? [{ url: collection.image, width: 1200, height: 630, alt: collection.title }]
        : [],
    },
    alternates: {
      canonical: url,
    },
  }
}

// ============================================================
// JSON-LD STRUCTURED DATA HELPERS
// ============================================================

interface ProductSchemaInput {
  name: string
  description: string
  handle: string
  image: string[]
  price: number
  currency: string
  availability: boolean
  sku?: string
  brand?: string
  category?: string
  ratingValue?: number
  reviewCount?: number
}

/**
 * Schema.org Product - para rich snippets en Google
 */
export function generateProductJsonLd(product: ProductSchemaInput) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    image: product.image,
    url: `${STORE_URL}/products/${product.handle}`,
    sku: product.sku,
    brand: product.brand
      ? { "@type": "Brand", name: product.brand }
      : undefined,
    category: product.category,
    offers: {
      "@type": "Offer",
      price: product.price,
      priceCurrency: product.currency || "USD",
      availability: product.availability
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      url: `${STORE_URL}/products/${product.handle}`,
      seller: {
        "@type": "Organization",
        name: STORE_NAME,
      },
    },
    ...(product.ratingValue && product.reviewCount
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: product.ratingValue,
            reviewCount: product.reviewCount,
          },
        }
      : {}),
  }
}

/**
 * Schema.org Organization - para el Knowledge Panel de Google
 */
export function generateOrganizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: STORE_NAME,
    url: STORE_URL,
    logo: `${STORE_URL}/images/logo.png`,
    description: STORE_DESCRIPTION,
    address: {
      "@type": "PostalAddress",
      addressCountry: "VE",
    },
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer service",
      availableLanguage: "Spanish",
    },
    sameAs: [
      "https://instagram.com/ryostore",
      // agregar otras redes sociales
    ],
  }
}

/**
 * Schema.org BreadcrumbList - para navegacion en SERPs
 */
export function generateBreadcrumbJsonLd(
  items: { name: string; url: string }[]
) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  }
}

/**
 * Schema.org WebSite con SearchAction - para sitelinks searchbox
 */
export function generateWebsiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: STORE_NAME,
    url: STORE_URL,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${STORE_URL}/search?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  }
}
```

### app/sitemap.ts - Sitemap XML dinamico

```typescript
import { MetadataRoute } from "next"

const STORE_URL = process.env.NEXT_PUBLIC_STORE_URL || "https://ryostore.com"
const MEDUSA_URL = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9000"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Paginas estaticas
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: STORE_URL,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${STORE_URL}/products`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${STORE_URL}/about`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${STORE_URL}/contact`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ]

  // Productos dinamicos desde Medusa API
  let productPages: MetadataRoute.Sitemap = []
  try {
    const res = await fetch(`${MEDUSA_URL}/store/products?limit=1000`, {
      headers: {
        "x-publishable-api-key": process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || "",
      },
      next: { revalidate: 3600 }, // revalidar cada hora
    })
    const { products } = await res.json()

    productPages = products.map((product: any) => ({
      url: `${STORE_URL}/products/${product.handle}`,
      lastModified: new Date(product.updated_at),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }))
  } catch (error) {
    console.error("Error fetching products for sitemap:", error)
  }

  // Colecciones/categorias dinamicas desde Medusa API
  let collectionPages: MetadataRoute.Sitemap = []
  try {
    const res = await fetch(`${MEDUSA_URL}/store/collections`, {
      headers: {
        "x-publishable-api-key": process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || "",
      },
      next: { revalidate: 3600 },
    })
    const { collections } = await res.json()

    collectionPages = collections.map((collection: any) => ({
      url: `${STORE_URL}/collections/${collection.handle}`,
      lastModified: new Date(collection.updated_at),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }))
  } catch (error) {
    console.error("Error fetching collections for sitemap:", error)
  }

  return [...staticPages, ...productPages, ...collectionPages]
}
```

### app/robots.ts - robots.txt

```typescript
import { MetadataRoute } from "next"

const STORE_URL = process.env.NEXT_PUBLIC_STORE_URL || "https://ryostore.com"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/account/",   // paginas privadas del usuario
          "/checkout/",  // proceso de checkout
          "/cart/",      // carrito (no indexar)
          "/api/",       // rutas de API
          "/admin/",     // admin panel
        ],
      },
    ],
    sitemap: `${STORE_URL}/sitemap.xml`,
  }
}
```

### components/seo/ProductJsonLd.tsx - Componente reutilizable

```tsx
import { generateProductJsonLd } from "@/lib/seo"

interface Props {
  product: {
    name: string
    description: string
    handle: string
    images: string[]
    price: number
    currency: string
    inStock: boolean
    sku?: string
    brand?: string
    category?: string
  }
}

export function ProductJsonLd({ product }: Props) {
  const jsonLd = generateProductJsonLd({
    name: product.name,
    description: product.description,
    handle: product.handle,
    image: product.images,
    price: product.price,
    currency: product.currency,
    availability: product.inStock,
    sku: product.sku,
    brand: product.brand,
    category: product.category,
  })

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  )
}
```

### Ejemplo: pagina de producto con SEO completo

```tsx
// app/(main)/products/[handle]/page.tsx
import { Metadata } from "next"
import { notFound } from "next/navigation"
import { getProductMetadata, generateBreadcrumbJsonLd } from "@/lib/seo"
import { ProductJsonLd } from "@/components/seo/ProductJsonLd"

const MEDUSA_URL = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL!
const STORE_URL = process.env.NEXT_PUBLIC_STORE_URL || "https://ryostore.com"

// Fetch del producto (memoizado automaticamente por Next.js)
async function getProduct(handle: string) {
  const res = await fetch(`${MEDUSA_URL}/store/products?handle=${handle}`, {
    headers: {
      "x-publishable-api-key": process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || "",
    },
    next: { revalidate: 3600 },
  })
  const { products } = await res.json()
  return products?.[0] || null
}

// Metadata dinamica (esto reemplaza Yoast SEO)
export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>
}): Promise<Metadata> {
  const { handle } = await params
  const product = await getProduct(handle)
  if (!product) return { title: "Producto no encontrado" }

  return getProductMetadata({
    title: product.title,
    description: product.description || `Compra ${product.title} en RYO Store`,
    handle: product.handle,
    image: product.thumbnail,
    price: product.variants?.[0]?.prices?.[0]?.amount / 100,
    currency: "USD",
    availability: product.variants?.some((v: any) => v.inventory_quantity > 0),
  })
}

// Pagina del producto
export default async function ProductPage({
  params,
}: {
  params: Promise<{ handle: string }>
}) {
  const { handle } = await params
  const product = await getProduct(handle)
  if (!product) notFound()

  const variant = product.variants?.[0]
  const price = variant?.prices?.[0]?.amount / 100

  // Breadcrumb JSON-LD
  const breadcrumbJsonLd = generateBreadcrumbJsonLd([
    { name: "Inicio", url: STORE_URL },
    { name: "Productos", url: `${STORE_URL}/products` },
    { name: product.title, url: `${STORE_URL}/products/${product.handle}` },
  ])

  return (
    <>
      {/* Structured Data - invisible para usuarios, visible para Google */}
      <ProductJsonLd
        product={{
          name: product.title,
          description: product.description || "",
          handle: product.handle,
          images: product.images?.map((img: any) => img.url) || [],
          price,
          currency: "USD",
          inStock: variant?.inventory_quantity > 0,
          sku: variant?.sku,
          category: product.collection?.title,
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      {/* Tu UI del producto aqui */}
      <div>{/* ... */}</div>
    </>
  )
}
```

### app/layout.tsx - JSON-LD global (Organization + WebSite)

```tsx
import { generateOrganizationJsonLd, generateWebsiteJsonLd } from "@/lib/seo"

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        {/* JSON-LD global - Organization y WebSite */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(generateOrganizationJsonLd()),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(generateWebsiteJsonLd()),
          }}
        />
        {children}
      </body>
    </html>
  )
}
```

### Checklist SEO completo (equivalente a Yoast)

| Funcionalidad Yoast/AIOSEO | Solucion Next.js | Archivo |
|---|---|---|
| Meta title y description | `generateMetadata()` | Cada page.tsx |
| Open Graph tags | `openGraph` en Metadata | lib/seo.ts |
| Twitter Cards | `twitter` en Metadata | lib/seo.ts |
| Canonical URLs | `alternates.canonical` | lib/seo.ts |
| Sitemap XML | `app/sitemap.ts` | app/sitemap.ts |
| robots.txt | `app/robots.ts` | app/robots.ts |
| Product rich snippets | JSON-LD Product | ProductJsonLd.tsx |
| Breadcrumbs en SERPs | JSON-LD BreadcrumbList | lib/seo.ts |
| Knowledge Panel | JSON-LD Organization | app/layout.tsx |
| Sitelinks Searchbox | JSON-LD WebSite + SearchAction | app/layout.tsx |
| Noindex paginas privadas | robots.ts disallow | app/robots.ts |
| Keyword optimization | Contenido semantico + metadata | Manual |

---

## Paso 10: CMS de Contenido con Sanity (Reemplaza la edicion en WordPress)

Medusa gestiona productos, ordenes e inventario. Pero el contenido editorial del
storefront (banners, textos, paginas, promociones) necesita un CMS que cualquier
persona pueda editar sin tocar codigo. Sanity cumple ese rol.

### Por que Sanity

- **Plan gratuito generoso**: hasta 20 usuarios, datasets ilimitados en tipos de contenido
- **Sanity Studio**: panel de admin React que se embebe como ruta dentro de tu Next.js
- **Visual Editing**: edicion en vivo con preview en tiempo real del storefront
- **GROQ**: lenguaje de queries potente y flexible para consultar contenido
- **CDN global**: content lake con API rapida desde cualquier ubicacion
- **next-sanity**: toolkit oficial para Next.js App Router

### Que se gestiona en cada sistema

| Contenido | Sistema | Quien lo edita |
|---|---|---|
| Productos, variantes, precios | **Medusa Admin** | Equipo de tienda |
| Ordenes, inventario, envios | **Medusa Admin** | Equipo de tienda |
| Hero banners, promos | **Sanity Studio** | Marketing / Owner |
| Paginas estaticas (About, FAQ) | **Sanity Studio** | Marketing / Owner |
| Categorias destacadas homepage | **Sanity Studio** | Marketing / Owner |
| Anuncios y notificaciones | **Sanity Studio** | Marketing / Owner |
| Blog / contenido editorial | **Sanity Studio** | Marketing / Owner |
| SEO metadata custom | **Sanity Studio** | Marketing / Owner |

### Instalacion

```bash
# Desde la raiz del storefront
cd storefront

# Instalar dependencias de Sanity
npm install next-sanity @sanity/image-url @sanity/vision sanity

# Inicializar proyecto Sanity (crea sanity.config.ts y sanity.cli.ts)
npx sanity@latest init --env .env.local

# Cuando pregunte:
# - Project name: ryo-store-cms
# - Dataset: production
# - Project output path: (el directorio actual del storefront)
# - Would you like to add configuration files for a Sanity project in this Next.js folder? YES
```

### Variables de entorno (.env.local)

```env
# Sanity (se agregan automaticamente con sanity init)
NEXT_PUBLIC_SANITY_PROJECT_ID=tu-project-id
NEXT_PUBLIC_SANITY_DATASET=production
SANITY_API_READ_TOKEN=sk-xxxxxxxxxxxxxxxx   # Para preview/draft
```

### Estructura de archivos Sanity en el storefront

```
storefront/
├── sanity/
│   ├── lib/
│   │   ├── client.ts           # Cliente Sanity configurado
│   │   ├── image.ts            # Helper para URLs de imagenes
│   │   └── queries.ts          # Todas las GROQ queries centralizadas
│   └── schemas/
│       ├── index.ts            # Export de todos los schemas
│       ├── homepage.ts         # Schema: secciones de la homepage
│       ├── heroBanner.ts       # Schema: hero banners
│       ├── announcement.ts     # Schema: barra de anuncios
│       ├── promoSection.ts     # Schema: secciones promocionales
│       ├── page.ts             # Schema: paginas estaticas (About, FAQ)
│       ├── blogPost.ts         # Schema: articulos de blog
│       ├── faq.ts              # Schema: preguntas frecuentes
│       ├── storeInfo.ts        # Schema: datos de la tienda (horarios, contacto)
│       └── seoSettings.ts      # Schema: SEO global overrides
├── sanity.config.ts            # Configuracion de Sanity Studio
├── sanity.cli.ts               # CLI config
└── src/
    └── app/
        └── studio/
            └── [[...tool]]/
                └── page.tsx    # Sanity Studio embebido en /studio
```

### sanity/lib/client.ts - Cliente Sanity

```typescript
import { createClient } from "next-sanity"

export const client = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET!,
  apiVersion: "2024-01-01",
  useCdn: true, // CDN para produccion, false para previews
})

// Cliente para draft/preview content
export const previewClient = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET!,
  apiVersion: "2024-01-01",
  useCdn: false,
  token: process.env.SANITY_API_READ_TOKEN,
})
```

### sanity/lib/image.ts - Helper de imagenes

```typescript
import imageUrlBuilder from "@sanity/image-url"
import { client } from "./client"

const builder = imageUrlBuilder(client)

export function urlFor(source: any) {
  return builder.image(source)
}

// Uso: urlFor(banner.image).width(1200).height(600).url()
```

### sanity/schemas/heroBanner.ts - Schema de Hero Banner

```typescript
import { defineType, defineField } from "sanity"

export default defineType({
  name: "heroBanner",
  title: "Hero Banner",
  type: "document",
  fields: [
    defineField({
      name: "title",
      title: "Titulo principal",
      type: "string",
      validation: (Rule) => Rule.required().max(80),
    }),
    defineField({
      name: "subtitle",
      title: "Subtitulo",
      type: "string",
      validation: (Rule) => Rule.max(150),
    }),
    defineField({
      name: "image",
      title: "Imagen de fondo",
      type: "image",
      options: { hotspot: true }, // permite recortar desde el Studio
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "imageMobile",
      title: "Imagen mobile (opcional)",
      type: "image",
      options: { hotspot: true },
      description: "Si no se sube, se usa la imagen principal recortada",
    }),
    defineField({
      name: "ctaText",
      title: "Texto del boton",
      type: "string",
      initialValue: "Ver productos",
    }),
    defineField({
      name: "ctaLink",
      title: "Link del boton",
      type: "string",
      initialValue: "/products",
    }),
    defineField({
      name: "isActive",
      title: "Activo",
      type: "boolean",
      initialValue: true,
      description: "Desactivar para ocultar sin eliminar",
    }),
    defineField({
      name: "order",
      title: "Orden",
      type: "number",
      initialValue: 0,
      description: "Menor numero = aparece primero",
    }),
  ],
  preview: {
    select: { title: "title", media: "image", active: "isActive" },
    prepare({ title, media, active }) {
      return {
        title: `${active ? "" : "[OFF] "}${title}`,
        media,
      }
    },
  },
})
```

### sanity/schemas/announcement.ts - Barra de anuncios

```typescript
import { defineType, defineField } from "sanity"

export default defineType({
  name: "announcement",
  title: "Barra de Anuncios",
  type: "document",
  fields: [
    defineField({
      name: "message",
      title: "Mensaje",
      type: "string",
      validation: (Rule) => Rule.required().max(100),
      description: "Ej: 'Envio gratis en Caracas por compras mayores a $30'",
    }),
    defineField({
      name: "link",
      title: "Link (opcional)",
      type: "string",
    }),
    defineField({
      name: "backgroundColor",
      title: "Color de fondo",
      type: "string",
      initialValue: "#000000",
      description: "Hex color. Ej: #000000 para negro, #16a34a para verde",
    }),
    defineField({
      name: "textColor",
      title: "Color de texto",
      type: "string",
      initialValue: "#ffffff",
    }),
    defineField({
      name: "isActive",
      title: "Activo",
      type: "boolean",
      initialValue: true,
    }),
  ],
})
```

### sanity/schemas/page.ts - Paginas estaticas editables

```typescript
import { defineType, defineField } from "sanity"

export default defineType({
  name: "page",
  title: "Paginas",
  type: "document",
  fields: [
    defineField({
      name: "title",
      title: "Titulo",
      type: "string",
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "slug",
      title: "URL slug",
      type: "slug",
      options: { source: "title" },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "content",
      title: "Contenido",
      type: "array",
      of: [
        { type: "block" }, // Rich text (negritas, cursiva, links, etc)
        {
          type: "image",
          options: { hotspot: true },
          fields: [
            { name: "alt", title: "Texto alternativo", type: "string" },
            { name: "caption", title: "Pie de imagen", type: "string" },
          ],
        },
      ],
    }),
    defineField({
      name: "seo",
      title: "SEO",
      type: "object",
      fields: [
        { name: "metaTitle", title: "Meta Title", type: "string" },
        { name: "metaDescription", title: "Meta Description", type: "text", rows: 3 },
        { name: "ogImage", title: "Imagen Open Graph", type: "image" },
      ],
    }),
  ],
})
```

### sanity/schemas/promoSection.ts - Secciones promocionales

```typescript
import { defineType, defineField } from "sanity"

export default defineType({
  name: "promoSection",
  title: "Seccion Promocional",
  type: "document",
  fields: [
    defineField({
      name: "title",
      title: "Titulo interno (no se muestra)",
      type: "string",
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "location",
      title: "Ubicacion en la pagina",
      type: "string",
      options: {
        list: [
          { title: "Homepage - Debajo del hero", value: "home_below_hero" },
          { title: "Homepage - Mitad de pagina", value: "home_middle" },
          { title: "Homepage - Antes del footer", value: "home_above_footer" },
          { title: "Sidebar - Catalogo", value: "catalog_sidebar" },
        ],
      },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "heading",
      title: "Titulo visible",
      type: "string",
    }),
    defineField({
      name: "description",
      title: "Descripcion",
      type: "text",
      rows: 3,
    }),
    defineField({
      name: "image",
      title: "Imagen",
      type: "image",
      options: { hotspot: true },
    }),
    defineField({
      name: "ctaText",
      title: "Texto del boton",
      type: "string",
    }),
    defineField({
      name: "ctaLink",
      title: "Link del boton",
      type: "string",
    }),
    defineField({
      name: "isActive",
      title: "Activo",
      type: "boolean",
      initialValue: true,
    }),
  ],
})
```

### sanity/schemas/storeInfo.ts - Informacion de la tienda

```typescript
import { defineType, defineField } from "sanity"

export default defineType({
  name: "storeInfo",
  title: "Informacion de la Tienda",
  type: "document",
  // Singleton: solo un documento de este tipo
  fields: [
    defineField({
      name: "storeName",
      title: "Nombre de la tienda",
      type: "string",
      initialValue: "RYO Store",
    }),
    defineField({
      name: "whatsapp",
      title: "Numero de WhatsApp",
      type: "string",
      description: "Con codigo de pais. Ej: +584121234567",
    }),
    defineField({
      name: "instagram",
      title: "Instagram",
      type: "string",
      description: "Solo el usuario sin @. Ej: ryostore",
    }),
    defineField({
      name: "email",
      title: "Email de contacto",
      type: "string",
    }),
    defineField({
      name: "address",
      title: "Direccion fisica (si aplica)",
      type: "text",
      rows: 2,
    }),
    defineField({
      name: "schedule",
      title: "Horario de atencion",
      type: "string",
      description: "Ej: Lunes a Viernes 9am - 6pm",
    }),
    defineField({
      name: "paymentMethods",
      title: "Metodos de pago",
      type: "array",
      of: [
        {
          type: "object",
          fields: [
            { name: "method", title: "Metodo", type: "string",
              options: {
                list: [
                  { title: "Pago Movil", value: "pago_movil" },
                  { title: "Zelle", value: "zelle" },
                  { title: "Binance Pay", value: "binance_pay" },
                  { title: "Transferencia", value: "transferencia" },
                ],
              },
            },
            { name: "details", title: "Datos del pago", type: "text", rows: 4,
              description: "Banco, telefono, cedula, email, etc." },
            { name: "isActive", title: "Activo", type: "boolean", initialValue: true },
          ],
        },
      ],
    }),
  ],
})
```

### sanity/schemas/index.ts - Exportar todos los schemas

```typescript
import heroBanner from "./heroBanner"
import announcement from "./announcement"
import page from "./page"
import promoSection from "./promoSection"
import storeInfo from "./storeInfo"

export const schemaTypes = [
  heroBanner,
  announcement,
  page,
  promoSection,
  storeInfo,
]
```

### sanity.config.ts - Configuracion del Studio

```typescript
import { defineConfig } from "sanity"
import { structureTool } from "sanity/structure"
import { visionTool } from "@sanity/vision"
import { schemaTypes } from "./sanity/schemas"

export default defineConfig({
  name: "ryo-store",
  title: "RYO Store CMS",

  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET!,

  plugins: [
    structureTool({
      structure: (S) =>
        S.list()
          .title("Contenido")
          .items([
            // Singleton: Info de la tienda
            S.listItem()
              .title("Informacion de la Tienda")
              .child(
                S.document()
                  .schemaType("storeInfo")
                  .documentId("storeInfo")
              ),
            S.divider(),
            // Listas normales
            S.documentTypeListItem("heroBanner").title("Hero Banners"),
            S.documentTypeListItem("announcement").title("Anuncios"),
            S.documentTypeListItem("promoSection").title("Secciones Promocionales"),
            S.divider(),
            S.documentTypeListItem("page").title("Paginas"),
          ]),
    }),
    visionTool(), // Para testear GROQ queries en el Studio
  ],

  schema: {
    types: schemaTypes,
  },
})
```

### app/studio/[[...tool]]/page.tsx - Studio embebido

```tsx
"use client"

import { NextStudio } from "next-sanity/studio"
import config from "../../../../sanity.config"

export default function StudioPage() {
  return <NextStudio config={config} />
}
```

### sanity/lib/queries.ts - Queries GROQ centralizadas

```typescript
import { client } from "./client"

// Hero banners activos, ordenados
export async function getHeroBanners() {
  return client.fetch(
    `*[_type == "heroBanner" && isActive == true] | order(order asc) {
      _id,
      title,
      subtitle,
      image,
      imageMobile,
      ctaText,
      ctaLink
    }`
  )
}

// Anuncio activo (solo el primero)
export async function getAnnouncement() {
  return client.fetch(
    `*[_type == "announcement" && isActive == true][0] {
      message,
      link,
      backgroundColor,
      textColor
    }`
  )
}

// Secciones promo por ubicacion
export async function getPromoSections(location: string) {
  return client.fetch(
    `*[_type == "promoSection" && isActive == true && location == $location] {
      _id,
      heading,
      description,
      image,
      ctaText,
      ctaLink
    }`,
    { location }
  )
}

// Pagina estatica por slug
export async function getPage(slug: string) {
  return client.fetch(
    `*[_type == "page" && slug.current == $slug][0] {
      title,
      slug,
      content,
      seo
    }`,
    { slug }
  )
}

// Info de la tienda (singleton)
export async function getStoreInfo() {
  return client.fetch(
    `*[_type == "storeInfo"][0] {
      storeName,
      whatsapp,
      instagram,
      email,
      address,
      schedule,
      paymentMethods
    }`
  )
}
```

### Ejemplo: Homepage consumiendo Sanity + Medusa

```tsx
// app/(main)/page.tsx
import { getHeroBanners, getAnnouncement, getPromoSections } from "@/sanity/lib/queries"
import { urlFor } from "@/sanity/lib/image"
// + imports de productos desde Medusa SDK

export const revalidate = 60 // ISR: revalidar cada 60 segundos

export default async function HomePage() {
  // Fetch en paralelo: contenido de Sanity + productos de Medusa
  const [banners, announcement, promos] = await Promise.all([
    getHeroBanners(),
    getAnnouncement(),
    getPromoSections("home_below_hero"),
    // getProducts() desde Medusa...
  ])

  return (
    <>
      {/* Barra de anuncio editable desde Sanity */}
      {announcement && (
        <div style={{
          backgroundColor: announcement.backgroundColor,
          color: announcement.textColor,
        }}>
          {announcement.link ? (
            <a href={announcement.link}>{announcement.message}</a>
          ) : (
            <p>{announcement.message}</p>
          )}
        </div>
      )}

      {/* Hero banner editable desde Sanity */}
      {banners?.map((banner: any) => (
        <section key={banner._id}>
          <img
            src={urlFor(banner.image).width(1920).height(700).url()}
            alt={banner.title}
          />
          <h1>{banner.title}</h1>
          <p>{banner.subtitle}</p>
          <a href={banner.ctaLink}>{banner.ctaText}</a>
        </section>
      ))}

      {/* Productos destacados desde Medusa */}
      {/* <ProductGrid products={featuredProducts} /> */}

      {/* Secciones promo editables desde Sanity */}
      {promos?.map((promo: any) => (
        <section key={promo._id}>
          <h2>{promo.heading}</h2>
          <p>{promo.description}</p>
          <a href={promo.ctaLink}>{promo.ctaText}</a>
        </section>
      ))}
    </>
  )
}
```

### Acceso al Studio

Una vez configurado, el equipo accede a:

- **Sanity Studio**: `https://ryostore.com/studio`
- **Medusa Admin**: `https://admin.ryostore.com/app` (o el dominio que configures)

Desde el Studio, cualquier persona sin conocimiento tecnico puede:
cambiar los banners de la homepage, editar textos y imagenes de secciones promo,
crear y editar paginas como "Sobre Nosotros" o FAQ, actualizar los datos de
contacto y metodos de pago, y activar/desactivar anuncios estacionales.

---

## Notas Importantes

- **Tasa de cambio**: Usar API del BCV o Monitor Dolar para conversion USD/Bs en tiempo real
- **WhatsApp**: Integrar boton de WhatsApp para soporte y notificaciones de pago
- **SEO**: Medusa + Next.js con SSR es excelente para SEO. Aprovechar metadata, og:tags, sitemap
- **Imagenes**: Usar Medusa File Service o Cloudinary para imagenes de productos
- **Analytics**: Google Analytics 4 o Plausible (privacy-friendly)
