import { NextRequest, NextResponse } from "next/server";

const BACKEND = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || process.env.MEDUSA_BACKEND_URL || "http://localhost:9000";
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || "";

function headers() {
  return {
    "Content-Type": "application/json",
    ...(PUBLISHABLE_KEY && { "x-publishable-api-key": PUBLISHABLE_KEY }),
  };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ lineId: string }> }
) {
  const { lineId } = await params;
  const cartId = request.nextUrl.searchParams.get("cartId");
  if (!cartId) return NextResponse.json({ error: "cartId required" }, { status: 400 });
  try {
    const body = await request.json();
    const res = await fetch(
      `${BACKEND}/store/carts/${cartId}/line-items/${lineId}`,
      {
        method: "POST",
        headers: headers(),
        body: JSON.stringify(body),
      }
    );
    const data = await res.json();
    if (!res.ok) return NextResponse.json(data, { status: res.status });
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ lineId: string }> }
) {
  const { lineId } = await params;
  const cartId = request.nextUrl.searchParams.get("cartId");
  if (!cartId) return NextResponse.json({ error: "cartId required" }, { status: 400 });
  try {
    const res = await fetch(
      `${BACKEND}/store/carts/${cartId}/line-items/${lineId}`,
      { method: "DELETE", headers: headers() }
    );
    const data = await res.json();
    if (!res.ok) return NextResponse.json(data, { status: res.status });
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
