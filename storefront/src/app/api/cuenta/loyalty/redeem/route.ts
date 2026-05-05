import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/auth"

const BACKEND_URL =
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ||
  process.env.MEDUSA_BACKEND_URL ||
  "http://localhost:9000"
const PUB_KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || ""

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const token = (session as unknown as Record<string, unknown>)?.medusaToken as string
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { reward_ids, order_id } = await req.json()

  const res = await fetch(`${BACKEND_URL}/store/loyalty/redeem`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "x-publishable-api-key": PUB_KEY,
    },
    body: JSON.stringify({ reward_ids, order_id }),
  })

  const data = await res.json()
  if (!res.ok) return NextResponse.json({ error: data.error || "Error al canjear" }, { status: res.status })
  return NextResponse.json(data)
}

// Reversar canje si el pedido falla
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const token = (session as unknown as Record<string, unknown>)?.medusaToken as string
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { reward_ids } = await req.json()

  const res = await fetch(`${BACKEND_URL}/store/loyalty/redeem`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "x-publishable-api-key": PUB_KEY,
    },
    body: JSON.stringify({ reward_ids }),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) return NextResponse.json({ error: data.error || "Error al reversar" }, { status: res.status })
  return NextResponse.json(data)
}
