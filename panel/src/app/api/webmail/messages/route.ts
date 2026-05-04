import { NextResponse } from "next/server"
import { listMessages, sendMessage } from "@/lib/webmail"
import { getSession } from "@/lib/auth"
import { MedusaError } from "@/lib/medusa"

export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ ok: false, error: "no_session" }, { status: 401 })
  const token = req.headers.get("x-webmail-token") ?? ""
  if (!token) return NextResponse.json({ ok: false, error: "no_webmail_token" }, { status: 401 })

  const url = new URL(req.url)
  const folder = url.searchParams.get("folder") ?? "INBOX"
  const page = Number(url.searchParams.get("page") ?? 1)
  const limit = Number(url.searchParams.get("limit") ?? 25)

  try {
    const data = await listMessages(token, folder, page, limit)
    return NextResponse.json({ ok: true, ...data })
  } catch (e) {
    if (e instanceof MedusaError) {
      return NextResponse.json({ ok: false, error: e.message }, { status: e.status })
    }
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "fetch error" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ ok: false, error: "no_session" }, { status: 401 })
  const token = req.headers.get("x-webmail-token") ?? ""
  if (!token) return NextResponse.json({ ok: false, error: "no_webmail_token" }, { status: 401 })

  try {
    const body = (await req.json()) as Parameters<typeof sendMessage>[1]
    const data = await sendMessage(token, body)
    return NextResponse.json({ ok: true, ...data })
  } catch (e) {
    if (e instanceof MedusaError) {
      return NextResponse.json({ ok: false, error: e.message }, { status: e.status })
    }
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "fetch error" }, { status: 500 })
  }
}
