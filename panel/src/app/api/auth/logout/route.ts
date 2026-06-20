import { NextResponse } from "next/server"
import { clearSessionCookie, getSession } from "@/lib/auth"

/**
 * POST /api/auth/logout
 *
 * Mejor esfuerzo: primero intentamos revocar el token Medusa para que
 * no quede válido durante las 8h de su propio TTL. Si falla (red, backend
 * caído, token ya expirado) seguimos de todas formas y borramos la cookie.
 */
export async function POST() {
  // Leer la sesión antes de borrar la cookie
  try {
    const session = await getSession()
    if (session?.medusaToken) {
      const base = process.env.MEDUSA_ADMIN_URL ?? "http://localhost:9000"
      await fetch(new URL("/auth/session", base), {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.medusaToken}` },
        cache: "no-store",
      })
    }
  } catch {
    // Best-effort: si falla la revocación igual limpiamos la cookie local
  }

  await clearSessionCookie()
  return NextResponse.json({ ok: true })
}
