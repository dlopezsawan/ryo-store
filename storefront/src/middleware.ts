import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

const BACKEND_URL =
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "https://api.enrola.shop"

// Cache maintenance status for 15 seconds to avoid hammering the API
let cachedStatus: { maintenance: boolean; ts: number } | null = null
const CACHE_TTL = 15_000

async function isMaintenanceMode(): Promise<boolean> {
  if (cachedStatus && Date.now() - cachedStatus.ts < CACHE_TTL) {
    return cachedStatus.maintenance
  }
  try {
    const r = await fetch(`${BACKEND_URL}/maintenance`, {
      next: { revalidate: 15 },
    })
    const data = await r.json()
    cachedStatus = { maintenance: !!data.maintenance, ts: Date.now() }
    return cachedStatus.maintenance
  } catch {
    return false
  }
}

// Kill switch: the WHOLE storefront answers 404 (assets and /api included).
// Toggled per-deploy via docker-compose environment — flip the env and
// `docker compose up -d storefront` to restore; no rebuild needed.
// X-Robots-Tag tells crawlers to drop the pages faster than the 404 alone.
const KILL_SWITCH = process.env.STOREFRONT_KILL_SWITCH === "1"

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (KILL_SWITCH) {
    return new NextResponse("404 — Not Found", {
      status: 404,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "x-robots-tag": "noindex, nofollow",
      },
    })
  }

  // Never block these paths
  if (
    pathname === "/mantenimiento" ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/fonts") ||
    pathname.startsWith("/favicon") ||
    pathname.endsWith(".ico") ||
    pathname.endsWith(".png") ||
    pathname.endsWith(".jpg") ||
    pathname.endsWith(".svg") ||
    pathname.endsWith(".webp") ||
    pathname.endsWith(".css") ||
    pathname.endsWith(".js")
  ) {
    return NextResponse.next()
  }

  const maintenance = await isMaintenanceMode()
  if (maintenance) {
    const url = request.nextUrl.clone()
    url.pathname = "/mantenimiento"
    return NextResponse.rewrite(url)
  }

  return NextResponse.next()
}

export const config = {
  // Match everything so the kill switch can 404 assets too. Normal mode
  // is unchanged: the early-allow list above already passes /_next,
  // favicon and static files through.
  matcher: ["/(.*)"],
}
