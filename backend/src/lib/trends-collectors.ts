/**
 * Trends collectors — Batch 5 Fase A (free-tier sources).
 *
 * Each collector returns a list of {@link NormalizedSignal}s. The caller
 * upserts them into `social_trend_source` using (kind, source_id) as the
 * conflict target so re-runs are idempotent.
 *
 * Sources (all free):
 *   - Reddit public JSON API  (no auth, rate-limited by IP)
 *   - YouTube Data API v3     (requires YOUTUBE_API_KEY)
 *   - Google Trends (pytrends) — we skip this in Node; punt to a future worker
 *
 * Each keeps its implementation self-contained (one async function per
 * collector) so they're easy to test and rotate independently.
 */

export type TrendKind =
  | "reddit_post"
  | "youtube_video"
  | "google_term"
  | "instagram_post"
  | "tiktok_video"

export interface NormalizedSignal {
  kind: TrendKind
  source_id: string
  source_url?: string | null
  title: string
  author?: string | null
  summary?: string | null
  media_url?: string | null
  permalink?: string | null
  score: number
  comments: number
  keywords?: string[] | null
  region?: string | null
  posted_at?: Date | null
}

// ── Keyword seeds ──────────────────────────────────────────────────
// Tuned for parafernalia / smoke shop / rolling papers niche, EN + ES
export const NICHE_KEYWORDS = [
  "rolling paper",
  "grinder weed",
  "rolling papers review",
  "smoking accessories",
  "bong glass",
  "pipe cannabis",
  "papel de armar",
  "papel saborizado",
  "grinder venezuela",
  "parafernalia",
]

// ── Reddit ─────────────────────────────────────────────────────────
/**
 * Pull the current "hot" posts across cannabis-adjacent subreddits and
 * normalize them.
 *
 * Uses the public `https://www.reddit.com/r/<sub>/hot.json` endpoint which
 * is unauthenticated but rate-limited. We identify via a custom UA — Reddit
 * flags generic "python-requests/x.y.z" UAs.
 */
const REDDIT_SUBS = [
  "rollingpapers",
  "trees",
  "weed",
  "cannabiscultivation",
  "glassheads",
  "bongs",
  "pipes",
]

const REDDIT_UA = "Mozilla/5.0 (compatible; enrola-bot/1.0)"

/**
 * Two-track Reddit fetch:
 *
 *   1. If REDDIT_CLIENT_ID/SECRET are set, use OAuth client-credentials →
 *      oauth.reddit.com (no user context, "anonymous but authenticated"
 *      app). This is the reliable path.
 *
 *   2. Otherwise fall back to the .rss endpoint which Reddit still serves
 *      without auth behind its CDN. Less data (no score/comments) but the
 *      title + link + author still fuel the trend feed.
 *
 * Reddit blocked unauthenticated www.reddit.com/*.json from datacenter
 * IPs in late 2023 — hence the switch.
 */
