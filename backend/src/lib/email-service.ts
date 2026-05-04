/**
 * Email service using Resend REST API
 * Visual identity: Enrola Shop — vintage/artisanal aesthetic
 * Colors: cream #F5F2E8 · crimson #BB3B2E · olive #4D5431 · dark #1A1A1A
 * Font: Kanit (Google Fonts)
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY || ""
const FROM_EMAIL = process.env.CONTACT_EMAIL || "hola@enrola.shop"
const FROM_NAME = "Club Enrola"
const STORE_URL = process.env.STORE_URL || "https://enrola.shop"

const LOGO_URL = `${STORE_URL}/logo-ryo.png`
const MASCOT_URL = `${STORE_URL}/mascota-ryo-web-blanca.png`

// ─── UTM tracking helper ────────────────────────────────────────────────────
// Appends utm_source=remarketing&utm_campaign=<name> to a URL. If the URL
// already has a query string, appends with `&`. Existing utm_* params are kept.
export function withUtm(url: string, campaign: string, medium: string = "email"): string {
  if (!url || !url.startsWith("http")) return url
  if (url.includes("utm_source=")) return url
  const sep = url.includes("?") ? "&" : "?"
  return `${url}${sep}utm_source=remarketing&utm_medium=${encodeURIComponent(medium)}&utm_campaign=${encodeURIComponent(campaign)}`
}

interface EmailAttachment {
  filename: string
  content: Buffer | string
  contentType?: string
}

interface EmailPayload {
  to: string
  subject: string
  html: string
  replyTo?: string
  // Optional override of the default sender name for transactional segments
  // (e.g. finanzas reports use "Enrola Finanzas" while customer-facing
  // emails stick with the default "Club Enrola"). Falls back to FROM_NAME.
  fromName?: string
  // Resend supports attachments as an array of { filename, content }.
  // Buffers are base64-encoded inline; strings are passed through as text.
  attachments?: EmailAttachment[]
}

export async function sendEmail(payload: EmailPayload): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.warn("[email-service] RESEND_API_KEY not set — skipping email to", payload.to)
    return false
  }
  try {
    const senderName = payload.fromName || FROM_NAME
    const body: Record<string, unknown> = {
      from: `${senderName} <${FROM_EMAIL}>`,
      to: [payload.to],
      subject: payload.subject,
      html: payload.html,
      reply_to: payload.replyTo || FROM_EMAIL,
    }
    if (payload.attachments?.length) {
      body.attachments = payload.attachments.map((a) => ({
        filename: a.filename,
        content: Buffer.isBuffer(a.content) ? a.content.toString("base64") : a.content,
        ...(a.contentType ? { content_type: a.contentType } : {}),
      }))
    }
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const err = await res.text()
      console.error("[email-service] Resend error:", res.status, err)
      return false
    }
    console.log("[email-service] ✅ Email sent to", payload.to, "—", payload.subject)
    return true
  } catch (err) {
    console.error("[email-service] fetch error:", err)
    return false
  }
}

// ─── Base Template ─────────────────────────────────────────────────────────────

function baseTemplate(content: string, preheader = "", accentColor = "#FF3B27"): string {
  return `<!DOCTYPE html>
<html lang="es" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta http-equiv="X-UA-Compatible" content="IE=edge"/>
<title>Club Enrola</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link href="https://fonts.googleapis.com/css2?family=Kanit:wght@400;500;600;700;900&display=swap" rel="stylesheet"/>
<!--[if mso]>
<style>* { font-family: Arial, sans-serif !important; }</style>
<![endif]-->
<style>
  * { box-sizing: border-box; }
  body, #bodyTable { margin: 0; padding: 0; width: 100%; background-color: #F5F2E8; }
  body { font-family: 'Kanit', Arial, sans-serif; }
  a { color: inherit; }
  img { border: 0; display: block; }
  .wrapper { background-color: #F5F2E8; padding: 32px 16px; }
  .container { max-width: 600px; margin: 0 auto; }

  /* HEADER */
  .header { background-color: #1A1A1A; padding: 36px 40px 32px; text-align: center; }
  .header-logo { max-width: 160px; height: auto; margin: 0 auto; display: block; }

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

  /* DISCOUNT BOX */
  .discount-box {
    background-color: #F5F2E8;
    border: 3px solid #1A1A1A;
    box-shadow: 5px 5px 0px 0px #1A1A1A;
    padding: 24px 20px 20px;
    text-align: center;
    margin: 24px 0;
  }
  .discount-label-top {
    font-family: 'Kanit', Arial, sans-serif;
    font-size: 11px; font-weight: 600; letter-spacing: 3px;
    text-transform: uppercase; color: #85827d; margin: 0 0 10px;
  }
  .discount-code {
    font-family: 'Kanit', Arial, sans-serif;
    font-size: 36px; font-weight: 900; color: ${accentColor};
    letter-spacing: 5px; line-height: 1; margin: 0 0 10px;
  }
  .discount-desc {
    font-family: 'Kanit', Arial, sans-serif;
    font-size: 13px; font-weight: 500; color: #4D5431;
    margin: 0;
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

  /* DIVIDER */
  .divider { border: none; border-top: 2px solid #e8e4d8; margin: 24px 0; }

  /* MASCOT SECTION */
  .mascot-band {
    background-color: #1A1A1A;
    padding: 16px; text-align: center;
  }
  .mascot-img { max-width: 60px; height: auto; opacity: 0.85; }

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
    .discount-code { font-size: 28px; }
  }
</style>
</head>
<body>
${preheader ? `<div style="display:none;max-height:0;overflow:hidden;font-size:1px;color:#F5F2E8;">${preheader}&nbsp;&zwnj;&nbsp;</div>` : ""}
<table id="bodyTable" width="100%" cellpadding="0" cellspacing="0" role="presentation">
<tr><td>
<div class="wrapper">
  <div class="container">

    <!-- HEADER -->
    <div class="header">
      <img src="${LOGO_URL}" alt="Enrola" class="header-logo" width="160"/>
    </div>

    <!-- RED BAND -->
    <div class="hero-band"></div>

    <!-- BODY CARD -->
    <div class="body-card">
      ${content}
    </div>

    <!-- MASCOT FOOTER BAND -->
    <div class="mascot-band">
      <img src="${MASCOT_URL}" alt="" class="mascot-img"/>
    </div>

    <!-- FOOTER -->
    <div class="footer">
      <p class="footer-links">
        <a href="${STORE_URL}">enrola.shop</a> &nbsp;&bull;&nbsp;
        <a href="${STORE_URL}/newsletter/unsubscribe">Cancelar suscripción</a>
      </p>
      <p class="footer-copy">&copy; ${new Date().getFullYear()} Enrola Shop &mdash; Barcelona &mdash; Todos los derechos reservados</p>
    </div>

  </div>
</div>
</td></tr>
</table>
</body>
</html>`
}

// ─── Email Templates ──────────────────────────────────────────────────────────

export function welcomeEmailHtml(customerName: string): string {
  const firstName = customerName.split(" ")[0]
  return baseTemplate(
    `
    <div class="stamp">Nuevo miembro</div>
    <h1 class="email-h1">Bienvenido/a al Club,<br/>${firstName}.</h1>
    <p class="email-p">
      Nos alegra tenerte aquí. Enrola es más que una tienda — es una comunidad
      de aficionados al tabaco artesanal que valoran la calidad, el ritual y la autenticidad.
    </p>
    <p class="email-p">Lo que te espera en el club:</p>
    <ul class="email-ul">
      <li>Selección curada de tabacos de hebra y mezclas exclusivas</li>
      <li>Papeles, filtros y accesorios premium</li>
      <li>Programa de puntos <strong>Club Enrola</strong></li>
      <li>Ofertas y ediciones limitadas para miembros</li>
    </ul>
    <div class="cta-wrap">
      <a href="${withUtm(STORE_URL, "welcome")}" class="cta-btn">Explorar la tienda →</a>
    </div>
    <hr class="divider"/>
    <p class="email-muted" style="text-align:center;">
      ¿Tienes dudas? Responde a este email y te ayudamos enseguida.
    </p>
    `,
    `Bienvenido/a al Club Enrola — explora nuestra selección artesanal`
  )
}

export function abandonedCartEmailHtml(
  customerName: string,
  items: Array<{ title: string; quantity: number; unit_price: number; thumbnail?: string }>,
  cartTotal: number,
  cartUrl: string
): string {
  const firstName = customerName.split(" ")[0]

  const itemRows = items
    .map(
      (item) => `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #e8e4d8;width:100%">
          <div class="order-item-name">${item.title}</div>
          <div class="order-item-qty">Cantidad: ${item.quantity}</div>
        </td>
        <td class="order-price" style="padding:10px 0;border-bottom:1px solid #e8e4d8;vertical-align:top;white-space:nowrap;">
          &euro;${(item.unit_price * item.quantity).toFixed(2)}
        </td>
      </tr>`
    )
    .join("")

  return baseTemplate(
    `
    <div class="stamp">Carrito pendiente</div>
    <h1 class="email-h1">Oye ${firstName},<br/>dejaste algo aquí.</h1>
    <p class="email-p">
      Tienes artículos esperándote en el carrito. Completa tu pedido antes de que se agoten.
    </p>

    <table class="order-table">
      <tbody>${itemRows}</tbody>
      <tfoot>
        <tr>
          <td class="order-total-label" style="padding:12px 0 0;">Total</td>
          <td class="order-total-price" style="padding:12px 0 0;">&euro;${Number(cartTotal).toFixed(2)}</td>
        </tr>
      </tfoot>
    </table>

    <div class="cta-wrap">
      <a href="${withUtm(cartUrl, "abandoned_cart")}" class="cta-btn">Recuperar mi carrito →</a>
    </div>

    <p class="email-muted" style="text-align:center;margin-top:16px;">
      El carrito se guarda durante 48 horas. Si tienes dudas sobre algún producto, responde a este email.
    </p>
    `,
    `Tienes artículos esperando en tu carrito de Enrola`
  )
}

export function birthdayEmailHtml(customerName: string, discountCode: string, discountPercent: number): string {
  const firstName = customerName.split(" ")[0]
  return baseTemplate(
    `
    <div style="text-align:center;margin-bottom:8px;">
      <span style="font-size:48px;">🎂</span>
    </div>
    <h1 class="email-h1" style="text-align:center;">
      ¡Feliz cumple,<br/>${firstName}!
    </h1>
    <p class="email-p" style="text-align:center;">
      Hoy es tu día y en el Club Enrola lo celebramos contigo.<br/>
      Aquí tienes tu regalo — un descuento exclusivo en toda la tienda.
    </p>

    <div class="discount-box">
      <p class="discount-label-top">Tu código de cumpleaños</p>
      <p class="discount-code">${discountCode}</p>
      <p class="discount-desc">${discountPercent}% de descuento en toda la tienda · Válido 48 horas</p>
    </div>

    <div class="cta-wrap">
      <a href="${withUtm(STORE_URL, "birthday")}" class="cta-btn">Usar mi regalo 🎁</a>
    </div>

    <p class="email-muted" style="text-align:center;margin-top:16px;">
      Un código por pedido. Válido durante 48 horas desde hoy.
    </p>
    `,
    `¡Feliz cumpleaños! Tu regalo especial de Enrola te espera`
  )
}

export function winBackEmailHtml(
  customerName: string,
  discountCode: string,
  discountPercent: number,
  daysSincePurchase: number
): string {
  const firstName = customerName.split(" ")[0]
  const months = Math.round(daysSincePurchase / 30)
  const timeText = months >= 2 ? `hace ${months} meses` : `hace más de un mes`

  return baseTemplate(
    `
    <div class="stamp">Te echamos de menos</div>
    <h1 class="email-h1">Oye ${firstName},<br/>¿sigues por ahí?</h1>
    <p class="email-p">
      Tu último pedido fue ${timeText} y queremos verte por aquí de nuevo.
      Hemos renovado el catálogo con novedades que te van a gustar.
    </p>
    <p class="email-p">
      Como muestra de que te echamos de menos, aquí tienes un descuento especial
      <strong>exclusivo para ti</strong>:
    </p>

    <div class="discount-box">
      <p class="discount-label-top">Descuento exclusivo</p>
      <p class="discount-code">${discountCode}</p>
      <p class="discount-desc">${discountPercent}% de descuento · Válido durante 7 días</p>
    </div>

    <div class="cta-wrap">
      <a href="${withUtm(STORE_URL, "win_back")}" class="cta-btn">Ver las novedades →</a>
    </div>

    <p class="email-muted" style="text-align:center;margin-top:16px;">
      Código válido durante 7 días desde hoy. Un código por pedido.
    </p>
    `,
    `Te echamos de menos — aquí tienes un descuento exclusivo de Enrola`,
    "#4D5431"
  )
}

export function orderConfirmationEmailHtml(
  customerName: string,
  orderNumber: string,
  items: Array<{ title: string; quantity: number; unit_price: number }>,
  subtotal: number,
  shippingTotal: number,
  total: number,
  // Optional discount block — when a Combo/Wholesale code applied we show a
  // dedicated row before the total. Both fields are optional so existing
  // callers without a discount don't need to pass null.
  discountTotal?: number,
  discountLabel?: string | null,
): string {
  const firstName = customerName.split(" ")[0]

  const itemRows = items
    .map(
      (item) => `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #e8e4d8;width:100%">
          <div class="order-item-name">${item.title}</div>
          <div class="order-item-qty">Cantidad: ${item.quantity}</div>
        </td>
        <td class="order-price" style="padding:10px 0;border-bottom:1px solid #e8e4d8;vertical-align:top;white-space:nowrap;">
          &euro;${(item.unit_price * item.quantity).toFixed(2)}
        </td>
      </tr>`
    )
    .join("")

  const shippingRow = shippingTotal > 0
    ? `<tr>
        <td class="order-total-label" style="padding:8px 0 0;font-weight:400;color:#85827d;">Envío</td>
        <td style="padding:8px 0 0;text-align:right;font-family:'Kanit',Arial,sans-serif;font-size:14px;color:#85827d;">&euro;${Number(shippingTotal).toFixed(2)}</td>
      </tr>`
    : ""

  const discountRow = (discountTotal && discountTotal > 0)
    ? `<tr>
        <td class="order-total-label" style="padding:8px 0 0;font-weight:400;color:#4D5431;">
          Descuento${discountLabel ? ` · ${discountLabel}` : ""}
        </td>
        <td style="padding:8px 0 0;text-align:right;font-family:'Kanit',Arial,sans-serif;font-size:14px;color:#4D5431;">−&euro;${Number(discountTotal).toFixed(2)}</td>
      </tr>`
    : ""

  return baseTemplate(
    `
    <div class="stamp">Pedido confirmado</div>
    <h1 class="email-h1">¡Gracias,<br/>${firstName}!</h1>
    <p class="email-p">
      Tu pedido <strong>#${orderNumber}</strong> ha sido recibido y está siendo preparado.
      Te avisaremos cuando salga de nuestro almacén.
    </p>

    <h2 class="email-h2">Resumen del pedido</h2>
    <table class="order-table">
      <tbody>${itemRows}</tbody>
      <tfoot>
        ${shippingRow}
        ${discountRow}
        <tr>
          <td class="order-total-label" style="padding:12px 0 0;border-top:2px solid #1A1A1A;">Total</td>
          <td class="order-total-price" style="padding:12px 0 0;border-top:2px solid #1A1A1A;">&euro;${Number(total).toFixed(2)}</td>
        </tr>
      </tfoot>
    </table>

    <div class="cta-wrap">
      <a href="${STORE_URL}/account/orders" class="cta-btn">Ver mi pedido →</a>
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
    `Pedido #${orderNumber} confirmado — gracias por tu compra en Enrola`
  )
}

