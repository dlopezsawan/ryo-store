import { PageHeader, PageWatermark } from "@/components/layout/PageHeader"
import { Package } from "lucide-react"
import {
  listShippingProfiles, listShippingOptions, listStockLocations, listServiceZones, listFulfillmentProviders, listStores,
  MedusaError,
  type AdminShippingProfile, type AdminShippingOption,
} from "@/lib/medusa"
import { ShippingOptionsManager, type ShippingOptionRow } from "./ShippingOptionsManager"

export default async function ShippingPage() {
  let profiles: AdminShippingProfile[] = []
  let options: AdminShippingOption[] = []
  let serviceZones: Array<{ id: string; name: string }> = []
  let providers: Array<{ id: string }> = []
  let defaultCurrency = "eur"
  let errorMsg: string | null = null

  try {
    const [profsRes, optsRes, locsRes, provsRes, storesRes] = await Promise.all([
      listShippingProfiles(),
      listShippingOptions(),
      listStockLocations().catch(() => ({ stock_locations: [] })),
      listFulfillmentProviders().catch(() => ({ fulfillment_providers: [] })),
      listStores().catch(() => ({ stores: [] })),
    ])
    profiles = profsRes.shipping_profiles
    options = optsRes.shipping_options
    providers = provsRes.fulfillment_providers.map((p) => ({ id: p.id }))
    const def = storesRes.stores[0]?.supported_currencies?.find((c) => c.is_default)
    defaultCurrency = def?.currency_code ?? storesRes.stores[0]?.default_currency_code ?? "eur"

    // Cargar service zones de cada stock location en paralelo
    const zonesArr = await Promise.all(
      locsRes.stock_locations.map((loc) => listServiceZones(loc.id).catch(() => ({ stock_location: { fulfillment_sets: [] } }))),
    )
    serviceZones = zonesArr.flatMap((res, idx) => {
      const locName = locsRes.stock_locations[idx]?.name ?? "?"
      return (res.stock_location.fulfillment_sets ?? []).flatMap((fs) =>
        fs.service_zones.map((z) => ({
          id: z.id,
          name: `${locName} → ${z.name}`,
        })),
      )
    })
  } catch (e) {
    if (e instanceof MedusaError && e.status === 401) {
      errorMsg = "Sesión expirada. Recarga el panel."
    } else {
      errorMsg = `No se pudo cargar shipping: ${e instanceof Error ? e.message : "error desconocido"}`
    }
  }

  // Agrupar options por profile
  const byProfile = new Map<string, AdminShippingOption[]>()
  for (const opt of options) {
    const key = opt.shipping_profile_id ?? "_unknown"
    const arr = byProfile.get(key) ?? []
    arr.push(opt)
    byProfile.set(key, arr)
  }

  return (
    <div className="p-7 space-y-5 relative">
      <PageWatermark />

      <PageHeader
        title="ENVÍOS"
        stamp={<>{options.length} OPCIONES</>}
        stampTone="orange"
        description={
          <>
            {profiles.length} perfil{profiles.length === 1 ? "" : "es"} ·{" "}
            {options.length} opción{options.length === 1 ? "" : "es"} ·{" "}
            {serviceZones.length} service zone{serviceZones.length === 1 ? "" : "s"} ·{" "}
            {providers.length} provider{providers.length === 1 ? "" : "s"}
          </>
        }
      />

      {errorMsg && (
        <div className="stamp-card p-4 bg-primary/5" style={{ borderColor: "#BB3B2E" }}>
          <p className="text-[13px] font-medium text-primary">{errorMsg}</p>
        </div>
      )}

      {!errorMsg && profiles.length === 0 && (
        <div className="stamp-card p-10 text-center">
          <p className="font-display font-bold text-[14px] uppercase tracking-wider text-ink-3">
            No hay shipping profiles configurados
          </p>
          <p className="text-[12px] text-ink-3 mt-1">
            Configura desde Medusa CLI o desde el dashboard antes de poder usar las opciones.
          </p>
        </div>
      )}

      {serviceZones.length === 0 && profiles.length > 0 && (
        <div className="stamp-card p-4 bg-orange/5" style={{ borderColor: "#FF3B27" }}>
          <p className="text-[13px] text-ink-2">
            <strong>No hay service zones</strong> configuradas. Las opciones de envío necesitan
            estar asociadas a una zona (e.g. "Caracas", "Valencia"). Crea zonas desde Medusa
            o desde la UI de stock-locations.
          </p>
        </div>
      )}

      {!errorMsg && profiles.map((prof) => {
        const profOptions = byProfile.get(prof.id) ?? []
        return (
          <div key={prof.id} className="stamp-card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 bg-dark text-cream">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-orange text-dark flex items-center justify-center" style={{ border: "1.5px solid #1A1A1A" }}>
                  <Package size={14} strokeWidth={2.4} />
                </div>
                <div>
                  <h3 className="font-display font-black text-[14px] uppercase tracking-wider">{prof.name}</h3>
                  <p className="text-[10px] font-mono text-cream/60 uppercase">{prof.type}</p>
                </div>
              </div>
              <span className="text-[11px] text-orange font-mono">
                {profOptions.length} opcion{profOptions.length === 1 ? "" : "es"}
              </span>
            </div>

            <ShippingOptionsManager
              profileId={prof.id}
              profileName={prof.name}
              rows={profOptions.map<ShippingOptionRow>((opt) => ({
                id: opt.id,
                name: opt.name,
                price_type: opt.price_type,
                amount: opt.amount != null ? Number(opt.amount) : null,
                currency: defaultCurrency,
                service_zone_id: opt.service_zone_id ?? "",
                shipping_profile_id: opt.shipping_profile_id ?? "",
                provider_id: opt.provider_id ?? "",
                type_label: opt.type?.label ?? opt.type?.code ?? "—",
              }))}
              serviceZones={serviceZones}
              providers={providers}
              defaultCurrency={defaultCurrency}
            />
          </div>
        )
      })}
    </div>
  )
}
