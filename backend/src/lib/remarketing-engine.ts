/**
 * Remarketing Rules Engine — core runner
 *
 *   candidates → buildUserContext → computeSignals → matchRules → dispatch → logFire
 *
 * Scheduled via `jobs/remarketing-engine.ts` (every 15 min).
 * Also exposed via `/admin/remarketing/engine/run` for manual + dry-run.
 */

import { Pool } from "pg"
import { discoverCandidates, type Candidate } from "./remarketing-candidates"
import { buildUserContext } from "./remarketing-user-context"
import { computeSignals, type Signal, type SignalSeverity } from "./remarketing-signals"

let enginePool: Pool | null = null
function getEnginePool(): Pool {
  if (!enginePool) enginePool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
  return enginePool
}

/**
 * Fetches products created in last 7 days. Used to enrich UserContext.catalog
 * for cross-cutting signals like VIP early access. Cached per engine run.
 */
async function getNewProducts(): Promise<Array<{ id: string; title: string; created_at: string; handle?: string }>> {
  try {
    const r = await getEnginePool().query(
      `SELECT id, title, handle, created_at
       FROM product
       WHERE deleted_at IS NULL
         AND status = 'published'
         AND created_at > NOW() - INTERVAL '7 days'
       ORDER BY created_at DESC
       LIMIT 10`
    )
    return r.rows.map((row) => ({
      id: String(row.id),
      title: String(row.title || ""),
      handle: row.handle ? String(row.handle) : undefined,
      created_at: String(row.created_at),
    }))
  } catch (err) {
    console.warn("[engine] getNewProducts failed:", (err as Error).message)
    return []
  }
}

/**
 * Fetches products that have positive stock and were updated in last 24h.
 * Heuristic for "recently restocked" — we don't track stock change history yet,
 * so any product whose inventory_level was touched recently and now has stock > 0
 * counts. False positives (regular stock adjustments) are filtered downstream
 * by the per-user OOS event match.
 */
async function getRecentlyRestockedProducts(): Promise<Array<{ id: string; title: string; handle?: string; stocked_at: string }>> {
  try {
    const r = await getEnginePool().query(
      `SELECT DISTINCT p.id, p.title, p.handle, MAX(il.updated_at) AS stocked_at
       FROM product p
       JOIN product_variant pv ON pv.product_id = p.id AND pv.deleted_at IS NULL
       JOIN product_variant_inventory_item pvi ON pvi.variant_id = pv.id
       JOIN inventory_level il ON il.inventory_item_id = pvi.inventory_item_id AND il.deleted_at IS NULL
       WHERE p.deleted_at IS NULL
         AND p.status = 'published'
         AND il.stocked_quantity > il.reserved_quantity
         AND il.updated_at > NOW() - INTERVAL '24 hours'
       GROUP BY p.id, p.title, p.handle
       LIMIT 50`
    )
    return r.rows.map((row) => ({
      id: String(row.id),
      title: String(row.title || ""),
      handle: row.handle ? String(row.handle) : undefined,
      stocked_at: String(row.stocked_at),
    }))
  } catch (err) {
    console.warn("[engine] getRecentlyRestockedProducts failed:", (err as Error).message)
    return []
  }
}
import {
  listRules,
  seedDefaultRulesIfMissing,
  wasRuleFiredRecently,
  countFiresToday,
  logFire,
  updateFireStatus,
  type RemarketingRule,
  type RuleChannel,
} from "./remarketing-rules-db"
import { sendEmail } from "./email-service"
import { sendRemarketingWhatsApp } from "./remarketing-wa"
import { sendTeamAlert, isTeamAlertConfigured } from "./team-alert"
import {
  alreadyNotified,
  resolveCustomerCedula,
  legacyTypeForRuleKey,
  logEmail,
} from "./remarketing-db"
import { captureServerSide, isPosthogConfigured } from "./posthog-server"

const SEVERITY_RANK: Record<SignalSeverity, number> = {
  high: 0,
  medium: 1,
  low: 2,
  info: 3,
}

