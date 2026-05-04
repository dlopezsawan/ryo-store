import { Text } from "@medusajs/ui"
import type { SocialPost } from "../types"
import { FeedbackPanel } from "./FeedbackPanel"

const ASSET_BASE = "https://api.enrola.shop"
/** Keep in sync with other components that bust image caches on re-render. */
const MEDIA_VERSION = "20260425c"

/**
 * Cover review content — NO outer container, NO header. Designed to be
 * mounted inside a tab panel (see PostCard's Reel tab group).
 *
 * Renders:
 *   - 9:16 cover image with a dashed overlay marking the 1:1 grid-crop band
 *     (y: 21.875%–78.125%), so reviewers see what IG shows in the grid vs
 *     only when the reel plays
 *   - Explanatory caption
 *   - Feedback panel scoped to the same post id
 */
export function ReelCoverPreview({ post }: { post: SocialPost }) {
  if (post.format !== "Reel" || !post.cover_url) return null

  const src = resolveAsset(post.cover_url)

  return (
    <div className="flex flex-col gap-2">
      <div className="relative mx-auto w-full max-w-[260px] aspect-[9/16] rounded-md overflow-hidden border border-ui-border-base bg-ui-bg-subtle">
        <img
          src={src}
          alt=""
          className="w-full h-full object-contain"
          loading="lazy"
        />
        {/* Dashed overlay = the 1:1 center band IG shows in the feed grid */}
        <div
          className="absolute left-0 right-0 pointer-events-none border-y-2 border-dashed border-ui-fg-interactive/60"
          style={{ top: "21.875%", height: "56.25%" }}
          aria-hidden
        />
        <div
          className="absolute bottom-1 left-1 right-1 text-center"
          aria-hidden
        >
          <span className="inline-block text-[9px] font-semibold tracking-wide uppercase bg-ui-fg-interactive text-ui-fg-on-inverted px-1.5 py-0.5 rounded">
            grid 1:1
          </span>
        </div>
      </div>

      <Text size="xsmall" className="text-ui-fg-muted text-center">
        Dentro de la línea punteada es lo que se ve en el feed grid · lo de afuera solo al abrir el reel · Buffer la usa como thumbnail
      </Text>

      <FeedbackPanel entityType="post" entityId={post.id} />
    </div>
  )
}

function resolveAsset(url: string): string {
  if (!url) return url
  const full =
    url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:")
      ? url
      : `${ASSET_BASE}${url.startsWith("/") ? "" : "/"}${url}`
  if (full.startsWith("data:")) return full
  const sep = full.includes("?") ? "&" : "?"
  return `${full}${sep}v=${MEDIA_VERSION}`
}