export function restockEmailHtml(
  customerName: string,
  productTitle: string,
  productUrl: string,
  crossSellProducts: Array<{ title: string; url: string }> = []
): string {
  const firstName = customerName.split(" ")[0]

  const crossSellSection = crossSellProducts.length > 0
    ? `
    <hr class="divider"/>
    <h2 class="email-h2">TAMBIÉN TE PUEDE INTERESAR</h2>
    <table style="width:100%;border-collapse:collapse;">
      ${crossSellProducts.map(p => `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #e8e4d8;">
          <a href="${withUtm(p.url, "restock_crosssell")}" style="font-family:'Kanit',Arial,sans-serif;font-size:15px;font-weight:600;color:#BB3B2E;text-decoration:none;">${p.title} →</a>
        </td>
      </tr>`).join("")}
    </table>
    ` : ""

  return baseTemplate(
    `
    <div class="stamp">Recordatorio de restock</div>
    <h1 class="email-h1">¿Ya se te acabó,<br/>${firstName}?</h1>
    <p class="email-p">
      Ha pasado un tiempo desde que pediste <strong>${productTitle}</strong>.
      Si ya se te está terminando, este es el momento perfecto para reponer.
    </p>
    <p class="email-p">
      No te quedes sin tu favorito — tenemos stock disponible ahora mismo.
    </p>

    <div class="cta-wrap">
      <a href="${withUtm(productUrl, "restock")}" class="cta-btn">COMPRAR DE NUEVO →</a>
    </div>

    ${crossSellSection}

    <p class="email-muted" style="text-align:center;margin-top:24px;">
      ¿Ya tienes suficiente? Ignora este email. Seguiremos aquí cuando lo necesites.
    </p>
    `,
    `¿Ya se te acabó ${productTitle}? Repón tu stock en Enrola`,
    "#BB3B2E"
  )
}

