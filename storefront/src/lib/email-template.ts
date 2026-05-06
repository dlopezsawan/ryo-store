const STORE_URL = process.env.NEXT_PUBLIC_STORE_URL || "https://enrola.shop";
// PNG (not SVG) for emails — Outlook desktop and several webmail clients
// still don't render SVG inline. The user-provided PNG is 3110×551 RGBA
// (~89 KB) — left unmodified to preserve the hand-drawn wordmark quality.
// Display constrained to max-width:280px in CSS so the wordmark is legible
// on mobile (at 280px wide the logo is ~50px tall, readable).
//
// Filename pattern (`enrola-logo-mail.png`): clean URL, fresh path so any
// stale Cloudflare/Gmail proxy caches from earlier test rounds are bypassed.
const LOGO_URL = `${STORE_URL}/enrola-logo-mail.png`;
const MASCOT_URL = `${STORE_URL}/mascota-ryo-web-blanca.png`;

import { centsToDisplay } from "./price";
import { formatPrice } from "./format";

function fmtEUR(usd: number): string {
  return `€${formatPrice(usd)}`;
}

export function baseCustomerTemplate(content: string, preheader = "", accentColor = "#FF3B27"): string {
  return `<!DOCTYPE html>
<html lang="es" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta http-equiv="X-UA-Compatible" content="IE=edge"/>
<!-- Dark-mode opt-out: Gmail Mobile + Outlook auto-invert dark backgrounds
     to light, which breaks our brand colors (the dark header turns white,
     the white body card turns dark). The meta tags below + [data-ogsc]/[data-ogsb]
     selectors below force light-mode rendering. -->
<meta name="color-scheme" content="only light"/>
<meta name="supported-color-schemes" content="only light"/>
<title>Club Enrola</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link href="https://fonts.googleapis.com/css2?family=Kanit:wght@400;500;600;700;900&display=swap" rel="stylesheet"/>
<!--[if mso]>
<style>* { font-family: Arial, sans-serif !important; }</style>
<![endif]-->
<style>
  /* Force light scheme even when client UA reports dark preference. */
  :root { color-scheme: only light; supported-color-schemes: only light; }

  /* Outlook/Office365 + Gmail Mobile dark-mode override hooks.
     [data-ogsc] = Outlook generic-schema container.
     [data-ogsb] = Outlook generic-schema body.
     Without these, the dark header inverts to light and breaks contrast. */
  [data-ogsc] .header, [data-ogsb] .header { background-color: #1A1A1A !important; }
  [data-ogsc] .body-card, [data-ogsb] .body-card { background-color: #ffffff !important; color: #1A1A1A !important; }
  [data-ogsc] .h1, [data-ogsb] .h1 { color: #1A1A1A !important; }

  * { box-sizing: border-box; }
  body, #bodyTable { margin: 0; padding: 0; width: 100%; background-color: #F5F2E8; }
  body { font-family: 'Kanit', Arial, sans-serif; }
  a { color: inherit; }
  img { border: 0; display: block; }
  .wrapper { background-color: #F5F2E8; padding: 32px 16px; }
  .container { max-width: 600px; margin: 0 auto; }

  /* HEADER */
  .header { background-color: #1A1A1A !important; padding: 36px 40px 32px; text-align: center; }
  .header-logo { max-width: 280px; width: 280px; height: auto; margin: 0 auto; display: block; }

  /* HERO BAND */
  .hero-band {
    background-color: ${accentColor};
    padding: 0;
    text-align: center;
    height: 6px;
  }

  /* BODY CARD */
  .body-card {
    background-color: #ffffff;
    border: 3px solid #1A1A1A;
    box-shadow: 6px 6px 0px 0px #1A1A1A;
    padding: 40px 40px 36px;
    margin: 0 0 8px;
  }

  /* TYPOGRAPHY */
  .email-h1 {
    font-family: 'Kanit', Arial, sans-serif;
    font-size: 28px; font-weight: 900; color: #1A1A1A;
    margin: 0 0 16px; line-height: 1.15; letter-spacing: -0.5px;
  }
  .email-h2 {
    font-family: 'Kanit', Arial, sans-serif;
    font-size: 18px; font-weight: 700; color: #1A1A1A;
    margin: 24px 0 12px;
  }
  .email-p {
    font-family: 'Kanit', Arial, sans-serif;
    font-size: 15px; font-weight: 400; color: #3d3a36;
    line-height: 1.65; margin: 0 0 16px;
  }
  .email-muted {
    font-family: 'Kanit', Arial, sans-serif;
    font-size: 12px; color: #85827d; line-height: 1.5;
  }
  .email-ul {
    font-family: 'Kanit', Arial, sans-serif;
    font-size: 15px; color: #3d3a36;
    line-height: 1.8; padding-left: 22px; margin: 0 0 16px;
  }

  /* CTA BUTTON */
  .cta-wrap { text-align: center; margin: 28px 0 8px; }
  .cta-btn {
    display: inline-block;
    background-color: ${accentColor};
    color: #ffffff !important;
    font-family: 'Kanit', Arial, sans-serif;
    font-size: 15px; font-weight: 700;
    letter-spacing: 0.5px; text-transform: uppercase;
    padding: 14px 32px;
    text-decoration: none;
    border: 3px solid #1A1A1A;
    box-shadow: 4px 4px 0px 0px #1A1A1A;
  }

  /* ORDER TABLE */
  .order-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
  .order-table td { padding: 10px 0; border-bottom: 1px solid #e8e4d8; }
  .order-item-name {
    font-family: 'Kanit', Arial, sans-serif;
    font-size: 14px; font-weight: 600; color: #1A1A1A;
  }
  .order-item-qty {
    font-family: 'Kanit', Arial, sans-serif;
    font-size: 13px; color: #85827d;
  }
  .order-price {
    font-family: 'Kanit', Arial, sans-serif;
    font-size: 15px; font-weight: 700; color: ${accentColor};
    text-align: right; white-space: nowrap;
  }
  .order-total-label {
    font-family: 'Kanit', Arial, sans-serif;
    font-size: 14px; font-weight: 700; color: #1A1A1A;
  }
  .order-total-price {
    font-family: 'Kanit', Arial, sans-serif;
    font-size: 16px; font-weight: 900; color: #1A1A1A;
    text-align: right;
  }

  /* REWARDS TABLE */
  .rewards-table { width: 100%; border-collapse: collapse; margin: 10px 0 20px; }
  .rewards-table td { padding: 6px 0; }

  /* DIVIDER */
  .divider { border: none; border-top: 2px solid #e8e4d8; margin: 24px 0; }

  /* MASCOT SECTION */
  .mascot-band {
    background-color: #1A1A1A;
    padding: 16px; text-align: center;
  }
  .mascot-img { max-width: 60px; height: auto; opacity: 0.85; display: inline-block; }

  /* FOOTER */
  .footer { padding: 20px 40px 0; text-align: center; }
  .footer-links {
    font-family: 'Kanit', Arial, sans-serif;
    font-size: 12px; color: #85827d; margin: 0 0 6px;
  }
  .footer-links a { color: #85827d; text-decoration: underline; }
  .footer-copy {
    font-family: 'Kanit', Arial, sans-serif;
    font-size: 11px; color: #b5b0a6; margin: 0;
  }

  /* VINTAGE STAMP */
  .stamp {
    display: inline-block;
    border: 2px solid #4D5431;
    color: #4D5431;
    font-family: 'Kanit', Arial, sans-serif;
    font-size: 10px; font-weight: 700; letter-spacing: 2px;
    text-transform: uppercase;
    padding: 4px 10px;
    transform: rotate(-3deg);
    margin-bottom: 12px;
  }

  @media (max-width: 600px) {
    .body-card { padding: 28px 24px; }
    .header { padding: 24px; }
    .footer { padding: 20px 24px 0; }
    .email-h1 { font-size: 24px; }
  }
</style>
</head>
<body>
${preheader ? `<div style="display:none;max-height:0;overflow:hidden;font-size:1px;color:#F5F2E8;">${preheader}&nbsp;&zwnj;&nbsp;</div>` : ""}
<table id="bodyTable" width="100%" cellpadding="0" cellspacing="0" role="presentation">
<tr><td>
<div class="wrapper">
  <div class="container">
    <!-- Header on a table with bgcolor inline (not just CSS) so Outlook
         + Gmail Mobile dark-mode auto-invert can't flip it to light.
         Logo width=280 matches .header-logo CSS rule (legible on mobile). -->
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="#1A1A1A" style="background-color:#1A1A1A;">
      <tr>
        <td bgcolor="#1A1A1A" align="center" class="header" style="background-color:#1A1A1A;padding:36px 40px 32px;text-align:center;">
          <img src="${LOGO_URL}" alt="Enrola" class="header-logo" width="280" style="display:block;margin:0 auto;max-width:280px;height:auto;border:0;"/>
        </td>
      </tr>
    </table>
    <div class="hero-band"></div>
    <div class="body-card">
      ${content}
    </div>
    <div class="mascot-band">
      <img src="${MASCOT_URL}" alt="Mascota Enrola" class="mascot-img" />
    </div>
    <div class="footer">
      <p class="footer-links">
        <a href="${STORE_URL}">enrola.shop</a>
      </p>
      <p class="footer-copy">&copy; ${new Date().getFullYear()} Enrola Shop &mdash; Barcelona &mdash; Todos los derechos reservados</p>
    </div>
  </div>
</div>
</td></tr>
</table>
</body>
</html>`;
}

