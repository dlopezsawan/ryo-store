import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { SOCIAL_MODULE } from "../../../../../modules/social"
import SocialModuleService from "../../../../../modules/social/service"
import { actorFromReq, recordActivity } from "../../_shared"
import {
  createPost as bufferCreatePost,
  pickSchedulingType,
  type BufferPostType,
  type CreatePostInput,
  type ImageAssetInput,
  type VideoAssetInput,
} from "../../../../../lib/buffer-client"

/**
 * POST /admin/social/publish/:id
 *   body: { entity: "post" | "story", when?: ISO8601 }
 *
 * Creates the post on Buffer so Buffer owns the scheduling + actual IG upload.
 * We keep a local shadow record: status + buffer_post_id + scheduled_at.
 *
 * Flow from the UI's perspective:
 *   - approved → (this endpoint) → scheduled (buffer_post_id filled)
 *   - Buffer fires at dueAt → webhook flips local status to published / failed
 *   - Cancel Schedule endpoint deletes on Buffer + resets status to approved
 *
 * Mode decision:
 *   - Story with link sticker → Buffer "notification" (phone notif to publish)
 *   - Everything else → "automatic" (zero touch)
 */

const ASSET_BASE = process.env.BACKEND_PUBLIC_URL || "https://api.enrola.shop"

function absMedia(relOrAbs: string): string {
  if (!relOrAbs) return relOrAbs
  if (relOrAbs.startsWith("http://") || relOrAbs.startsWith("https://")) return relOrAbs
  return `${ASSET_BASE}${relOrAbs.startsWith("/") ? "" : "/"}${relOrAbs}`
}

function postTypeForPost(format: string, nMedia: number): BufferPostType {
  const f = (format || "").toLowerCase()
  if (f === "reel") return "reel"
  if (f.startsWith("carr") || nMedia > 1) return "carousel"
  return "post"
}

function withJitter(when: Date, jitterMin: number): Date {
  if (jitterMin <= 0) return when
  const delta = Math.round((Math.random() * 2 - 1) * jitterMin * 60 * 1000)
  return new Date(when.getTime() + delta)
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const svc: SocialModuleService = req.scope.resolve(SOCIAL_MODULE)
  const { id } = req.params as { id: string }
  const body = (req.body ?? {}) as { entity?: "post" | "story"; when?: string }
  const entity: "post" | "story" = body.entity === "story" ? "story" : "post"

  const channelId = process.env.BUFFER_IG_CHANNEL_ID
  if (!channelId) {
    return res.status(500).json({
      message: "BUFFER_IG_CHANNEL_ID not configured. Connect the IG channel in Buffer and set it in .env.",
    })
  }

  let scheduledAt: Date | null = null
  if (body.when) {
    const d = new Date(body.when)
    if (isNaN(d.getTime())) return res.status(400).json({ message: "Invalid 'when'" })
    const jitterMin = parseInt(process.env.SCHEDULE_JITTER_MIN || "15", 10)
    scheduledAt = withJitter(d, jitterMin)
  }
  // If no scheduledAt and we want immediate, we still need a dueAt for
  // customScheduled — shareNow seems to be gated per Buffer doc; use now+90s.
  const effectiveDue = scheduledAt ?? new Date(Date.now() + 90_000)

  try {
    if (entity === "post") {
      const post = await svc.retrieveSocialPost(id)
      if (!post) return res.status(404).json({ message: "Post not found" })

      const mediaUrls = (Array.isArray(post.media_urls) ? post.media_urls : []) as string[]
      if (mediaUrls.length === 0 && !post.cover_url) {
        return res.status(400).json({ message: "Post has no media" })
      }

      const type = postTypeForPost(post.format, mediaUrls.length)

      // Build assets based on type
      const assets: CreatePostInput["assets"] = {}
      if (type === "reel") {
        const videoUrl = mediaUrls.find((u) => /\.(mp4|mov|m4v)$/i.test(u)) ?? mediaUrls[0] ?? post.cover_url!
        const video: VideoAssetInput = {
          url: absMedia(videoUrl),
          thumbnailUrl: post.cover_url ? absMedia(post.cover_url) : undefined,
        }
        assets.videos = [video]
      } else {
        const sources = mediaUrls.length > 0 ? mediaUrls : [post.cover_url!]
        assets.images = sources.map<ImageAssetInput>((u) => ({ url: absMedia(u) }))
      }

      const schedulingType = pickSchedulingType({ type, link: null })
      const input: CreatePostInput = {
        channelId,
        schedulingType,
        mode: "customScheduled",
        dueAt: effectiveDue.toISOString(),
        text: post.caption ?? undefined,
        assets,
        instagram: {
          type,
          shouldShareToFeed: true,
        },
      }

      const { bufferPostId } = await bufferCreatePost(input, {
        caller: "publish-route",
        entityExternalId: post.external_id,
      })

      const updated = await svc.updateSocialPosts({
        id,
        status: "scheduled",
        scheduled_at: effectiveDue,
        buffer_post_id: bufferPostId,
        failure_reason: null,
      } as never)

      await recordActivity(svc, {
        entity_type: "post",
        entity_id: id,
        actor: actorFromReq(req),
        action: "status_changed",
        payload: {
          from: post.status,
          to: "scheduled",
          scheduled_at: effectiveDue.toISOString(),
          schedulingType,
          buffer_post_id: bufferPostId,
        },
      })

      return res.json({ post: updated, schedulingType, buffer_post_id: bufferPostId })
    } else {
      // ── Story ────────────────────────────────────────────────────
      const story = await svc.retrieveSocialStory(id)
      if (!story) return res.status(404).json({ message: "Story not found" })
      if (!story.media_url) {
        return res.status(400).json({ message: "Story has no media" })
      }

      const isVideo = /\.(mp4|mov|m4v)$/i.test(story.media_url)
      const assets: CreatePostInput["assets"] = isVideo
        ? { videos: [{ url: absMedia(story.media_url) }] }
        : { images: [{ url: absMedia(story.media_url) }] }

      const schedulingType = pickSchedulingType({ type: "story", link: story.link_url })
      const input: CreatePostInput = {
        channelId,
        schedulingType,
        mode: "customScheduled",
        dueAt: effectiveDue.toISOString(),
        assets,
        instagram: {
          type: "story",
          link: story.link_url ?? null,
          shouldShareToFeed: false,
        },
      }

      const { bufferPostId } = await bufferCreatePost(input, {
        caller: "publish-route",
        entityExternalId: story.external_id,
      })

      const updated = await svc.updateSocialStories({
        id,
        status: "scheduled",
        scheduled_at: effectiveDue,
        buffer_post_id: bufferPostId,
        failure_reason: null,
      } as never)

      await recordActivity(svc, {
        entity_type: "story",
        entity_id: id,
        actor: actorFromReq(req),
        action: "status_changed",
        payload: {
          from: story.status,
          to: "scheduled",
          scheduled_at: effectiveDue.toISOString(),
          schedulingType,
          buffer_post_id: bufferPostId,
          link_url: story.link_url,
        },
      })

      return res.json({ story: updated, schedulingType, buffer_post_id: bufferPostId })
    }
  } catch (e) {
    return res.status(502).json({
      message: "Buffer rejected the publish request",
      detail: (e as Error).message,
    })
  }
}
