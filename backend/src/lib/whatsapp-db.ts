/**
 * WhatsApp Bot — Database layer
 * Tables: wa_conversations, wa_messages, wa_bot_config, wa_bot_msg_ids
 * Uses the existing Medusa PostgreSQL pool.
 */

import { Pool } from "pg"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

// ─── Types ──────────────────────────────────────────────────────────────────

export interface OrderData {
  items: Array<{
    variant_id: string
    product_title: string
    variant_title?: string
    quantity: number
    unit_price: number
    handle: string
  }>
  customer_name?: string
  customer_email?: string
  customer_phone?: string
  address_1?: string
  city?: string
  province?: string
  postal_code?: string
  country_code?: string
  delivery_zone?: "valencia" | "nacional" | "unknown"
  lat?: number
  lng?: number
  maps_url?: string
  cart_id?: string
  region_id?: string
  shipping_option_id?: string
  payment_collection_id?: string
  payment_proof_url?: string
  payment_proof_received?: boolean
  recovery_sent_at?: string
  last_search_results?: Array<{ variant_id: string; title: string; price: number; handle: string; thumbnail: string }>
  order_id?: string
  order_display_id?: number
  subtotal_eur?: number
  discount_pct?: number
  total_eur?: number
  total_bs?: number
  bcv_rate?: number
  combo_tier?: string
  step_completed: {
    cart_created: boolean
    items_added: boolean
    address_set: boolean
    shipping_set: boolean
    payment_created: boolean
    order_completed: boolean
  }
  started_at: string
  updated_at: string
}

// ─── Bootstrap tables (idempotent) ──────────────────────────────────────────

