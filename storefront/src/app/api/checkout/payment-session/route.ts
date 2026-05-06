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
    const body = await request.json();
    const { collectionId, provider_id, data } = body;
    if (!collectionId || !provider_id) {
      return NextResponse.json(
        { error: "collectionId and provider_id required" },
        { status: 400 }
      );
    }
    const res = await fetch(
      `${BACKEND}/store/payment-collections/${collectionId}/payment-sessions`,
      {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          provider_id,
          ...(data && { data }),
        }),
      }
    );
    const sessionData = await res.json();
    if (!res.ok) {
      return NextResponse.json(sessionData, { status: res.status });
    }
    return NextResponse.json(sessionData);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
