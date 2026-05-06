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

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

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
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
