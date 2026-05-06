import { NextRequest, NextResponse } from "next/server"

const BACKEND_URL =
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ||
  process.env.MEDUSA_BACKEND_URL ||
  "http://localhost:9000"
const PUB_KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || ""

/**
 * Proxy → Medusa POST /store/carts/:id/recalculate-combos
 * Llamado desde el cliente tras cada operación de cart (add/update/remove)
 * para que el backend recalcule y aplique adjustments per-línea.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  if (!id) return NextResponse.json({ error: "cart id required" }, { status: 400 })
  try {
    const res = await fetch(`${BACKEND_URL}/store/carts/${encodeURIComponent(id)}/recalculate-combos`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(PUB_KEY && { "x-publishable-api-key": PUB_KEY }),
      },
    })
    const data = await res.json().catch(() => ({}))
    return NextResponse.json(data, { status: res.ok ? 200 : res.status })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 200 })
  }
}
