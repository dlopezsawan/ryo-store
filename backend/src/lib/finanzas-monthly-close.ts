/**
 * Finanzas — Monthly close email
 * Schedule: day 1 of each month at 09:00 UTC (`0 9 1 * *`)
 *
 * Generates the docx P&L for the *previous* month and emails it to the
 * configured owner address with a short HTML summary in the body.
 *
 * Configuration:
 *   - FINANZAS_REPORT_EMAIL  → recipient. Falls back to CONTACT_EMAIL.
 *   - RESEND_API_KEY         → required (already used by email-service).
 */

import { sendEmail } from "./email-service"
import { generateMonthlyDocx } from "./finanzas-docx"
import { Pool } from "pg"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

function previousMonthKey(): string {
  const d = new Date()
  d.setUTCDate(1)
  d.setUTCMonth(d.getUTCMonth() - 1)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`
}

const EUR_PER_USDT = 1.08

async function fetchSummary(month: string) {
  const [y, m] = month.split("-").map(Number)
  const from = new Date(Date.UTC(y, m - 1, 1))
  const to = new Date(Date.UTC(y, m, 1))

  const r = await pool.query(
    `SELECT
       COUNT(*) AS orders,
       COALESCE(SUM(amount_eur_total), 0)  AS net_eur,
       COALESCE(SUM(amount_eur_cogs), 0)   AS cogs_eur,
       COALESCE(SUM(amount_eur_margin), 0) AS margin_eur
     FROM finanzas_pago_movil
     WHERE deleted_at IS NULL AND created_at >= $1 AND created_at < $2`,
    [from, to]
  )
  const expR = await pool.query(
    `SELECT COALESCE(SUM(amount_usdt), 0) AS spent
     FROM finanzas_expense
     WHERE deleted_at IS NULL AND status = 'paid'
       AND expense_date >= $1 AND expense_date < $2`,
    [from, to]
  )
  const orders = Number(r.rows[0].orders)
  const netEur = Number(r.rows[0].net_eur)
  const marginEur = Number(r.rows[0].margin_eur)
  const expensesUsdt = Number(expR.rows[0].spent)
  const ebitdaEur = marginEur - expensesUsdt * EUR_PER_USDT
  return { orders, netEur, marginEur, expensesUsdt, ebitdaEur }
}

const fmtEur = (n: number) =>
  `€${(Number(n) || 0).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmtUsdt = (n: number) =>
  `$${(Number(n) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

function emailHtml(month: string, monthName: string, s: Awaited<ReturnType<typeof fetchSummary>>): string {
  const marginColor = s.marginEur >= 0 ? "#10B981" : "#EF4444"
  const ebitdaColor = s.ebitdaEur >= 0 ? "#10B981" : "#EF4444"
  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"/></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,system-ui,sans-serif;color:#1A1A1A;background:#F5F2E8;margin:0;padding:24px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;border-top:4px solid #FF3B27;">
    <h1 style="margin:0 0 4px;font-size:22px;color:#FF3B27;font-weight:800;">ENROLA SHOP</h1>
    <p style="margin:0 0 24px;color:#6B7280;font-size:13px;">Cierre de mes · ${monthName}</p>

    <p style="font-size:14px;line-height:1.6;">Hola Daniel 👋,</p>
    <p style="font-size:14px;line-height:1.6;">
      Cerró <b>${monthName}</b>. Adjunto va el reporte completo en Word.
      Resumen rápido:
    </p>

    <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">
      <tr>
        <td style="padding:8px 0;border-bottom:1px solid #E5E7EB;color:#6B7280;">Órdenes</td>
        <td style="padding:8px 0;border-bottom:1px solid #E5E7EB;text-align:right;font-weight:600;">${s.orders}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;border-bottom:1px solid #E5E7EB;color:#6B7280;">Ingresos netos</td>
        <td style="padding:8px 0;border-bottom:1px solid #E5E7EB;text-align:right;font-weight:600;">${fmtEur(s.netEur)}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;border-bottom:1px solid #E5E7EB;color:#6B7280;">Margen bruto</td>
        <td style="padding:8px 0;border-bottom:1px solid #E5E7EB;text-align:right;font-weight:600;color:${marginColor};">${fmtEur(s.marginEur)}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;border-bottom:1px solid #E5E7EB;color:#6B7280;">Gastos pagados</td>
        <td style="padding:8px 0;border-bottom:1px solid #E5E7EB;text-align:right;font-weight:600;color:#EF4444;">${fmtUsdt(s.expensesUsdt)}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;color:#1A1A1A;font-weight:700;">EBITDA</td>
        <td style="padding:8px 0;text-align:right;font-weight:700;color:${ebitdaColor};font-size:16px;">${fmtEur(s.ebitdaEur)}</td>
      </tr>
    </table>

    <p style="font-size:13px;color:#6B7280;line-height:1.6;">
      📎 El archivo <b>enrola-finanzas-${month}.docx</b> tiene el desglose completo:
      P&amp;L formal, top productos por margen, top clientes, runway y breakeven.
    </p>
    <p style="font-size:13px;color:#6B7280;line-height:1.6;">
      Para ver el dashboard interactivo: <a href="https://api.enrola.shop/dashboard/finanzas" style="color:#FF3B27;text-decoration:none;">/dashboard/finanzas</a>
    </p>
  </div>
  <p style="text-align:center;color:#6B7280;font-size:11px;margin-top:18px;">
    Enviado automáticamente por el módulo Finanzas el día 1 de cada mes
  </p>
</body></html>`
}

/**
 * Internal sender — invocable manualmente desde admin endpoint.
 * @param opts.month  YYYY-MM. Default: mes anterior al actual.
 * @param opts.toOverride  Email destino. Default: FINANZAS_REPORT_EMAIL env.
 */
export async function sendMonthlyCloseEmail(opts: {
  month?: string
  toOverride?: string
} = {}): Promise<{
  status: "sent" | "skipped"
  reason?: string
  month?: string
  to?: string
  orders?: number
  net_eur?: number
  ebitda_eur?: number
}> {
  const month = opts.month || previousMonthKey()
  const [y, m] = month.split("-").map(Number)
  if (!y || !m || m < 1 || m > 12) {
    return { status: "skipped", reason: "invalid_month_format" }
  }
  const monthName = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("es-ES", {
    month: "long",
    year: "numeric",
  })
  const to = opts.toOverride || process.env.FINANZAS_REPORT_EMAIL || process.env.CONTACT_EMAIL || ""
  if (!to) {
    return { status: "skipped", reason: "no_recipient_configured" }
  }

  const summary = await fetchSummary(month)
  if (summary.orders === 0 && summary.expensesUsdt === 0) {
    return { status: "skipped", reason: "no_activity_in_month", month }
  }

  const buffer = await generateMonthlyDocx(month)
  const ok = await sendEmail({
    to,
    subject: `📊 Cierre Enrola · ${monthName}`,
    html: emailHtml(month, monthName, summary),
    fromName: "Enrola Finanzas",
    attachments: [{ filename: `enrola-finanzas-${month}.docx`, content: buffer }],
  })

  return {
    status: ok ? "sent" : "skipped",
    reason: ok ? undefined : "send_failed",
    month,
    to,
    orders: summary.orders,
    net_eur: summary.netEur,
    ebitda_eur: summary.ebitdaEur,
  }
}

// Helper público — invocable manualmente desde el endpoint admin
// `POST /admin/finanzas/send-monthly-close` (botón "📧 Enviar cierre" en /finanzas).
//
// El scheduler de Medusa NO carga este archivo (vive en /lib/, no en /jobs/).
// Razón: el cron "0 9 1 * *" se ejecutaba 24×/seg (906k runs en 24h) y agotó la
// quota de Resend mandándose 200 emails a hola@enrola.shop el 1-2 mayo 2026.
//
// Si en el futuro se reactiva el scheduler, hacerlo via cron del HOST (crontab
// del VPS) que haga POST al endpoint admin — fuera del job loader de Medusa.
