import { NextResponse } from "next/server"
import { listDanaConversations, MedusaError } from "@/lib/medusa"
import { getSession } from "@/lib/auth"

/**
 * GET /api/dana/conversations
 *
 * Proxy panel→medusa para que el componente cliente DanaWorkspace
 * pueda hacer polling sin necesitar el bearer en el browser. La
 * sesión se valida server-side via cookie firmada.
 *
 * Query: status, q, limit, offset (todos opcionales)
 */

export async function GET(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "no_session" }, { status: 401 })

  const url = new URL(req.url)
  const status = url.searchParams.get("status") as "bot_active" | "human_active" | "all" | null
  const q = url.searchParams.get("q") ?? undefined
  const limit = Number(url.searchParams.get("limit") ?? 50)
  const offset = Number(url.searchParams.get("offset") ?? 0)

  try {
    const data = await listDanaConversations({
      status: status === "bot_active" || status === "human_active" ? status : "all",
      q,
      limit,
      offset,
    })
    return NextResponse.json(data)
  } catch (e) {
    if (e instanceof MedusaError) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
    return NextResponse.json({ error: "fetch_failed" }, { status: 500 })
  }
}