export function customerOrderConfirmationEmailHtml(
  customerName: string,
  orderNumber: string,
  items: Array<{ title?: string; product_title?: string; variant_title?: string; quantity?: number; unit_price?: number }>,
  shippingTotalUSD: number,
  totalUSD: number,
  totalBS: string | null,
  redeemedRewards: Array<{ name: string; points_required: number }>
): string {
  const firstName = customerName.split(" ")[0] || "Cliente";

  const itemRows = items
    .map((item) => {
      const name = `${item.title ?? item.product_title ?? "Producto"}${item.variant_title ? ` — ${item.variant_title}` : ""}`;
      const qty = item.quantity ?? 1;
      const lineUSD = ((item.unit_price ?? 0) * qty);
      
      return `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #e8e4d8;width:100%">
          <div class="order-item-name">${name}</div>
          <div class="order-item-qty">Cantidad: ${qty}</div>
        </td>
        <td class="order-price" style="padding:10px 0;border-bottom:1px solid #e8e4d8;vertical-align:top;white-space:nowrap;">
          ${fmtEUR(lineUSD)}
        </td>
      </tr>`;
    })
    .join("");

  const shippingRow = shippingTotalUSD > 0
    ? `<tr>
        <td class="order-total-label" style="padding:8px 0 0;font-weight:400;color:#85827d;">Envío</td>
        <td style="padding:8px 0 0;text-align:right;font-family:'Kanit',Arial,sans-serif;font-size:14px;color:#85827d;">${fmtEUR(shippingTotalUSD)}</td>
      </tr>`
    : `<tr>
        <td class="order-total-label" style="padding:8px 0 0;font-weight:400;color:#85827d;">Envío</td>
        <td style="padding:8px 0 0;text-align:right;font-family:'Kanit',Arial,sans-serif;font-size:14px;color:#85827d;">Gratis</td>
      </tr>`;

  const bsRow = totalBS
    ? `<tr>
        <td colspan="2" style="text-align:right;padding-top:8px;">
          <span style="font-family:'Kanit',Arial,sans-serif;font-size:13px;color:#85827d;">&approx; ${totalBS}</span>
        </td>
       </tr>`
    : "";

  let rewardsSection = "";
  if (redeemedRewards && redeemedRewards.length > 0) {
    const rewardsList = redeemedRewards.map(r => `
      <tr>
        <td style="font-family:'Kanit',Arial,sans-serif;font-size:14px;color:#3d3a36;">🎁 ${r.name}</td>
        <td style="font-family:'Kanit',Arial,sans-serif;font-size:13px;color:#85827d;text-align:right;">(-${r.points_required} pts)</td>
      </tr>
    `).join("");

    rewardsSection = `
      <h2 class="email-h2" style="margin-top: 32px">Recompensas Club Enrola Canjeadas</h2>
      <table class="rewards-table">
        <tbody>${rewardsList}</tbody>
      </table>
    `;
  }

  return baseCustomerTemplate(
    `
    <div class="stamp">Pedido confirmado</div>
    <h1 class="email-h1">¡Gracias,<br/>${firstName}!</h1>
    <p class="email-p">
      Tu pedido <strong>${orderNumber}</strong> ha sido recibido y está siendo preparado.
      Te avisaremos apenas confirmemos el pago.
    </p>

    <h2 class="email-h2">Resumen del pedido</h2>
    <table class="order-table">
      <tbody>${itemRows}</tbody>
      <tfoot>
        ${shippingRow}
        <tr>
          <td class="order-total-label" style="padding:12px 0 0;border-top:2px solid #1A1A1A;">Total</td>
          <td class="order-total-price" style="padding:12px 0 0;border-top:2px solid #1A1A1A;">${fmtEUR(totalUSD)}</td>
        </tr>
        ${bsRow}
      </tfoot>
    </table>

    ${rewardsSection}

    <div class="cta-wrap">
      <a href="${STORE_URL}/cuenta/orders" class="cta-btn">Ver mi historial de pedidos →</a>
    </div>

    <hr class="divider"/>

    <p class="email-p" style="text-align:center;">
      ¿Alguna pregunta sobre tu pedido? Responde directamente a este email
      y te atendemos enseguida.
    </p>
    <p class="email-muted" style="text-align:center;">
      Club Enrola &mdash; Barcelona &mdash; <a href="${STORE_URL}" style="color:#85827d;">enrola.shop</a>
    </p>
    `,
    `Tu pedido ${orderNumber} fue recibido correctamente — gracias por tu compra en Enrola`
  );
}
