import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
      { protocol: "http", hostname: "localhost", pathname: "/**" },
    ],
    // Force Next/image to cache optimized outputs for 1 year regardless of upstream Cache-Control.
    // Medusa returns max-age=14400, must-revalidate which prevents Cloudflare from caching.
    minimumCacheTTL: 31536000,
    // Inline (default is 'attachment' which forces download prompt if the user opens the image URL directly).
    contentDispositionType: "inline",
  },
  async redirects() {
    // 301 redirects para slugs unificados al español (Batch 6 del SEO plan)
    return [
      { source: "/productos/alien-puff-glass", destination: "/productos/papel-celulosa-transparente", permanent: true },
      { source: "/productos/rolling-paper-sabores-alien-puff", destination: "/productos/papel-sabores-alien-puff", permanent: true },
      // Nota: /productos/conos-rolling-paper NO se redirige porque otro producto
      // nuevo está usando ese handle actualmente. El viejo movió a conos-hemp-natural
      // pero sin redirect para no romper el nuevo.
      { source: "/productos/filtros-carton-perforado-puffman", destination: "/productos/filtros-carton-perforado", permanent: true },

      // Legacy English /cart and /cart/handoff. The storefront standardized
      // on /carrito (Spanish) — /cart never existed as a real route, but
      // earlier versions of the abandoned-cart job and Dana's bot generated
      // links pointing there. These redirects catch old WhatsApp / email
      // messages still in customer inboxes so a click doesn't 404.
      // Path-preserving redirect for deep links (handoff?cart_id=...).
      { source: "/cart", destination: "/carrito", permanent: true },
      { source: "/cart/:path*", destination: "/carrito/:path*", permanent: true },
    ];
  },
  async headers() {
    return [
      {
        // JS/CSS con hash en nombre → immutable (1 año) solo en producción
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: isDev
              ? "no-store"
              : "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        // Imágenes optimizadas por Next.js Image → 1 día + stale-while-revalidate 7 días
        source: "/_next/image",
        headers: [
          { key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" },
        ],
      },
      {
        // Fonts WOFF2 → 1 año immutable (nombre versionado vía hash en deploy)
        source: "/:path*.woff2",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        // Assets estáticos públicos (svg, png, jpg, webp, ico) → 1 mes + SWR 3 meses
        source: "/:path*.(svg|png|jpg|jpeg|webp|ico)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=2592000, stale-while-revalidate=7776000" },
        ],
      },
      {
        // Home: 60s edge cache + SWR 5 min (ISR via revalidate=60)
        source: "/",
        headers: [
          { key: "Cache-Control", value: "public, s-maxage=60, stale-while-revalidate=300" },
        ],
      },
      {
        source: "/tienda",
        headers: [
          { key: "Cache-Control", value: "public, s-maxage=60, stale-while-revalidate=300" },
        ],
      },
      {
        source: "/productos/:handle",
        headers: [
          { key: "Cache-Control", value: "public, s-maxage=120, stale-while-revalidate=600" },
        ],
      },
      {
        source: "/:path(faq|terminos|privacidad|devoluciones|mayoristas)",
        headers: [
          { key: "Cache-Control", value: "public, s-maxage=3600, stale-while-revalidate=86400" },
        ],
      },
    ];
  },
};

export default nextConfig;
