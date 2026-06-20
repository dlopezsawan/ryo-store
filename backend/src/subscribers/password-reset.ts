/**
 * Password Reset Email Subscriber
 * Fires when a customer requests a password reset token via /auth/customer/emailpass/reset-password
 * Without this subscriber the reset email was never sent, making /recuperar silently fail.
 */

import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { sendEmail } from "../lib/email-service"

const STORE_URL = process.env.STORE_URL || "https://enrola.shop"

function passwordResetEmailHtml(resetUrl: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Restablecer contraseña — Club Enrola</title>
<link href="https://fonts.googleapis.com/css2?family=Kanit:wght@400;600;700;900&display=swap" rel="stylesheet"/>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; padding: 0; background-color: #F5F2E8; font-family: 'Kanit', Arial, sans-serif; }
  .wrapper { background-color: #F5F2E8; padding: 32px 16px; }
  .container { max-width: 600px; margin: 0 auto; }
  .header { background-color: #1A1A1A; padding: 36px 40px 32px; text-align: center; }
  .header-logo { max-width: 160px; height: auto; margin: 0 auto; display: block; }
  .hero-band { background-color: #FF3B27; height: 6px; }
  .body-card { background-color: #ffffff; border: 3px solid #1A1A1A; box-shadow: 6px 6px 0px 0px #1A1A1A; padding: 40px 40px 36px; }
  .stamp { display: inline-block; border: 2px solid #4D5431; color: #4D5431; font-size: 10px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; padding: 4px 10px; transform: rotate(-3deg); margin-bottom: 12px; }
  .email-h1 { font-size: 28px; font-weight: 900; color: #1A1A1A; margin: 0 0 16px; line-height: 1.15; }
  .email-p { font-size: 15px; color: #3d3a36; line-height: 1.65; margin: 0 0 16px; }
  .email-muted { font-size: 12px; color: #85827d; line-height: 1.5; text-align: center; }
  .cta-wrap { text-align: center; margin: 28px 0 8px; }
  .cta-btn { display: inline-block; background-color: #FF3B27; color: #ffffff !important; font-size: 15px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; padding: 14px 32px; text-decoration: none; border: 3px solid #1A1A1A; box-shadow: 4px 4px 0px 0px #1A1A1A; }
  .divider { border: none; border-top: 2px solid #e8e4d8; margin: 24px 0; }
  .mascot-band { background-color: #1A1A1A; padding: 16px; text-align: center; }
  .footer { padding: 20px 40px 0; text-align: center; }
  .footer a { color: #85827d; text-decoration: underline; }
</style>
</head>
<body>
<div class="wrapper">
  <div class="container">
    <div class="header">
      <img src="${STORE_URL}/logo-ryo.png" alt="Enrola" class="header-logo" width="160"/>
    </div>
    <div class="hero-band"></div>
    <div class="body-card">
      <div class="stamp">Seguridad</div>
      <h1 class="email-h1">Restablecer<br/>tu contraseña</h1>
      <p class="email-p">
        Recibimos una solicitud para restablecer la contraseña de tu cuenta en Club Enrola.
        Haz clic en el botón de abajo para crear una nueva.
      </p>
      <div class="cta-wrap">
        <a href="${resetUrl}" class="cta-btn">Restablecer contraseña →</a>
      </div>
      <hr class="divider"/>
      <p class="email-p">
        Si no solicitaste este cambio, ignora este correo — tu contraseña seguirá siendo la misma.
      </p>
      <p class="email-muted">
        Este enlace es válido durante 24 horas.<br/>
        Si el botón no funciona, copia y pega este enlace en tu navegador:<br/>
        <a href="${resetUrl}" style="color:#85827d;word-break:break-all;">${resetUrl}</a>
      </p>
    </div>
    <div class="mascot-band">
      <img src="${STORE_URL}/mascota-ryo-web-blanca.png" alt="" style="max-width:60px;height:auto;opacity:0.85;"/>
    </div>
    <div class="footer">
      <p style="font-size:12px;color:#85827d;margin:0 0 6px;">
        <a href="${STORE_URL}">enrola.shop</a>
      </p>
      <p style="font-size:11px;color:#b5b0a6;margin:0;">&copy; ${new Date().getFullYear()} Enrola Shop &mdash; Todos los derechos reservados</p>
    </div>
  </div>
</div>
</body>
</html>`
}

export default async function passwordResetHandler({
  event: { data },
}: SubscriberArgs<{
  entity_id?: string
  email?: string
  token: string
  actor_type?: string
}>) {
  try {
    // Medusa v2 emite `auth.password_reset` con { entity_id, token, actor_type }
    // donde entity_id es el identificador (el email, para el provider emailpass).
    // Aceptamos `email` como fallback por si la versión difiere.
    const email = data.entity_id || data.email
    const { token } = data

    if (!email || !token) {
      console.warn("[password-reset] Missing email/entity_id or token in event data:", data)
      return
    }

    const resetUrl = `${STORE_URL}/reset-password?token=${encodeURIComponent(token)}`
    const html = passwordResetEmailHtml(resetUrl)

    const sent = await sendEmail({
      to: email,
      subject: "Restablecer contraseña — Club Enrola",
      html,
    })

    if (sent) {
      console.log(`[password-reset] ✅ Reset email sent to ${email}`)
    } else {
      console.warn(`[password-reset] Failed to send reset email to ${email}`)
    }
  } catch (err) {
    console.error("[password-reset] Error:", err)
  }
}

export const config: SubscriberConfig = {
  event: "auth.password_reset",
}
