import { NextResponse } from "next/server"
import { getPosthogHeatmap, MedusaError } from "@/lib/medusa"
import { getSession } from "@/lib/auth"

export const maxDuration = 60
export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ ok: false, error: "no_session" }, { status: 401 })

  const url = new URL(req.url)
  const days = Number(url.searchParams.get("days") ?? 7)
  const limit = Number(url.searchParams.get("limit") ?? 30)
  const page = url.searchParams.get("page") ?? undefined

  try {
    const data = await getPosthogHeatmap({ days, limit, page })
    return NextResponse.json({ ok: true, ...data })
  } catch (e) {
    if (e instanceof MedusaError) {
      return NextResponse.json({ ok: false, error: `Medusa ${e.status}: ${e.message}` }, { status: e.status === 401 ? 401 : 502 })
    }
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "fetch error" }, { status: 500 })
  }
}
