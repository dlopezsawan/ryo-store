/**
 * GET /admin/webmail/accounts
 *
 * Devuelve los buzones IMAP que el admin loged-in puede usar, según su email
 * de Medusa. La password de cada buzón se busca server-side en env vars
 * (`WEBMAIL_PASS_<LOCAL_PART>`). Si la password no está, la cuenta NO se
 * incluye — así el front nunca ofrece login a un buzón que no podemos abrir.
 *
 * Mapping admin → buzones:
 *   - Default (todos):       hola@enrola.shop
 *   - dlopezsawan@gmail.com: + daniel@enrola.shop
 *   - lede495@gmail.com:     + leo@enrola.shop
 *   - admin@enrola.shop:     + admin@enrola.shop, pedidos@enrola.shop
 *
 * Override del mapping vía env `WEBMAIL_ACCOUNT_ACCESS` (JSON), formato:
 *   {"dlopezsawan@gmail.com":["hola@enrola.shop","daniel@enrola.shop"], ...}
 */

import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"

interface MailAccount {
  email: string
  /** Display name del buzón (parte local capitalizada) */
  label: string
  /** Si tenemos password configurada para este buzón en env */
  available: boolean
}

const DEFAULT_ACCESS_MAP: Record<string, string[]> = {
  "dlopezsawan@gmail.com": ["hola@enrola.shop", "daniel@enrola.shop", "pedidos@enrola.shop"],
  "lede495@gmail.com": ["hola@enrola.shop", "leo@enrola.shop", "pedidos@enrola.shop"],
  "admin@enrola.shop": ["hola@enrola.shop", "admin@enrola.shop", "pedidos@enrola.shop"],
}

const FALLBACK_ACCOUNTS = ["hola@enrola.shop"]

function readAccessMap(): Record<string, string[]> {
  const raw = process.env.WEBMAIL_ACCOUNT_ACCESS
  if (!raw) return DEFAULT_ACCESS_MAP
  try {
    const parsed = JSON.parse(raw) as Record<string, string[]>
    if (parsed && typeof parsed === "object") return parsed
  } catch {
    // ignore — fall through to default
  }
  return DEFAULT_ACCESS_MAP
}

/** Convierte un email en el nombre de la env var de password.
 *  daniel@enrola.shop → WEBMAIL_PASS_DANIEL_ENROLA_SHOP */
function passwordEnvVarName(email: string): string {
  const sanitized = email.toUpperCase().replace(/[^A-Z0-9]+/g, "_")
  return `WEBMAIL_PASS_${sanitized}`
}

/** Lee la password de un buzón desde env. Devuelve null si no existe. */
export function getAccountPassword(email: string): string | null {
  const v = process.env[passwordEnvVarName(email)]
  return v && v.length > 0 ? v : null
}

function labelForEmail(email: string): string {
  const local = email.split("@")[0] ?? email
  return local.charAt(0).toUpperCase() + local.slice(1)
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  // En Medusa v2 admin, `auth_context.actor_id` es el user_id.
  // Resolvemos el email vía el módulo USER.
  const actorId =
    (req as unknown as { auth_context?: { actor_id?: string } }).auth_context?.actor_id ||
    (req as unknown as { user?: { id?: string } }).user?.id ||
    null

  let adminEmail: string | null = null
  if (actorId) {
    try {
      const userModule = req.scope.resolve(Modules.USER) as {
        listUsers: (q: { id: string[] }, opts: { take: number }) => Promise<Array<{ email?: string }>>
      }
      const users = await userModule.listUsers({ id: [actorId] }, { take: 1 })
      adminEmail = users[0]?.email?.toLowerCase() ?? null
    } catch {
      // ignore — fallback al default access
    }
  }

  const accessMap = readAccessMap()
  const list = (adminEmail && accessMap[adminEmail]) || FALLBACK_ACCOUNTS

  const accounts: MailAccount[] = list.map((email) => ({
    email,
    label: labelForEmail(email),
    available: getAccountPassword(email) !== null,
  }))

  res.json({ admin_email: adminEmail, accounts })
}
