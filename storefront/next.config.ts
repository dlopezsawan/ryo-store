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
    // Baseline security headers applied to every route. Compliance:
    // docs/compliance/02-WEB.md §12.2.
    //   - HSTS: forces HTTPS for one year on all subdomains. Safe to
    //     set globally because every public host is already HTTPS.
    //   - X-Frame-Options DENY: blocks the storefront from being
    //     iframed (clickjacking).
    //   - X-Content-Type-Options nosniff: stops the browser from
    //     guessing MIME types (XSS via fake images, etc.).
    //   - Referrer-Policy strict-origin-when-cross-origin: don't leak
    //     full URLs to third parties via Referer.
    //   - Permissions-Policy: hard-deny camera/mic/geolocation — none
    //     of those are used today; revisit when a feature needs them.
    //   - CSP: deliberately NOT set globally yet — the homepage uses
    //     inline JSON-LD scripts and lazy-loads pixels from several
    //     third-party origins that would each need to be allow-listed.
    //     Better to enable CSP per-route once we've audited everything
    //     than ship a broken CSP that breaks production. Tracked as a
    //     follow-up.
    const baselineSecurity = [
      { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    ];
    return [
      {
        // Apply baseline security headers to ALL routes. Cache-Control
        // headers below override `Cache-Control` only — the security
        // headers compose because Next merges by route + key.
        source: "/:path*",
        headers: baselineSecurity,
      },
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
