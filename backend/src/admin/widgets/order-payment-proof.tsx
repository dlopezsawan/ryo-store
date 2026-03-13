import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { Container, Heading } from "@medusajs/ui"

type OrderMetadata = Record<string, unknown> | null | undefined
type OrderWidgetProps = { data?: { metadata?: OrderMetadata } }

function OrderPaymentProofWidget({ data }: OrderWidgetProps) {
  const metadata = data?.metadata as Record<string, string> | undefined
  const url = metadata?.payment_proof_url

  if (!url || typeof url !== "string") {
    return null
  }

  const fullUrl = url.startsWith("http") ? url : `${window.location.origin}${url.startsWith("/") ? "" : "/"}${url}`

  return (
    <Container className="p-4 divide-y divide-grey-20">
      <div className="flex flex-col gap-3">
        <Heading level="h2">Comprobante de pago</Heading>
        <a
          href={fullUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block rounded-lg overflow-hidden border border-grey-20 bg-grey-5 hover:opacity-90 transition"
        >
          <img
            src={fullUrl}
            alt="Comprobante de pago del cliente"
            className="w-full max-h-80 object-contain"
          />
        </a>
        <a
          href={fullUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-blue-600 hover:underline"
        >
          Abrir imagen en nueva pestaña
        </a>
      </div>
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "order.details.side.after",
})

export default OrderPaymentProofWidget
