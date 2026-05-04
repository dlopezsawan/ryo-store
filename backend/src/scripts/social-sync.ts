/**
 * CLI alternative to POST /admin/social/sync — useful before the server runs
 * or when you just want to re-populate the DB without hitting HTTP.
 *
 * Run: npm run social:sync
 */
import type { ExecArgs } from "@medusajs/framework/types"
import { SOCIAL_MODULE } from "../modules/social"
import SocialModuleService from "../modules/social/service"
import path from "node:path"
import fs from "node:fs/promises"
import crypto from "node:crypto"

const DASHBOARD_PATH = path.resolve(process.cwd(), "../storefront/scripts/social/dashboard.html")
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

async function copyMedia(srcRel: string, dstSubdir: string): Promise<string | null> {
  if (!srcRel) return null
  const src = path.resolve(SOCIAL_ROOT, srcRel)
  try {
    await fs.access(src)
  } catch {
    return null
  }
  const fileName = path.basename(src)
  const hash = crypto.createHash("md5").update(srcRel).digest("hex").slice(0, 6)
  const dst = path.resolve(STATIC_ROOT, dstSubdir, `${hash}-${fileName}`)
  await fs.mkdir(path.dirname(dst), { recursive: true })
  await fs.copyFile(src, dst)
  return `/static/social-media/${dstSubdir}/${hash}-${fileName}`
}

function parseSpanishDate(label?: string): Date | null {
  if (!label) return null
  const MONTHS: Record<string, number> = {
    ene: 0, feb: 1, mar: 2, abr: 3, may: 4, jun: 5,
    jul: 6, ago: 7, sep: 8, oct: 9, nov: 10, dic: 11,
  }
  const m = label.match(/(\d{1,2})\s+(\w{3})\w*\s*·\s*(\d{1,2}):(\d{2})/i)
  if (!m) return null
  const day = parseInt(m[1], 10)
  const mon = MONTHS[m[2].toLowerCase()]
  if (mon === undefined) return null
  const hour = parseInt(m[3], 10)
  const min = parseInt(m[4], 10)
  // Venezuela = UTC-4, stored as UTC (hour + 4)
  return new Date(Date.UTC(2026, mon, day, hour + 4, min, 0))
}

export default async function socialSync({ container }: ExecArgs) {
  const svc: SocialModuleService = container.resolve(SOCIAL_MODULE)

  const html = await fs.readFile(DASHBOARD_PATH, "utf-8")
  const m = html.match(/const\s+_EMBEDDED_DATA\s*=\s*(\{[\s\S]*?\});\s*Object\.assign/)
  if (!m) throw new Error("_EMBEDDED_DATA block not found in dashboard.html")
  const data: { posts: PostRow[]; stories: StoryRow[] } = JSON.parse(m[1])

  await fs.mkdir(STATIC_ROOT, { recursive: true })

  let postsCreated = 0, postsUpdated = 0
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
    const existing = await svc.listSocialPosts({ external_id: p.id } as never)
    if (existing.length > 0) {
      await svc.updateSocialPosts({ ...payload, id: existing[0].id } as never)
      postsUpdated++
    } else {
      await svc.createSocialPosts({ ...payload, status: "draft" } as never)
      postsCreated++
    }
  }

  let storiesCreated = 0, storiesUpdated = 0
  for (const s of data.stories) {
    const media_url = s.preview ? await copyMedia(s.preview, `stories/${s.date}`) : null
    const payload = {
      external_id: s.id,
      date: s.date,
      slot: s.slot,
      type: s.type,
      media_url,
    }
    // Identity is (date, slot) — NOT external_id. The external_id encodes the
    // story type ("story-2026-04-28-2-quote") and changes whenever we tweak
    // the dashboard.html plan, but the actual slot (date Apr 28, slot #2) is
    // the same human concept. Matching on external_id caused every type
    // tweak to spawn a duplicate draft alongside the already-approved row.
    const existing = await svc.listSocialStories({ date: s.date, slot: s.slot } as never)
    if (existing.length > 0) {
      // Pick the most recently updated row in case there are stale dupes
      // — the active one is the one the user has been working with.
      const target = existing.sort(
        (a, b) => +new Date(b.updated_at as never) - +new Date(a.updated_at as never)
      )[0]
      await svc.updateSocialStories({ ...payload, id: target.id } as never)
      storiesUpdated++
    } else {
      await svc.createSocialStories({ ...payload, status: "draft" } as never)
      storiesCreated++
    }
  }

  console.log(`\n✓ Social sync complete`)
  console.log(`  Posts:   ${postsCreated} created · ${postsUpdated} updated`)
  console.log(`  Stories: ${storiesCreated} created · ${storiesUpdated} updated`)
  console.log(`  Media copied to: ${STATIC_ROOT}\n`)
}
