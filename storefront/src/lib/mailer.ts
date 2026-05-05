/**
 * Shared Resend email sender.
 * Env vars: RESEND_API_KEY, SMTP_FROM (optional override for from address)
 */
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY || "");

export const FROM_PEDIDOS =
  process.env.SMTP_FROM_PEDIDOS || "Enrola Shop <pedidos@enrola.shop>";

export const FROM_HOLA =
  process.env.SMTP_FROM_HOLA || "Enrola Shop <hola@enrola.shop>";

// Default from kept for backwards compatibility
export const SMTP_FROM = FROM_HOLA;

export async function sendMail(options: {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
  from?: string;
}) {
  return resend.emails.send({
    from: options.from ?? FROM_HOLA,
    to: options.to,
    subject: options.subject,
    html: options.html,
    ...(options.replyTo ? { replyTo: options.replyTo } : {}),
  });
}
