import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/auth"
import { medusaGetOrders } from "@/lib/medusaAuth"

export async function GET() {
  const session = await getServerSession(authOptions)
  const token = (session as unknown as Record<string, unknown>)?.medusaToken as string
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const orders = await medusaGetOrders(token)
  return NextResponse.json({ orders })
}
