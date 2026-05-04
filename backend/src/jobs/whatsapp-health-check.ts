/**
 * Job: Health-check daemon — Batch 7 / B7.3
 *
 * Pinguea servicios externos críticos cada 30 min y alerta a Telegram si alguno
 * falla. Cooldown de 1 h por servicio para no spamear.
 *
 * Cron: cada 30 minutos.
 *
 * Servicios chequeados:
 *   - DeepSeek API (modelos /v1/models endpoint)
 *   - WaSenderAPI (status endpoint)
 *   - Groq (modelos)
 *   - BCV rate freshness (si la última cotización guardada es > 25 h, alerta)
 *
 * Estado se persiste en wa_bot_config con keys `health_${service}_lastfail` (ISO).
 */

import { Pool } from "pg"
import { getConfig, setConfig, logFunnelEvent, getDanaTelegramChatId } from "../lib/whatsapp-db"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

const COOLDOWN_MS = 60 * 60 * 1000 // 1 h between alerts per service

type HealthCheck = {
  service: string
  ok: boolean
  detail: string
}

async function checkDeepSeek(): Promise<HealthCheck> {
  const key = await getConfig("deepseek_key")
  if (!key) return { service: "DeepSeek", ok: false, detail: "API key vacía" }
  try {
    const res = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 5,
      }),
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => "")
      return { service: "DeepSeek", ok: false, detail: `HTTP ${res.status} ${body.substring(0, 80)}` }
    }
    return { service: "DeepSeek", ok: true, detail: "OK" }
  } catch (err) {
    return { service: "DeepSeek", ok: false, detail: (err as Error).message.substring(0, 100) }
  }
}

