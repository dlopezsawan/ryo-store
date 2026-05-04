import { NextResponse } from "next/server"
import { listPosthogRecordings, MedusaError } from "@/lib/medusa"
import { getSession } from "@/lib/auth"

export const maxDuration = 60
export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ ok: false, error: "no_session" }, { status: 401 })

  const url = new URL(req.url)
  const days = Number(url.searchParams.get("days") ?? 7)
  const limit = Number(url.searchParams.get("limit") ?? 30)
  const search = url.searchParams.get("search") ?? undefined
  const distinct_id = url.searchParams.get("distinct_id") ?? undefined

  try {
    const data = await listPosthogRecordings({ days, limit, search, distinct_id })
    return NextResponse.json({ ok: true, ...data })
  } catch (e) {
    if (e instanceof MedusaError) {
      return NextResponse.json({ ok: false, error: `Medusa ${e.status}: ${e.message}` }, { status: e.status === 401 ? 401 : 502 })
    }
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "fetch error" }, { status: 500 })
  }
}
