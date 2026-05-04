/**
 * Helpers para resolver URLs de media — client-safe (no importa server-only).
 *
 * El backend Medusa sirve `/static/social-media/...` en `MEDUSA_PUBLIC_URL`.
 * El panel corre en panel.enrola.shop, así que paths relativos hay que prefijar.
 */

export const MEDUSA_PUBLIC_URL =
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ?? "https://api.enrola.shop"

/** Resuelve una URL relativa al backend Medusa.  */
export function resolveMediaUrl(url: string | null | undefined): string | null {
  if (!url) return null
  if (/^https?:\/\//i.test(url)) return url
  if (url.startsWith("/")) return `${MEDUSA_PUBLIC_URL}${url}`
  return url
}
