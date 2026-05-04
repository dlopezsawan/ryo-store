import { NextResponse } from "next/server"
import { setFlags } from "@/lib/webmail"
import { getSession } from "@/lib/auth"
import { MedusaError } from "@/lib/medusa"

export const dynamic = "force-dynamic"

export async function PATCH(req: Request, { params }: { params: Promise<{ uid: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ ok: false, error: "no_session" }, { status: 401 })
  const token = req.headers.get("x-webmail-token") ?? ""
  if (!token) return NextResponse.json({ ok: false, error: "no_webmail_token" }, { status: 401 })

  const { uid } = await params
  const body = (await req.json()) as { folder?: string; seen?: boolean; flagged?: boolean }
  if (!body.folder) return NextResponse.json({ ok: false, error: "folder required" }, { status: 400 })

  try {
    const data = await setFlags(token, Number(uid), body.folder, { seen: body.seen, flagged: body.flagged })
    return NextResponse.json({ ok: true, ...data })
  } catch (e) {
    if (e instanceof MedusaError) {
      return NextResponse.json({ ok: false, error: e.message }, { status: e.status })
    }
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "fetch error" }, { status: 500 })
  }
}