export async function collectReddit(opts: { limit?: number } = {}): Promise<NormalizedSignal[]> {
  const limit = opts.limit ?? 15
  const out: NormalizedSignal[] = []

  const clientId = process.env.REDDIT_CLIENT_ID
  const clientSecret = process.env.REDDIT_CLIENT_SECRET
  const useOAuth = clientId && clientSecret

  let token: string | null = null
  if (useOAuth) {
    try {
      const authRes = await fetch("https://www.reddit.com/api/v1/access_token", {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
          "User-Agent": REDDIT_UA,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "grant_type=client_credentials",
      })
      if (authRes.ok) {
        const data = (await authRes.json()) as { access_token?: string }
        token = data.access_token ?? null
      } else {
        console.warn(`[trends/reddit] oauth failed ${authRes.status}, falling back to RSS`)
      }
    } catch (e) {
      console.warn("[trends/reddit] oauth threw:", (e as Error).message)
    }
  }

  for (const sub of REDDIT_SUBS) {
    try {
      if (token) {
        // JSON via OAuth — richer data (score, comments, preview)
        const res = await fetch(
          `https://oauth.reddit.com/r/${sub}/hot?limit=${limit}&raw_json=1`,
          { headers: { Authorization: `Bearer ${token}`, "User-Agent": REDDIT_UA } }
        )
        if (!res.ok) {
          console.warn(`[trends/reddit] ${sub} oauth returned ${res.status}`)
          continue
        }
        const data = (await res.json()) as {
          data?: { children?: Array<{ data: RedditListingChild }> }
        }
        for (const child of data.data?.children ?? []) {
          const p = child.data
          if (p.stickied) continue
          const preview = p.preview?.images?.[0]?.source?.url
          const thumb =
            (preview && preview.replace(/&amp;/g, "&")) ||
            (p.thumbnail && /^https?:/.test(p.thumbnail) ? p.thumbnail : null)
          out.push({
            kind: "reddit_post",
            source_id: p.name,
            source_url: p.url_overridden_by_dest || p.url,
            title: p.title,
            author: p.author || null,
            summary: (p.selftext || "").slice(0, 500) || null,
            media_url: thumb,
            permalink: `https://www.reddit.com${p.permalink}`,
            score: p.score,
            comments: p.num_comments,
            keywords: [sub, ...matchedKeywords(p.title + " " + (p.selftext || ""))],
            region: null,
            posted_at: new Date(p.created_utc * 1000),
          })
        }
      } else {
        // RSS fallback — unauthenticated, still served by Reddit's CDN
        const res = await fetch(`https://www.reddit.com/r/${sub}/hot/.rss?limit=${limit}`, {
          headers: { "User-Agent": REDDIT_UA, Accept: "application/rss+xml,application/atom+xml,text/xml" },
        })
        if (!res.ok) {
          console.warn(`[trends/reddit] ${sub} rss ${res.status}`)
          continue
        }
        const xml = await res.text()
        for (const sig of parseRedditAtom(xml, sub)) {
          out.push(sig)
        }
      }
    } catch (e) {
      console.warn(`[trends/reddit] ${sub} error:`, (e as Error).message)
    }
  }
  return out
}

interface RedditListingChild {
  id: string
  name: string
  title: string
  author: string
  selftext?: string
  permalink: string
  url?: string
  url_overridden_by_dest?: string
  thumbnail?: string
  preview?: { images?: Array<{ source?: { url?: string } }> }
  score: number
  num_comments: number
  created_utc: number
  stickied?: boolean
}

/**
 * Minimal Atom parser tailored to Reddit's RSS shape. We only care about
 * <entry> blocks with <id>, <title>, <author><name>, <updated>, <content>,
 * and the self-link href. No XML libs to avoid a dep.
 */
function parseRedditAtom(xml: string, sub: string): NormalizedSignal[] {
  const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) ?? []
  const out: NormalizedSignal[] = []
  for (const entry of entries) {
    const idRaw = tag(entry, "id")        // "t3_abc123"
    const title = cleanText(tag(entry, "title"))
    const updated = tag(entry, "updated") // ISO
    const author = cleanText(tag(entry, "name"))
    const content = cleanText(tag(entry, "content"))
    const hrefMatch = entry.match(/<link[^>]+href="([^"]+)"/)
    const permalink = hrefMatch ? hrefMatch[1] : null
    if (!idRaw || !title) continue
    // Media URL: try to pull first <img src="…"> from the rendered content
    const imgMatch = content.match(/<img[^>]+src="([^"]+)"/)
    out.push({
      kind: "reddit_post",
      source_id: idRaw,
      source_url: permalink,
      title,
      author: author || null,
      summary: stripHtml(content).slice(0, 500) || null,
      media_url: imgMatch ? imgMatch[1] : null,
      permalink,
      score: 0,       // RSS doesn't expose upvotes
      comments: 0,
      keywords: [sub, ...matchedKeywords(title + " " + content)],
      region: null,
      posted_at: updated ? new Date(updated) : null,
    })
  }
  return out
}

