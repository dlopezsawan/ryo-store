import { NextRequest, NextResponse } from "next/server";

const BACKEND =
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || process.env.MEDUSA_BACKEND_URL || "http://localhost:9000";
const PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || "";

function headers() {
  return {
    "Content-Type": "application/json",
    ...(PUBLISHABLE_KEY && {
      "x-publishable-api-key": PUBLISHABLE_KEY,
    }),
  };
}

export async function POST(request: NextRequest) {
  try {
    const { cart_id } = await request.json();
    if (!cart_id) {
      return NextResponse.json({ error: "cart_id required" }, { status: 400 });
    }
    const res = await fetch(`${BACKEND}/store/payment-collections`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ cart_id }),
    });
    const data = await res.json();
    if (!res.ok) return NextResponse.json(data, { status: res.status });
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
