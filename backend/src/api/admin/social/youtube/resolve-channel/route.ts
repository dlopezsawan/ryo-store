/**
 * GET /admin/social/youtube/resolve-channel?input=<url-or-handle-or-id>
 *
 * Turn whatever the user pasted into a clean { channel_id, name } pair so
 * the subscription form doesn't make them open DevTools to find the UCxxx.
 *
 * Accepted inputs:
 *   - "UCxxxxxxxxxxxxxxxxxxxxxx"          (already an id, just validate)
 *   - "https://www.youtube.com/channel/UCxxx..."
 *   - "https://www.youtube.com/@enrolaShop"
 *   - "https://www.youtube.com/c/SomeChannel"
 *   - "https://www.youtube.com/user/legacyName"
 *   - "@enrolaShop"
 *   - "youtube.com/@enrolaShop"
 *   - bare channel name (best-effort search via page fetch)
 *
 * Strategy:
 *   1. If input matches /^UC[A-Za-z0-9_-]{20,30}$/ → return as-is, fetch
 *      the channel page just to grab the friendly name.
 *   2. Otherwise, normalize to a YouTube URL and fetch. The HTML contains
 *      multiple copies of the channelId in different formats:
 *        - <meta itemprop="channelId" content="UCxxx">
 *        - <link rel="canonical" href=".../channel/UCxxx">
 *        - "channelId":"UCxxx"  (in inline JSON)
 *        - "externalId":"UCxxx" (also inline JSON)
 *      We try them in that order. The og:title is used for the name.
 *
 * Why server-side and not client-side: cross-origin fetch to youtube.com
 * is blocked by CORS in the browser, and we don't want to embed a
 * scraping iframe. A simple authenticated GET is fine here.
 */
import { MedusaRequest, MedusaResponse } from "@medusajs/framework"

interface ResolveResult {
  channel_id: string
  name: string
  url: string
}

const UC_RE = /^UC[A-Za-z0-9_-]{20,30}$/

function normalizeToUrl(input: string): string {
  const s = input.trim()
  // Already an URL
  if (/^https?:\/\//i.test(s)) return s
  // Bare youtube.com/...
  if (/^(www\.)?youtube\.com\//i.test(s)) return `https://${s.replace(/^www\./, "www.")}`
  // Bare @handle
  if (s.startsWith("@")) return `https://www.youtube.com/${s}`
  // Bare channel id (caller should special-case this before calling us)
  if (UC_RE.test(s)) return `https://www.youtube.com/channel/${s}`
  // Last resort: treat as a name and ask /@name (rarely works but free)
  return `https://www.youtube.com/@${s}`
}

function extractChannelId(html: string): string | null {
  // Meta tag — most stable.
  const meta = /<meta itemprop="channelId" content="(UC[A-Za-z0-9_-]+)"/i.exec(html)
  if (meta) return meta[1]
  // Canonical link — e.g. https://www.youtube.com/channel/UCxxx
  const canonical = /<link rel="canonical" href="https:\/\/www\.youtube\.com\/channel\/(UC[A-Za-z0-9_-]+)"/i.exec(html)
  if (canonical) return canonical[1]
  // Inline JSON keys.
  const inline =
    /"channelId":"(UC[A-Za-z0-9_-]+)"/.exec(html) ??
    /"externalId":"(UC[A-Za-z0-9_-]+)"/.exec(html) ??
    /"browseId":"(UC[A-Za-z0-9_-]+)"/.exec(html)
  return inline?.[1] ?? null
}

function extractName(html: string): string | null {
  const og = /<meta property="og:title" content="([^"]+)"/.exec(html)
  if (og) return decodeEntities(og[1])
  const title = /<title>([^<]+) - YouTube<\/title>/.exec(html)
  if (title) return decodeEntities(title[1])
  return null
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

async function fetchPage(url: string): Promise<string> {
  const res = await fetch(url, {
    redirect: "follow",
    headers: {
      // Channel pages are served different content based on UA; pretend to
      // be a desktop Chrome to get the full HTML with the JSON blobs.
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
      "Accept-Language": "es-VE,es;q=0.9,en;q=0.8",
    },
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`)
  return res.text()
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const input = String((req.query as { input?: string }).input ?? "").trim()
  if (!input) {
    return res.status(400).json({ message: "input is required" })
  }

  try {
    let channelId: string
    let url: string

    if (UC_RE.test(input)) {
      // Fast path: already have the id, just enrich with friendly name.
      channelId = input
      url = `https://www.youtube.com/channel/${channelId}`
    } else {
      url = normalizeToUrl(input)
      const html = await fetchPage(url)
      const id = extractChannelId(html)
      if (!id) {
        return res.status(404).json({
          message:
            "No pude detectar el ID del canal en esa URL. Verificá que sea un canal de YouTube válido (no una URL de video o playlist).",
        })
      }
      channelId = id
    }

    // Either way, fetch the canonical channel page to grab the name.
    let name: string | null = null
    try {
      const html = await fetchPage(`https://www.youtube.com/channel/${channelId}`)
      name = extractName(html)
    } catch {
      /* name is best-effort; the user can edit it */
    }

    const result: ResolveResult = {
      channel_id: channelId,
      name: name ?? `Canal ${channelId.slice(0, 8)}…`,
      url: `https://www.youtube.com/channel/${channelId}`,
    }
    return res.json(result)
  } catch (e) {
    return res.status(500).json({ message: (e as Error).message })
  }
}
