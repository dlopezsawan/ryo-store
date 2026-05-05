import { NextRequest, NextResponse } from "next/server"

const BACKEND_URL =
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ||
  process.env.MEDUSA_BACKEND_URL ||
  "http://localhost:9000"
const PUB_KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || ""

/**
 * Public validation endpoint — used by the cookie toast and cart UI to confirm
 * a code is real before showing "Referido aplicado".
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const res = await fetch(`${BACKEND_URL}/store/referrals/validate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(PUB_KEY && { "x-publishable-api-key": PUB_KEY }),
      },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    return NextResponse.json(data, { status: res.ok ? 200 : res.status })
  } catch (e) {
    return NextResponse.json({ valid: false, code: null, referrer_initial: null, error: String(e) }, { status: 200 })
  }
}
