import { PageHeader, PageWatermark } from "@/components/layout/PageHeader"
import { listStockLocations, MedusaError, type AdminStockLocation } from "@/lib/medusa"
import { LocationsManager } from "./LocationsManager"

export default async function LocationsPage() {
  let locations: AdminStockLocation[] = []
  let errorMsg: string | null = null

  try {
    const res = await listStockLocations()
    locations = res.stock_locations
  } catch (e) {
    if (e instanceof MedusaError && e.status === 401) {
      errorMsg = "Sesión expirada. Recarga el panel."
    } else {
      errorMsg = `No se pudo cargar locations: ${e instanceof Error ? e.message : "error desconocido"}`
    }
  }

  return (
    <div className="p-7 space-y-5 relative">
      <PageWatermark />

      <PageHeader
        title="UBICACIONES"
        stamp={<>{locations.length} ACTIVAS</>}
        stampTone="secondary"
        description={
          <>
            Warehouses y puntos de pickup donde se trackea inventario y desde donde sale el envío
          </>
        }
      />

      {errorMsg ? (
        <div className="stamp-card p-4 bg-primary/5" style={{ borderColor: "#BB3B2E" }}>
          <p className="text-[13px] font-medium text-primary">{errorMsg}</p>
        </div>
      ) : (
        <LocationsManager
          rows={locations.map((l) => ({
            id: l.id,
            name: l.name,
            address_1: l.address?.address_1 ?? "",
            city: l.address?.city ?? "",
            province: "",
            postal_code: "",
            country_code: l.address?.country_code ?? "",
            phone: "",
          }))}
        />
      )}
    </div>
  )
}
