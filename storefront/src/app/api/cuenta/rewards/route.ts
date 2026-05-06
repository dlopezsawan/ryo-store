import { NextResponse } from "next/server"

const BACKEND_URL =
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ||
  process.env.MEDUSA_BACKEND_URL ||
  "http://localhost:9000"
const PUB_KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || ""

export async function GET() {
  const res = await fetch(`${BACKEND_URL}/store/loyalty/rewards`, {
    headers: { "x-publishable-api-key": PUB_KEY },
    next: { revalidate: 60 },
  })
  if (!res.ok) return NextResponse.json({ rewards: [] })
  const data = await res.json()
  return NextResponse.json(data)
}
