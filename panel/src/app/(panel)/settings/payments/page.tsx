import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { PageHeader, PageWatermark } from "@/components/layout/PageHeader"
import {
  listPaymentProviders, listRegions,
  MedusaError,
  type AdminPaymentProvider, type AdminRegion,
} from "@/lib/medusa"
import { PaymentsManager } from "./PaymentsManager"

export default async function PaymentsSettingsPage() {
  let providers: AdminPaymentProvider[] = []
  let regions: AdminRegion[] = []
  let errorMsg: string | null = null

  try {
    const [pRes, rRes] = await Promise.all([listPaymentProviders(), listRegions()])
    providers = pRes.payment_providers
    regions = rRes.regions
  } catch (e) {
    if (e instanceof MedusaError && e.status === 401) errorMsg = "Sesión expirada."
    else if (e instanceof MedusaError && e.status === 404) errorMsg = "Endpoint /admin/payment-providers no disponible."
    else errorMsg = `No se pudo cargar payment providers: ${e instanceof Error ? e.message : "error"}`
  }

  return (
    <div className="p-7 space-y-5 relative">
      <PageWatermark char="$" />
      <Link href="/settings" className="inline-flex items-center gap-1 text-[11px] font-display font-bold uppercase tracking-wider text-ink-3 hover:text-orange">
        <ArrowLeft size={12} strokeWidth={2.5} /> Settings
      </Link>
      <PageHeader
        title="PAYMENT PROVIDERS"
        stamp={<>{providers.length} REGISTRADOS</>}
        stampTone="secondary"
        description="Métodos de pago disponibles · asignación por región"
      />

      {errorMsg ? (
        <div className="stamp-card p-4 bg-primary/5" style={{ borderColor: "#BB3B2E" }}>
          <p className="text-[13px] font-medium text-primary">{errorMsg}</p>
        </div>
      ) : (
        <PaymentsManager
          providers={providers.map((p) => ({ id: p.id }))}
          regions={regions.map((r) => ({
            id: r.id,
            name: r.name,
            currency_code: r.currency_code,
            enabled_provider_ids: (r.payment_providers ?? []).filter((p) => p.is_enabled !== false).map((p) => p.id),
          }))}
        />
      )}
    </div>
  )
}