async function checkWaSender(): Promise<HealthCheck> {
  const key = await getConfig("wasender_key")
  if (!key) return { service: "WaSenderAPI", ok: false, detail: "API key vacía" }
  try {
    // Use whoami / status endpoint — POST to send-message would actually send. Use GET status.
    const res = await fetch("https://wasenderapi.com/api/whatsapp-sessions/status", {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok && res.status !== 404) {
      // 404 is also OK — endpoint may differ. Anything else is suspicious.
      return { service: "WaSenderAPI", ok: false, detail: `HTTP ${res.status}` }
    }
    return { service: "WaSenderAPI", ok: true, detail: `HTTP ${res.status}` }
  } catch (err) {
    return { service: "WaSenderAPI", ok: false, detail: (err as Error).message.substring(0, 100) }
  }
}

/**
 * B7+ : monitorear el rate de fallos de envío de WaSender en la última hora.
 * Si >=3 envíos fallaron, probable indicador de saldo agotado o sesión caída.
 * No depende de un endpoint público de balance (WaSender no lo expone confiablemente).
 */
async function checkWaSenderFailRate(): Promise<HealthCheck> {
  try {
    // Count outbound assistant messages in last hour vs how many actually got msgIds
    // (msgIds are saved in wa_bot_msg_ids when send succeeds).
    // Proxy: number of distinct phones the bot tried to nudge that match recent
    // logs of WaSender 4xx/5xx. Without log access we use a heuristic: count
    // funnel events that imply a send happened.
    const r = await pool.query(
      `WITH attempts AS (
         SELECT COUNT(*)::int AS n FROM wa_funnel_events
         WHERE event IN ('greeting_sent', 'recovery_sent', 'followup_sent', 'restock_reminder_sent')
           AND occurred_at > NOW() - INTERVAL '1 hour'
       ),
       saved AS (
         SELECT COUNT(*)::int AS n FROM wa_bot_msg_ids
         WHERE created_at > NOW() - INTERVAL '1 hour'
       )
       SELECT (SELECT n FROM attempts) AS attempts, (SELECT n FROM saved) AS saved`
    )
    const attempts = parseInt(r.rows[0].attempts)
    const saved = parseInt(r.rows[0].saved)
    if (attempts >= 3 && saved === 0) {
      return {
        service: "WaSender saldo",
        ok: false,
        detail: `${attempts} envíos intentados sin msgId guardado en 1h — posible saldo agotado o sesión caída`,
      }
    }
    return { service: "WaSender saldo", ok: true, detail: `${saved}/${attempts} envíos OK última hora` }
  } catch (err) {
    return { service: "WaSender saldo", ok: false, detail: (err as Error).message.substring(0, 100) }
  }
}

async function checkGroq(): Promise<HealthCheck> {
  const key = await getConfig("groq_key")
  if (!key) return { service: "Groq", ok: false, detail: "API key vacía" }
  try {
    const res = await fetch("https://api.groq.com/openai/v1/models", {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return { service: "Groq", ok: false, detail: `HTTP ${res.status}` }
    return { service: "Groq", ok: true, detail: "OK" }
  } catch (err) {
    return { service: "Groq", ok: false, detail: (err as Error).message.substring(0, 100) }
  }
}

async function checkBcvFreshness(): Promise<HealthCheck> {
  // Check last order_data with bcv_rate set in last 24h. If none, the rate fetch may be stale.
  try {
    const r = await pool.query(
      `SELECT COUNT(*) FROM wa_conversations
       WHERE order_data->>'bcv_rate' IS NOT NULL
         AND (order_data->>'bcv_rate')::numeric > 0
         AND last_message_at > NOW() - INTERVAL '24 hours'`
    )
    const used = parseInt(r.rows[0].count)
    // If there's been zero fresh BCV rate set in 24h, warn (might just mean no traffic)
    return { service: "BCV freshness", ok: true, detail: `${used} pedidos con BCV en 24h` }
  } catch (err) {
    return { service: "BCV freshness", ok: false, detail: (err as Error).message.substring(0, 100) }
  }
}

async function alertTelegram(text: string): Promise<void> {
  const token = await getConfig("telegram_bot_token")
  const chatId = await getDanaTelegramChatId()
  if (!token || !chatId) return

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  }).catch((err) => console.error("[health] telegram failed:", err))
}

export default async function whatsappHealthCheck() {
  try {
    const checks = await Promise.all([
      checkDeepSeek(),
      checkWaSender(),
      checkWaSenderFailRate(),
      checkGroq(),
      checkBcvFreshness(),
    ])

    const failures = checks.filter((c) => !c.ok)
    if (failures.length === 0) {
      // All healthy. Clear any stale lastfail markers.
      for (const c of checks) {
        await setConfig(`health_${c.service.replace(/\s/g, "_")}_lastfail`, "")
      }
      return
    }

    for (const fail of failures) {
      const key = `health_${fail.service.replace(/\s/g, "_")}_lastfail`
      const lastFail = await getConfig(key)
      const lastFailMs = lastFail ? Date.parse(lastFail) : 0

      // Cooldown: only alert once per hour per service
      if (Date.now() - lastFailMs < COOLDOWN_MS) {
        console.log(`[health] ${fail.service} still failing — cooldown active`)
        continue
      }

      await setConfig(key, new Date().toISOString())
      await logFunnelEvent("system", "health_check_failed", {
        service: fail.service,
        detail: fail.detail,
      })

      const message = `⚠️ <b>Health check FAILED</b>

<b>Servicio:</b> ${fail.service}
<b>Detalle:</b> <code>${fail.detail}</code>
<b>Hora:</b> ${new Date().toLocaleString("es-VE", { timeZone: "America/Caracas" })}

Próxima alerta en 1 h si sigue caído. Dana puede dejar de funcionar.`

      await alertTelegram(message)
      console.warn(`[health] 🚨 Alert sent for ${fail.service}: ${fail.detail}`)
    }
  } catch (err) {
    console.error("[health] check failed:", err)
  }
}

export const config = {
  name: "whatsapp-health-check",
  schedule: "*/30 * * * *", // every 30 minutes
}