function tag(xml: string, name: string): string {
  const re = new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`)
  const m = xml.match(re)
  return m ? m[1] : ""
}

function cleanText(s: string): string {
  return s
    .replace(/<!\[CDATA\[/g, "")
    .replace(/\]\]>/g, "")
    .trim()
}

function stripHtml(s: string): string {
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim()
}

// ── YouTube Data API v3 ────────────────────────────────────────────
/**
 * Pull recent popular videos matching niche keywords. Uses search.list with
 * `order=viewCount` and `publishedAfter` within the last 14 days.
 *
 * Cost: each search.list call = 100 units. With 6 queries per run and a 10k
 * daily quota, we can run every 6h for 6 queries × 4 runs × 100 = 2400 units.
 * Safely within budget.
 */
export async function collectYouTube(opts: { maxPerQuery?: number } = {}): Promise<NormalizedSignal[]> {
  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) {
    console.warn("[trends/youtube] YOUTUBE_API_KEY not set, skipping")
    return []
  }

  const maxResults = opts.maxPerQuery ?? 5
  const publishedAfter = new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString()
  const queries = [
    "rolling papers review",
    "how to grind weed",
    "best grinder 2026",
    "rolling paper comparison",
    "smoking accessories unboxing",
    "glass bong review",
  ]

  const out: NormalizedSignal[] = []

  for (const q of queries) {
    try {
      const url = new URL("https://www.googleapis.com/youtube/v3/search")
      url.searchParams.set("part", "snippet")
      url.searchParams.set("type", "video")
      url.searchParams.set("order", "viewCount")
      url.searchParams.set("publishedAfter", publishedAfter)
      url.searchParams.set("maxResults", String(maxResults))
      url.searchParams.set("q", q)
      url.searchParams.set("key", apiKey)

      const res = await fetch(url.toString())
      if (!res.ok) {
        console.warn(`[trends/youtube] query "${q}" → ${res.status}`)
        continue
      }
      const data = (await res.json()) as {
        items?: Array<{
          id: { videoId: string }
          snippet: {
            title: string
            description: string
            channelTitle: string
            publishedAt: string
            thumbnails?: Record<string, { url: string }>
          }
        }>
      }

      for (const item of data.items ?? []) {
        const vid = item.id.videoId
        const s = item.snippet
        out.push({
          kind: "youtube_video",
          source_id: vid,
          source_url: `https://www.youtube.com/watch?v=${vid}`,
          title: s.title,
          author: s.channelTitle,
          summary: s.description?.slice(0, 500) || null,
          media_url:
            s.thumbnails?.high?.url ||
            s.thumbnails?.medium?.url ||
            s.thumbnails?.default?.url ||
            null,
          permalink: `https://www.youtube.com/watch?v=${vid}`,
          score: 0,  // search.list doesn't include stats; videos.list is a separate call we skip for now
          comments: 0,
          keywords: [q, ...matchedKeywords(s.title + " " + (s.description || ""))],
          region: null,
          posted_at: s.publishedAt ? new Date(s.publishedAt) : null,
        })
      }
    } catch (e) {
      console.warn(`[trends/youtube] query "${q}" error:`, (e as Error).message)
    }
  }

  return out
}

// ── YouTube RSS per channel ────────────────────────────────────────
/**
 * Per-channel YouTube monitoring via Atom feed. Free, unlimited, no API
 * quota cost. Complements the keyword-based YouTube Data API collector:
 *
 *   - YouTube Data API → "what's bubbling up in the niche"  (keywords)
 *   - YouTube RSS      → "did this specific creator post anything new"
 *                        (subscriptions)
 *
 * Endpoint: https://www.youtube.com/feeds/videos.xml?channel_id=UCxxx
 *   Returns up to 15 most-recent videos per channel as an Atom 1.0 feed.
 *   Updated within minutes of upload. No auth required.
 *
 * The list of channels comes from `social_trend_subscription` rows where
 * kind="youtube_channel" and active=true. Adding/removing a channel is
 * a DB write — admin UI surfaces this.
 *
 * Caller passes a function that resolves the active subscriptions, so
 * the collector stays Medusa-agnostic and unit-testable.
 */
export interface YouTubeRssSubscription {
  id: string
  source_id: string  // UCxxxxxxxxxxxxxxxxxxxxxx
  label: string
}

