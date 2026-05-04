import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { PageHeader, PageWatermark } from "@/components/layout/PageHeader"
import {
  listTaxRegions, listTaxRates,
  MedusaError,
  type AdminTaxRegion, type AdminTaxRate,
} from "@/lib/medusa"
import { TaxManager, type RegionRow } from "./TaxManager"

export default async function TaxSettingsPage() {
  let regions: AdminTaxRegion[] = []
  let ratesByRegion = new Map<string, AdminTaxRate[]>()
  let errorMsg: string | null = null

  try {
    const r = await listTaxRegions()
    regions = r.tax_regions
    // Cargar rates de cada región en paralelo
    const ratesArr = await Promise.all(
      regions.map((tr) => listTaxRates(tr.id).catch(() => ({ tax_rates: [] as AdminTaxRate[], count: 0 }))),
    )
    ratesByRegion = new Map(regions.map((tr, i) => [tr.id, ratesArr[i].tax_rates]))
  } catch (e) {
    if (e instanceof MedusaError && e.status === 401) errorMsg = "Sesión expirada."
    else if (e instanceof MedusaError && e.status === 404) errorMsg = "Endpoint /admin/tax-regions no disponible — ¿módulo de tax activado?"
    else errorMsg = `No se pudo cargar tax regions: ${e instanceof Error ? e.message : "error"}`
  }

  const rows: RegionRow[] = regions.map((tr) => ({
    id: tr.id,
    country_code: tr.country_code,
    province_code: tr.province_code ?? "",
    default_rate_pct: tr.default_tax_rate?.rate ?? null,
    default_rate_name: tr.default_tax_rate?.name ?? "",
    rates: (ratesByRegion.get(tr.id) ?? []).map((rt) => ({
      id: rt.id,
      name: rt.name ?? "",
      rate: Number(rt.rate) || 0,
      code: rt.code ?? "",
    })),
  }))

  return (
    <div className="p-7 space-y-5 relative">
      <PageWatermark char="%" />
      <Link href="/settings" className="inline-flex items-center gap-1 text-[11px] font-display font-bold uppercase tracking-wider text-ink-3 hover:text-orange">
        <ArrowLeft size={12} strokeWidth={2.5} /> Settings
      </Link>
      <PageHeader
        title="TAX REGIONS"
        stamp={<>{regions.length} CONFIGURADAS</>}
        stampTone="orange"
        description="Países y provincias donde se aplican impuestos · IVA, taxes regionales"
      />

      {errorMsg ? (
        <div className="stamp-card p-4 bg-primary/5" style={{ borderColor: "#BB3B2E" }}>
          <p className="text-[13px] font-medium text-primary">{errorMsg}</p>
        </div>
      ) : (
        <TaxManager rows={rows} />
      )}
    </div>
  )
}
