/* Enrola Panel · Service Worker mínimo
 *
 * Estrategia:
 *  - Network-first para todo (es un panel admin con datos siempre frescos)
 *  - Fallback a cache para assets estáticos (logos, fonts, manifest)
 *  - Offline page cuando no hay red ni cache
 *
 * No cachear /api/* porque cambian constantemente.
 * No cachear ?_rsc tampoco (server components hidratables).
 */

const CACHE_VERSION = "enrola-panel-v1"
const ASSET_CACHE = `${CACHE_VERSION}-assets`

const PRECACHE = [
  "/logo.svg",
  "/manifest.webmanifest",
]

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(ASSET_CACHE).then((cache) => cache.addAll(PRECACHE).catch(() => null))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k.startsWith("enrola-panel-") && !k.startsWith(CACHE_VERSION))
          .map((k) => caches.delete(k)),
      ),
    ).then(() => self.clients.claim()),
  )
})

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url)

  // Solo same-origin GET
  if (event.request.method !== "GET") return
  if (url.origin !== self.location.origin) return

  // No interceptar API ni RSC payloads ni Next data
  if (url.pathname.startsWith("/api/")) return
  if (url.search.includes("_rsc")) return
  if (url.pathname.startsWith("/_next/data/")) return

  // Static assets — cache-first
  const isAsset = url.pathname.startsWith("/_next/static/")
                || url.pathname.startsWith("/icon-")
                || url.pathname.endsWith(".svg")
                || url.pathname.endsWith(".webmanifest")
                || url.pathname.endsWith(".woff2")
                || url.pathname.endsWith(".woff")
                || url.pathname.endsWith(".png")
                || url.pathname.endsWith(".jpg")
                || url.pathname.endsWith(".webp")

  if (isAsset) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached
        return fetch(event.request).then((res) => {
          if (res.ok) {
            const clone = res.clone()
            caches.open(ASSET_CACHE).then((c) => c.put(event.request, clone))
          }
          return res
        }).catch(() => caches.match("/logo.svg"))
      }),
    )
    return
  }

  // Pages — network-first con fallback a cache (último HTML visto)
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        if (res.ok) {
          const clone = res.clone()
          caches.open(ASSET_CACHE).then((c) => c.put(event.request, clone))
        }
        return res
      })
      .catch(() => caches.match(event.request).then((cached) => cached ?? caches.match("/logo.svg"))),
  )
})
