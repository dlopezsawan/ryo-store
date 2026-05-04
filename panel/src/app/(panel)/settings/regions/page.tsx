import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { PageHeader, PageWatermark } from "@/components/layout/PageHeader"
import { listRegions, MedusaError, type AdminRegion } from "@/lib/medusa"
import { RegionsManager } from "./RegionsManager"

export default async function RegionsSettingsPage() {
  let regions: AdminRegion[] = []
  let errorMsg: string | null = null

  try {
    const res = await listRegions()
    regions = res.regions
  } catch (e) {
    if (e instanceof MedusaError && e.status === 401) errorMsg = "Sesión expirada."
    else errorMsg = `No se pudo cargar regiones: ${e instanceof Error ? e.message : "error"}`
  }

  return (
    <div className="p-7 space-y-5 relative">
      <PageWatermark char="🌍" />
      <Link href="/settings" className="inline-flex items-center gap-1 text-[11px] font-display font-bold uppercase tracking-wider text-ink-3 hover:text-orange">
        <ArrowLeft size={12} strokeWidth={2.5} /> Settings
      </Link>
      <PageHeader
        title="REGIONES"
        stamp={<>{regions.length} ACTIVAS</>}
        stampTone="orange"
        description="Países, moneda por región y aplicación de taxes"
      />

      {errorMsg ? (
        <div className="stamp-card p-4 bg-primary/5" style={{ borderColor: "#BB3B2E" }}>
          <p className="text-[13px] font-medium text-primary">{errorMsg}</p>
        </div>
      ) : (
        <RegionsManager
          rows={regions.map((r) => ({
            id: r.id,
            name: r.name,
            currency_code: r.currency_code,
            automatic_taxes: r.automatic_taxes ?? false,
            countries: (r.countries ?? []).map((c) => c.iso_2),
          }))}
        />
      )}
    </div>
  )
}
