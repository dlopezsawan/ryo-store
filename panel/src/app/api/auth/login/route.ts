import { NextResponse } from "next/server"
import { medusaLogin, medusaMe, MedusaError } from "@/lib/medusa"
import { setSessionCookie } from "@/lib/auth"

/**
 * POST /api/auth/login
 * Body: { email, password }
 *
 * 1. Cambia las credenciales con Medusa Admin API → bearer JWT
 * 2. Verifica que el bearer funciona haciendo /admin/users/me
 * 3. Empaqueta el bearer en una cookie firmada por nosotros (httpOnly)
 *
 * Si cualquier paso falla → 401 con mensaje genérico (no leak detalles).
 */
export async function POST(req: Request) {
  let body: { email?: string; password?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 })
  }

  const email = String(body.email ?? "").trim().toLowerCase()
  const password = String(body.password ?? "")
  if (!email || !password) {
    return NextResponse.json({ error: "missing_credentials" }, { status: 400 })
  }

  try {
    const { token } = await medusaLogin(email, password)
    // Verifica el bearer sirve y obtenemos user_id real (no confiamos sólo
    // en el JWT — Medusa pudo regresar uno con scope wrong)
    const me = await medusaMe(token)

    await setSessionCookie({
      medusaToken: token,
      email: me.user.email,
      userId: me.user.id,
    })

    return NextResponse.json({ ok: true, user: { email: me.user.email, id: me.user.id } })
  } catch (e) {
    const status = e instanceof MedusaError ? e.status : 500
    // Mensaje genérico al cliente — detalles completos solo a logs server
    const cause = e instanceof Error && "cause" in e ? (e as Error & { cause?: unknown }).cause : undefined
    console.error(
      "[panel/login] failed:",
      e instanceof Error ? e.message : e,
      "BASE=", process.env.MEDUSA_ADMIN_URL,
      "cause=", cause instanceof Error ? cause.message : cause
    )
    return NextResponse.json(
      { error: status === 401 ? "invalid_credentials" : "login_error" },
      { status: status === 401 ? 401 : 500 }
    )
  }
}
