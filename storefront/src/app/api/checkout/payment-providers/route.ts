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

export async function GET(request: NextRequest) {
  const regionId = request.nextUrl.searchParams.get("regionId");
  if (!regionId) {
    return NextResponse.json({ error: "regionId required" }, { status: 400 });
  }
  try {
    const res = await fetch(
      `${BACKEND}/store/payment-providers?region_id=${encodeURIComponent(regionId)}`,
      { headers: headers() }
    );
    const data = await res.json();
    if (!res.ok) return NextResponse.json(data, { status: res.status });
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