function ruleMatchesSignal(rule: RemarketingRule, signal: Signal): boolean {
  // Severity floor
  const min = rule.min_severity || "medium"
  if (SEVERITY_RANK[signal.severity] > SEVERITY_RANK[min]) return false
  if (rule.match_signal_id && rule.match_signal_id === signal.id) return true
  if (rule.match_signal_prefix && signal.id.startsWith(rule.match_signal_prefix)) return true
  return false
}

function isInQuietHours(rule: RemarketingRule, now = new Date()): boolean {
  const start = rule.quiet_hours_start
  const end = rule.quiet_hours_end
  if (start == null || end == null) return false
  // Use Venezuela local time (UTC-4). Date object getUTCHours() + offset.
  const hour = (now.getUTCHours() - 4 + 24) % 24
  if (start === end) return false
  if (start < end) return hour >= start && hour < end      // 9..17
  return hour >= start || hour < end                        // 22..9 wraps
}

function resolveChannel(
  rule: RemarketingRule,
  signal: Signal,
  hasPhone: boolean,
  hasEmail: boolean
): RuleChannel | null {
  let channel: RuleChannel = rule.channel
  if (channel === "auto") {
    // Prefer WA if signal suggests it AND phone exists; otherwise email.
    if (signal.suggested_channel === "whatsapp" && hasPhone) channel = "whatsapp"
    else if (hasEmail) channel = "email"
    else if (hasPhone) channel = "whatsapp"
    else return null
  }
  if (channel === "whatsapp" && !hasPhone) return null
  if (channel === "email" && !hasEmail) return null
  if (channel === "manual") return null
  // team_alert always reachable as long as Telegram is configured (checked at dispatch)
  return channel
}

/**
 * Render a template with {placeholder} substitution from context.
 */
function renderTemplate(template: string, ctx: Record<string, unknown>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => {
    const v = ctx[k]
    return v == null ? "" : String(v)
  })
}

/**
 * A/B variant picker — deterministic by user identity hash so the same user
 * always gets the same variant within a rule.
 */
type Variant = {
  key: string
  weight: number
  email_subject_template?: string
  email_html_template?: string
  whatsapp_template?: string
}

function djb2Hash(str: string): number {
  let h = 5381
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0
  return Math.abs(h)
}

function pickVariant(
  variants: unknown,
  identity: string
): Variant | null {
  if (!Array.isArray(variants) || variants.length === 0) return null
  const list = variants as Variant[]
  const totalWeight = list.reduce((s, v) => s + (Number(v.weight) || 0), 0)
  if (totalWeight <= 0) return list[0] || null
  const bucket = djb2Hash(identity) % totalWeight
  let cum = 0
  for (const v of list) {
    cum += Number(v.weight) || 0
    if (bucket < cum) return v
  }
  return list[list.length - 1]
}

export interface EngineRunResult {
  dry_run: boolean
  started_at: string
  finished_at: string
  duration_ms: number
  candidates_scanned: number
  signals_detected: number
  rules_matched: number
  fires_sent: number
  fires_skipped: number
  fires_failed: number
  by_rule: Record<string, { matched: number; sent: number; skipped: number; failed: number }>
  errors: Array<{ candidate: string; error: string }>
}

