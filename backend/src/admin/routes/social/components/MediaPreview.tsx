import { useState } from "react"

// Admin is served from enrola.shop but /static/* lives on api.enrola.shop.
// Resolve relative URLs to absolute so media actually loads from the backend.
const ASSET_BASE = "https://api.enrola.shop"
// Cache-bust token — bumped when we re-render media in place. Prevents the
// browser from serving a stale disk-cache copy when bytes change but the
// filename stays the same.
const MEDIA_VERSION = "20260425c"

const abs = (u: string | null | undefined): string | undefined => {
  if (!u) return undefined
  if (u.startsWith("http://") || u.startsWith("https://") || u.startsWith("data:")) return u
  const full = `${ASSET_BASE}${u.startsWith("/") ? "" : "/"}${u}`
  const sep = full.includes("?") ? "&" : "?"
  return `${full}${sep}v=${MEDIA_VERSION}`
}

/**
 * Renders post media:
 *  - Single image → <img>
 *  - Multiple images (carousel) → horizontal scroll with dot nav
 *  - Video (.mp4) → <video> with cover as poster
 */
export function MediaPreview({
  cover,
  urls,
  aspect = "4/5",
}: {
  cover: string | null
  urls: string[]
  aspect?: "4/5" | "9/16" | "1/1"
}) {
  const [idx, setIdx] = useState(0)
  if (urls.length === 0) return null

  const first = urls[0]
  const isVideo = first.endsWith(".mp4") || first.startsWith("data:video/")
  const aspectClass = { "4/5": "aspect-[4/5]", "9/16": "aspect-[9/16]", "1/1": "aspect-square" }[aspect]

  if (isVideo && urls.length === 1) {
    return (
      <div className={`w-full ${aspectClass} bg-ui-bg-base overflow-hidden rounded-md border border-ui-border-base`}>
        <video
          src={abs(first)}
          poster={abs(cover) ?? undefined}
          controls
          preload="metadata"
          playsInline
          className="w-full h-full object-contain bg-black"
        />
      </div>
    )
  }

  if (urls.length === 1) {
    return (
      <div className={`w-full ${aspectClass} bg-ui-bg-base overflow-hidden rounded-md border border-ui-border-base`}>
        <img src={abs(first)} alt="" className="w-full h-full object-contain" loading="lazy" />
      </div>
    )
  }

  // Carousel
  return (
    <div className="w-full flex flex-col gap-2">
      <div className={`w-full ${aspectClass} bg-ui-bg-base overflow-hidden rounded-md border border-ui-border-base relative`}>
        <img src={abs(urls[idx])} alt="" className="w-full h-full object-contain" loading="lazy" />
        <div className="absolute top-2 right-2 text-xs bg-black/70 text-white rounded px-2 py-0.5 font-mono">
          {idx + 1} / {urls.length}
        </div>
      </div>
      <div className="flex justify-center gap-1.5">
        {urls.map((_, i) => (
          <button
            key={i}
            onClick={() => setIdx(i)}
            aria-label={`Slide ${i + 1}`}
            className={`h-1.5 rounded-full transition-all ${
              i === idx ? "w-6 bg-ui-fg-base" : "w-1.5 bg-ui-fg-muted"
            }`}
          />
        ))}
      </div>
    </div>
  )
}
