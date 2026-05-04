import { NextResponse } from "next/server"
import { autoLogin, logout } from "@/lib/webmail"
import { getSession } from "@/lib/auth"
import { MedusaError } from "@/lib/medusa"

export const dynamic = "force-dynamic"

/** POST { email } → auto-login. Returns { token, email }. */
export async function POST(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ ok: false, error: "no_session" }, { status: 401 })

  try {
    const { email } = (await req.json()) as { email?: string }
    if (!email) return NextResponse.json({ ok: false, error: "email required" }, { status: 400 })
    const data = await autoLogin(email)
    return NextResponse.json({ ok: true, ...data })
  } catch (e) {
    if (e instanceof MedusaError) {
      return NextResponse.json(
        { ok: false, error: e.message, details: e.details },
        { status: e.status === 401 ? 401 : 502 },
      )
    }
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "fetch error" }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ ok: false, error: "no_session" }, { status: 401 })
  const token = req.headers.get("x-webmail-token") ?? ""
  if (!token) return NextResponse.json({ ok: true })
  try {
    await logout(token)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: true })
  }
}