export function postPurchaseEmailHtml(
  customerName: string,
  orderNumber: string,
  items: Array<{ title: string; quantity: number }>
): string {
  const firstName = customerName.split(" ")[0]
  const itemsList = items
    .map(
      (i) => `
      <tr>
        <td class="order-item-name" style="padding:8px 0;border-bottom:1px solid #e8e4d8;">${i.title}</td>
        <td class="order-item-qty" style="padding:8px 0;border-bottom:1px solid #e8e4d8;text-align:right;">&times;${i.quantity}</td>
      </tr>`
    )
    .join("")

  return baseTemplate(
    `
    <div class="stamp">Post-compra</div>
    <h1 class="email-h1">¿Cómo te fue,<br/>${firstName}?</h1>
    <p class="email-p">
      Han pasado unos días desde tu pedido <strong>#${orderNumber}</strong>
      y queremos asegurarnos de que todo llegó en perfecto estado.
    </p>

    <table class="order-table">
      <tbody>${itemsList}</tbody>
    </table>

    <p class="email-p">
      Si algo no está a tu gusto o tienes cualquier duda, responde directamente
      a este email. Estamos aquí.
    </p>

    <hr class="divider"/>

    <h2 class="email-h2">¿Te gustó la experiencia?</h2>
    <p class="email-p">
      Tu opinión nos ayuda a mejorar y a que otros amantes del tabaco artesanal
      descubran Enrola. ¡Cuéntanos!
    </p>

    <div class="cta-wrap">
      <a href="${withUtm(STORE_URL + "/account/orders", "post_purchase")}" class="cta-btn">Ver mis pedidos →</a>
    </div>
    `,
    `¿Cómo fue tu experiencia con el pedido #${orderNumber}?`,
    "#4D5431"
  )
}

