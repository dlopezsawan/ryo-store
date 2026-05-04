import { NextResponse } from "next/server"
import { listFolders } from "@/lib/webmail"
import { getSession } from "@/lib/auth"
import { MedusaError } from "@/lib/medusa"

export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ ok: false, error: "no_session" }, { status: 401 })
  const token = req.headers.get("x-webmail-token") ?? ""
  if (!token) return NextResponse.json({ ok: false, error: "no_webmail_token" }, { status: 401 })
  try {
    const data = await listFolders(token)
    return NextResponse.json({ ok: true, ...data })
  } catch (e) {
    if (e instanceof MedusaError) {
      return NextResponse.json({ ok: false, error: e.message }, { status: e.status })
    }
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "fetch error" }, { status: 500 })
  }
}
