/**
 * Instagram Webhook — receives DMs and comments from Meta Graph API
 *
 * GET  /webhooks/instagram  → verify challenge (one-time Meta setup)
 * POST /webhooks/instagram  → payload with entry[].messaging[] (DMs)
 *                                           or entry[].changes[] (comments)
 *
 * Signature verification: X-Hub-Signature-256 header vs. HMAC-SHA256(body, app_secret)
 *
 * Flows:
 *   - First DM from user → send welcome (ENROLAWELCOME copy) → set welcomed_at → enter Dana flow
 *   - Comment matching trigger word → private-reply DM with welcome copy (bypasses 24h rule)
 */

import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import crypto from "crypto"
import { Pool } from "pg"
import {
  ensureTables,
  getConfig,
  getOrCreateConversation,
  setSessionStatus,
  saveMessage,
  saveBotMsgId,
  getMessageCount,
} from "../../../lib/whatsapp-db"
import { chat, buildGreeting } from "../../../lib/whatsapp-bot"
import { sendInstagramDM, sendInstagramPrivateReply } from "../../../lib/instagram-sender"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
let tablesReady = false

// ─── Signature verification ─────────────────────────────────────────────────

async function verifySignature(rawBody: string, header: string | undefined): Promise<boolean> {
  const secret = await getConfig("meta_app_secret")
  if (!secret) {
    console.warn("[ig-webhook] No meta_app_secret — skipping signature check (INSECURE)")
    return true
  }
  if (!header || !header.startsWith("sha256=")) return false
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex")
  const received = header.slice("sha256=".length)
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(received, "hex"))
  } catch {
    return false
  }
}

// ─── Per-user lock (avoid concurrent welcome duplicates) ────────────────────

const userLocks = new Map<string, Promise<void>>()
async function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = userLocks.get(key)
  let resolve!: () => void
  const newLock = new Promise<void>((r) => { resolve = r })
  userLocks.set(key, newLock)
  if (existing) await existing.catch(() => {})
  try {
    return await fn()
  } finally {
    resolve()
    if (userLocks.get(key) === newLock) userLocks.delete(key)
  }
}

// ─── DB helpers ─────────────────────────────────────────────────────────────

async function getIgConversation(igUserId: string) {
  await pool.query(
    `INSERT INTO wa_conversations (phone, channel, session_status)
     VALUES ($1, 'instagram', 'bot_active')
     ON CONFLICT (channel, phone) DO UPDATE SET last_message_at = NOW(), updated_at = NOW()
     RETURNING *`,
    [igUserId]
  )
  const r = await pool.query(
    `SELECT * FROM wa_conversations WHERE channel = 'instagram' AND phone = $1`,
    [igUserId]
  )
  return r.rows[0]
}

async function markWelcomed(igUserId: string): Promise<void> {
  await pool.query(
    `UPDATE wa_conversations SET welcomed_at = NOW()
     WHERE channel = 'instagram' AND phone = $1 AND welcomed_at IS NULL`,
    [igUserId]
  )
}

async function hasCommentBeenHandled(commentId: string): Promise<boolean> {
  const r = await pool.query("SELECT 1 FROM ig_comment_dms WHERE comment_id = $1", [commentId])
  return r.rows.length > 0
}

async function recordCommentDm(
  commentId: string,
  igUserId: string,
  username: string | null,
  postId: string | null,
  trigger: string
): Promise<void> {
  await pool.query(
    `INSERT INTO ig_comment_dms (comment_id, ig_user_id, username, post_id, trigger_word)
     VALUES ($1, $2, $3, $4, $5) ON CONFLICT (comment_id) DO NOTHING`,
    [commentId, igUserId, username, postId, trigger]
  )
}

// ─── GET: Meta verification challenge ───────────────────────────────────────

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const mode = req.query["hub.mode"]
  const token = req.query["hub.verify_token"]
  const challenge = req.query["hub.challenge"]

  const expectedToken = await getConfig("meta_verify_token")
  if (mode === "subscribe" && token === expectedToken && expectedToken) {
    console.log("[ig-webhook] ✅ Verification challenge passed")
    return res.status(200).send(String(challenge || ""))
  }
  console.warn("[ig-webhook] ❌ Verification failed — mode/token mismatch")
  return res.status(403).send("forbidden")
}