export function stockoutAlertEmailHtml(
  customerName: string,
  productTitle: string,
  productUrl: string,
  daysOfCover: number
): string {
  const firstName = customerName.split(" ")[0]
  const timePhrase = daysOfCover < 3
    ? "se agota en pocos días"
    : daysOfCover < 7
      ? `aproximadamente ${daysOfCover} días de stock`
      : "está quedando poco stock"
  return baseTemplate(
    `
    <div class="stamp">Último stock</div>
    <h1 class="email-h1">Aviso,<br/>${firstName}.</h1>
    <p class="email-p">
      Tu <strong>${productTitle}</strong> ${timePhrase}. Como ya lo pediste antes,
      quisimos avisarte para que repongas antes de que se agote.
    </p>
    <div class="cta-wrap">
      <a href="${withUtm(productUrl, "stockout_alert")}" class="cta-btn">Asegurar mi stock →</a>
    </div>
    <p class="email-muted" style="text-align:center;margin-top:16px;">
      Si no lo necesitas todavía, ignorá este aviso — no volvemos a avisarte de este producto en 30 días.
    </p>
    `,
    `⚠ Último stock de ${productTitle} en Enrola`,
    "#BB3B2E"
  )
}

export function pendingPaymentEmailHtml(
  customerName: string,
  orderNumber: string,
  total: number,
  hoursAgo: number
): string {
  const firstName = customerName.split(" ")[0]
  return baseTemplate(
    `
    <div class="stamp">Pago pendiente</div>
    <h1 class="email-h1">Hola ${firstName},<br/>tu pedido espera confirmación.</h1>
    <p class="email-p">
      Recibimos tu pedido <strong>#${orderNumber}</strong> hace ${Math.round(hoursAgo)} horas
      pero aún no hemos confirmado el pago.
    </p>
    <p class="email-p">
      Total: <strong>€${Number(total).toFixed(2)}</strong>
    </p>
    <p class="email-p">
      Si ya hiciste la transferencia, déjanos el comprobante respondiendo a este email
      y procesamos tu pedido enseguida. Si tuviste algún problema, también estamos acá para ayudarte.
    </p>
    <div class="cta-wrap">
      <a href="${withUtm(STORE_URL + "/account/orders", "pending_payment")}" class="cta-btn">Ver mi pedido →</a>
    </div>
    <p class="email-muted" style="text-align:center;margin-top:16px;">
      Si no procesas el pago en 48h, el pedido se cancela automáticamente.
    </p>
    `,
    `Tu pedido #${orderNumber} espera confirmación de pago`,
    "#BB3B2E"
  )
}

