import type { Metadata } from "next";

const STORE_NAME = "Enrola Shop";
const STORE_URL =
  process.env.NEXT_PUBLIC_STORE_URL || "https://enrola.shop";
const STORE_DESCRIPTION =
  "Rolling papers, conos prearmados, grinders y filtros con envío a toda Venezuela. Accesorios de tabaco artesanal. Pago móvil + envíos MRW y same-day en Valencia.";

// ============================================================
// METADATA HELPERS
// ============================================================

export interface ProductSEO {
  title: string;
  description: string;
  handle: string;
  image?: string;
  price?: number;
  currency?: string;
  availability?: boolean;
  category?: string;
}

export interface CollectionSEO {
  title: string;
  description: string;
  handle: string;
  image?: string;
}

/**
 * Metadata para la homepage
 */
export function getHomeMetadata(): Metadata {
  return {
    title: `Rolling Papers, Conos y Grinders en Venezuela | ${STORE_NAME}`,
    description: STORE_DESCRIPTION,
    keywords: [
      "rolling papers venezuela",
      "papers king size",
      "conos prearmados",
      "grinders",
      "filtros de cartón",
      "filtros de carbón activo",
      "accesorios tabaco venezuela",
      "tienda de papers valencia",
      "roll your own",
    ],
    openGraph: {
      title: `Rolling Papers, Conos y Grinders en Venezuela | ${STORE_NAME}`,
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
          alt: `${STORE_NAME} - Parafernalia Canábica`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `Rolling Papers, Conos y Grinders en Venezuela | ${STORE_NAME}`,
      description: STORE_DESCRIPTION,
      images: [`${STORE_URL}/images/og-home.jpg`],
    },
    alternates: {
      canonical: STORE_URL,
    },
  };
}

/**
 * Metadata para página de producto
 */
export function getProductMetadata(product: ProductSEO): Metadata {
  const title = `${product.title} | ${STORE_NAME}`;
  const url = `${STORE_URL}/productos/${product.handle}`;
  const imageUrl = product.image?.startsWith("/")
    ? `${STORE_URL}${product.image}`
    : product.image;

  return {
    title,
    description: product.description,
    openGraph: {
      title,
      description: product.description,
      url,
      siteName: STORE_NAME,
      type: "website",
      locale: "es_VE",
      images: imageUrl
        ? [{ url: imageUrl, width: 800, height: 800, alt: product.title }]
        : [],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: product.description,
      images: imageUrl ? [imageUrl] : [],
    },
    alternates: {
      canonical: url,
    },
  };
}

/**
 * Metadata para página de colección/tienda
 */
export function getCollectionMetadata(
  collection: CollectionSEO
): Metadata {
  const title = `${collection.title} | ${STORE_NAME}`;
  const url = `${STORE_URL}/tienda`;

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
        ? [
            {
              url: collection.image.startsWith("/")
                ? `${STORE_URL}${collection.image}`
                : collection.image,
              width: 1200,
              height: 630,
              alt: collection.title,
            },
          ]
        : [],
    },
    alternates: {
      canonical: url,
    },
  };
}

/**
 * Metadata genérica para páginas estáticas (Contacto, Login, etc.)
 */
export function getPageMetadata(title: string, description?: string, path?: string): Metadata {
  const fullTitle = `${title} | ${STORE_NAME}`;
  const fullDescription = description || STORE_DESCRIPTION;
  const url = path ? `${STORE_URL}${path}` : STORE_URL;

  return {
    title: fullTitle,
    description: fullDescription,
    openGraph: {
      title: fullTitle,
      description: fullDescription,
      url,
      siteName: STORE_NAME,
      type: "website",
      locale: "es_VE",
    },
    alternates: {
      canonical: url,
    },
  };
}

// ============================================================
// JSON-LD STRUCTURED DATA
// ============================================================

export interface ProductSchemaInput {
  name: string;
  description: string;
  handle: string;
  image: string[];
  price: number;
  currency: string;
  availability: boolean;
  sku?: string;
  brand?: string;
  category?: string;
  ratingValue?: number;
  reviewCount?: number;
}

/**
 * Schema.org Product - rich snippets en Google
 */
export function generateProductJsonLd(product: ProductSchemaInput) {
  const imageUrls = product.image.map((img) =>
    img.startsWith("/") ? `${STORE_URL}${img}` : img
  );

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    image: imageUrls,
    url: `${STORE_URL}/productos/${product.handle}`,
    sku: product.sku,
    brand: product.brand
      ? { "@type": "Brand", name: product.brand }
      : undefined,
    category: product.category,
    offers: {
      "@type": "Offer",
      price: product.price,
      priceCurrency: product.currency || "EUR",
      availability: product.availability
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      url: `${STORE_URL}/productos/${product.handle}`,
      seller: {
        "@type": "Organization",
        name: STORE_NAME,
      },
    },
    // Nota: aggregateRating removido hasta tener reseñas reales verificables
    // en la página (evita structured-data spam manual actions de Google).
  };
}

/**
 * Schema.org Organization - Knowledge Panel
 */
export function generateOrganizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: STORE_NAME,
    url: STORE_URL,
    logo: `${STORE_URL}/logo-web-nuevo.svg`,
    description: STORE_DESCRIPTION,
    alternateName: "Enrola",
    address: {
      "@type": "PostalAddress",
      addressCountry: "VE",
    },
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer service",
      availableLanguage: "Spanish",
      url: `${STORE_URL}/contacto`,
    },
    sameAs: [
      "https://instagram.com/ryo.smoke",
      "https://tiktok.com/@ryo.smoke",
    ],
  };
}

/**
 * Schema.org BreadcrumbList - breadcrumbs en SERPs
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
      item: item.url.startsWith("http") ? item.url : `${STORE_URL}${item.url}`,
    })),
  };
}

/**
 * Schema.org WebSite + SearchAction - sitelinks searchbox
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
        urlTemplate: `${STORE_URL}/tienda?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}