// ─── POST: incoming events ──────────────────────────────────────────────────

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  if (!tablesReady) {
    try { await ensureTables(); tablesReady = true }
    catch (err) { console.error("[ig-webhook] Table setup failed:", err) }
  }

  // Signature check — rawBody set by middleware (see middlewares.ts)
  const rawBody = (req as unknown as { rawBody?: string }).rawBody
    || JSON.stringify(req.body || {})
  const sigHeader = req.headers["x-hub-signature-256"] as string | undefined
  if (!(await verifySignature(rawBody, sigHeader))) {
    console.error("[ig-webhook] Signature verification failed")
    return res.status(401).json({ ok: false, error: "invalid signature" })
  }

  try {
    const body = req.body as Record<string, unknown>
    const enabled = await getConfig("ig_enabled")
    if (enabled !== "true") {
      return res.status(200).json({ ok: true, skipped: "ig disabled" })
    }

    const entries = (body.entry || []) as Array<Record<string, unknown>>

    for (const entry of entries) {
      // ── DMs (messaging array) ────────────────────────────────────────────
      const messaging = (entry.messaging || []) as Array<Record<string, unknown>>
      for (const event of messaging) {
        await handleMessagingEvent(event).catch((err) =>
          console.error("[ig-webhook] Messaging handler error:", err)
        )
      }

      // ── Comments / mentions (changes array) ──────────────────────────────
      const changes = (entry.changes || []) as Array<Record<string, unknown>>
      for (const change of changes) {
        if (change.field === "comments") {
          await handleCommentEvent(change.value as Record<string, unknown>).catch((err) =>
            console.error("[ig-webhook] Comment handler error:", err)
          )
        }
      }
    }

    return res.status(200).json({ ok: true })
  } catch (err) {
    console.error("[ig-webhook] Error:", err)
    return res.status(200).json({ ok: false, error: "internal" })
  }
}

// ─── Handlers ───────────────────────────────────────────────────────────────

async function handleMessagingEvent(event: Record<string, unknown>): Promise<void> {
  const sender = (event.sender || {}) as Record<string, unknown>
  const recipient = (event.recipient || {}) as Record<string, unknown>
  const message = (event.message || {}) as Record<string, unknown>

  const senderId = String(sender.id || "")
  const recipientId = String(recipient.id || "")
  if (!senderId || !recipientId) return

  const ourId = await getConfig("ig_business_id")
  if (senderId === ourId) {
    // It's our own outgoing echo — ignore
    return
  }

  // Ignore echoes and reactions
  if (message.is_echo || message.reaction) return

  const text = String(message.text || "").trim()
  const mid = String(message.mid || "")
  if (!text) return // attachments-only for now: punt

  console.log(`[ig-webhook] IN ${senderId}: ${text.substring(0, 100)}`)

  await withLock(`ig:${senderId}`, async () => {
    const convo = await getIgConversation(senderId)
    await saveMessage(senderId, "user", text, mid)

    if (convo.session_status === "human_active") {
      console.log(`[ig-webhook] Human active for ${senderId} — bot silent`)
      return
    }

    // First-ever DM from this user → send welcome copy, mark welcomed
    const alreadyWelcomed = !!convo.welcomed_at
    const msgCount = await getMessageCount(senderId)
    if (!alreadyWelcomed && msgCount <= 1) {
      const welcome = (await getConfig("ig_welcome_message")) || ""
      if (welcome) {
        const sent = await sendInstagramDM(senderId, welcome)
        if (sent && sent !== "sent") await saveBotMsgId(sent)
        await saveMessage(senderId, "assistant", welcome, sent || undefined)
        await markWelcomed(senderId)
      }
      // Follow up with Dana's catalog greeting so the user can continue
      const greeting = buildGreeting()
      const sent2 = await sendInstagramDM(senderId, greeting)
      if (sent2 && sent2 !== "sent") await saveBotMsgId(sent2)
      await saveMessage(senderId, "assistant", greeting, sent2 || undefined)
      return
    }

    // Regular Dana flow (LLM)
    const reply = await chat(senderId, text)
    const sent = await sendInstagramDM(senderId, reply)
    if (sent && sent !== "sent") await saveBotMsgId(sent)
    await saveMessage(senderId, "assistant", reply, sent || undefined)
  })
}

async function handleCommentEvent(value: Record<string, unknown>): Promise<void> {
  const commentId = String(value.id || "")
  const fromObj = (value.from || {}) as Record<string, unknown>
  const igUserId = String(fromObj.id || "")
  const username = fromObj.username ? String(fromObj.username) : null
  const text = String(value.text || "").trim()
  const mediaObj = (value.media || {}) as Record<string, unknown>
  const postId = mediaObj.id ? String(mediaObj.id) : null

  if (!commentId || !igUserId || !text) return

  const trigger = ((await getConfig("ig_comment_trigger")) || "REGALO").toUpperCase()
  const hit = text.toUpperCase().split(/\W+/).includes(trigger)
  if (!hit) return

  // Idempotency: one DM per comment
  if (await hasCommentBeenHandled(commentId)) {
    console.log(`[ig-webhook] Comment ${commentId} already handled — skip`)
    return
  }

  // Skip if the comment is our own page
  const ourId = await getConfig("ig_business_id")
  if (igUserId === ourId) return

  console.log(`[ig-webhook] 🎯 Comment trigger from @${username || igUserId}: "${text.substring(0, 80)}"`)

  const welcome = (await getConfig("ig_welcome_message")) || ""
  if (!welcome) return

  const sent = await sendInstagramPrivateReply(commentId, welcome)
  if (!sent) {
    console.error("[ig-webhook] Private reply failed — not recording, will retry on retry webhook")
    return
  }
  await recordCommentDm(commentId, igUserId, username, postId, trigger)

  // Also create/update the conversation record so Dana can continue the flow when they reply
  await getIgConversation(igUserId)
  await saveMessage(igUserId, "assistant", welcome, typeof sent === "string" ? sent : undefined)
  await markWelcomed(igUserId)
}
