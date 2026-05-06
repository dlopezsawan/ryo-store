import { NextRequest, NextResponse } from "next/server";

const BACKEND = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || process.env.MEDUSA_BACKEND_URL || "http://localhost:9000";
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || "";

export async function GET(request: NextRequest) {
  try {
    const res = await fetch(`${BACKEND}/store/regions?limit=20&fields=*countries`, {
      headers: {
        "Content-Type": "application/json",
        ...(PUBLISHABLE_KEY && { "x-publishable-api-key": PUBLISHABLE_KEY }),
      },
    });
    if (!res.ok) return NextResponse.json({ error: "Regions failed" }, { status: res.status });
    const data = (await res.json()) as {
      regions?: Array<{
        id: string;
        countries?: Array<{ iso_2?: string }>;
      }>;
    };
    const regions = data.regions ?? [];
    const preferCountry = request.nextUrl.searchParams.get("country")?.toLowerCase() ?? "ve";
    const venezuelaRegion = regions.find((r) =>
      r.countries?.some((c) => c.iso_2?.toLowerCase() === preferCountry)
    );
    const regionId = venezuelaRegion?.id ?? regions[0]?.id ?? null;
    if (!regionId) return NextResponse.json({ regions: [] });
    return NextResponse.json({ regions: [{ id: regionId }] });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