export function graduationEmailHtml(
  customerName: string,
  discountCode: string,
  discountPercent: number
): string {
  const firstName = customerName.split(" ")[0]
  return baseTemplate(
    `
    <div class="stamp">Solo online</div>
    <h1 class="email-h1">¡Seguí pidiendo,<br/>${firstName}!</h1>
    <p class="email-p">
      Nos alegra haberte atendido por chat. Para tu próxima compra te preparamos algo
      especial: un descuento <strong>exclusivo para el sitio web</strong>, más rápido y sin esperas.
    </p>

    <div class="discount-box">
      <p class="discount-label-top">Tu descuento web</p>
      <p class="discount-code">${discountCode}</p>
      <p class="discount-desc">${discountPercent}% off · Válido 14 días · Solo en enrola.shop</p>
    </div>

    <div class="cta-wrap">
      <a href="${withUtm(STORE_URL, "graduation")}" class="cta-btn">Pedir en la web →</a>
    </div>

    <p class="email-muted" style="text-align:center;margin-top:16px;">
      Código válido una sola vez, durante 14 días desde hoy, solo en la tienda web.
    </p>
    `,
    `Tu descuento exclusivo en enrola.shop`,
    "#4D5431"
  )
}

export function orderShippedEmailHtml(customerName: string, orderNumber: string): string {
  const firstName = customerName.split(" ")[0]
  return baseTemplate(
    `
    <div class="stamp">Pedido enviado</div>
    <h1 class="email-h1">¡En camino,<br/>${firstName}!</h1>
    <p class="email-p">
      Tu pedido <strong>#${orderNumber}</strong> acaba de salir de nuestro almacén.
      En breve lo tendrás contigo.
    </p>
    <p class="email-p">
      Si tienes cualquier duda sobre la entrega, responde a este email y te ayudamos.
    </p>
    <div class="cta-wrap">
      <a href="${withUtm(STORE_URL + "/account/orders", "order_shipped")}" class="cta-btn">Ver mi pedido →</a>
    </div>
    `,
    `Tu pedido #${orderNumber} está en camino`,
    "#4D5431"
  )
}

