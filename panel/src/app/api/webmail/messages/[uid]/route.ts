import { NextResponse } from "next/server"
import { getMessage, deleteMessage } from "@/lib/webmail"
import { getSession } from "@/lib/auth"
import { MedusaError } from "@/lib/medusa"

export const dynamic = "force-dynamic"

export async function GET(req: Request, { params }: { params: Promise<{ uid: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ ok: false, error: "no_session" }, { status: 401 })
  const token = req.headers.get("x-webmail-token") ?? ""
  if (!token) return NextResponse.json({ ok: false, error: "no_webmail_token" }, { status: 401 })

  const { uid } = await params
  const url = new URL(req.url)
  const folder = url.searchParams.get("folder") ?? "INBOX"

  try {
    const data = await getMessage(token, folder, Number(uid))
    return NextResponse.json({ ok: true, ...data })
  } catch (e) {
    if (e instanceof MedusaError) {
      return NextResponse.json({ ok: false, error: e.message }, { status: e.status })
    }
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "fetch error" }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ uid: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ ok: false, error: "no_session" }, { status: 401 })
  const token = req.headers.get("x-webmail-token") ?? ""
  if (!token) return NextResponse.json({ ok: false, error: "no_webmail_token" }, { status: 401 })

  const { uid } = await params
  const url = new URL(req.url)
  const folder = url.searchParams.get("folder") ?? "INBOX"

  try {
    const data = await deleteMessage(token, Number(uid), folder)
    return NextResponse.json({ ok: true, ...data })
  } catch (e) {
    if (e instanceof MedusaError) {
      return NextResponse.json({ ok: false, error: e.message }, { status: e.status })
    }
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "fetch error" }, { status: 500 })
  }
}
