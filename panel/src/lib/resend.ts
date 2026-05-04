/**
 * Resend client — Server-side helpers para la API de Resend.
 *
 * Mantenemos esto separado de medusa.ts porque Resend es una integración
 * directa (sin pasar por Medusa). El API key vive en `RESEND_API_KEY`.
 *
 * Docs: https://resend.com/docs/api-reference
 *
 * Las funciones lanzan ResendError si la API responde con !2xx.
 * Si la env var no está, lanzan un error claro para que el panel pueda
 * mostrar un placeholder en vez de fallar silenciosamente.
 */

const BASE = "https://api.resend.com"

export class ResendError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message)
    this.name = "ResendError"
  }
}

export class ResendNotConfigured extends Error {
  constructor() {
    super("RESEND_API_KEY no está configurado")
    this.name = "ResendNotConfigured"
  }
}

function getKey(): string {
  const k = process.env.RESEND_API_KEY
  if (!k) throw new ResendNotConfigured()
  return k
}

interface FetchOpts {
  query?: Record<string, string | number | undefined>
  body?: unknown
}

async function resendFetch<T>(method: "GET" | "POST" | "DELETE" | "PATCH", path: string, opts: FetchOpts = {}): Promise<T> {
  const key = getKey()
  const url = new URL(path.startsWith("/") ? path : `/${path}`, BASE)
  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      if (v === undefined) continue
      url.searchParams.set(k, String(v))
    }
  }
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      ...(opts.body ? { "Content-Type": "application/json" } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    cache: "no-store",
  })
  if (!res.ok) {
    let details: unknown
    try { details = await res.json() } catch { /* ignore */ }
    throw new ResendError(res.status, `resend ${method} ${path} (${res.status})`, details)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

// ─── Domain types ────────────────────────────────────────────────────

export interface ResendEmail {
  id: string
  from: string
  to: string[]
  subject: string
  created_at: string
  last_event?: "sent" | "delivered" | "opened" | "clicked" | "bounced" | "complained" | string
  html?: string
  text?: string
}

export interface ResendAudience {
  id: string
  name: string
  created_at: string
}

export interface ResendContact {
  id: string
  email: string
  first_name?: string | null
  last_name?: string | null
  unsubscribed: boolean
  created_at: string
}

export interface ResendBroadcast {
  id: string
  audience_id: string
  status: "draft" | "scheduled" | "sent" | "queued" | string
  name?: string
  subject?: string
  scheduled_at?: string | null
  sent_at?: string | null
  created_at: string
}

// ─── Helpers ────────────────────────────────────────────────────────

/**
 * Resend's `/emails` endpoint actualmente NO ofrece un list general
 * desde la public API; el dashboard usa endpoints internos. Aquí
 * exponemos el endpoint oficial de retrieve por ID y, para listing,
 * la versión beta `/emails` (si está disponible). Si no, devolvemos
 * lista vacía con un flag `unsupported: true`.
 */
export async function retrieveEmail(id: string) {
  return resendFetch<ResendEmail>("GET", `/emails/${id}`)
}

/**
 * Listing oficial — la API pública v1 de Resend permite GET /emails
 * con paginación cursor-based desde finales de 2024. Si tu cuenta no
 * está activada, esto devuelve 404 y lo manejamos arriba.
 */
export async function listEmails(args?: { limit?: number; before?: string; after?: string }) {
  return resendFetch<{ data: ResendEmail[]; has_more?: boolean }>("GET", "/emails", {
    query: {
      limit: args?.limit ?? 50,
      before: args?.before,
      after: args?.after,
    },
  })
}

export async function sendEmail(args: {
  from: string
  to: string | string[]
  subject: string
  html?: string
  text?: string
  reply_to?: string
  cc?: string[]
  bcc?: string[]
  tags?: Array<{ name: string; value: string }>
}) {
  return resendFetch<{ id: string }>("POST", "/emails", { body: args })
}

export async function listAudiences() {
  return resendFetch<{ data: ResendAudience[] }>("GET", "/audiences")
}

export async function listContacts(audienceId: string, args?: { limit?: number }) {
  return resendFetch<{ data: ResendContact[] }>(
    "GET",
    `/audiences/${audienceId}/contacts`,
    { query: { limit: args?.limit ?? 100 } },
  )
}

export async function listBroadcasts() {
  return resendFetch<{ data: ResendBroadcast[] }>("GET", "/broadcasts")
}

export async function createBroadcast(args: {
  audience_id: string
  from: string
  subject: string
  html?: string
  text?: string
  reply_to?: string
  name?: string
}) {
  return resendFetch<{ id: string }>("POST", "/broadcasts", { body: args })
}

export async function sendBroadcast(broadcastId: string, args?: { scheduled_at?: string }) {
  return resendFetch<{ id: string }>("POST", `/broadcasts/${broadcastId}/send`, {
    body: args ?? {},
  })
}

export async function deleteBroadcast(broadcastId: string) {
  return resendFetch<{ id: string; deleted: boolean }>("DELETE", `/broadcasts/${broadcastId}`)
}

export function isConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY)
}

export function defaultFromAddress(): string {
  return process.env.RESEND_FROM_ADDRESS || "Enrola <hola@enrola.shop>"
}
