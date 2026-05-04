import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { Container, Heading, Text, Button, Input, Badge, toast } from "@medusajs/ui"
import { useState } from "react"

type OrderMetadata = Record<string, unknown> | null | undefined
type OrderWidgetProps = { data?: { id?: string; metadata?: OrderMetadata } }

type TrackingStatus =
  | "submitted"
  | "arrived_at_destination"
  | "delivered"
  | null

function statusLabel(s: TrackingStatus): { text: string; color: "green" | "blue" | "orange" | "grey" } {
  switch (s) {
    case "submitted":
      return { text: "🚚 En tránsito", color: "blue" }
    case "arrived_at_destination":
      return { text: "📦 Listo para retirar", color: "orange" }
    case "delivered":
      return { text: "✅ Entregado", color: "green" }
    default:
      return { text: "—", color: "grey" }
  }
}

function fmtDate(iso?: string | null): string {
  if (!iso) return "—"
  try {
    return new Date(iso).toLocaleString("es-ES", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return iso
  }
}

function MrwTrackingWidget({ data }: OrderWidgetProps) {
  const orderId = data?.id
  const meta = (data?.metadata || {}) as Record<string, string | boolean | undefined>

  // Only render for MRW orders. If the operator hasn't tagged the shipping
  // type yet, hide the widget (it would just be noise on inmediato/Valencia
  // pickups).
  const shippingType = String(meta.shipping_type || "").toLowerCase()
  if (shippingType !== "mrw") return null

  const initialTracking = (meta.mrw_tracking_number as string) || ""
  const initialAgency = (meta.mrw_destination_agency as string) || ""
  const status = (meta.mrw_tracking_status as TrackingStatus) || null
  const arrivedAt = meta.mrw_arrived_at as string | undefined
  const deliveredAt = meta.mrw_delivered_at as string | undefined
  const arrivedNotifWa = meta.mrw_arrived_notif_whatsapp as boolean | undefined
  const arrivedNotifEmail = meta.mrw_arrived_notif_email as boolean | undefined
  const deliveredNotifWa = meta.mrw_delivered_notif_whatsapp as boolean | undefined
  const deliveredNotifEmail = meta.mrw_delivered_notif_email as boolean | undefined

  const [trackingInput, setTrackingInput] = useState(initialTracking)
  const [agencyInput, setAgencyInput] = useState(initialAgency)
  const [busy, setBusy] = useState<string | null>(null)

  const labelInfo = statusLabel(status)
  const isArrived = status === "arrived_at_destination" || status === "delivered"
  const isDelivered = status === "delivered"

  async function callApi(action: string, payload: Record<string, unknown> = {}) {
    if (!orderId) return
    setBusy(action)
    try {
      const res = await fetch(`/admin/orders/${orderId}/mrw-tracking`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...payload }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(`Error: ${json.error || res.statusText}`)
        return
      }
      if (action === "set_tracking") {
        toast.success(`Guía ${payload.trackingNumber} guardada`)
      } else if (action === "mark_arrived") {
        if (json.notified === false) {
          toast.warning("Ya estaba notificado")
        } else {
          const o = json.outcome || {}
          const ch = [o.whatsapp ? "WhatsApp" : null, o.email ? "Email" : null].filter(Boolean)
          toast.success(`Cliente notificado por: ${ch.join(" + ") || "ningún canal (revisá phone/email)"}`)
        }
      } else if (action === "mark_delivered") {
        if (json.notified === false) {
          toast.warning("Ya estaba notificado")
        } else {
          toast.success("Pedido marcado como entregado y cliente notificado")
        }
      }
      // Force a refetch by reloading. Crude but reliable for admin widgets.
      setTimeout(() => window.location.reload(), 800)
    } catch (err) {
      toast.error(`Error: ${(err as Error).message}`)
    } finally {
      setBusy(null)
    }
  }

  return (
    <Container className="p-4 divide-y divide-grey-20">
      <div className="flex flex-col gap-3 pb-2">
        <div className="flex justify-between items-center">
          <Heading level="h2">📦 Tracking MRW</Heading>
          <Badge color={labelInfo.color}>{labelInfo.text}</Badge>
        </div>

        {/* Tracking number — set or edit */}
        <div className="flex flex-col gap-2">
          <Text size="small" className="text-ui-fg-muted">
            Número de guía
          </Text>
          <div className="flex gap-2">
            <Input
              placeholder="080002004000778"
              value={trackingInput}
              onChange={(e) => setTrackingInput(e.target.value.replace(/\D/g, ""))}
              disabled={isDelivered}
            />
            <Button
              size="small"
              variant="secondary"
              disabled={busy !== null || isDelivered || !trackingInput || trackingInput === initialTracking}
              onClick={() =>
                callApi("set_tracking", {
                  trackingNumber: trackingInput,
                  agency: agencyInput || null,
                })
              }
            >
              Guardar
            </Button>
          </div>
          <Text size="small" className="text-ui-fg-muted">
            Agencia destino (opcional)
          </Text>
          <Input
            placeholder="LA GRITA"
            value={agencyInput}
            onChange={(e) => setAgencyInput(e.target.value)}
            disabled={isDelivered}
          />
          {!initialTracking && (
            <Text size="small" className="text-ui-fg-subtle italic">
              ⚠ El QR del comprobante no se pudo leer. Pegá el número de guía manualmente.
            </Text>
          )}
        </div>
      </div>

      {/* Action buttons + history */}
      <div className="flex flex-col gap-3 pt-3">
        <div className="flex gap-2 flex-wrap">
          <Button
            size="base"
            variant={isArrived ? "secondary" : "primary"}
            disabled={busy !== null || isArrived}
            onClick={() => {
              if (!confirm("Marcar como ¡llegó a la agencia! y notificar al cliente?")) return
              callApi("mark_arrived")
            }}
          >
            {busy === "mark_arrived" ? "Notificando…" : "📍 Marcar llegó a agencia"}
          </Button>
          <Button
            size="base"
            variant={isDelivered ? "secondary" : "primary"}
            disabled={busy !== null || isDelivered || !isArrived}
            onClick={() => {
              if (!confirm("Confirmar que el cliente retiró el pedido? Esto cierra la orden.")) return
              callApi("mark_delivered")
            }}
          >
            {busy === "mark_delivered" ? "Procesando…" : "✅ Marcar entregado"}
          </Button>
        </div>

        {(arrivedAt || deliveredAt) && (
          <div className="text-xs text-ui-fg-muted flex flex-col gap-1 mt-1">
            {arrivedAt && (
              <div>
                <strong>Llegó:</strong> {fmtDate(arrivedAt)}
                {(arrivedNotifWa !== undefined || arrivedNotifEmail !== undefined) && (
                  <span className="ml-2">
                    {arrivedNotifWa ? "📱 WA✓" : "📱 WA✗"} ·{" "}
                    {arrivedNotifEmail ? "✉ Email✓" : "✉ Email✗"}
                  </span>
                )}
              </div>
            )}
            {deliveredAt && (
              <div>
                <strong>Entregado:</strong> {fmtDate(deliveredAt)}
                {(deliveredNotifWa !== undefined || deliveredNotifEmail !== undefined) && (
                  <span className="ml-2">
                    {deliveredNotifWa ? "📱 WA✓" : "📱 WA✗"} ·{" "}
                    {deliveredNotifEmail ? "✉ Email✓" : "✉ Email✗"}
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {!isArrived && (
          <Text size="small" className="text-ui-fg-subtle">
            Cuando MRW notifique que el paquete llegó a la oficina destino, presioná{" "}
            <strong>Marcar llegó a agencia</strong> — se enviará WhatsApp + email automáticamente
            al cliente.
          </Text>
        )}
      </div>
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "order.details.side.after",
})

export default MrwTrackingWidget
