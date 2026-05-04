import { notFound } from "next/navigation"
import { retrieveOrder, MedusaError, type AdminOrderDetail } from "@/lib/medusa"
import { fmtEur } from "@/lib/utils"
import { PrintTrigger } from "./PrintTrigger"

/**
 * Vista de packing slip — optimizada para impresión A4.
 * Auto-dispara window.print() al cargar via PrintTrigger client component.
 *
 * Diseño:
 *   - Header: logo Enrola + número orden + fecha
 *   - Cliente: nombre, email, teléfono
 *   - Dirección de envío
 *   - Tabla de items: thumbnail, sku, qty, precio, subtotal
 *   - Totales: subtotal, descuento, envío, total
 *   - Footer: nota interna si existe
 */
export default async function PrintPackingSlip({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  let order: AdminOrderDetail
  try {
    const res = await retrieveOrder(id)
    order = res.order
  } catch (e) {
    if (e instanceof MedusaError && e.status === 404) notFound()
    throw e
  }

  const customerName =
    [order.customer?.first_name, order.customer?.last_name].filter(Boolean).join(" ") ||
    [order.shipping_address?.first_name, order.shipping_address?.last_name].filter(Boolean).join(" ") ||
    order.email ||
    "Cliente"
  const ship = order.shipping_address
  const created = new Date(order.created_at)
  const subtotal = Number(order.subtotal) || 0
  const total = Number(order.total) || 0
  const discount = Number(order.discount_total) || 0
  const shipping = Number(order.shipping_total) || 0
  const internalNote = typeof order.metadata?.internal_note === "string" ? order.metadata.internal_note : null

  return (
    <div className="print-page">
      <PrintTrigger />

      <style>{`
        @media print {
          @page { margin: 1.5cm; size: A4; }
          .panel-main { margin-left: 0 !important; }
          header[class*="sticky"], aside, .no-print { display: none !important; }
          body { background: white !important; color: black !important; }
        }
        .print-page {
          background: white;
          color: #1A1A1A;
          padding: 32px;
          max-width: 800px;
          margin: 0 auto;
          font-family: var(--font-inter, system-ui), sans-serif;
        }
        .print-page h1, .print-page h2, .print-page h3 {
          font-family: var(--font-kanit, sans-serif);
        }
      `}</style>

      <div className="flex justify-between items-start pb-4 mb-6 border-b-2 border-black">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tight">ENROLA</h1>
          <p className="text-xs uppercase tracking-widest text-gray-600 mt-1">Packing slip</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-black font-mono">#{order.display_id}</div>
          <div className="text-xs text-gray-600 mt-1 font-mono">
            {created.toLocaleDateString("es-VE", { day: "numeric", month: "long", year: "numeric" })}
          </div>
          <div className="text-xs text-gray-600 font-mono">
            {created.toLocaleTimeString("es-VE", { hour: "2-digit", minute: "2-digit" })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-6">
        <div>
          <h3 className="text-[10px] uppercase tracking-widest font-bold text-gray-600 mb-1.5">Cliente</h3>
          <p className="font-bold text-base">{customerName}</p>
          <p className="text-xs font-mono text-gray-700">{order.customer?.email || order.email || "—"}</p>
          {ship?.phone && (
            <p className="text-xs font-mono text-gray-700">{ship.phone}</p>
          )}
        </div>
        <div>
          <h3 className="text-[10px] uppercase tracking-widest font-bold text-gray-600 mb-1.5">Enviar a</h3>
          {ship ? (
            <p className="text-xs font-mono leading-relaxed">
              {[ship.first_name, ship.last_name].filter(Boolean).join(" ")}<br />
              {ship.address_1 && <>{ship.address_1}<br /></>}
              {[ship.city, ship.province].filter(Boolean).join(", ")}
            </p>
          ) : (
            <p className="text-xs italic text-gray-500">Sin dirección registrada</p>
          )}
        </div>
      </div>

      <table className="w-full mb-6">
        <thead>
          <tr className="bg-gray-100 border-y-2 border-black">
            <th className="text-left px-3 py-2 text-[10px] uppercase tracking-widest font-bold">Producto</th>
            <th className="text-left px-3 py-2 text-[10px] uppercase tracking-widest font-bold">SKU</th>
            <th className="text-right px-3 py-2 text-[10px] uppercase tracking-widest font-bold">Qty</th>
            <th className="text-right px-3 py-2 text-[10px] uppercase tracking-widest font-bold">Precio</th>
            <th className="text-right px-3 py-2 text-[10px] uppercase tracking-widest font-bold">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((it) => {
            const lineSubtotal = Number(it.subtotal ?? Number(it.unit_price) * it.quantity) || 0
            return (
              <tr key={it.id} className="border-b border-gray-200">
                <td className="px-3 py-2.5">
                  <div className="font-bold text-sm">{it.title}</div>
                  {it.variant?.title && it.variant.title !== "Default Title" && (
                    <div className="text-[10px] text-gray-600">{it.variant.title}</div>
                  )}
                </td>
                <td className="px-3 py-2.5 text-xs font-mono text-gray-700">{it.variant?.sku ?? "—"}</td>
                <td className="px-3 py-2.5 text-right font-mono font-bold">{it.quantity}</td>
                <td className="px-3 py-2.5 text-right font-mono">{fmtEur(Number(it.unit_price) || 0)}</td>
                <td className="px-3 py-2.5 text-right font-mono font-bold">{fmtEur(lineSubtotal)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <div className="flex justify-end mb-6">
        <div className="w-72 space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Subtotal</span>
            <span className="font-mono">{fmtEur(subtotal)}</span>
          </div>
          {discount > 0 && (
            <div className="flex justify-between text-green-700">
              <span>Descuento</span>
              <span className="font-mono">−{fmtEur(discount)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-gray-600">Envío</span>
            <span className="font-mono">{shipping === 0 ? "GRATIS" : fmtEur(shipping)}</span>
          </div>
          <div className="flex justify-between pt-2 border-t-2 border-black">
            <span className="font-black uppercase tracking-wider">Total</span>
            <span className="font-mono font-black text-lg">{fmtEur(total)}</span>
          </div>
        </div>
      </div>

      {internalNote && (
        <div className="border-2 border-dashed border-gray-400 p-3 mb-6">
          <h3 className="text-[10px] uppercase tracking-widest font-bold text-gray-600 mb-1">Nota interna</h3>
          <p className="text-xs">{internalNote}</p>
        </div>
      )}

      <div className="text-center pt-6 border-t border-gray-300 text-[10px] text-gray-500 font-mono uppercase tracking-widest">
        Enrola Shop · enrola.shop · Gracias por tu compra
      </div>

      <div className="no-print mt-8 text-center">
        <button
          type="button"
          onClick={() => window.print()}
          className="px-5 py-2 bg-orange-500 text-white font-bold rounded uppercase tracking-wider text-sm"
          style={{ background: "#FF3B27", color: "#1A1A1A", border: "2px solid #1A1A1A", boxShadow: "3px 3px 0 0 #1A1A1A" }}
        >
          🖨 Imprimir
        </button>
      </div>
    </div>
  )
}
