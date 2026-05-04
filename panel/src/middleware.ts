import { NextRequest, NextResponse } from "next/server"
import { jwtVerify } from "jose"
import { PANEL_COOKIE_NAME } from "./lib/auth"

/**
 * Middleware de auth.
 *
 * Reglas:
 *   - /login y /api/auth/* son públicos
 *   - Todo lo demás requiere cookie de sesión válida → si no, redirige a /login
 *   - Static assets (_next/*, public/*) no pasan por aquí (config.matcher)
 *
 * Verificamos el JWT acá mismo (no llamamos a la lib que usa cookies()
 * helper porque el middleware corre en Edge Runtime y necesitamos jose
 * directo). La lib auth.ts y el middleware deben mantener el mismo contrato.
 */

const ALG = "HS256"
const ISS = "enrola-panel"
const PUBLIC_PATHS = ["/login", "/api/auth"]
const PUBLIC_FILES = ["/manifest.webmanifest", "/sw.js", "/robots.txt"]

function isPublic(pathname: string): boolean {
  if (PUBLIC_FILES.includes(pathname)) return true
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

function getSecret(): Uint8Array {
  const s = process.env.PANEL_SESSION_SECRET
  if (!s) throw new Error("PANEL_SESSION_SECRET missing")
  return new TextEncoder().encode(s)
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (isPublic(pathname)) return NextResponse.next()

  const cookie = req.cookies.get(PANEL_COOKIE_NAME)?.value
  if (!cookie) return redirectToLogin(req)

  try {
    await jwtVerify(cookie, getSecret(), { issuer: ISS })
    return NextResponse.next()
  } catch {
    // Token inválido o expirado → al login con flag para mostrar mensaje
    const res = redirectToLogin(req, "expired")
    res.cookies.delete(PANEL_COOKIE_NAME)
    return res
  }
}

function redirectToLogin(req: NextRequest, reason?: string) {
  const url = req.nextUrl.clone()
  url.pathname = "/login"
  url.searchParams.set("from", req.nextUrl.pathname)
  if (reason) url.searchParams.set("reason", reason)
  return NextResponse.redirect(url)
}

export const config = {
  // Excluye archivos estáticos y _next/* del middleware. /favicon.ico
  // tampoco — ahorra cycles en assets servidos por Next directamente.
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico|logo\\.svg|bichito\\.svg|wordmark\\.svg|sw\\.js|manifest\\.webmanifest).*)"],
}