export async function collectYouTubeRSS(
  loadSubs: () => Promise<YouTubeRssSubscription[]>,
  onSubFetched?: (sub: YouTubeRssSubscription, error: string | null) => Promise<void>,
): Promise<NormalizedSignal[]> {
  let subs: YouTubeRssSubscription[]
  try {
    subs = await loadSubs()
  } catch (e) {
    console.warn("[trends] yt-rss: cannot load subscriptions:", (e as Error).message)
    return []
  }
  if (subs.length === 0) return []

  const out: NormalizedSignal[] = []

  for (const sub of subs) {
    let err: string | null = null
    try {
      const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(sub.source_id)}`
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 enrola-trends/1.0" },
        signal: AbortSignal.timeout(10_000),
      })
      if (!res.ok) {
        err = `HTTP ${res.status}`
        continue
      }
      const xml = await res.text()
      const entries = parseYouTubeAtom(xml, sub.label)
      out.push(...entries)
    } catch (e) {
      err = (e as Error).message
    } finally {
      if (onSubFetched) {
        try { await onSubFetched(sub, err) } catch { /* swallow */ }
      }
    }
    // Polite spacing — YouTube doesn't rate-limit RSS but no need to hammer
    await new Promise((r) => setTimeout(r, 250))
  }

  return out
}

/**
 * Atom feed parser for YouTube channel feeds. Only what we need:
 *   - <entry><id>yt:video:VIDEO_ID</id>
 *   - <title>...</title>
 *   - <link rel="alternate" href="..."/>
 *   - <author><name>...</name></author>
 *   - <published>2026-04-25T12:00:00+00:00</published>
 *   - <media:group><media:description>...</media:description></media:group>
 *   - <media:community><media:starRating count="N"/><media:statistics views="M"/></media:community>
 *
 * Atom is well-formed XML so a regex pass is reliable enough for these
 * feeds (15 entries max per channel). No need to pull a heavy XML lib.
 */
function parseYouTubeAtom(xml: string, channelLabel: string): NormalizedSignal[] {
  const out: NormalizedSignal[] = []
  const entryRe = /<entry>([\s\S]*?)<\/entry>/g
  let m: RegExpExecArray | null
  while ((m = entryRe.exec(xml)) !== null) {
    const e = m[1]
    const idMatch = /<yt:videoId>([^<]+)<\/yt:videoId>/.exec(e)
    const videoId = idMatch?.[1]
    if (!videoId) continue
    const title = cleanText(tag(e, "title"))
    const author = cleanText(/<author>[\s\S]*?<name>([^<]*)<\/name>[\s\S]*?<\/author>/.exec(e)?.[1] ?? "")
    const published = /<published>([^<]+)<\/published>/.exec(e)?.[1]
    const link = /<link[^>]+rel="alternate"[^>]+href="([^"]+)"/.exec(e)?.[1]
      ?? `https://www.youtube.com/watch?v=${videoId}`
    const description = stripHtml(
      /<media:description>([\s\S]*?)<\/media:description>/.exec(e)?.[1] ?? ""
    ).slice(0, 400)
    const views = parseInt(/<media:statistics[^/]+views="(\d+)"/.exec(e)?.[1] ?? "0", 10)
    const stars = parseInt(/<media:starRating[^/]+count="(\d+)"/.exec(e)?.[1] ?? "0", 10)

    out.push({
      kind: "youtube_video",
      source_id: `rss-${videoId}`,                  // prefix avoids clash with Data API ids
      source_url: link,
      title: title || "(sin título)",
      author: author || channelLabel,
      summary: description || null,
      media_url: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      permalink: link,
      score: views,                                 // use views as the score signal
      comments: stars,                              // ratings stand in for engagement
      keywords: matchedKeywords(`${title} ${description}`),
      region: null,
      posted_at: published ? new Date(published) : null,
    })
  }
  return out
}

// ── Google Trends (interest-over-time per keyword) ─────────────────
/**
 * Google Trends has no official free API. We hit the same undocumented
 * endpoints `pytrends` and `google-trends-api` use — no auth needed but
 * Google can throttle us at any time. Wrap in try/catch and degrade.
 *
 * For each NICHE_KEYWORD we ask for the "interest over time" signal in
 * the last 7 days, then synthesize a single "rising" signal per keyword
 * with score = peak interest, summary = trajectory text.
 *
 * Implementation: 2-step dance Google forces — first call returns a
 * widget config token, second call uses the token to fetch the actual
 * data. Both responses are prefixed with `)]}'` (anti-CSRF) so we strip.
 *
 * GEO: "VE" (Venezuela). Falls back to "" (worldwide) if VE returns no
 * data — the niche is small enough locally that worldwide is often more
 * useful than empty.
 */
