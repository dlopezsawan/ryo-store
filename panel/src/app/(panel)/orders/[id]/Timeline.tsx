import { Clock, ShoppingBag, CreditCard, Package, Truck, Undo2, AlertTriangle, X, Mail } from "lucide-react"

export interface TimelineEvent {
  id: string
  ts: string
  kind: "created" | "paid" | "fulfilled" | "shipped" | "delivered" | "canceled" | "return-requested" | "return-received" | "claim-created" | "exchange-created"
  label: string
  detail?: string
}

interface Props {
  events: TimelineEvent[]
}

const ICON_MAP: Record<TimelineEvent["kind"], React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>> = {
  "created":          ShoppingBag,
  "paid":             CreditCard,
  "fulfilled":        Package,
  "shipped":          Truck,
  "delivered":        Truck,
  "canceled":         X,
  "return-requested": Undo2,
  "return-received":  Undo2,
  "claim-created":    AlertTriangle,
  "exchange-created": Mail,
}

const COLOR_MAP: Record<TimelineEvent["kind"], string> = {
  "created":          "text-orange bg-orange/15",
  "paid":             "text-secondary bg-secondary/15",
  "fulfilled":        "text-secondary bg-secondary/15",
  "shipped":          "text-secondary bg-secondary/15",
  "delivered":        "text-secondary bg-secondary/15",
  "canceled":         "text-primary bg-primary/15",
  "return-requested": "text-orange bg-orange/15",
  "return-received":  "text-secondary bg-secondary/15",
  "claim-created":    "text-primary bg-primary/15",
  "exchange-created": "text-orange bg-orange/15",
}

const BORDER_MAP: Record<TimelineEvent["kind"], string> = {
  "created":          "#FF3B27",
  "paid":             "#4D5431",
  "fulfilled":        "#4D5431",
  "shipped":          "#4D5431",
  "delivered":        "#4D5431",
  "canceled":         "#BB3B2E",
  "return-requested": "#FF3B27",
  "return-received":  "#4D5431",
  "claim-created":    "#BB3B2E",
  "exchange-created": "#FF3B27",
}

export function Timeline({ events }: Props) {
  if (events.length === 0) {
    return (
      <div className="stamp-card p-6 text-center">
        <Clock size={20} className="mx-auto text-ink-3 mb-2" />
        <p className="text-[12px] text-ink-3">Sin actividad registrada</p>
      </div>
    )
  }

  return (
    <div className="stamp-card overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3 bg-dark text-cream">
        <Clock size={14} strokeWidth={2.4} />
        <h3 className="font-display font-black text-[14px] uppercase tracking-wider">
          Línea de tiempo
        </h3>
        <span className="ml-auto text-[10px] text-cream/60 font-mono">
          {events.length} eventos
        </span>
      </div>
      <div className="p-5">
        <ol className="relative">
          {events.map((e, i) => {
            const Icon = ICON_MAP[e.kind]
            const colorCls = COLOR_MAP[e.kind]
            const isLast = i === events.length - 1
            const date = new Date(e.ts)
            return (
              <li key={e.id} className="relative pl-10 pb-4 last:pb-0">
                {!isLast && (
                  <span
                    className="absolute left-[15px] top-6 bottom-0 w-px"
                    style={{ background: "var(--border)" }}
                  />
                )}
                <span
                  className={`absolute left-0 top-0 w-8 h-8 flex items-center justify-center rounded-md ${colorCls}`}
                  style={{ border: `1.5px solid ${BORDER_MAP[e.kind]}` }}
                >
                  <Icon size={13} strokeWidth={2.4} />
                </span>
                <div className="min-w-0">
                  <div className="font-display font-bold text-[13px] text-ink uppercase tracking-wider">
                    {e.label}
                  </div>
                  {e.detail && (
                    <div className="text-[11px] text-ink-2 mt-0.5">{e.detail}</div>
                  )}
                  <div className="text-[10px] text-ink-3 font-mono mt-0.5">
                    {date.toLocaleDateString("es-VE", { day: "numeric", month: "short", year: "numeric" })} ·{" "}
                    {date.toLocaleTimeString("es-VE", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              </li>
            )
          })}
        </ol>
      </div>
    </div>
  )
}
