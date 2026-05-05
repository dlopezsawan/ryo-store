import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/auth"

const BACKEND_URL =
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ||
  process.env.MEDUSA_BACKEND_URL ||
  "http://localhost:9000"
const PUB_KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || ""

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions)
  const token = (session as unknown as Record<string, unknown>)?.medusaToken as string
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const res = await fetch(`${BACKEND_URL}/store/referrals/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "x-publishable-api-key": PUB_KEY,
    },
    next: { revalidate: 0 },
  })
  if (!res.ok) {
    return NextResponse.json(
      { code: null, link: null, friends_invited: 0, points_earned: 0, awarded: [] },
      { status: 200 }
    )
  }
  const data = await res.json()
  return NextResponse.json(data)
}
