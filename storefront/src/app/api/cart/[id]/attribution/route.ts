import { NextRequest, NextResponse } from "next/server"

const BACKEND_URL =
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ||
  process.env.MEDUSA_BACKEND_URL ||
  "http://localhost:9000"
const PUB_KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || ""

/**
 * Proxy: POST /store/carts/:id/attribution
 * Used by <AttributionSync> on every page-load to write captured UTM+ref
 * cookies onto the cart as soon as a cart exists. Idempotent on the backend.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  if (!id) return NextResponse.json({ error: "cart id required" }, { status: 400 })
  try {
    const body = await req.json().catch(() => ({}))
    const res = await fetch(`${BACKEND_URL}/store/carts/${encodeURIComponent(id)}/attribution`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(PUB_KEY && { "x-publishable-api-key": PUB_KEY }),
      },
      body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => ({}))
    return NextResponse.json(data, { status: res.ok ? 200 : res.status })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 200 })
  }
}
