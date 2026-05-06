import { NextRequest, NextResponse } from "next/server";

const BACKEND = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || process.env.MEDUSA_BACKEND_URL || "http://localhost:9000";
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || "";

function headers() {
  return {
    "Content-Type": "application/json",
    ...(PUBLISHABLE_KEY && { "x-publishable-api-key": PUBLISHABLE_KEY }),
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { cartId, variant_id, quantity = 1 } = body;
    if (!cartId || !variant_id) {
      return NextResponse.json({ error: "cartId and variant_id required" }, { status: 400 });
    }
    const res = await fetch(`${BACKEND}/store/carts/${cartId}/line-items`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ variant_id, quantity }),
    });
    const data = await res.json();
    if (!res.ok) {
      const msg = data?.message || data?.error || (typeof data === "string" ? data : "Error del backend");
      return NextResponse.json({ error: msg, ...data }, { status: res.status });
    }
    return NextResponse.json(data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `No se pudo conectar al backend: ${msg}` }, { status: 500 });
  }
}
