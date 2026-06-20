import { NextRequest, NextResponse } from "next/server";
import { sendMail, FROM_PEDIDOS } from "@/lib/mailer";
import { sendTelegramMessage, sendTelegramPhoto } from "@/lib/telegram";
import { centsToDisplay } from "@/lib/price";
import { formatPrice } from "@/lib/format";
import { customerOrderConfirmationEmailHtml } from "@/lib/email-template";

const STORE_NAME = process.env.NEXT_PUBLIC_STORE_NAME || "Enrola Shop";
const STORE_URL = process.env.NEXT_PUBLIC_STORE_URL || "https://enrola.shop";
const PEDIDOS_EMAIL = process.env.PEDIDOS_EMAIL || "pedidos@enrola.shop";

type OrderItem = {
  title?: string;
  product_title?: string;
  variant_title?: string;
  quantity?: number;
  unit_price?: number;
};

type ShippingAddress = {
  first_name?: string;
  last_name?: string;
  address_1?: string;
  address_2?: string;
  city?: string;
  province?: string;
  phone?: string;
  country_code?: string;
};

type OrderPayload = {
  id?: string;
  display_id?: number;
  email?: string;
  items?: OrderItem[];
  total?: number;
  subtotal?: number;
  shipping_total?: number;
  currency_code?: string;
  metadata?: Record<string, unknown>;
  shipping_address?: ShippingAddress;
};

function usdDisplay(cents: number | undefined): number {
  if (cents == null) return 0;
  return centsToDisplay(cents);
}

function fmtEUR(usd: number): string {
  return `€${formatPrice(usd)}`;
}