export async function collectGoogleTrends(opts: {
  geo?: string
} = {}): Promise<NormalizedSignal[]> {
  // Opt-in: Google blocks most VPS / cloud IP ranges with 429. Works fine
  // from a residential dev machine, but on Hostinger we never get past the
  // explore call. Default OFF in production unless the deployer flips it
  // on (e.g. behind a residential proxy or after testing).
  if (process.env.GOOGLE_TRENDS_ENABLED !== "true") return []
  const geo = opts.geo ?? "VE"
  const out: NormalizedSignal[] = []

  // Pick a smaller subset that's most ES-relevant for VE traffic.
  const seeds = NICHE_KEYWORDS.filter((k) => /[ñá]|papel|grinder|parafer/i.test(k)).slice(0, 6)

  let rateLimited = false
  for (const kw of seeds) {
    if (rateLimited) break // first 429 = give up the batch, save the noise
    try {
      const sig = await fetchGoogleTrendsKeyword(kw, geo)
      if (sig) out.push(sig)
    } catch (e) {
      const msg = (e as Error).message
      if (/HTTP 429/.test(msg)) {
        // One concise warning then bail — 6 identical 429 lines per cron
        // run is just noise that obscures real failures elsewhere.
        console.warn(`[trends] google-trends rate-limited (HTTP 429), skipping batch`)
        rateLimited = true
        break
      }
      console.warn(`[trends] google-trends "${kw}" failed:`, msg)
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  return out
}

async function fetchGoogleTrendsKeyword(
  keyword: string,
  geo: string,
): Promise<NormalizedSignal | null> {
  const ua = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"
  const headers = { "User-Agent": ua, "Accept-Language": "es-VE,es;q=0.9,en;q=0.8" }

  // Step 1: explore — returns widget bundle with tokens.
  const exploreReq = {
    comparisonItem: [{ keyword, geo, time: "now 7-d" }],
    category: 0,
    property: "",
  }
  const exploreUrl = `https://trends.google.com/trends/api/explore?hl=es&tz=240&req=${encodeURIComponent(
    JSON.stringify(exploreReq),
  )}`
  const exploreRes = await fetch(exploreUrl, { headers, signal: AbortSignal.timeout(8000) })
  if (!exploreRes.ok) throw new Error(`explore HTTP ${exploreRes.status}`)
  const exploreText = (await exploreRes.text()).replace(/^\)\]\}'\s*/, "")
  const exploreJson = JSON.parse(exploreText) as {
    widgets: Array<{ id: string; token: string; request: unknown }>
  }
  const tsWidget = exploreJson.widgets.find((w) => w.id === "TIMESERIES")
  if (!tsWidget) return null

  // Step 2: multiline — interest-over-time series.
  const tsUrl = `https://trends.google.com/trends/api/widgetdata/multiline?hl=es&tz=240&req=${encodeURIComponent(
    JSON.stringify(tsWidget.request),
  )}&token=${encodeURIComponent(tsWidget.token)}`
  const tsRes = await fetch(tsUrl, { headers, signal: AbortSignal.timeout(8000) })
  if (!tsRes.ok) throw new Error(`multiline HTTP ${tsRes.status}`)
  const tsText = (await tsRes.text()).replace(/^\)\]\}'\s*/, "")
  const tsJson = JSON.parse(tsText) as {
    default: { timelineData: Array<{ time: string; value: number[] }> }
  }
  const series = tsJson.default.timelineData
  if (!series || series.length === 0) return null

  const values = series.map((p) => p.value[0] ?? 0)
  const peak = Math.max(...values)
  const last = values[values.length - 1] ?? 0
  const first = values[0] ?? 0
  const delta = last - first
  // Skip flat-line "no signal" keywords
  if (peak === 0) return null

  const trajectory =
    delta > 10 ? "subiendo" : delta < -10 ? "cayendo" : "estable"
  const lastTs = series[series.length - 1]?.time
  const postedAt = lastTs ? new Date(parseInt(lastTs, 10) * 1000) : new Date()

  return {
    kind: "google_term",
    source_id: `gt-${geo}-${encodeURIComponent(keyword)}`,
    source_url: `https://trends.google.com/trends/explore?q=${encodeURIComponent(keyword)}&geo=${geo}`,
    title: keyword,
    author: null,
    summary: `Interés últimos 7d (${geo || "global"}): pico ${peak}, ${trajectory} (${delta >= 0 ? "+" : ""}${delta}).`,
    media_url: null,
    permalink: `https://trends.google.com/trends/explore?q=${encodeURIComponent(keyword)}&geo=${geo}`,
    score: peak, // 0-100 normalized by Google
    comments: 0,
    keywords: [keyword],
    region: geo || null,
    posted_at: postedAt,
  }
}

