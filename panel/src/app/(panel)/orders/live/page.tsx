import Link from "next/link"
import { ArrowLeft, Radio } from "lucide-react"
import { PageHeader, PageWatermark } from "@/components/layout/PageHeader"
import { LiveOrdersClient } from "./LiveOrdersClient"

export const dynamic = "force-dynamic"

export default function LiveOrdersPage() {
  return (
    <div className="p-7 space-y-5 relative">
      <PageWatermark char="●" />

      <Link href="/orders" className="inline-flex items-center gap-1 text-[11px] font-display font-bold uppercase tracking-wider text-ink-3 hover:text-orange">
        <ArrowLeft size={12} strokeWidth={2.5} /> Pedidos
      </Link>

      <PageHeader
        title="LIVE"
        stamp={
          <span className="flex items-center gap-1">
            <Radio size={10} strokeWidth={2.5} className="animate-pulse" />
            EN VIVO
          </span>
        }
        stampTone="primary"
        description="Feed en tiempo real · Kanban arrastrable · Vista geográfica · Notificaciones desktop"
      />

      <LiveOrdersClient />
    </div>
  )
}
