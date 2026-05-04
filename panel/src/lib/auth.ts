import { SignJWT, jwtVerify } from "jose"
import { cookies } from "next/headers"

/**
 * Sesión del panel.
 *
 * Modelo: el panel intercambia email+password contra Medusa Admin API
 * (POST /admin/auth/user/emailpass) → recibe un JWT firmado por Medusa.
 * Ese token NO se guarda como cookie del browser (sería bearer expuesto a
 * XSS). En lugar de eso lo guardamos en una cookie firmada por NUESTRO
 * secret — httpOnly, samesite=lax — y en cada request server-side la
 * desempaquetamos para obtener el bearer original que reutilizamos al
 * llamar a Medusa.
 *
 * Esto da:
 *   - Defensa contra XSS (el token nunca llega al JS del browser)
 *   - Permite logout instantáneo (rotamos el secret o borramos la cookie)
 *   - Rotación independiente del lifetime de Medusa
 */

const COOKIE_NAME = "panel_session"
const ALG = "HS256"
const ISS = "enrola-panel"

function getSecret(): Uint8Array {
  const s = process.env.PANEL_SESSION_SECRET
  if (!s || s.length < 32) {
    throw new Error("PANEL_SESSION_SECRET missing or too short (min 32 chars)")
  }
  return new TextEncoder().encode(s)
}

export interface SessionPayload {
  /** JWT bearer original que devolvió Medusa */
  medusaToken: string
  /** Email del admin para mostrar en la UI sin un round-trip extra */
  email: string
  /** ID del usuario admin en Medusa */
  userId: string
}

/** Firma una sesión con nuestro secret y devuelve el cookie value. */
export async function signSession(payload: SessionPayload, ttlSeconds = 60 * 60 * 8): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: ALG })
    .setIssuer(ISS)
    .setIssuedAt()
    .setExpirationTime(`${ttlSeconds}s`)
    .sign(getSecret())
}

/** Verifica la cookie y devuelve el payload, o null si inválida/expirada. */
export async function verifySession(cookieValue: string | undefined): Promise<SessionPayload | null> {
  if (!cookieValue) return null
  try {
    const { payload } = await jwtVerify(cookieValue, getSecret(), { issuer: ISS })
    if (typeof payload.medusaToken !== "string") return null
    if (typeof payload.email !== "string") return null
    if (typeof payload.userId !== "string") return null
    return {
      medusaToken: payload.medusaToken,
      email: payload.email,
      userId: payload.userId,
    }
  } catch {
    return null
  }
}

/**
 * Lee la sesión del request actual (server-side).
 * Llamar desde Server Components, route handlers, middleware-friendly code.
 */
export async function getSession(): Promise<SessionPayload | null> {
  const c = await cookies()
  return verifySession(c.get(COOKIE_NAME)?.value)
}

/** Setea la cookie de sesión. Llamar desde route handler de login. */
export async function setSessionCookie(payload: SessionPayload): Promise<void> {
  const c = await cookies()
  const value = await signSession(payload)
  c.set(COOKIE_NAME, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.PANEL_COOKIE_SECURE === "true",
    domain: process.env.PANEL_COOKIE_DOMAIN || undefined,
    path: "/",
    maxAge: 60 * 60 * 8, // 8h, mismo TTL que el JWT
  })
}

/** Borra la cookie. */
export async function clearSessionCookie(): Promise<void> {
  const c = await cookies()
  c.delete(COOKIE_NAME)
}

export const PANEL_COOKIE_NAME = COOKIE_NAME