/**
 * MRW: paquete listo para retirar en agencia destino.
 * Disparado cuando el operador marca "Llegó a agencia" en el admin.
 */
export function mrwArrivedEmailHtml(
  customerName: string,
  orderNumber: string,
  trackingNumber: string | null,
  agencyName: string | null,
): string {
  const firstName = customerName.split(" ")[0]
  const trackingLine = trackingNumber
    ? `<p class="email-p" style="margin-top:0;"><strong>Número de guía:</strong> <span style="font-family:'Kanit',monospace;letter-spacing:1px;">${trackingNumber}</span></p>`
    : ""
  const agencyLine = agencyName
    ? `<p class="email-p" style="margin-top:0;"><strong>Agencia destino:</strong> ${agencyName}</p>`
    : ""
  return baseTemplate(
    `
    <div class="stamp">Listo para retirar</div>
    <h1 class="email-h1">¡Llegó a tu MRW,<br/>${firstName}!</h1>
    <p class="email-p">
      Tu pedido <strong>#${orderNumber}</strong> ya está en la oficina MRW de destino,
      esperándote para que lo retires.
    </p>
    ${agencyLine}
    ${trackingLine}
    <h2 class="email-h2">Para retirarlo necesitás</h2>
    <ul class="email-ul">
      <li>Tu cédula o documento de identidad</li>
      <li>El número de guía (arriba ☝)</li>
    </ul>
    <p class="email-p">
      Recordá que MRW guarda los paquetes <strong>hasta 15 días</strong> antes de devolverlos.
      Acercate cuanto antes para asegurar tu pedido.
    </p>
    <div class="cta-wrap">
      <a href="${withUtm(STORE_URL + "/account/orders", "mrw_arrived")}" class="cta-btn">Ver mi pedido →</a>
    </div>
    <p class="email-muted" style="text-align:center;margin-top:16px;">
      ¿Algún problema en la oficina? Respondé a este email y te ayudamos.
    </p>
    `,
    `Tu pedido #${orderNumber} llegó a la oficina MRW — listo para retirar`,
    "#4D5431"
  )
}

