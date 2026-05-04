import { useCallback, useEffect, useState } from "react"
import { Badge, Text } from "@medusajs/ui"

const API = "https://api.enrola.shop"

type Quota = {
  used_24h: number
  cap: number
  remaining: number
  rate_limited_until: string | null
  reset_at: string
  window_hours: number
}

/**
 * Compact badge that shows how much of Buffer's quota we've used in the
 * last 24h. Polls every 30s while visible. Turns red when we're in a
 * rate-limited window so the user knows why schedule buttons might refuse.
 *
 * Cheap: hits our own DB-backed /admin/social/buffer-status endpoint,
 * never touches Buffer itself.
 */
export function BufferQuotaBadge() {
  const [q, setQ] = useState<Quota | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API}/admin/social/buffer-status`, {
        credentials: "include",
        cache: "no-store",
      })
      if (!res.ok) return
      setQ(await res.json())
    } catch {
      /* no-op */
    }
  }, [])

  useEffect(() => {
    void load()
    const iv = setInterval(load, 30_000)
    return () => clearInterval(iv)
  }, [load])

  if (!q) return null

  // Which variant to show
  const rateLimited =
    q.rate_limited_until && new Date(q.rate_limited_until).getTime() > Date.now()
  const nearLimit = !rateLimited && q.remaining <= 10
  const color: "red" | "orange" | "grey" = rateLimited
    ? "red"
    : nearLimit
      ? "orange"
      : "grey"

  const label = rateLimited
    ? `Buffer bloqueado hasta ${formatTime(q.rate_limited_until!)}`
    : `Buffer: ${q.used_24h}/${q.cap} en 24h`

  const tooltip = rateLimited
    ? `Rate-limited. Esperá hasta ${new Date(q.rate_limited_until!).toLocaleString("es-VE")}.`
    : `${q.remaining} calls restantes · ventana resetea a ${formatTime(q.reset_at)}`

  return (
    <div title={tooltip} className="inline-flex items-center gap-1 shrink-0">
      <Badge size="2xsmall" color={color}>
        {label}
      </Badge>
      {!rateLimited && (
        <Text size="xsmall" className="text-ui-fg-muted hidden md:inline">
          ({q.remaining} restantes)
        </Text>
      )}
    </div>
  )
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString("es-VE", {
    hour: "2-digit",
    minute: "2-digit",
  })
}