export async function runEngine(opts: {
  dryRun?: boolean
  maxCandidates?: number
  lookbackHours?: number
} = {}): Promise<EngineRunResult> {
  const dryRun = !!opts.dryRun
  const start = Date.now()
  const startedIso = new Date().toISOString()

  await seedDefaultRulesIfMissing()
  const allRules = await listRules()
  const rules = allRules.filter((r) => r.enabled)
  const byRule: EngineRunResult["by_rule"] = {}
  for (const r of rules) {
    byRule[r.key] = { matched: 0, sent: 0, skipped: 0, failed: 0 }
  }

  const errors: EngineRunResult["errors"] = []
  const [candidates, newProducts, restockedProducts] = await Promise.all([
    discoverCandidates({
      lookback_hours: opts.lookbackHours ?? 72,
      max: opts.maxCandidates ?? 500,
    }),
    getNewProducts(),
    getRecentlyRestockedProducts(),
  ])

  let signalsDetected = 0
  let rulesMatched = 0
  let firesSent = 0
  let firesSkipped = 0
  let firesFailed = 0

  // Daily cap tracker (rule_key → count today)
  const dailyCounts = new Map<string, number>()
  async function getDailyCount(ruleKey: string): Promise<number> {
    if (dailyCounts.has(ruleKey)) return dailyCounts.get(ruleKey)!
    const n = await countFiresToday(ruleKey)
    dailyCounts.set(ruleKey, n)
    return n
  }
  function bumpDailyCount(ruleKey: string) {
    dailyCounts.set(ruleKey, (dailyCounts.get(ruleKey) || 0) + 1)
  }

  // Early exit when no rules enabled → still useful to log the run and count candidates
  if (rules.length === 0) {
    return {
      dry_run: dryRun,
      started_at: startedIso,
      finished_at: new Date().toISOString(),
      duration_ms: Date.now() - start,
      candidates_scanned: candidates.length,
      signals_detected: 0,
      rules_matched: 0,
      fires_sent: 0,
      fires_skipped: 0,
      fires_failed: 0,
      by_rule: byRule,
      errors: [{ candidate: "—", error: "No enabled rules (engine is idle)" }],
    }
  }

  for (const cand of candidates) {
    try {
      const ctx = await buildUserContext({
        email: cand.email,
        customer_id: cand.customer_id,
        distinct_id: cand.distinct_id,
      })
      // Inject cross-cutting catalog data for signals like vip_early_access
      ctx.signalContext.catalog = {
        new_products: newProducts,
        recently_restocked: restockedProducts,
      }
      const signals = computeSignals(ctx.signalContext)
      signalsDetected += signals.length
      if (!signals.length) continue

      // Sort rules by priority desc to give precedence to higher priority rules
      const sortedRules = [...rules].sort((a, b) => b.priority - a.priority)
      // One fire per rule per user per run (avoid double-matching on variants)
      const firedRuleKeys = new Set<string>()

      for (const signal of signals) {
        for (const rule of sortedRules) {
          if (firedRuleKeys.has(rule.key)) continue
          if (!ruleMatchesSignal(rule, signal)) continue
          byRule[rule.key].matched++
          rulesMatched++

          const email = ctx.customer?.email || cand.email || null
          const customerId = ctx.customer?.id || cand.customer_id || null
          const phone = ctx.customer?.phone || null
          const distinctId =
            ctx.posthogPerson?.distinct_ids?.[0] || cand.distinct_id || null

          // Cooldown check
          const onCooldown = await wasRuleFiredRecently(
            rule.key,
            { email, customer_id: customerId, distinct_id: distinctId },
            rule.cooldown_hours
          )
          if (onCooldown) {
            byRule[rule.key].skipped++
            firesSkipped++
            if (!dryRun) {
              await logFire({
                rule_key: rule.key,
                customer_id: customerId,
                email,
                phone,
                distinct_id: distinctId,
                signal_id: signal.id,
                signal_severity: signal.severity,
                channel: rule.channel,
                status: "skipped_cooldown",
                context: { cooldown_hours: rule.cooldown_hours },
              })
            }
            firedRuleKeys.add(rule.key)
            continue
          }

          // Daily cap check
          if (rule.daily_cap != null) {
            const today = await getDailyCount(rule.key)
            if (today >= rule.daily_cap) {
              byRule[rule.key].skipped++
              firesSkipped++
              if (!dryRun) {
                await logFire({
                  rule_key: rule.key,
                  customer_id: customerId,
                  email,
                  phone,
                  distinct_id: distinctId,
                  signal_id: signal.id,
                  signal_severity: signal.severity,
                  channel: rule.channel,
                  status: "skipped_cap",
                  context: { daily_cap: rule.daily_cap, today },
                })
              }
              firedRuleKeys.add(rule.key)
              continue
            }
          }

          // Quiet hours check
          if (isInQuietHours(rule)) {
            byRule[rule.key].skipped++
            firesSkipped++
            if (!dryRun) {
              await logFire({
                rule_key: rule.key,
                customer_id: customerId,
                email,
                phone,
                distinct_id: distinctId,
                signal_id: signal.id,
                signal_severity: signal.severity,
                channel: rule.channel,
                status: "skipped_quiet_hours",
                context: {
                  quiet_start: rule.quiet_hours_start,
                  quiet_end: rule.quiet_hours_end,
                },
              })
            }
            firedRuleKeys.add(rule.key)
            continue
          }

          // Resolve channel
          const channel = resolveChannel(rule, signal, !!phone, !!email)
          if (!channel) {
            byRule[rule.key].skipped++
            firesSkipped++
            if (!dryRun) {
              await logFire({
                rule_key: rule.key,
                customer_id: customerId,
                email,
                phone,
                distinct_id: distinctId,
                signal_id: signal.id,
                signal_severity: signal.severity,
                channel: rule.channel,
                status: "skipped_no_channel",
                context: { reason: "no reachable channel (manual or missing contact)" },
              })
            }
            firedRuleKeys.add(rule.key)
            continue
          }

          // Pick A/B variant deterministically by user identity (if defined)
          const identity = email || customerId || distinctId || "anon"
          const variant = pickVariant(rule.variants, `${rule.key}:${identity}`)

          // Build message body from variant template > rule template > signal fallback
          const firstName = ctx.customer?.first_name || "amig@"
          const products = (signal.context?.products as Array<{ title?: string }> | undefined)
            ?.map((p) => p?.title)
            .filter(Boolean)
            .join(", ")
          const product = (signal.context?.title as string) || (signal.context?.product_title as string) || ""
          const templateCtx = {
            first_name: firstName,
            product,
            products: products || product,
            cycle_days: (signal.context?.cycle_days as number) || "",
          }

          // Geo overrides: per-city template overrides take precedence over the
          // rule defaults but variant overrides still win (variants are the
          // experimental layer; geo is the localization layer).
          const city = ctx.signalContext.customer.city || null
          const geoMap = (rule.geo_overrides || {}) as Record<
            string,
            {
              email_subject_template?: string
              email_html_template?: string
              whatsapp_template?: string
            }
          >
          const geo = city && typeof geoMap === "object" ? geoMap[city] : null

          const emailSubjectTpl =
            variant?.email_subject_template ||
            geo?.email_subject_template ||
            rule.email_subject_template
          const emailHtmlTpl =
            variant?.email_html_template ||
            geo?.email_html_template ||
            rule.email_html_template
          const whatsappTpl =
            variant?.whatsapp_template ||
            geo?.whatsapp_template ||
            rule.whatsapp_template

          let subject: string | null = null
          let body: string | null = null
          if (channel === "email") {
            subject = emailSubjectTpl
              ? renderTemplate(emailSubjectTpl, templateCtx)
              : signal.title
            body = emailHtmlTpl
              ? renderTemplate(emailHtmlTpl, templateCtx)
              : `<p>${signal.description}</p><p>${signal.suggested_action}</p>`
          } else if (channel === "whatsapp") {
            body = whatsappTpl
              ? renderTemplate(whatsappTpl, templateCtx)
              : `${signal.title}\n\n${signal.suggested_action}`
          } else if (channel === "team_alert") {
            // Internal alert — title=signal.title rendered, body=whatsappTpl or signal description
            subject = signal.title
            body = whatsappTpl
              ? renderTemplate(whatsappTpl, templateCtx)
              : signal.description
          }

          if (dryRun) {
            byRule[rule.key].sent++
            firesSent++
            firedRuleKeys.add(rule.key)
            continue
          }

          // ─── Cross-system dedup BEFORE any dispatch ───────────────────────
          // Maps the engine rule to its legacy bucket (e.g. cart_abandoned_v2 →
          // "abandoned_cart") so old jobs and new engine never double-fire.
          const legacyType = legacyTypeForRuleKey(rule.key)
          const cedula = await resolveCustomerCedula(customerId, email)
          let legacyDupe = false
          if (legacyType) {
            legacyDupe = await alreadyNotified(
              legacyType,
              { email, cedula, customerId },
              Math.min(rule.cooldown_hours, 24)
            )
          }

          // Log as pending first, then dispatch (or short-circuit on legacy dupe)
          const fireId = await logFire({
            rule_key: rule.key,
            customer_id: customerId,
            email,
            phone,
            distinct_id: distinctId,
            signal_id: signal.id,
            signal_severity: signal.severity,
            channel,
            status: legacyDupe ? "skipped_cooldown" : "pending",
            subject,
            body,
            context: {
              signal_context: signal.context || {},
              rendered: templateCtx,
              variant: variant?.key || null,
              legacy_type: legacyType,
              city: city || null,
              geo_override_applied: geo ? true : false,
            },
            error_message: legacyDupe ? "legacy dedup hit (cross-system)" : null,
          })

          if (legacyDupe) {
            byRule[rule.key].skipped++
            firesSkipped++
            firedRuleKeys.add(rule.key)
            continue
          }

          try {
            let ok = false
            if (channel === "email" && email && subject && body) {
              ok = await sendEmail({ to: email, subject, html: body })
            } else if (channel === "whatsapp" && phone && body) {
              ok = await sendRemarketingWhatsApp(
                (legacyType as any) || "abandoned_cart",
                phone,
                body,
                customerId || null,
                { signal_id: signal.id, rule_key: rule.key, cedula, fire_id: fireId }
              )
            } else if (channel === "team_alert") {
              // Internal notification — no customer-facing dispatch.
              // Body becomes the alert text; subject becomes the title.
              const userLabel = email || phone || customerId || distinctId || "anónimo"
              // Medusa admin path is configured via medusa-config.js → admin.path
              // (defaults to "/app" but overridden to "/dashboard" in this project).
              // Allow ADMIN_URL env to fully override; otherwise build from STORE_URL/api host.
              const adminBase =
                process.env.ADMIN_URL || "https://api.enrola.shop/dashboard"
              const adminUrl = `${adminBase.replace(/\/$/, "")}/remarketing`
              ok = await sendTeamAlert({
                title: subject || `🚨 ${signal.title}`,
                body:
                  `${body || signal.description}\n\n` +
                  `<b>Usuario:</b> ${userLabel}\n` +
                  `<b>Señal:</b> ${signal.id} (${signal.severity})\n` +
                  `<b>Regla:</b> ${rule.name}`,
                buttons: email
                  ? [{ text: "Ver User 360", url: `${adminUrl}?tab=users&user=${encodeURIComponent(email)}` }]
                  : undefined,
              })
            }
            if (ok) {
              await updateFireStatus(fireId, "sent")
              byRule[rule.key].sent++
              firesSent++
              bumpDailyCount(rule.key)

              // Mirror to remarketing_log so legacy stats / dedup / activity feed
              // include engine dispatches as a single source of truth.
              if (legacyType && email) {
                await logEmail(
                  legacyType,
                  email,
                  customerId || null,
                  subject || signal.title,
                  {
                    cedula,
                    fire_id: fireId,
                    rule_key: rule.key,
                    signal_id: signal.id,
                    channel,
                    variant: variant?.key || null,
                    source: "engine",
                  }
                )
              }

              // Server-side PostHog capture so funnels can correlate fire → conversion
              if (isPosthogConfigured()) {
                const phDistinctId = distinctId || customerId || email || `fire_${fireId}`
                captureServerSide({
                  distinctId: phDistinctId,
                  event: "remarketing_fired",
                  properties: {
                    rule_key: rule.key,
                    signal_id: signal.id,
                    signal_severity: signal.severity,
                    channel,
                    variant: variant?.key || null,
                    fire_id: fireId,
                    has_email: !!email,
                    has_phone: !!phone,
                    legacy_type: legacyType,
                  },
                }).catch(() => { /* never block */ })
              }
            } else {
              await updateFireStatus(fireId, "failed", "dispatch returned false")
              byRule[rule.key].failed++
              firesFailed++
            }
          } catch (err) {
            await updateFireStatus(fireId, "failed", (err as Error).message)
            byRule[rule.key].failed++
            firesFailed++
          }
          firedRuleKeys.add(rule.key)
        }
      }
    } catch (err) {
      errors.push({
        candidate: cand.email || cand.customer_id || cand.distinct_id || "?",
        error: (err as Error).message,
      })
    }
  }

  return {
    dry_run: dryRun,
    started_at: startedIso,
    finished_at: new Date().toISOString(),
    duration_ms: Date.now() - start,
    candidates_scanned: candidates.length,
    signals_detected: signalsDetected,
    rules_matched: rulesMatched,
    fires_sent: firesSent,
    fires_skipped: firesSkipped,
    fires_failed: firesFailed,
    by_rule: byRule,
    errors: errors.slice(0, 20),
  }
}
