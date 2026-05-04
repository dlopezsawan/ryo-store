/**
 * Shared helpers for the /admin/social/* routes.
 *
 * - actorFromReq:    extract the current admin user's id/name from the auth
 *                    context attached by Medusa's built-in auth middleware
 * - recordActivity:  insert a row into social_activity (fire-and-forget:
 *                    we never let audit-log failures break the main request)
 * - parseMentions:   pull @handle tokens out of feedback text
 * - notifyMention:   send an email when somebody is @-mentioned
 */
import type { MedusaRequest } from "@medusajs/framework"
import type SocialModuleService from "../../../modules/social/service"
import { sendEmail } from "../../../lib/email-service"

export type ActorInfo = {
  id: string | null
  name: string | null
  email: string | null
}

/**
 * Hardcoded handle → email map for users that aren't in the Medusa admin
 * user table but should still receive @mention notifications.
 *
 * Why: Leo (consultor externo) doesn't have admin login but the team tags
 * @leo on posts/stories he reviews. Without this map his mentions were
 * silently dropped because notifyMentions only resolved against admin
 * users.
 *
 * Handles are matched case-insensitive and as exact OR prefix:
 *   "@leo cambiá esto"   → leonardo@somosimpulsa.com
 *   "@leonardo qué opinás" → also routes to him (prefix match)
 */
export const EXTERNAL_HANDLE_MAP: Record<string, string> = {
  leo: "leonardo@somosimpulsa.com",
  leonardo: "leonardo@somosimpulsa.com",
}

/**
 * Build the list of handles that identify a given user. Used by the
 * notifications endpoint to filter activity rows to "mentions of me".
 *
 * Inputs (any of):
 *   - email "daniel@enrola.shop"     → ["daniel"]
 *   - first_name "Daniel"            → ["daniel"]
 *   - explicit handles via EXTERNAL_HANDLE_MAP reverse lookup
 *
 * Returns lowercased handles, deduped.
 */
export function handlesForUser(args: {
  email?: string | null
  first_name?: string | null
  id?: string | null
}): string[] {
  const out = new Set<string>()
  if (args.email) {
    const local = args.email.split("@")[0].toLowerCase()
    if (local) out.add(local)
  }
  if (args.first_name) {
    out.add(args.first_name.toLowerCase())
  }
  // Reverse lookup external map: if this user's email matches a known
  // external handle target, add the handle so they receive those mentions.
  if (args.email) {
    for (const [handle, target] of Object.entries(EXTERNAL_HANDLE_MAP)) {
      if (target.toLowerCase() === args.email.toLowerCase()) {
        out.add(handle.toLowerCase())
      }
    }
  }
  return Array.from(out)
}

export function actorFromReq(req: MedusaRequest): ActorInfo {
  const authCtx = (req as unknown as {
    auth_context?: { actor_id?: string; actor_type?: string }
  }).auth_context
  // Medusa v2 attaches auth info here; we keep it loose so we work even
  // when the shape shifts between versions.
  const actorId = authCtx?.actor_id ?? null

  // Name/email aren't on the auth context — would require a user lookup.
  // We leave them null here; callers can enrich if they need to.
  return { id: actorId, name: null, email: null }
}

export async function recordActivity(
  svc: SocialModuleService,
  args: {
    entity_type: "post" | "story"
    entity_id: string
    actor: ActorInfo
    action: string
    payload?: Record<string, unknown> | null
  }
): Promise<void> {
  try {
    await svc.createSocialActivities({
      entity_type: args.entity_type,
      entity_id: args.entity_id,
      actor_id: args.actor.id,
      actor_name: args.actor.name,
      action: args.action,
      payload: (args.payload ?? null) as never,
    } as never)
  } catch (e) {
    // Never break the real request if audit logging fails.
    console.warn("[social] recordActivity failed:", (e as Error).message)
  }
}

/**
 * Pull @handle tokens out of a comment body.
 * "Hola @elena cambia esto cc @juan.perez" → ["elena", "juan.perez"]
 */
export function parseMentions(text: string): string[] {
  const re = /(?:^|\s)@([a-zA-Z0-9._-]{2,40})/g
  const out = new Set<string>()
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    out.add(m[1].toLowerCase())
  }
  return Array.from(out)
}

/**
 * Best-effort email notification for a @mention on a social post/story.
 *
 * We don't have a full user directory wired in yet, so we resolve handles
 * against the admin user table via Medusa's user module. A handle matches
 * if it's contained in the email local-part OR the first_name.
 */
export async function notifyMentions(
  req: MedusaRequest,
  args: {
    handles: string[]
    entity_type: "post" | "story"
    entity_id: string
    entity_title: string
    text: string
    actor: ActorInfo
  }
): Promise<void> {
  if (args.handles.length === 0) return

  let users: Array<{ id: string; email: string; first_name?: string | null }> = []
  try {
    // Medusa v2 exposes IUserModuleService under "userService"
    const userService = req.scope.resolve("user") as unknown as {
      listUsers: (filters?: Record<string, unknown>, config?: unknown) => Promise<
        Array<{ id: string; email: string; first_name?: string | null }>
      >
    }
    users = await userService.listUsers({})
  } catch (e) {
    console.warn("[social] notifyMentions: cannot list users:", (e as Error).message)
    return
  }

  const matched = new Map<string, { email: string; first_name?: string | null }>()
  for (const handle of args.handles) {
    const h = handle.toLowerCase()
    // 1. External map takes priority — covers users that don't have an
    //    admin account but the team still tags (consultants, designers).
    const external = EXTERNAL_HANDLE_MAP[h]
    if (external && !matched.has(external)) {
      matched.set(external, { email: external, first_name: h })
      continue
    }
    // 2. Fall back to admin user directory.
    const hit = users.find((u) => {
      const local = (u.email || "").split("@")[0].toLowerCase()
      const first = (u.first_name || "").toLowerCase()
      return local === h || first === h || local.startsWith(h) || first.startsWith(h)
    })
    if (hit && !matched.has(hit.email)) {
      matched.set(hit.email, { email: hit.email, first_name: hit.first_name })
    }
  }

  if (matched.size === 0) return

  const dashboardUrl = `https://enrola.shop/dashboard/social`
  const actorLabel = args.actor.name || args.actor.id || "alguien del equipo"
  const preview = args.text.length > 220 ? args.text.slice(0, 220) + "…" : args.text

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:24px auto;padding:24px;border:1px solid #e5e5e5;border-radius:8px;background:#fff">
      <p style="margin:0 0 8px 0;color:#666;font-size:13px;text-transform:uppercase;letter-spacing:0.08em">Mención · Enrola Social</p>
      <h2 style="margin:0 0 16px 0;color:#1A1A1A;font-size:20px">${escapeHtml(actorLabel)} te mencionó</h2>
      <p style="color:#555;margin:0 0 8px 0">En <strong>${escapeHtml(args.entity_title)}</strong>:</p>
      <blockquote style="margin:0 0 20px 0;padding:12px 16px;background:#F5F2E8;border-left:3px solid #BB3B2E;color:#1A1A1A;white-space:pre-wrap">${escapeHtml(preview)}</blockquote>
      <a href="${dashboardUrl}" style="display:inline-block;padding:10px 18px;background:#1A1A1A;color:#fff;text-decoration:none;border-radius:4px;font-weight:600">Abrir panel</a>
    </div>
  `

  await Promise.allSettled(
    Array.from(matched.values()).map((u) =>
      sendEmail({
        to: u.email,
        subject: `💬 ${actorLabel} te mencionó en ${args.entity_title}`,
        html,
      })
    )
  )
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}
