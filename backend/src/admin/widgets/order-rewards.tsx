import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { Container, Heading, Text } from "@medusajs/ui"

type OrderMetadata = Record<string, unknown> | null | undefined
type OrderWidgetProps = { data?: { metadata?: OrderMetadata } }

type RedeemedReward = {
  id: string
  name: string
  points: number
}

function OrderRewardsWidget({ data }: OrderWidgetProps) {
  const metadata = data?.metadata as Record<string, unknown> | undefined
  
  if (!metadata || !metadata.redeemed_rewards || !metadata.total_points_redeemed) {
    return null
  }

  const redeemedRewards = metadata.redeemed_rewards as RedeemedReward[]
  const totalPoints = metadata.total_points_redeemed as number

  if (!Array.isArray(redeemedRewards) || redeemedRewards.length === 0) {
    return null
  }

  return (
    <Container className="p-0 overflow-hidden border border-ui-border-base mb-4">
      <div className="bg-ui-bg-subtle p-4 flex flex-col gap-3">
        <Heading level="h2" className="flex items-center gap-2 text-ui-fg-base">
          🎁 Recompensas canjeadas (Club Enrola)
        </Heading>
        <div className="flex flex-wrap gap-4 mt-2">
          {redeemedRewards.map((r, i) => (
            <div key={i} className="bg-ui-bg-base border border-ui-border-base rounded-lg p-3 shadow-sm min-w-[200px]">
              <Text className="font-bold text-ui-fg-base">{r.name}</Text>
              <Text className="text-xs text-ui-fg-subtle">Costo: {r.points} pts</Text>
            </div>
          ))}
        </div>
        <div className="mt-2 pt-2 border-t border-ui-border-base flex justify-between items-center">
          <Text className="text-sm font-semibold text-ui-fg-base">
            Total puntos canjeados: <span className="text-ui-fg-interactive">{totalPoints} pts</span>
          </Text>
          <Text className="text-xs text-ui-fg-muted italic">
            * Estos productos deben incluirse manualmente en el paquete
          </Text>
        </div>
      </div>
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "order.details.before",
})

export default OrderRewardsWidget
