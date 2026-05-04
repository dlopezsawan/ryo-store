/**
 * Telegram command logger.
 * Persists every /venta (and future) command invocation with result/error
 * so we can surface the bot's failure funnel in the analytics dashboard.
 */

import { Pool } from "pg"

let pool: Pool | null = null
function getPool(): Pool {
  if (!pool) pool = new Pool({ connectionString: process.env.DATABASE_URL })
  return pool
}

let ensured = false
async function ensureTable(): Promise<void> {
  if (ensured) return
  try {
    await getPool().query(`
      CREATE TABLE IF NOT EXISTS telegram_command_log (
        id SERIAL PRIMARY KEY,
        command TEXT NOT NULL,
        args TEXT,
        chat_id TEXT,
        user_id TEXT,
        result TEXT NOT NULL CHECK (result IN ('ok', 'error')),
        error_type TEXT,
        error_message TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_tg_log_created_at ON telegram_command_log (created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_tg_log_command_result ON telegram_command_log (command, result);
    `)
    ensured = true
  } catch (err) {
    console.error("[telegram-log] ensureTable failed:", (err as Error).message)
  }
}

export async function logTelegramCommand(opts: {
  command: string
  args?: string
  chat_id?: string | number
  user_id?: string | number
  result: "ok" | "error"
  error_type?: string
  error_message?: string
}): Promise<void> {
  try {
    await ensureTable()
    await getPool().query(
      `INSERT INTO telegram_command_log (command, args, chat_id, user_id, result, error_type, error_message)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        opts.command,
        opts.args || null,
        opts.chat_id != null ? String(opts.chat_id) : null,
        opts.user_id != null ? String(opts.user_id) : null,
        opts.result,
        opts.error_type || null,
        opts.error_message ? String(opts.error_message).slice(0, 500) : null,
      ]
    )
  } catch (err) {
    console.error("[telegram-log] insert failed:", (err as Error).message)
  }
}

/**
 * Heuristic mapper from an error message to a category, so the admin
 * dashboard can group failures (e.g. "product_not_found", "warehouse_missing", etc.).
 */
export function classifyVentaError(message: string): string {
  const m = message.toLowerCase()
  if (m.includes("producto") && m.includes("no encontrado")) return "product_not_found"
  if (m.includes("almacén") && m.includes("no encontrado")) return "warehouse_not_found"
  if (m.includes("falta almacén")) return "warehouse_missing"
  if (m.includes("falta \"para")) return "client_name_missing"
  if (m.includes("stock")) return "stock_insufficient"
  if (m.includes("reservation")) return "reservation_missing"
  if (m.includes("payment") || m.includes("pago")) return "payment_error"
  if (m.includes("fulfillment") || m.includes("ship")) return "fulfillment_error"
  return "other"
}
