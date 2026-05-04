import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { PageHeader, PageWatermark } from "@/components/layout/PageHeader"
import {
  listStores, listSalesChannels, listRegions,
  MedusaError,
  type AdminStore, type AdminSalesChannel, type AdminRegion,
} from "@/lib/medusa"
import { StoreEditor } from "./StoreEditor"

export default async function StoreSettingsPage() {
  let store: AdminStore | null = null
  let channels: AdminSalesChannel[] = []
  let regions: AdminRegion[] = []
  let errorMsg: string | null = null

  try {
    const [s, c, r] = await Promise.all([listStores(), listSalesChannels(), listRegions()])
    store = s.stores[0] ?? null
    channels = c.sales_channels
    regions = r.regions
  } catch (e) {
    if (e instanceof MedusaError && e.status === 401) errorMsg = "Sesión expirada."
    else errorMsg = `No se pudo cargar la tienda: ${e instanceof Error ? e.message : "error"}`
  }

  return (
    <div className="p-7 space-y-5 relative">
      <PageWatermark char="🏪" />
      <Link href="/settings" className="inline-flex items-center gap-1 text-[11px] font-display font-bold uppercase tracking-wider text-ink-3 hover:text-orange">
        <ArrowLeft size={12} strokeWidth={2.5} /> Settings
      </Link>
      <PageHeader
        title="TIENDA"
        stamp={store ? <>{store.name}</> : <>SIN STORE</>}
        stampTone="orange"
        description="Datos generales de la tienda · monedas · default region/channel"
      />

      {errorMsg && (
        <div className="stamp-card p-4 bg-primary/5" style={{ borderColor: "#BB3B2E" }}>
          <p className="text-[13px] font-medium text-primary">{errorMsg}</p>
        </div>
      )}

      {!errorMsg && !store && (
        <div className="stamp-card p-10 text-center">
          <p className="font-display font-bold text-[14px] uppercase tracking-wider text-ink-3">
            No hay tienda configurada
          </p>
          <p className="text-[12px] text-ink-3 mt-1">
            Crea una desde Medusa CLI primero (`medusa store create`).
          </p>
        </div>
      )}

      {!errorMsg && store && (
        <StoreEditor
          storeId={store.id}
          initial={{
            name: store.name,
            default_sales_channel_id: store.default_sales_channel_id ?? null,
            default_region_id: store.default_region_id ?? null,
            supported_currencies: (store.supported_currencies ?? []).map((c) => ({
              currency_code: c.currency_code,
              is_default: c.is_default ?? false,
            })),
          }}
          salesChannels={channels.map((c) => ({ id: c.id, name: c.name }))}
          regions={regions.map((r) => ({ id: r.id, name: r.name, currency_code: r.currency_code }))}
        />
      )}
    </div>
  )
}