function fmtBS(usd: number, rate: number): string {
  const bs = usd * rate;
  return bs.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " Bs";
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      order?: OrderPayload;
      email?: string;
      bcvRate?: number;
      paymentProofUrl?: string;
      shippingType?: string;
      redeemedRewards?: { id: string; name: string; points_required: number }[];
      totalPointsRedeemed?: number;
    };

    const redeemedRewards = body?.redeemedRewards || [];
    const totalPointsRedeemed = body?.totalPointsRedeemed || 0;

    const order = body?.order;
    const to = body?.email || order?.email;
    if (!to || typeof to !== "string") {
      return NextResponse.json({ error: "Email requerido" }, { status: 400 });
    }

    const bcvRate = Number(body?.bcvRate ?? 0);
    const displayId = order?.display_id
      ? `#${order.display_id}`
      : order?.id
        ? String(order.id).slice(-6).toUpperCase()
        : "—";

    const items = order?.items ?? [];

    // Item prices and shipping total share the same scale in Medusa v2 with
    // PRICE_DIVISOR=1 — both stored as plain major units (unit_price=2 → $2.00,
    // shipping_total=3 → $3.00). Use usdDisplay for both.
    const itemsTotal = items.reduce((sum, i) => sum + usdDisplay((i.unit_price ?? 0) * (i.quantity ?? 1)), 0);
    const shippingUSD = usdDisplay(order?.shipping_total ?? 0);
    const totalUSD = itemsTotal + shippingUSD;
    const totalBS = bcvRate > 0 ? fmtBS(totalUSD, bcvRate) : null;

    // paymentProofUrl and shippingType come directly from checkout (order.metadata is empty in Medusa v2)
    const paymentProofUrl = body?.paymentProofUrl || (order?.metadata?.payment_proof_url as string) || "";
    const shippingType = body?.shippingType || (order?.metadata?.shipping_type as string) || "";
    const shippingLabel =
      shippingType === "mrw"
        ? "MRW (cobro a destino)"
        : shippingType === "inmediato"
          ? "Inmediato — Solo Valencia"
          : shippingType || "—";

    const addr = order?.shipping_address;
    const addrLines = addr
      ? [
          `${addr.first_name ?? ""} ${addr.last_name ?? ""}`.trim(),
          addr.phone ? `Tel: ${addr.phone}` : null,
          addr.address_1,
          addr.address_2 || null,
          [addr.city, addr.province].filter(Boolean).join(", "),
          addr.country_code?.toUpperCase(),
        ].filter(Boolean)
      : ["—"];
    const fullAddressText = addrLines.join("\n");
    const fullAddressInline = addrLines.join(", ");

    // ── 1. Customer confirmation email via Resend ────────────────────────────
    const customerHtml = customerOrderConfirmationEmailHtml(
      `${addr?.first_name ?? ""} ${addr?.last_name ?? ""}`.trim() || "Cliente",
      displayId,
      items,
      shippingUSD,
      totalUSD,
      totalBS,
      redeemedRewards
    );

    // El email al cliente va en su PROPIO try/catch: si Resend falla (key
    // vacía, dominio no verificado, rate limit) NO debe abortar la ruta y
    // saltarse la notificación interna + la alerta Telegram al warehouse.
    // El pedido ya está creado en Medusa; lo crítico es que el equipo se entere.
    try {
      await sendMail({
        from: FROM_PEDIDOS,
        to: to.trim(),
        subject: `Pedido ${displayId} recibido — ${STORE_NAME}`,
        html: customerHtml,
      });
    } catch (err) {
      console.error("[send-confirmation] customer email failed (continuing):", err);
    }

    // ── 2. Internal notification to pedidos@ via Resend ──────────────────────
    try {
      const internalItemRows = items
        .map((i) => {
          const name = `${i.title ?? i.product_title ?? "Producto"}${i.variant_title ? ` — ${i.variant_title}` : ""}`;
          const qty = i.quantity ?? 1;
          const lineUSD = usdDisplay((i.unit_price ?? 0) * qty);
          const lineBS = bcvRate > 0 ? fmtBS(lineUSD, bcvRate) : null;
          return `<tr>
            <td style="padding:8px 12px;border:1px solid #e5e7eb;">${name}</td>
            <td style="text-align:center;padding:8px 12px;border:1px solid #e5e7eb;">${qty}</td>
            <td style="text-align:right;padding:8px 12px;border:1px solid #e5e7eb;">${fmtEUR(lineUSD)}</td>
            ${lineBS ? `<td style="text-align:right;padding:8px 12px;border:1px solid #e5e7eb;">${lineBS}</td>` : ""}
          </tr>`;
        })
        .join("");

      const bsColumn = bcvRate > 0 ? `<th style="text-align:right;padding:8px 12px;border:1px solid #e5e7eb;">Bs</th>` : "";
      const bsTotalCell = totalBS ? `<td style="text-align:right;padding:10px 12px;border:1px solid #e5e7eb;">${totalBS}</td>` : "";

      const internalHtml = `
        <div style="font-family:sans-serif;max-width:700px;margin:0 auto;color:#1a1a1a;">
          <div style="background:#FF6B00;color:white;padding:24px;">
            <h1 style="margin:0;font-size:24px;">🛍 Nuevo Pedido ${displayId}</h1>
            <p style="margin:6px 0 0;opacity:0.9;">${new Date().toLocaleString("es-VE", { timeZone: "America/Caracas" })}</p>
          </div>
          <div style="padding:24px;">

            <h2 style="font-size:16px;border-bottom:2px solid #f0f0f0;padding-bottom:8px;">📦 Artículos</h2>
            <table style="width:100%;border-collapse:collapse;font-size:14px;">
              <thead><tr style="background:#f9fafb;">
                <th style="text-align:left;padding:8px 12px;border:1px solid #e5e7eb;">Producto</th>
                <th style="text-align:center;padding:8px 12px;border:1px solid #e5e7eb;">Cant.</th>
                <th style="text-align:right;padding:8px 12px;border:1px solid #e5e7eb;">EUR</th>
                ${bsColumn}
              </tr></thead>
              <tbody>${internalItemRows}</tbody>
              <tfoot>
                <tr style="font-weight:bold;background:#fff8f0;">
                  <td colspan="2" style="padding:10px 12px;border:1px solid #e5e7eb;">TOTAL</td>
                  <td style="text-align:right;padding:10px 12px;border:1px solid #e5e7eb;">${fmtEUR(totalUSD)}</td>
                  ${bsTotalCell}
                </tr>
              </tfoot>
            </table>

            ${redeemedRewards.length > 0 ? `
            <h2 style="font-size:16px;border-bottom:2px solid #f0f0f0;padding-bottom:8px;margin-top:28px;">🎁 Recompensas Canjeadas</h2>
            <ul style="margin:8px 0 0;padding-left:20px;">
              ${redeemedRewards.map(r => `<li>${r.name} (-${r.points_required} pts)</li>`).join("")}
            </ul>
            <p style="font-size:13px;color:#666;margin-top:4px;">Total canjeado: ${totalPointsRedeemed} pts</p>
            ` : ""}

            <h2 style="font-size:16px;border-bottom:2px solid #f0f0f0;padding-bottom:8px;margin-top:28px;">🚚 Envío</h2>
            <p><strong>Tipo:</strong> ${shippingLabel}</p>
            <p><strong>Dirección:</strong></p>
            <pre style="background:#f9fafb;padding:12px;font-family:sans-serif;white-space:pre-wrap;border:1px solid #e5e7eb;">${fullAddressText}</pre>

            <h2 style="font-size:16px;border-bottom:2px solid #f0f0f0;padding-bottom:8px;margin-top:28px;">💳 Comprobante de Pago</h2>
            ${
              paymentProofUrl
                ? `<p><a href="${paymentProofUrl}" style="color:#FF6B00;font-weight:bold;">Ver comprobante completo →</a></p>
                   <img src="${paymentProofUrl}" alt="Comprobante de pago" style="max-width:420px;border:2px solid #ddd;display:block;margin-top:8px;" />`
                : "<p style='color:#999;'>No adjunto</p>"
            }

            <h2 style="font-size:16px;border-bottom:2px solid #f0f0f0;padding-bottom:8px;margin-top:28px;">👤 Cliente</h2>
            <p><strong>Email:</strong> <a href="mailto:${to}">${to}</a></p>

          </div>
        </div>`;

      await sendMail({
        from: FROM_PEDIDOS,
        to: PEDIDOS_EMAIL,
        replyTo: to.trim(),
        subject: `🛍 Nuevo Pedido ${displayId} — ${fmtEUR(totalUSD)} EUR`,
        html: internalHtml,
      });
    } catch (resendErr) {
      console.error("Resend internal notification error:", resendErr);
    }

    // ── 3. Telegram notification ──────────────────────────────────────────────
    try {
      const itemLines = items.map((i) => {
        const name = i.title ?? i.product_title ?? "Producto";
        const variant = i.variant_title ? ` (${i.variant_title})` : "";
        const qty = i.quantity ?? 1;
        const lineUSD = usdDisplay((i.unit_price ?? 0) * qty);
        const bsPart = bcvRate > 0 ? ` / ${fmtBS(lineUSD, bcvRate)}` : "";
        return `  • ${name}${variant} ×${qty} — ${fmtEUR(lineUSD)}${bsPart}`;
      });

      const tgText = [
        `🛍 <b>Nuevo Pedido ${displayId}</b>`,
        ``,
        `<b>Artículos:</b>`,
        ...itemLines,
        ...(redeemedRewards.length > 0 ? [
          ``,
          `🎁 <b>Recompensas Canjeadas:</b>`,
          ...redeemedRewards.map(r => `  • ${r.name} (-${r.points_required} pts)`)
        ] : []),
        shippingUSD > 0 ? `  • Envío (${shippingLabel}) — ${fmtEUR(shippingUSD)}` : `  • Envío: ${shippingLabel} (Gratis)`,
        ``,
        `💰 <b>Total: ${fmtEUR(totalUSD)} EUR</b>${totalBS ? `\n💱 <b>${totalBS}</b>` : ""}`,
        ``,
        `🚚 <b>Envío:</b> ${shippingLabel}`,
        `📍 <b>Dirección:</b> ${fullAddressInline}`,
        ``,
        `👤 <b>Cliente:</b> ${to}`,
        paymentProofUrl ? `\n🧾 <b>Comprobante:</b> <a href="${paymentProofUrl}">Ver imagen</a>` : "",
      ].filter(l => l !== "").join("\n");

      // Add inline buttons for order management (display_id for callback data)
      const orderDisplayId = order?.display_id;
      const inlineButtons = orderDisplayId ? [
        [
          { text: "✅ Aprobar Pago", callback_data: `ap:${orderDisplayId}` },
          { text: "🔍 Revisar Pago", callback_data: `rv:${orderDisplayId}` },
        ],
      ] : undefined;

      if (paymentProofUrl) {
        try {
          await sendTelegramPhoto(paymentProofUrl, tgText, inlineButtons);
        } catch {
          // Fallback: send as text with link if photo fails
          await sendTelegramMessage(tgText, inlineButtons);
        }
      } else {
        await sendTelegramMessage(tgText, inlineButtons);
      }
    } catch (tgErr) {
      console.error("Telegram notification error:", tgErr);
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("send-confirmation error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
