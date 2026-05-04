import { NextResponse } from "next/server"
import { listSocialFeedback, listAllSocialFeedback, MedusaError } from "@/lib/medusa"
import { getSession } from "@/lib/auth"

/**
 * GET /api/social/feedback?entity_type=post&entity_id=...
 *   → feedback de un post/story específico
 *
 * GET /api/social/feedback   (sin params)
 *   → todos los feedback (inbox global)
 *
 * Proxies a /admin/social/feedback del backend Medusa con sesión del panel.
 */
export async function GET(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ ok: false, error: "no_session" }, { status: 401 })

  const url = new URL(req.url)
  const entity_type = url.searchParams.get("entity_type") as "post" | "story" | null
  const entity_id = url.searchParams.get("entity_id")

  try {
    if (entity_type && entity_id) {
      const r = await listSocialFeedback({ entity_type, entity_id })
      return NextResponse.json({ ok: true, feedback: r.feedback })
    }
    // No params → inbox global
    const r = await listAllSocialFeedback()
    return NextResponse.json({ ok: true, feedback: r.feedback })
  } catch (e) {
    if (e instanceof MedusaError) {
      return NextResponse.json({ ok: false, error: `Medusa ${e.status}: ${e.message}` }, { status: e.status === 401 ? 401 : 502 })
    }
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "fetch error" }, { status: 500 })
  }
}
