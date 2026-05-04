import { NextResponse } from "next/server"
import { getRemarketingPatterns, MedusaError } from "@/lib/medusa"
import { getSession } from "@/lib/auth"

// El backend puede tomar 60s+ — desactivamos el límite de Vercel/Next
export const maxDuration = 90
export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ ok: false, error: "no_session" }, { status: 401 })

  const url = new URL(req.url)
  const force = url.searchParams.get("force") === "1"

  try {
    const data = await getRemarketingPatterns(force)
    return NextResponse.json({ ok: true, data })
  } catch (e) {
    if (e instanceof MedusaError) {
      return NextResponse.json({ ok: false, error: `Medusa ${e.status}: ${e.message}` }, { status: e.status === 401 ? 401 : 502 })
    }
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "fetch error" }, { status: 500 })
  }
}
