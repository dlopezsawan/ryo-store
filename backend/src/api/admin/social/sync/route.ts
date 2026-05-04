/**
 * POST /admin/social/sync
 *
 * Reads storefront/scripts/social/dashboard.html from the repo filesystem,
 * extracts _EMBEDDED_DATA, copies every referenced media file into
 * backend/static/social-media/<external_id>/..., and upserts SocialPost +
 * SocialStory rows.
 *
 * The sync is idempotent: running again updates existing rows (by external_id)
 * without losing their status, feedback, or scheduled dates.
 */
import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { SOCIAL_MODULE } from "../../../../modules/social"
import SocialModuleService from "../../../../modules/social/service"
import path from "node:path"
import fs from "node:fs/promises"
import crypto from "node:crypto"

const DASHBOARD_PATH = path.resolve(
  process.cwd(),
  "../storefront/scripts/social/dashboard.html"
)
const SOCIAL_ROOT = path.resolve(process.cwd(), "../storefront/scripts/social")
const STATIC_ROOT = path.resolve(process.cwd(), "static/social-media")

type PostRow = {
  id: string
  number: string
  title: string
  date: string
  pillar?: string
  format: string
  previews: string[]
  cover?: string
  copy?: string
}

type StoryRow = {
  id: string
  date: string
  slot: number
  type: string
  preview?: string
}

async function ensureDir(p: string) {
  await fs.mkdir(p, { recursive: true })
}

async function copyMedia(srcRel: string, dstSubdir: string): Promise<string | null> {
  // srcRel looks like "mes-2/post-05-carbon-activo/reel.mp4"
  if (!srcRel) return null
  const src = path.resolve(SOCIAL_ROOT, srcRel)
  try {
    await fs.access(src)
  } catch {
    console.warn("[social:sync] missing file", src)
    return null
  }
  const fileName = path.basename(src)
  // Add tiny hash prefix so we don't overwrite when filenames collide across posts
  const hash = crypto.createHash("md5").update(srcRel).digest("hex").slice(0, 6)
  const dst = path.resolve(STATIC_ROOT, dstSubdir, `${hash}-${fileName}`)
  await ensureDir(path.dirname(dst))
  await fs.copyFile(src, dst)
  // Medusa serves /static/* from backend/static/
  return `/static/social-media/${dstSubdir}/${hash}-${fileName}`
}

function parseSpanishDate(label?: string): Date | null {
  // "Jueves 30 Abr · 20:00 VE" → Date
  if (!label) return null
  const MONTHS: Record<string, number> = {
    ene: 0, feb: 1, mar: 2, abr: 3, may: 4, jun: 5,
    jul: 6, ago: 7, sep: 8, oct: 9, nov: 10, dic: 11,
  }
  const m = label.match(/(\d{1,2})\s+(\w{3})\w*\s*·\s*(\d{1,2}):(\d{2})/i)
  if (!m) return null
  const day = parseInt(m[1], 10)
  const mon = MONTHS[m[2].toLowerCase()]
  const hour = parseInt(m[3], 10)
  const min = parseInt(m[4], 10)
  if (mon === undefined) return null
  // Use 2026 (current planning year); adjust here when year changes
  const year = 2026
  // Venezuela is UTC-4 (no DST) — store as UTC equivalent
  const dt = new Date(Date.UTC(year, mon, day, hour + 4, min, 0))
  return dt
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const svc: SocialModuleService = req.scope.resolve(SOCIAL_MODULE)

  // 1. Read dashboard.html
  let html: string
  try {
    html = await fs.readFile(DASHBOARD_PATH, "utf-8")
  } catch (e) {
    return res.status(500).json({
      error: "Cannot read dashboard.html",
      path: DASHBOARD_PATH,
      details: (e as Error).message,
    })
  }

  const m = html.match(/const\s+_EMBEDDED_DATA\s*=\s*(\{[\s\S]*?\});\s*Object\.assign/)
  if (!m) {
    return res.status(500).json({ error: "_EMBEDDED_DATA block not found" })
  }
  let data: { posts: PostRow[]; stories: StoryRow[] }
  try {
    data = JSON.parse(m[1])
  } catch (e) {
    return res.status(500).json({ error: "Invalid JSON in _EMBEDDED_DATA", details: (e as Error).message })
  }

  await ensureDir(STATIC_ROOT)

  // 2. Upsert posts
  const posts_synced: string[] = []
  for (const p of data.posts) {
    const cover_url = p.cover ? await copyMedia(p.cover, p.id) : null
    const media_urls: string[] = []
    for (const prev of p.previews || []) {
      const url = await copyMedia(prev, p.id)
      if (url) media_urls.push(url)
    }
    const payload = {
      external_id: p.id,
      number: p.number,
      title: p.title,
      pillar: p.pillar ?? null,
      format: p.format,
      date_label: p.date ?? null,
      date_planned: parseSpanishDate(p.date),
      caption: p.copy ?? null,
      cover_url,
      media_urls,
    }
    // Upsert by external_id — don't clobber status/published_at/ig_post_id
    const existing = await svc.listSocialPosts({ external_id: p.id } as never)
    if (existing.length > 0) {
      await svc.updateSocialPosts({ ...payload, id: existing[0].id } as never)
    } else {
      await svc.createSocialPosts({ ...payload, status: "draft" } as never)
    }
    posts_synced.push(p.id)
  }

  // 3. Upsert stories
  // Identity is (date, slot) — NOT external_id. The external_id encodes
  // the story type ("story-2026-04-28-2-quote") and changes whenever we
  // tweak the dashboard.html plan, but the actual slot (date Apr 28,
  // slot #2) is the same human concept. Matching on external_id caused
  // every type tweak to spawn a duplicate draft alongside the already-
  // approved row → 58 phantom drafts after every sync.
  const stories_synced: string[] = []
  for (const s of data.stories) {
    const media_url = s.preview ? await copyMedia(s.preview, `stories/${s.date}`) : null
    const payload = {
      external_id: s.id,
      date: s.date,
      slot: s.slot,
      type: s.type,
      media_url,
    }
    const existing = await svc.listSocialStories({ date: s.date, slot: s.slot } as never)
    if (existing.length > 0) {
      // Most-recently-updated row is the active one; older are stale.
      const target = existing.sort(
        (a, b) => +new Date(b.updated_at as never) - +new Date(a.updated_at as never)
      )[0]
      await svc.updateSocialStories({ ...payload, id: target.id } as never)
    } else {
      await svc.createSocialStories({ ...payload, status: "draft" } as never)
    }
    stories_synced.push(s.id)
  }

  return res.json({
    ok: true,
    posts_synced: posts_synced.length,
    stories_synced: stories_synced.length,
    static_root: STATIC_ROOT,
  })
}