// ── TikTok (via RapidAPI scraper) ──────────────────────────────────
/**
 * TikTok has no public API for content discovery. We use a community
 * scraper on RapidAPI (`tiktok-scraper7`) which proxies the unofficial
 * mobile API. Free tier is 25 req/mo, Basic ~$10/mo for 5k req.
 *
 * Set up:
 *   1. Sign up at https://rapidapi.com → subscribe to "TikTok Scraper" by tikwm
 *   2. Copy your RapidAPI key
 *   3. Set RAPIDAPI_KEY=... and (optionally) TIKTOK_RAPIDAPI_HOST=...
 *
 * What we fetch: per niche keyword, top 5 videos sorted by recency,
 * region "VE" if supported, falling back to no-region.
 *
 * If RAPIDAPI_KEY is unset we just no-op — collector is opt-in.
 */
export async function collectTikTok(opts: {
  perKeyword?: number
} = {}): Promise<NormalizedSignal[]> {
  const apiKey = process.env.RAPIDAPI_KEY
  if (!apiKey) return [] // silent no-op when not configured
  if (process.env.TIKTOK_ENABLED === "false") return []

  const host = process.env.TIKTOK_RAPIDAPI_HOST || "tiktok-scraper7.p.rapidapi.com"
  const perKeyword = opts.perKeyword ?? 5
  const out: NormalizedSignal[] = []

  // Same Spanish-leaning subset Google Trends uses — TikTok ES content is
  // where the actual cultural signal lives for VE audiences.
  const seeds = NICHE_KEYWORDS.filter((k) => /[ñá]|papel|grinder|parafer/i.test(k)).slice(0, 6)

  for (const kw of seeds) {
    try {
      const url =
        `https://${host}/feed/search?keywords=${encodeURIComponent(kw)}&count=${perKeyword}` +
        `&region=ve&publish_time=7&sort_type=0`
      const res = await fetch(url, {
        headers: {
          "X-RapidAPI-Key": apiKey,
          "X-RapidAPI-Host": host,
        },
        signal: AbortSignal.timeout(12_000),
      })
      if (!res.ok) {
        console.warn(`[trends] tiktok "${kw}" HTTP ${res.status}`)
        continue
      }
      const json = (await res.json()) as {
        data?: {
          videos?: Array<{
            video_id?: string
            aweme_id?: string
            title?: string
            author?: { unique_id?: string; nickname?: string }
            digg_count?: number
            comment_count?: number
            share_count?: number
            play_count?: number
            cover?: string
            origin_cover?: string
            create_time?: number
            region?: string
          }>
        }
      }
      const vids = json.data?.videos ?? []
      for (const v of vids) {
        const id = v.video_id || v.aweme_id
        if (!id) continue
        const handle = v.author?.unique_id || ""
        const score = (v.digg_count ?? 0) + (v.share_count ?? 0) * 3 // weight shares 3x
        out.push({
          kind: "tiktok_video",
          source_id: id,
          source_url: handle ? `https://www.tiktok.com/@${handle}/video/${id}` : null,
          title: v.title ?? "(sin título)",
          author: v.author?.nickname ?? handle ?? null,
          summary: `❤ ${(v.digg_count ?? 0).toLocaleString()} · 💬 ${(v.comment_count ?? 0).toLocaleString()} · ▶ ${(v.play_count ?? 0).toLocaleString()}`,
          media_url: v.cover ?? v.origin_cover ?? null,
          permalink: handle ? `https://www.tiktok.com/@${handle}/video/${id}` : null,
          score,
          comments: v.comment_count ?? 0,
          keywords: [kw],
          region: v.region ?? "VE",
          posted_at: v.create_time ? new Date(v.create_time * 1000) : null,
        })
      }
    } catch (e) {
      console.warn(`[trends] tiktok "${kw}" failed:`, (e as Error).message)
    }
    // Spacing — RapidAPI rate limits per second on free tier
    await new Promise((r) => setTimeout(r, 800))
  }
  return out
}

// ── Helpers ────────────────────────────────────────────────────────
function matchedKeywords(text: string): string[] {
  const t = text.toLowerCase()
  return NICHE_KEYWORDS.filter((kw) => t.includes(kw.toLowerCase()))
}