/**
 * MRW: el cliente confirmó retiro en agencia (operador marca "Entregado").
 * Mensaje de cierre + invitación a próxima compra.
 */
export function mrwDeliveredEmailHtml(
  customerName: string,
  orderNumber: string,
): string {
  const firstName = customerName.split(" ")[0]
  return baseTemplate(
    `
    <div class="stamp">Pedido entregado</div>
    <h1 class="email-h1">¡Gracias,<br/>${firstName}!</h1>
    <p class="email-p">
      Confirmamos que retiraste tu pedido <strong>#${orderNumber}</strong> en MRW.
      Esperamos que disfrutes cada detalle.
    </p>
    <hr class="divider"/>
    <h2 class="email-h2">¿Cómo te fue?</h2>
    <p class="email-p">
      Si te gustó el producto, contanos respondiendo a este email — leemos cada uno y nos
      ayuda a mejorar para vos y para la comunidad.
    </p>
    <div class="cta-wrap">
      <a href="${withUtm(STORE_URL, "mrw_delivered")}" class="cta-btn">Volver a comprar →</a>
    </div>
    <p class="email-muted" style="text-align:center;margin-top:16px;">
      Club Enrola &mdash; Barcelona / Valencia &mdash; <a href="${STORE_URL}" style="color:#85827d;">enrola.shop</a>
    </p>
    `,
    `Pedido #${orderNumber} entregado — ¡gracias por tu compra!`,
    "#4D5431"
  )
}

export function orderDeliveredEmailHtml(customerName: string, orderNumber: string): string {
  const firstName = customerName.split(" ")[0]
  return baseTemplate(
    `
    <div class="stamp">Pedido entregado</div>
    <h1 class="email-h1">¡Llegó,<br/>${firstName}!</h1>
    <p class="email-p">
      Tu pedido <strong>#${orderNumber}</strong> ha sido entregado.
      Esperamos que disfrutes cada detalle.
    </p>
    <hr class="divider"/>
    <p class="email-p" style="text-align:center;">
      ¿Todo llegó perfecto? Cuéntanos tu experiencia respondiendo a este email
      o deja tu reseña en la tienda.
    </p>
    <div class="cta-wrap">
      <a href="${withUtm(STORE_URL + "/account/orders", "order_delivered")}" class="cta-btn">Ver mi pedido →</a>
    </div>
    `,
    `Pedido #${orderNumber} entregado — ¡gracias!`,
    "#4D5431"
  )
}
