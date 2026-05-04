/**
 * Google Service Account auth helper for SEO Analytics.
 *
 * Loads credentials from GOOGLE_SERVICE_ACCOUNT_KEY_BASE64 (preferred) or
 * GOOGLE_APPLICATION_CREDENTIALS (path to JSON). Used by GSC, GA4, and URL
 * Inspection clients.
 *
 * We hand-roll JWT → access_token (no `googleapis` dep required for v0) to
 * keep the backend bundle small. If/when we add more Google APIs, swap in
 * the official `googleapis` package.
 */

import { createSign } from "crypto"

type ServiceAccountKey = {
  client_email: string
  private_key: string
  token_uri: string
}

let cachedKey: ServiceAccountKey | null = null
let cachedToken: { token: string; expiresAt: number; scope: string } | null = null

function loadKey(): ServiceAccountKey | null {
  if (cachedKey) return cachedKey
  const b64 = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64
  if (!b64) return null
  try {
    const json = Buffer.from(b64, "base64").toString("utf8")
    const parsed = JSON.parse(json) as ServiceAccountKey
    cachedKey = parsed
    return parsed
  } catch (err) {
    console.error("[seo-google-auth] Failed to parse service account key:", err)
    return null
  }
}

function base64url(buf: Buffer | string): string {
  return Buffer.from(buf).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_")
}

/**
 * Get a short-lived OAuth2 access token for the given scope.
 * Cached in memory until 60s before expiry.
 */
export async function getGoogleAccessToken(scope: string): Promise<string | null> {
  const key = loadKey()
  if (!key) {
    console.warn("[seo-google-auth] No service account key configured — skipping")
    return null
  }

  const now = Math.floor(Date.now() / 1000)
  if (cachedToken && cachedToken.scope === scope && cachedToken.expiresAt - 60 > now) {
    return cachedToken.token
  }

  const header = { alg: "RS256", typ: "JWT" }
  const claim = {
    iss: key.client_email,
    scope,
    aud: key.token_uri,
    iat: now,
    exp: now + 3600,
  }

  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claim))}`
  const sig = createSign("RSA-SHA256").update(unsigned).sign(key.private_key)
  const jwt = `${unsigned}.${base64url(sig)}`

  const res = await fetch(key.token_uri, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }).toString(),
  })

  if (!res.ok) {
    console.error("[seo-google-auth] Token exchange failed:", res.status, await res.text())
    return null
  }

  const data = (await res.json()) as { access_token: string; expires_in: number }
  cachedToken = {
    token: data.access_token,
    expiresAt: now + data.expires_in,
    scope,
  }
  return data.access_token
}

export const GOOGLE_SCOPES = {
  WEBMASTERS: "https://www.googleapis.com/auth/webmasters.readonly",
  ANALYTICS: "https://www.googleapis.com/auth/analytics.readonly",
} as const
