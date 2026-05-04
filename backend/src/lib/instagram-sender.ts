/**
 * Instagram Messaging sender — Meta Graph API v21.0
 *
 * Uses the Instagram Business Account's Page Access Token.
 * Endpoint: POST https://graph.facebook.com/v21.0/{ig-business-id}/messages
 * Recipient is the page-scoped user ID (PSID) received via webhook.
 *
 * Constraints enforced by Meta:
 *  - Can only DM users who messaged you first (24h window after their last message)
 *  - Private replies to comments are allowed once per comment
 */

import { getConfig } from "./whatsapp-db"

const GRAPH_VERSION = "v21.0"

async function metaFetch(path: string, body: Record<string, unknown>): Promise<Record<string, unknown> | null> {
  const token = await getConfig("meta_page_token")
  const igId = await getConfig("ig_business_id")
  if (!token || !igId) {
    console.warn("[instagram] Missing meta_page_token or ig_business_id — skipping send")
    return null
  }
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${igId}/${path}?access_token=${encodeURIComponent(token)}`
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    const raw = await res.text()
    if (!res.ok) {
      console.error("[instagram] Graph API error:", res.status, raw.substring(0, 400))
      return null
    }
    try { return JSON.parse(raw) } catch { return {} }
  } catch (err) {
    console.error("[instagram] Send failed:", err)
    return null
  }
}

/** Send a DM to an IG user who has messaged you within the 24h window. */
export async function sendInstagramDM(recipientId: string, text: string): Promise<string | false> {
  const result = await metaFetch("messages", {
    recipient: { id: recipientId },
    message: { text },
  })
  if (!result) return false
  const msgId = String(result.message_id || "")
  console.log(`[instagram] ✅ DM sent to ${recipientId} msgId: ${msgId}`)
  return msgId || "sent"
}

/**
 * Private reply to a comment on a feed post or reel.
 * This is Meta's supported flow for comment-to-DM automation and works even if
 * the commenter has never messaged the brand before.
 */
export async function sendInstagramPrivateReply(commentId: string, text: string): Promise<string | false> {
  const result = await metaFetch("messages", {
    recipient: { comment_id: commentId },
    message: { text },
  })
  if (!result) return false
  const msgId = String(result.message_id || "")
  console.log(`[instagram] ✅ Private reply to comment ${commentId}: ${msgId}`)
  return msgId || "sent"
}

/** Optional: also publish a public reply under the comment ("Revisa tu DM 💌") */
export async function replyToComment(commentId: string, text: string): Promise<boolean> {
  const token = await getConfig("meta_page_token")
  if (!token) return false
  try {
    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${commentId}/replies?access_token=${encodeURIComponent(token)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      }
    )
    if (!res.ok) {
      console.error("[instagram] Comment reply error:", res.status, await res.text().catch(() => ""))
      return false
    }
    return true
  } catch (err) {
    console.error("[instagram] Comment reply failed:", err)
    return false
  }
}
