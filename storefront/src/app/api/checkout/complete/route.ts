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

const UTM_COOKIE_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "referrer", "ref"] as const;

export async function POST(request: NextRequest) {
  try {
    const { cartId } = await request.json();
    if (!cartId) {
      return NextResponse.json({ error: "cartId required" }, { status: 400 });
    }

    // Best-effort attribution — read UTM cookies and attach to cart before completion.
    // Failures here must not block the checkout.
    try {
      const cookies = request.cookies;
      const attribution: Record<string, string> = {};
      for (const key of UTM_COOKIE_KEYS) {
        const val = cookies.get(key)?.value;
        if (val) attribution[key] = decodeURIComponent(val);
      }
      if (Object.keys(attribution).length > 0) {
        await fetch(`${BACKEND}/store/carts/${cartId}/attribution`, {
          method: "POST",
          headers: headers(),
          body: JSON.stringify(attribution),
        }).catch(() => null);
      }
    } catch {
      // ignore — attribution is optional
    }

    const res = await fetch(`${BACKEND}/store/carts/${cartId}/complete`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({}),
    });
    const data = await res.json();
    if (!res.ok) return NextResponse.json(data, { status: res.status });
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
