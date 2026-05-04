/**
 * Webmail client helpers — proxy hacia Medusa /admin/webmail/*
 *
 * Wrapping mínimo de medusaFetch para mantener el contrato de errores y
 * propagar el `x-webmail-token` que identifica la sesión IMAP.
 */
import { medusaFetch } from "@/lib/medusa"

export interface WebmailAccount {
  email: string
  label: string
  available: boolean
}

export interface WebmailFolder {
  path: string
  name: string
  unseen: number
  total: number
}

export interface WebmailMessageSummary {
  uid: number
  seq: number
  from: string
  to: string
  subject: string
  date: string
  seen: boolean
  flagged: boolean
  size: number
  preview: string
}

export interface WebmailMessageDetail {
  uid: number
  from: string
  to: string
  cc: string
  subject: string
  date: string
  html: string
  text: string
  seen: boolean
  attachments: { filename: string; size: number; contentType: string }[]
}

/** GET /admin/webmail/accounts — buzones que el admin actual puede usar */
export async function listAccounts(): Promise<{ admin_email: string | null; accounts: WebmailAccount[] }> {
  return medusaFetch<{ admin_email: string | null; accounts: WebmailAccount[] }>(
    "GET",
    "/webmail/accounts",
  )
}

/** POST /admin/webmail/auth — auto-login (sin password). Devuelve token de sesión IMAP. */
export async function autoLogin(email: string): Promise<{ token: string; email: string }> {
  return medusaFetch<{ token: string; email: string }>("POST", "/webmail/auth", { body: { email } })
}

export async function logout(token: string): Promise<void> {
  await medusaFetch<{ success: boolean }>("DELETE", "/webmail/auth", {
    headers: { "x-webmail-token": token },
  })
}

export async function listFolders(token: string): Promise<{ folders: WebmailFolder[] }> {
  return medusaFetch<{ folders: WebmailFolder[] }>("GET", "/webmail/folders", {
    headers: { "x-webmail-token": token },
  })
}

export async function listMessages(
  token: string,
  folder: string,
  page = 1,
  limit = 25,
): Promise<{ messages: WebmailMessageSummary[]; total: number }> {
  return medusaFetch<{ messages: WebmailMessageSummary[]; total: number }>(
    "GET",
    "/webmail/messages",
    {
      query: { folder, page, limit },
      headers: { "x-webmail-token": token },
    },
  )
}

export async function getMessage(
  token: string,
  folder: string,
  uid: number,
): Promise<{ message: WebmailMessageDetail }> {
  return medusaFetch<{ message: WebmailMessageDetail }>("GET", `/webmail/messages/${uid}`, {
    query: { folder },
    headers: { "x-webmail-token": token },
  })
}

export async function sendMessage(
  token: string,
  payload: { to: string; subject: string; html: string; cc?: string; bcc?: string; inReplyTo?: string },
): Promise<{ success: boolean }> {
  return medusaFetch<{ success: boolean }>("POST", "/webmail/messages", {
    body: payload,
    headers: { "x-webmail-token": token },
  })
}

export async function setFlags(
  token: string,
  uid: number,
  folder: string,
  flags: { seen?: boolean; flagged?: boolean },
): Promise<{ success: boolean }> {
  return medusaFetch<{ success: boolean }>("PATCH", `/webmail/messages/${uid}/flags`, {
    body: { folder, ...flags },
    headers: { "x-webmail-token": token },
  })
}

export async function deleteMessage(
  token: string,
  uid: number,
  folder: string,
): Promise<{ success: boolean }> {
  return medusaFetch<{ success: boolean }>("DELETE", `/webmail/messages/${uid}`, {
    query: { folder },
    headers: { "x-webmail-token": token },
  })
}
