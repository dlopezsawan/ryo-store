import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { PageHeader, PageWatermark } from "@/components/layout/PageHeader"
import { listSalesChannels, MedusaError, type AdminSalesChannel } from "@/lib/medusa"
import { SalesChannelsManager } from "./SalesChannelsManager"

export default async function SalesChannelsPage() {
  let channels: AdminSalesChannel[] = []
  let errorMsg: string | null = null

  try {
    const res = await listSalesChannels()
    channels = res.sales_channels
  } catch (e) {
    if (e instanceof MedusaError && e.status === 401) errorMsg = "Sesión expirada."
    else errorMsg = `No se pudo cargar sales channels: ${e instanceof Error ? e.message : "error"}`
  }

  return (
    <div className="p-7 space-y-5 relative">
      <PageWatermark char="#" />
      <Link href="/settings" className="inline-flex items-center gap-1 text-[11px] font-display font-bold uppercase tracking-wider text-ink-3 hover:text-orange">
        <ArrowLeft size={12} strokeWidth={2.5} /> Settings
      </Link>
      <PageHeader
        title="SALES CHANNELS"
        stamp={<>{channels.length} TOTALES</>}
        stampTone="secondary"
        description="Storefronts conectados (web, mobile, marketplace, etc.)"
      />

      {errorMsg ? (
        <div className="stamp-card p-4 bg-primary/5" style={{ borderColor: "#BB3B2E" }}>
          <p className="text-[13px] font-medium text-primary">{errorMsg}</p>
        </div>
      ) : (
        <SalesChannelsManager
          rows={channels.map((c) => ({
            id: c.id,
            name: c.name,
            description: c.description ?? "",
            is_disabled: c.is_disabled,
          }))}
        />
      )}
    </div>
  )
}
