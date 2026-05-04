import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"

/** GET /api/auth/me → who am I (devuelve null si no hay sesión) */
export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ user: null }, { status: 401 })
  return NextResponse.json({ user: { email: session.email, id: session.userId } })
}
