import { Badge } from "@medusajs/ui"
import { SocialStatus, STATUS_COLORS, STATUS_LABELS } from "../types"

export function StatusBadge({ status }: { status: SocialStatus }) {
  return (
    <Badge size="2xsmall" color={STATUS_COLORS[status]}>
      {STATUS_LABELS[status]}
    </Badge>
  )
}