export async function ensureTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS wa_conversations (
      id            SERIAL PRIMARY KEY,
      phone         VARCHAR(50) UNIQUE NOT NULL,
      session_status VARCHAR(20) DEFAULT 'bot_active',   -- bot_active | human_active
      customer_name VARCHAR(255),
      last_message_at TIMESTAMPTZ DEFAULT NOW(),
      created_at    TIMESTAMPTZ DEFAULT NOW(),
      updated_at    TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS wa_messages (
      id          SERIAL PRIMARY KEY,
      phone       VARCHAR(50) NOT NULL,
      role        VARCHAR(20) NOT NULL,   -- user | assistant | human
      content     TEXT NOT NULL,
      message_id  VARCHAR(100),
      created_at  TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS wa_bot_msg_ids (
      msg_id VARCHAR(100) PRIMARY KEY,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS wa_bot_config (
      key   VARCHAR(100) PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_wa_conv_phone ON wa_conversations(phone);
    CREATE INDEX IF NOT EXISTS idx_wa_msg_phone  ON wa_messages(phone);
    CREATE INDEX IF NOT EXISTS idx_wa_msg_created ON wa_messages(created_at);

    -- Add columns if missing
    ALTER TABLE wa_conversations ADD COLUMN IF NOT EXISTS order_data JSONB DEFAULT NULL;
    ALTER TABLE wa_conversations ADD COLUMN IF NOT EXISTS customer_email VARCHAR(255);
    ALTER TABLE wa_conversations ADD COLUMN IF NOT EXISTS channel VARCHAR(20) DEFAULT 'whatsapp';
    ALTER TABLE wa_conversations ADD COLUMN IF NOT EXISTS welcomed_at TIMESTAMPTZ;

    -- wa_messages.metadata — JSONB para guardar análisis de imagen,
    -- transcripción de audio, etc. Permite que el panel /dana
    -- muestre chips informativos junto al mensaje sin tener que
    -- re-analizar la imagen. Null = mensaje de texto plano.
    ALTER TABLE wa_messages ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT NULL;

    -- Phone uniqueness must now be per-channel (same IG user could coincidentally match a WA phone)
    DO $$ BEGIN
      ALTER TABLE wa_conversations DROP CONSTRAINT IF EXISTS wa_conversations_phone_key;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_wa_conv_channel_phone ON wa_conversations(channel, phone);
    EXCEPTION WHEN OTHERS THEN NULL; END $$;

    CREATE TABLE IF NOT EXISTS ig_comment_dms (
      id          SERIAL PRIMARY KEY,
      comment_id  VARCHAR(100) UNIQUE NOT NULL,
      ig_user_id  VARCHAR(100) NOT NULL,
      username    VARCHAR(100),
      post_id     VARCHAR(100),
      trigger_word VARCHAR(100),
      dm_sent_at  TIMESTAMPTZ DEFAULT NOW()
    );

    -- Funnel events (Batch 2 — F5.1). Discrete events per funnel step,
    -- one row per (phone, event) occurrence. Used for conversion / drop-off analytics.
    CREATE TABLE IF NOT EXISTS wa_funnel_events (
      id          SERIAL PRIMARY KEY,
      phone       VARCHAR(50) NOT NULL,
      channel     VARCHAR(20) DEFAULT 'whatsapp',
      event       VARCHAR(50) NOT NULL,
      occurred_at TIMESTAMPTZ DEFAULT NOW(),
      metadata    JSONB
    );
    CREATE INDEX IF NOT EXISTS idx_funnel_phone_event ON wa_funnel_events(phone, event);
    CREATE INDEX IF NOT EXISTS idx_funnel_event_occurred ON wa_funnel_events(event, occurred_at);
    CREATE INDEX IF NOT EXISTS idx_funnel_occurred_at ON wa_funnel_events(occurred_at);

    -- Batch 4 — F1.3: classification of products as consumibles + estimated restock cycle.
    -- Populated manually after migration (see scripts/seed-consumption-estimate.sql).
    CREATE TABLE IF NOT EXISTS product_consumption_estimate (
      product_id        TEXT PRIMARY KEY,
      category          VARCHAR(100),
      days_to_restock   INTEGER,
      is_consumable     BOOLEAN DEFAULT false,
      updated_at        TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_pce_consumable ON product_consumption_estimate(is_consumable) WHERE is_consumable = true;

    -- Batch 4 — F1.2: log of post-purchase followup sends (idempotency)
    CREATE TABLE IF NOT EXISTS wa_followup_log (
      id           SERIAL PRIMARY KEY,
      order_id     TEXT NOT NULL,
      customer_id  TEXT,
      phone        VARCHAR(50),
      sent_at      TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_followup_order ON wa_followup_log(order_id);

    -- Batch 4 — F1.3: log of restock reminders sent per (customer, product)
    CREATE TABLE IF NOT EXISTS wa_restock_reminders (
      id           SERIAL PRIMARY KEY,
      customer_id  TEXT NOT NULL,
      product_id   TEXT NOT NULL,
      phone        VARCHAR(50),
      sent_at      TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_restock_customer_product ON wa_restock_reminders(customer_id, product_id, sent_at DESC);

    -- Batch 6 — F5.2: empirical cross-sell map computed from historical orders.
    -- Recomputed monthly by the cross-sell-rebuild job. While there's not enough data,
    -- searchProducts falls back to the static CROSS_SELL constant in whatsapp-bot.ts.
    CREATE TABLE IF NOT EXISTS product_affinity (
      product_a       TEXT NOT NULL,
      product_b       TEXT NOT NULL,
      co_occurrence   INTEGER NOT NULL,
      total_a         INTEGER NOT NULL,
      affinity_pct    NUMERIC(5,2) NOT NULL,
      computed_at     TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (product_a, product_b)
    );
    CREATE INDEX IF NOT EXISTS idx_affinity_a ON product_affinity(product_a, affinity_pct DESC);

    -- Default config (WhatsApp + Instagram + Meta)
    INSERT INTO wa_bot_config (key, value) VALUES
      ('enabled',        'true'),
      ('bot_name',       'Enrola Bot'),
      ('human_timeout',  '30'),
      ('bot_timeout',    '120'),
      ('owner_phone',    ''),
      ('wasender_key',   ''),
      ('deepseek_key',   ''),
      ('telegram_bot_token', ''),
      ('telegram_chat_id',   ''),
      ('telegram_messages_chat_id', ''),
      ('groq_key',       ''),
      ('pago_movil_banco',    ''),
      ('pago_movil_cedula',   ''),
      ('pago_movil_telefono', ''),
      ('google_maps_key',     ''),
      ('delivery_whatsapp_group', ''),
      ('maintenance_mode', 'false'),
      ('meta_page_token',     ''),
      ('meta_app_secret',     ''),
      ('meta_verify_token',   ''),
      ('ig_business_id',      ''),
      ('ig_enabled',          'false'),
      ('ig_comment_trigger',  'REGALO'),
      ('ig_welcome_message',  'Gracias por seguirnos 🫡\nTenemos un regalo: 1 Rolling Paper Alien Puff (sabor que elijas) GRATIS con el código ⬇️\n🟧 enrolawelcome\nCómo canjearlo:\n1. Entra a enrola.shop y regístrate\n2. Añade al carrito el Alien Puff del sabor que quieras\n3. Aplica ENROLAWELCOME en el checkout\nSolo 1 por cuenta. Pago Móvil · envío a toda VE.\nEl arte de armar 🤝')
    ON CONFLICT (key) DO NOTHING;
  `)
}

// ─── Config ─────────────────────────────────────────────────────────────────

export async function getConfig(key: string): Promise<string | null> {
  const r = await pool.query("SELECT value FROM wa_bot_config WHERE key = $1", [key])
  return r.rows[0]?.value ?? null
}

/**
 * Resolves the Telegram chat ID for Dana-related alerts (handoff requests,
 * handoff returns, health-check failures). Falls back to the orders chat
 * (`telegram_chat_id`) if the dedicated messages chat isn't configured yet.
 */
export async function getDanaTelegramChatId(): Promise<string | null> {
  const messages = await getConfig("telegram_messages_chat_id")
  if (messages && messages.trim().length > 0) return messages
  return await getConfig("telegram_chat_id")
}

export async function setConfig(key: string, value: string) {
  await pool.query(
    "INSERT INTO wa_bot_config (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2",
    [key, value]
  )
}

export async function getAllConfig(): Promise<Record<string, string>> {
  const r = await pool.query("SELECT key, value FROM wa_bot_config")
  const cfg: Record<string, string> = {}
  for (const row of r.rows) cfg[row.key] = row.value
  return cfg
}

// ─── JID mapping (phone → WaSenderAPI JID for reliable delivery) ─────────

export async function saveJid(phone: string, jid: string): Promise<void> {
  await pool.query(
    `INSERT INTO wa_bot_config (key, value) VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = $2`,
    [`jid_${phone}`, jid]
  )
}

export async function getJid(phone: string): Promise<string | null> {
  const r = await pool.query(
    "SELECT value FROM wa_bot_config WHERE key = $1",
    [`jid_${phone}`]
  )
  return r.rows[0]?.value ?? null
}

// ─── Conversations ──────────────────────────────────────────────────────────

export async function getOrCreateConversation(phone: string, channel: string = "whatsapp") {
  const r = await pool.query(
    `INSERT INTO wa_conversations (phone, channel) VALUES ($1, $2)
     ON CONFLICT (channel, phone) DO UPDATE SET last_message_at = NOW(), updated_at = NOW()
     RETURNING *`,
    [phone, channel]
  )
  return r.rows[0]
}

export async function getConversation(phone: string) {
  const r = await pool.query("SELECT * FROM wa_conversations WHERE phone = $1", [phone])
  return r.rows[0] ?? null
}

export async function getMessageCount(phone: string): Promise<number> {
  const r = await pool.query("SELECT COUNT(*)::int AS cnt FROM wa_messages WHERE phone = $1", [phone])
  return r.rows[0]?.cnt || 0
}

export async function setSessionStatus(phone: string, status: "bot_active" | "human_active") {
  await pool.query(
    "UPDATE wa_conversations SET session_status = $2, updated_at = NOW() WHERE phone = $1",
    [phone, status]
  )
}

export async function setCustomerName(phone: string, name: string) {
  await pool.query(
    "UPDATE wa_conversations SET customer_name = $1, updated_at = NOW() WHERE phone = $2",
    [name, phone]
  )
}

export async function getRecentConversations(limit = 30) {
  const r = await pool.query(
    `SELECT c.*,
       (SELECT content FROM wa_messages WHERE phone = c.phone ORDER BY created_at DESC LIMIT 1) as last_message,
       (SELECT COUNT(*) FROM wa_messages WHERE phone = c.phone) as message_count
     FROM wa_conversations c
     ORDER BY c.last_message_at DESC LIMIT $1`,
    [limit]
  )
  return r.rows
}

// ─── Messages ───────────────────────────────────────────────────────────────

export async function saveMessage(
  phone: string,
  role: string,
  content: string,
  messageId?: string,
  metadata?: Record<string, unknown> | null
) {
  await pool.query(
    "INSERT INTO wa_messages (phone, role, content, message_id, metadata) VALUES ($1, $2, $3, $4, $5)",
    [phone, role, content, messageId || null, metadata ? JSON.stringify(metadata) : null]
  )
  // Update conversation timestamp
  await pool.query(
    "UPDATE wa_conversations SET last_message_at = NOW() WHERE phone = $1",
    [phone]
  )
}

export async function isBotEcho(messageId: string): Promise<boolean> {
  // Check in wa_messages (by message_id or assistant role)
  const r = await pool.query(
    "SELECT 1 FROM wa_messages WHERE message_id = $1 AND role = 'assistant' LIMIT 1",
    [messageId]
  )
  if (r.rows.length > 0) return true
  // Check in bot_msg_ids tracking table
  const r2 = await pool.query(
    "SELECT 1 FROM wa_bot_msg_ids WHERE msg_id = $1 LIMIT 1",
    [messageId]
  )
  return r2.rows.length > 0
}

/** Track WaSenderAPI msgId so we recognize it as bot echo */
export async function saveBotMsgId(msgId: string): Promise<void> {
  await pool.query(
    "INSERT INTO wa_bot_msg_ids (msg_id) VALUES ($1) ON CONFLICT DO NOTHING",
    [msgId]
  )
}

/** Check if a text matches a recent bot message to this phone (within 60s) */
export async function isRecentBotMessage(phone: string, text: string): Promise<boolean> {
  const r = await pool.query(
    `SELECT 1 FROM wa_messages WHERE phone = $1 AND role = 'assistant'
     AND content = $2 AND created_at > NOW() - INTERVAL '60 seconds' LIMIT 1`,
    [phone, text]
  )
  return r.rows.length > 0
}

export async function getConversationHistory(phone: string, limit = 20) {
  const r = await pool.query(
    "SELECT role, content, created_at FROM wa_messages WHERE phone = $1 ORDER BY created_at DESC LIMIT $2",
    [phone, limit]
  )
  return r.rows.reverse() // oldest first
}

// ─── Admin panel queries ────────────────────────────────────────────────────
//
// Used by /admin/dana/* routes that power the operator panel. These are
// kept separate from the bot's own helpers (getRecentConversations,
// getConversationHistory) because the panel needs richer payloads:
// pagination, status filtering, search, last-message preview. The bot
// only ever needs a fixed-N tail of the latest messages.

/**
 * Paginated, filterable list of conversations for the panel left rail.
 * Returns the conversation row + a small derived payload:
 *   - last_message: text of the most recent message (any role)
 *   - last_message_role: who sent it (user | assistant | human)
 *   - message_count: total messages in the thread
 *
 * Filters:
 *   - status: "bot_active" | "human_active" | "all"
 *   - q: substring match against phone OR customer_name (case-insensitive)
 */
export async function listConversationsForPanel(args: {
  limit?: number
  offset?: number
  status?: "bot_active" | "human_active" | "all"
  q?: string
}) {
  const limit = Math.min(Math.max(1, args.limit ?? 50), 200)
  const offset = Math.max(0, args.offset ?? 0)
  const status = args.status ?? "all"
  const q = (args.q ?? "").trim()

  const where: string[] = []
  const params: unknown[] = []
  if (status !== "all") {
    params.push(status)
    where.push(`c.session_status = $${params.length}`)
  }
  if (q) {
    params.push(`%${q}%`)
    where.push(`(c.phone ILIKE $${params.length} OR c.customer_name ILIKE $${params.length})`)
  }
  const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : ""

  params.push(limit)
  const limitIdx = params.length
  params.push(offset)
  const offsetIdx = params.length

  const rowsQ = await pool.query(
    `SELECT c.*,
            (SELECT m.content FROM wa_messages m WHERE m.phone = c.phone ORDER BY m.created_at DESC LIMIT 1) AS last_message,
            (SELECT m.role FROM wa_messages m WHERE m.phone = c.phone ORDER BY m.created_at DESC LIMIT 1) AS last_message_role,
            (SELECT COUNT(*)::int FROM wa_messages m WHERE m.phone = c.phone) AS message_count
     FROM wa_conversations c
     ${whereClause}
     ORDER BY c.last_message_at DESC NULLS LAST
     LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    params
  )
  const countQ = await pool.query(
    `SELECT COUNT(*)::int AS total FROM wa_conversations c ${whereClause}`,
    params.slice(0, params.length - 2)
  )
  return {
    conversations: rowsQ.rows,
    total: countQ.rows[0]?.total ?? 0,
    limit,
    offset,
  }
}

/**
 * Full message thread for one phone, newest-last (chat order). Used by
 * /admin/dana/conversations/:phone. Limit defaults to 200 — enough for
 * any practical conversation; older history can be requested with
 * `before_id` if we ever need infinite scroll.
 */
export async function listMessagesForPanel(phone: string, args: { limit?: number; before_id?: number } = {}) {
  const limit = Math.min(Math.max(1, args.limit ?? 200), 500)
  const params: unknown[] = [phone]
  let beforeClause = ""
  if (args.before_id) {
    params.push(args.before_id)
    beforeClause = `AND id < $${params.length}`
  }
  params.push(limit)
  const limitIdx = params.length
  const r = await pool.query(
    `SELECT id, role, content, message_id, created_at, metadata
     FROM wa_messages
     WHERE phone = $1 ${beforeClause}
     ORDER BY created_at DESC
     LIMIT $${limitIdx}`,
    params
  )
  return r.rows.reverse()
}

/** Count of conversations currently in human_active mode. Used for the
 *  panel sidebar badge so operators see at a glance how many threads
 *  they've taken control of. */
export async function getHumanActiveCount(): Promise<number> {
  const r = await pool.query(
    `SELECT COUNT(*)::int AS n FROM wa_conversations WHERE session_status = 'human_active'`
  )
  return r.rows[0]?.n ?? 0
}

// ─── Session cleanup ────────────────────────────────────────────────────────

export async function closeInactiveSessions(humanMinutes: number, botMinutes: number) {
  const humanResult = await pool.query(
    `UPDATE wa_conversations SET session_status = 'bot_active', updated_at = NOW()
     WHERE session_status = 'human_active'
       AND last_message_at < NOW() - INTERVAL '1 minute' * $1
     RETURNING phone`,
    [humanMinutes]
  )
  const botResult = await pool.query(
    `UPDATE wa_conversations SET updated_at = NOW()
     WHERE session_status = 'bot_active'
       AND last_message_at < NOW() - INTERVAL '1 minute' * $1
     RETURNING phone`,
    [botMinutes]
  )
  return { humanClosed: humanResult.rowCount ?? 0, botReset: botResult.rowCount ?? 0 }
}

// ─── Order Data ─────────────────────────────────────────────────────────────

export async function getOrderData(phone: string): Promise<OrderData | null> {
  const r = await pool.query(
    "SELECT order_data FROM wa_conversations WHERE phone = $1",
    [phone]
  )
  return r.rows[0]?.order_data ?? null
}

export async function setOrderData(phone: string, data: OrderData): Promise<void> {
  data.updated_at = new Date().toISOString()
  await pool.query(
    "UPDATE wa_conversations SET order_data = $2, updated_at = NOW() WHERE phone = $1",
    [phone, JSON.stringify(data)]
  )
}

export async function clearOrderData(phone: string): Promise<void> {
  await pool.query(
    "UPDATE wa_conversations SET order_data = NULL, updated_at = NOW() WHERE phone = $1",
    [phone]
  )
}

/** Remove a single key from order_data JSONB (used to clear recovery_sent_at after response). */
export async function clearOrderDataKey(phone: string, key: string): Promise<void> {
  await pool.query(
    `UPDATE wa_conversations SET order_data = order_data - $2, updated_at = NOW() WHERE phone = $1`,
    [phone, key]
  )
}

/** Set a single key in order_data JSONB (creates order_data if NULL). */
export async function setOrderDataKey(phone: string, key: string, value: unknown): Promise<void> {
  await pool.query(
    `UPDATE wa_conversations
     SET order_data = COALESCE(order_data, '{}'::jsonb) || jsonb_build_object($2::text, $3::jsonb),
         updated_at = NOW()
     WHERE phone = $1`,
    [phone, key, JSON.stringify(value)]
  )
}

export function newOrderData(): OrderData {
  return {
    items: [],
    step_completed: {
      cart_created: false,
      items_added: false,
      address_set: false,
      shipping_set: false,
      payment_created: false,
      order_completed: false,
    },
    started_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
}

// ─── Funnel events (Batch 2 — F5.1) ────────────────────────────────────────

export type FunnelEvent =
  | "greeting_sent"
  | "search_executed"
  | "cart_first_item_added"
  | "cart_subsequent_item_added"
  | "combo_threshold_reached"
  | "customer_info_provided"
  | "address_provided"
  | "payment_screen_shown"
  | "proof_received"
  | "order_submitted"
  | "order_completed"
  | "cart_abandoned"
  | "recovery_sent"
  | "recovery_responded"
  | "objection_detected"
  | "delivery_zone_set"
  | "redirected_to_web"
  | "followup_sent"
  | "restock_reminder_sent"
  | "objection_recovered"
  | "human_handoff_requested"
  | "antispam_throttled"
  | "health_check_failed"

/**
 * Batch 7 / B7.2 — Anti-spam throttling check.
 *
 * Returns true if the phone has exceeded MAX_PROACTIVE_PER_WEEK (default 2)
 * proactive messages from Dana in the last 7 days. Use this in jobs (recovery,
 * followup, restock, referral intro) BEFORE sending to avoid annoying customers.
 *
 * Proactive events tracked: recovery_sent, followup_sent, restock_reminder_sent.
 */
const MAX_PROACTIVE_PER_WEEK = 2

export async function isProactiveThrottled(phone: string): Promise<boolean> {
  try {
    const r = await pool.query(
      `SELECT COUNT(*)::int AS cnt FROM wa_funnel_events
       WHERE phone = $1
         AND event IN ('recovery_sent', 'followup_sent', 'restock_reminder_sent')
         AND occurred_at > NOW() - INTERVAL '7 days'`,
      [phone]
    )
    return (r.rows[0]?.cnt || 0) >= MAX_PROACTIVE_PER_WEEK
  } catch (err) {
    console.error("[antispam] check failed:", (err as Error).message)
    return false // fail-open — better to send than to block silently
  }
}

/**
 * Log a discrete funnel event. Fire-and-forget — errors are swallowed so
 * instrumentation never breaks the main conversation flow.
 *
 * Mirrors the event to PostHog via captureServerSide using `wa:${phone}` as
 * distinct_id, so the WhatsApp/Dana funnel shows up in PostHog alongside
 * web events. Disabled silently if POSTHOG_PROJECT_API_KEY is not set.
 */
export async function logFunnelEvent(
  phone: string,
  event: FunnelEvent,
  metadata: Record<string, unknown> = {},
  channel: string = "whatsapp"
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO wa_funnel_events (phone, channel, event, metadata)
       VALUES ($1, $2, $3, $4)`,
      [phone, channel, event, JSON.stringify(metadata)]
    )
  } catch (err) {
    console.error("[funnel] log failed:", (err as Error).message)
  }

  // Mirror to PostHog — fire-and-forget, never blocks the bot
  try {
    const { captureServerSide, isPosthogConfigured } = await import("./posthog-server.js")
    if (!isPosthogConfigured()) return
    void captureServerSide({
      distinctId: `wa:${phone}`,
      event: `wa_${event}`,
      properties: {
        ...metadata,
        channel,
        phone, // useful for cohorts / cross-ref
        $set: { wa_phone: phone, primary_channel: "whatsapp" },
      },
    }).catch(() => { /* never block */ })
  } catch {
    // dynamic import or capture failed — never block
  }
}

// ─── Stats ──────────────────────────────────────────────────────────────────

export async function getBotStats() {
  const [conversations, messages, active, todayMessages] = await Promise.all([
    pool.query("SELECT COUNT(*) as count FROM wa_conversations"),
    pool.query("SELECT COUNT(*) as count FROM wa_messages"),
    pool.query("SELECT COUNT(*) as count FROM wa_conversations WHERE session_status = 'bot_active' AND last_message_at > NOW() - INTERVAL '24 hours'"),
    pool.query("SELECT COUNT(*) as count FROM wa_messages WHERE created_at > NOW() - INTERVAL '24 hours'"),
  ])
  return {
    total_conversations: parseInt(conversations.rows[0].count),
    total_messages: parseInt(messages.rows[0].count),
    active_24h: parseInt(active.rows[0].count),
    messages_24h: parseInt(todayMessages.rows[0].count),
  }
}
