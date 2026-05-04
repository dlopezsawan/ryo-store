/**
 * Remarketing Rules Engine — DB layer
 *
 * Tables:
 *   - remarketing_rule  → one row per rule (abandoned_checkout_v2, cart_abandoned_v2, …)
 *   - remarketing_fire  → one row per (rule × user) dispatch attempt (audit log)
 *
 * Design notes:
 *   - Rules are signal-based. Each rule matches a Signal.id pattern emitted by
 *     `computeSignals()`. Match is either exact (rule.match_signal_id === signal.id)
 *     or prefix-based (rule.match_signal_prefix matches signal.id start).
 *   - Each rule has its own cooldown: we skip dispatch if the same rule fired
 *     for the same user (by email or customer_id) within cooldown_hours.
 *   - Rules default to DISABLED so nothing goes out until the operator enables them.
 *   - Fires are linked back to orders for conversion attribution when possible.
 */

import { Pool } from "pg"

let pool: Pool | null = null
function getPool(): Pool {
  if (!pool) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL })
  }
  return pool
}

// ─── Types ──────────────────────────────────────────────────────────────────

export type RuleChannel = "email" | "whatsapp" | "auto" | "manual" | "team_alert"

export interface RemarketingRule {
  key: string                       // stable unique id (e.g. "abandoned_checkout_v2")
  name: string                      // human label
  description?: string | null
  enabled: boolean
  priority: number                  // higher fires first (for tie-breaking same user)
  cooldown_hours: number            // min hours between fires of this rule to the same user
  channel: RuleChannel              // "auto" = whatsapp if phone else email
  // Signal matching (one of these must be set)
  match_signal_id?: string | null           // exact match
  match_signal_prefix?: string | null       // prefix match (e.g. "multi_view_no_cart:")
  // Min signal severity accepted
  min_severity?: "high" | "medium" | "low" | "info"
  // Channel templates (optional; if null the engine uses signal.suggested_message)
  email_subject_template?: string | null
  email_html_template?: string | null
  whatsapp_template?: string | null
  // Optional quiet hours window (e.g. { start: 22, end: 8 }) — 0-23 local time
  quiet_hours_start?: number | null
  quiet_hours_end?: number | null
  // Optional daily budget cap
  daily_cap?: number | null
  // A/B test variants (future)
  variants?: unknown | null
  /**
   * Per-city template overrides. Keys are lowercased city names matching
   * `customer.city` resolved by `getCustomerCity()`.
   *
   * Example:
   *   { "caracas": { "whatsapp_template": "Caracas: ..." }, "maracaibo": {...} }
   *
   * Precedence: variant template > geo override > rule template > signal fallback.
   */
  geo_overrides?: unknown | null
  created_at?: string
  updated_at?: string
}

export type FireStatus =
  | "pending"      // matched rule, queued
  | "sent"         // dispatched successfully
  | "failed"       // dispatch error
  | "skipped_cooldown"
  | "skipped_quiet_hours"
  | "skipped_cap"
  | "skipped_no_channel"
  | "dry_run"      // engine ran in dryRun mode; not dispatched
  | "converted"    // marked after order_placed attribution

export interface RemarketingFire {
  id: string
  rule_key: string
  customer_id: string | null
  email: string | null
  phone: string | null
  distinct_id: string | null
  signal_id: string
  signal_severity: string
  channel: RuleChannel
  status: FireStatus
  subject: string | null
  body: string | null
  error_message: string | null
  fired_at: string
  converted_order_id: string | null
  converted_at: string | null
  context: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

// ─── Bootstrap (idempotent) ─────────────────────────────────────────────────

let tablesEnsured = false

export async function ensureRulesTables(): Promise<void> {
  if (tablesEnsured) return
  const db = getPool()
  await db.query(`
    CREATE TABLE IF NOT EXISTS remarketing_rule (
      key                     VARCHAR(120) PRIMARY KEY,
      name                    VARCHAR(255) NOT NULL,
      description             TEXT,
      enabled                 BOOLEAN NOT NULL DEFAULT FALSE,
      priority                INT NOT NULL DEFAULT 0,
      cooldown_hours          INT NOT NULL DEFAULT 48,
      channel                 VARCHAR(20) NOT NULL DEFAULT 'auto',
      match_signal_id         VARCHAR(120),
      match_signal_prefix     VARCHAR(120),
      min_severity            VARCHAR(20) DEFAULT 'medium',
      email_subject_template  TEXT,
      email_html_template     TEXT,
      whatsapp_template       TEXT,
      quiet_hours_start       INT,
      quiet_hours_end         INT,
      daily_cap               INT,
      variants                JSONB,
      geo_overrides           JSONB,
      created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS remarketing_fire (
      id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      rule_key            VARCHAR(120) NOT NULL,
      customer_id         VARCHAR(120),
      email               VARCHAR(255),
      phone               VARCHAR(50),
      distinct_id         VARCHAR(120),
      signal_id           VARCHAR(255) NOT NULL,
      signal_severity     VARCHAR(20) NOT NULL,
      channel             VARCHAR(20) NOT NULL,
      status              VARCHAR(40) NOT NULL DEFAULT 'pending',
      subject             TEXT,
      body                TEXT,
      error_message       TEXT,
      fired_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      converted_order_id  VARCHAR(120),
      converted_at        TIMESTAMPTZ,
      context             JSONB,
      created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_fire_rule_email_time
      ON remarketing_fire (rule_key, email, fired_at DESC);
    CREATE INDEX IF NOT EXISTS idx_fire_rule_customer_time
      ON remarketing_fire (rule_key, customer_id, fired_at DESC);
    CREATE INDEX IF NOT EXISTS idx_fire_status_time
      ON remarketing_fire (status, fired_at DESC);
    CREATE INDEX IF NOT EXISTS idx_fire_fired_at
      ON remarketing_fire (fired_at DESC);
  `)
  tablesEnsured = true
}

// ─── Rules CRUD ─────────────────────────────────────────────────────────────

export async function listRules(): Promise<RemarketingRule[]> {
  await ensureRulesTables()
  const r = await getPool().query(
    `SELECT * FROM remarketing_rule ORDER BY priority DESC, key ASC`
  )
  return r.rows as RemarketingRule[]
}

export async function getRule(key: string): Promise<RemarketingRule | null> {
  await ensureRulesTables()
  const r = await getPool().query(
    `SELECT * FROM remarketing_rule WHERE key = $1 LIMIT 1`,
    [key]
  )
  return (r.rows[0] as RemarketingRule) || null
}

export async function upsertRule(rule: RemarketingRule): Promise<void> {
  await ensureRulesTables()
  await getPool().query(
    `
    INSERT INTO remarketing_rule (
      key, name, description, enabled, priority, cooldown_hours, channel,
      match_signal_id, match_signal_prefix, min_severity,
      email_subject_template, email_html_template, whatsapp_template,
      quiet_hours_start, quiet_hours_end, daily_cap, variants, geo_overrides, updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7,
      $8, $9, $10,
      $11, $12, $13,
      $14, $15, $16, $17::jsonb, $18::jsonb, NOW()
    )
    ON CONFLICT (key) DO UPDATE SET
      name = EXCLUDED.name,
      description = EXCLUDED.description,
      enabled = EXCLUDED.enabled,
      priority = EXCLUDED.priority,
      cooldown_hours = EXCLUDED.cooldown_hours,
      channel = EXCLUDED.channel,
      match_signal_id = EXCLUDED.match_signal_id,
      match_signal_prefix = EXCLUDED.match_signal_prefix,
      min_severity = EXCLUDED.min_severity,
      email_subject_template = EXCLUDED.email_subject_template,
      email_html_template = EXCLUDED.email_html_template,
      whatsapp_template = EXCLUDED.whatsapp_template,
      quiet_hours_start = EXCLUDED.quiet_hours_start,
      quiet_hours_end = EXCLUDED.quiet_hours_end,
      daily_cap = EXCLUDED.daily_cap,
      variants = EXCLUDED.variants,
      geo_overrides = EXCLUDED.geo_overrides,
      updated_at = NOW()
    `,
    [
      rule.key,
      rule.name,
      rule.description ?? null,
      rule.enabled,
      rule.priority,
      rule.cooldown_hours,
      rule.channel,
      rule.match_signal_id ?? null,
      rule.match_signal_prefix ?? null,
      rule.min_severity ?? "medium",
      rule.email_subject_template ?? null,
      rule.email_html_template ?? null,
      rule.whatsapp_template ?? null,
      rule.quiet_hours_start ?? null,
      rule.quiet_hours_end ?? null,
      rule.daily_cap ?? null,
      rule.variants ? JSON.stringify(rule.variants) : null,
      rule.geo_overrides ? JSON.stringify(rule.geo_overrides) : null,
    ]
  )
}

export async function deleteRule(key: string): Promise<void> {
  await ensureRulesTables()
  await getPool().query(`DELETE FROM remarketing_rule WHERE key = $1`, [key])
}

export async function setRuleEnabled(key: string, enabled: boolean): Promise<void> {
  await ensureRulesTables()
  await getPool().query(
    `UPDATE remarketing_rule SET enabled = $1, updated_at = NOW() WHERE key = $2`,
    [enabled, key]
  )
}

// ─── Fires ──────────────────────────────────────────────────────────────────

export async function wasRuleFiredRecently(
  rule_key: string,
  opts: { email?: string | null; customer_id?: string | null; distinct_id?: string | null },
  withinHours: number
): Promise<boolean> {
  await ensureRulesTables()
  const params: unknown[] = [rule_key, withinHours]
  const conditions: string[] = []
  if (opts.email) {
    params.push(opts.email)
    conditions.push(`email = $${params.length}`)
  }
  if (opts.customer_id) {
    params.push(opts.customer_id)
    conditions.push(`customer_id = $${params.length}`)
  }
  if (opts.distinct_id) {
    params.push(opts.distinct_id)
    conditions.push(`distinct_id = $${params.length}`)
  }
  if (!conditions.length) return false
  const sql = `
    SELECT 1 FROM remarketing_fire
    WHERE rule_key = $1
      AND fired_at > NOW() - INTERVAL '1 hour' * $2
      AND status IN ('sent', 'pending', 'converted')
      AND (${conditions.join(" OR ")})
    LIMIT 1
  `
  const r = await getPool().query(sql, params)
  return (r.rowCount ?? 0) > 0
}

export async function countFiresToday(rule_key: string): Promise<number> {
  await ensureRulesTables()
  const r = await getPool().query(
    `SELECT COUNT(*) AS n FROM remarketing_fire
     WHERE rule_key = $1
       AND fired_at::date = NOW()::date
       AND status IN ('sent', 'pending')`,
    [rule_key]
  )
  return Number(r.rows[0]?.n || 0)
}

export async function logFire(data: {
  rule_key: string
  customer_id?: string | null
  email?: string | null
  phone?: string | null
  distinct_id?: string | null
  signal_id: string
  signal_severity: string
  channel: RuleChannel
  status: FireStatus
  subject?: string | null
  body?: string | null
  error_message?: string | null
  context?: Record<string, unknown> | null
}): Promise<string> {
  await ensureRulesTables()
  const r = await getPool().query(
    `
    INSERT INTO remarketing_fire (
      rule_key, customer_id, email, phone, distinct_id,
      signal_id, signal_severity, channel, status,
      subject, body, error_message, context
    ) VALUES (
      $1, $2, $3, $4, $5,
      $6, $7, $8, $9,
      $10, $11, $12, $13::jsonb
    )
    RETURNING id
    `,
    [
      data.rule_key,
      data.customer_id ?? null,
      data.email ?? null,
      data.phone ?? null,
      data.distinct_id ?? null,
      data.signal_id,
      data.signal_severity,
      data.channel,
      data.status,
      data.subject ?? null,
      data.body ?? null,
      data.error_message ?? null,
      data.context ? JSON.stringify(data.context) : null,
    ]
  )
  return r.rows[0].id as string
}

export async function updateFireStatus(
  id: string,
  status: FireStatus,
  errorMessage?: string
): Promise<void> {
  await ensureRulesTables()
  await getPool().query(
    `UPDATE remarketing_fire
     SET status = $1,
         error_message = COALESCE($2, error_message),
         updated_at = NOW()
     WHERE id = $3`,
    [status, errorMessage ?? null, id]
  )
}

export async function markFireConverted(
  fire_id: string,
  order_id: string
): Promise<void> {
  await ensureRulesTables()
  await getPool().query(
    `UPDATE remarketing_fire
     SET status = 'converted',
         converted_order_id = $1,
         converted_at = NOW(),
         updated_at = NOW()
     WHERE id = $2`,
    [order_id, fire_id]
  )
}

export async function listFires(opts: {
  rule_key?: string
  status?: FireStatus
  since_hours?: number
  limit?: number
} = {}): Promise<RemarketingFire[]> {
  await ensureRulesTables()
  const limit = Math.min(opts.limit || 100, 500)
  const params: unknown[] = []
  const conditions: string[] = []
  if (opts.rule_key) {
    params.push(opts.rule_key)
    conditions.push(`rule_key = $${params.length}`)
  }
  if (opts.status) {
    params.push(opts.status)
    conditions.push(`status = $${params.length}`)
  }
  if (opts.since_hours) {
    params.push(opts.since_hours)
    conditions.push(`fired_at > NOW() - INTERVAL '1 hour' * $${params.length}`)
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""
  params.push(limit)
  const r = await getPool().query(
    `SELECT * FROM remarketing_fire ${where} ORDER BY fired_at DESC LIMIT $${params.length}`,
    params
  )
  return r.rows as RemarketingFire[]
}

export interface RuleStats {
  rule_key: string
  fires_total: number
  fires_24h: number
  fires_7d: number
  fires_30d: number
  sent: number
  failed: number
  converted: number
  conversion_rate: number
  revenue_attributed: number
}

export interface VariantStats {
  rule_key: string
  variant: string  // "A" | "B" | "control" | "(none)" if rule has no variants
  fires: number
  sent: number
  converted: number
  conversion_rate: number
  revenue_attributed: number
}

export async function getVariantStats(rule_key?: string): Promise<VariantStats[]> {
  await ensureRulesTables()
  const params: unknown[] = []
  let where = "WHERE fired_at > NOW() - INTERVAL '30 days'"
  if (rule_key) {
    params.push(rule_key)
    where += ` AND rule_key = $1`
  }
  const r = await getPool().query(
    `
    SELECT
      rf.rule_key,
      COALESCE(rf.context->>'variant', '(none)') AS variant,
      COUNT(*)                                                    AS fires,
      COUNT(*) FILTER (WHERE status IN ('sent','converted'))      AS sent,
      COUNT(*) FILTER (WHERE status = 'converted')                AS converted,
      COALESCE(SUM(
        CASE WHEN status = 'converted' AND converted_order_id IS NOT NULL
             THEN (SELECT COALESCE((os.totals->>'original_order_total')::numeric, 0)
                   FROM "order" o
                   LEFT JOIN LATERAL (
                     SELECT totals FROM order_summary
                     WHERE order_id = o.id ORDER BY created_at DESC LIMIT 1
                   ) os ON true
                   WHERE o.id = rf.converted_order_id)
             ELSE 0 END
      ), 0) AS revenue_attributed
    FROM remarketing_fire rf
    ${where}
    GROUP BY rf.rule_key, COALESCE(rf.context->>'variant', '(none)')
    ORDER BY rf.rule_key, variant
    `,
    params
  )
  return r.rows.map((row) => {
    const sent = Number(row.sent || 0)
    const conv = Number(row.converted || 0)
    return {
      rule_key: row.rule_key,
      variant: row.variant,
      fires: Number(row.fires || 0),
      sent,
      converted: conv,
      conversion_rate: sent > 0 ? Number(((conv / sent) * 100).toFixed(2)) : 0,
      revenue_attributed: Number(Number(row.revenue_attributed || 0).toFixed(2)),
    }
  })
}

export async function getRuleStats(rule_key?: string): Promise<RuleStats[]> {
  await ensureRulesTables()
  const params: unknown[] = []
  let where = ""
  if (rule_key) {
    params.push(rule_key)
    where = `WHERE rule_key = $1`
  }
  const r = await getPool().query(
    `
    SELECT
      rf.rule_key,
      COUNT(*)                                          AS fires_total,
      COUNT(*) FILTER (WHERE fired_at > NOW() - INTERVAL '24 hours')  AS fires_24h,
      COUNT(*) FILTER (WHERE fired_at > NOW() - INTERVAL '7 days')    AS fires_7d,
      COUNT(*) FILTER (WHERE fired_at > NOW() - INTERVAL '30 days')   AS fires_30d,
      COUNT(*) FILTER (WHERE status = 'sent' OR status = 'converted') AS sent,
      COUNT(*) FILTER (WHERE status = 'failed')                       AS failed,
      COUNT(*) FILTER (WHERE status = 'converted')                    AS converted,
      COALESCE(SUM(
        CASE WHEN status = 'converted' AND converted_order_id IS NOT NULL
             THEN (SELECT COALESCE((os.totals->>'original_order_total')::numeric, 0)
                   FROM "order" o
                   LEFT JOIN LATERAL (
                     SELECT totals FROM order_summary
                     WHERE order_id = o.id ORDER BY created_at DESC LIMIT 1
                   ) os ON true
                   WHERE o.id = rf.converted_order_id)
             ELSE 0 END
      ), 0) AS revenue_attributed
    FROM remarketing_fire rf
    ${where}
    GROUP BY rf.rule_key
    ORDER BY fires_total DESC
    `,
    params
  )
  return r.rows.map((row) => {
    const sent = Number(row.sent || 0)
    const conv = Number(row.converted || 0)
    return {
      rule_key: row.rule_key,
      fires_total: Number(row.fires_total || 0),
      fires_24h: Number(row.fires_24h || 0),
      fires_7d: Number(row.fires_7d || 0),
      fires_30d: Number(row.fires_30d || 0),
      sent,
      failed: Number(row.failed || 0),
      converted: conv,
      conversion_rate: sent > 0 ? Number(((conv / sent) * 100).toFixed(2)) : 0,
      revenue_attributed: Number(Number(row.revenue_attributed || 0).toFixed(2)),
    }
  })
}

// ─── Seed defaults ──────────────────────────────────────────────────────────

export async function seedDefaultRulesIfMissing(): Promise<void> {
  await ensureRulesTables()
  const existing = await listRules()
  if (existing.length > 0) return
  const defaults: RemarketingRule[] = [
    {
      key: "abandoned_checkout_v2",
      name: "Checkout abandonado",
      description:
        "Usuario inició checkout en las últimas 72h sin completar la orden. Canal preferente WhatsApp si vino de mobile + IG, email en otro caso.",
      enabled: false,
      priority: 100,
      cooldown_hours: 48,
      channel: "auto",
      match_signal_id: "abandoned_checkout",
      min_severity: "high",
      email_subject_template:
        "{first_name}, nos quedamos esperándote — tu carrito sigue activo 🛒",
      whatsapp_template:
        "Hola {first_name} 👋 Vi que estabas por finalizar tu compra en enrola.shop con {products}. ¿Necesitas ayuda con el pago o envío? Te ayudo por aquí.",
      quiet_hours_start: 22,
      quiet_hours_end: 9,
      daily_cap: 40,
    },
    {
      key: "cart_abandoned_v2",
      name: "Carrito abandonado (sin checkout)",
      description:
        "Añadió un producto al carrito hace 2-48h y no volvió. Email con el producto + 10% off válido 48h.",
      enabled: false,
      priority: 80,
      cooldown_hours: 72,
      channel: "email",
      match_signal_id: "cart_abandoned",
      min_severity: "medium",
      email_subject_template: "¿Te lo dejo guardado? {product} sigue disponible",
      whatsapp_template:
        "Hola 👋 Vi que te interesó {product} en enrola.shop. Te dejo 10% off (código VUELVE10) por si quieres cerrar la compra. Válido 48h.",
      quiet_hours_start: 22,
      quiet_hours_end: 9,
      daily_cap: 30,
    },
    {
      key: "multi_view_no_cart_v2",
      name: "Multi-view sin carrito",
      description:
        "Vio el mismo producto 3+ veces en 14d sin agregarlo. Email con más info + social proof.",
      enabled: false,
      priority: 50,
      cooldown_hours: 168, // 7d
      channel: "email",
      match_signal_prefix: "multi_view_no_cart:",
      min_severity: "medium",
      email_subject_template: "¿Dudas con {product}? Te contamos lo que debes saber",
      whatsapp_template:
        "Hola 👋 Te veo interesado en {product}. Si tienes dudas sobre calidad, envío o pago, por aquí te respondo al toque.",
      quiet_hours_start: 22,
      quiet_hours_end: 9,
      daily_cap: 20,
    },
    {
      key: "restock_due_v2",
      name: "Reposición por ciclo de compra",
      description:
        "Cliente con 2+ compras del mismo producto y ciclo medio cumplido. Email reorder-1-click.",
      enabled: false,
      priority: 60,
      cooldown_hours: 168,
      channel: "email",
      match_signal_prefix: "restock_due:",
      min_severity: "low",
      email_subject_template: "¿Se te están acabando? Reordena {product} en un clic",
      whatsapp_template:
        "Hola 👋 Han pasado unos {cycle_days} días desde tu última compra de {product}. ¿Te preparo el pedido?",
      daily_cap: 50,
    },
    {
      key: "coupon_failed_no_purchase",
      name: "Cupón fallido (rescate)",
      description:
        "Usuario intentó aplicar un código en checkout que falló y no completó la orden en 30min-24h. Rescate empático con código válido — alta intención + emoción negativa = ventana caliente.",
      enabled: false,
      priority: 95,           // priority casi tan alta como abandoned_checkout
      cooldown_hours: 168,    // 7d — no martillar con códigos
      channel: "auto",
      match_signal_id: "coupon_failed_no_purchase",
      min_severity: "high",
      email_subject_template:
        "{first_name}, te dejamos un código que sí funciona 🎟",
      email_html_template: null,
      whatsapp_template:
        "Hola {first_name} 👋 Vi que tuviste lío con un código en enrola.shop. Te dejo este válido: VUELVE10 (10% off · 48h). Si necesitas ayuda con el pago, escríbeme aquí.",
      quiet_hours_start: 22,
      quiet_hours_end: 9,
      daily_cap: 30,
    },
    {
      key: "win_back_v2",
      name: "Reactivación (win-back)",
      description:
        "Cliente con compra hace 60+ días. Si volvió a visitar, WhatsApp; si no, email con 20% off 7d.",
      enabled: false,
      priority: 40,
      cooldown_hours: 720, // 30d
      channel: "auto",
      match_signal_id: "win_back",
      min_severity: "medium",
      email_subject_template: "Te extrañamos 💌 20% off para que vuelvas",
      whatsapp_template:
        "Hola {first_name} 👋 Ha pasado un tiempo desde tu última compra. Si quieres volver, te dejo 20% off con el código VUELVE20 (7 días).",
      quiet_hours_start: 22,
      quiet_hours_end: 9,
      daily_cap: 15,
    },
  ]
  for (const rule of defaults) {
    await upsertRule(rule)
  }
  console.log(`[remarketing-rules] Seeded ${defaults.length} default rules (all disabled).`)
}
