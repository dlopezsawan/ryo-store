import { PageHeader, PageWatermark } from "@/components/layout/PageHeader"
import {
  listCategories, listCollections,
  MedusaError,
  type AdminCategory, type AdminCollection,
} from "@/lib/medusa"
import { CatalogManager } from "./CatalogManager"

export default async function CatalogPage() {
  let categories: AdminCategory[] = []
  let collections: AdminCollection[] = []
  let errorMsg: string | null = null

  try {
    const [catsRes, colsRes] = await Promise.all([listCategories(), listCollections()])
    categories = catsRes.product_categories
    collections = colsRes.collections
  } catch (e) {
    if (e instanceof MedusaError && e.status === 401) {
      errorMsg = "Sesión expirada. Recarga el panel."
    } else {
      errorMsg = `No se pudo cargar el catálogo: ${e instanceof Error ? e.message : "error desconocido"}`
    }
  }

  return (
    <div className="p-7 space-y-5 relative">
      <PageWatermark />

      <PageHeader
        title="CATÁLOGO"
        stamp={<>{categories.length + collections.length} ENTRADAS</>}
        stampTone="secondary"
        description={
          <>
            {categories.length} categoría{categories.length === 1 ? "" : "s"} ·{" "}
            {collections.length} colección{collections.length === 1 ? "" : "es"} · taxonomía del store
          </>
        }
      />

      {errorMsg && (
        <div className="stamp-card p-4 bg-primary/5" style={{ borderColor: "#BB3B2E" }}>
          <p className="text-[13px] font-medium text-primary">{errorMsg}</p>
        </div>
      )}

      {!errorMsg && (
        <CatalogManager
          categories={categories.map((c) => ({
            id: c.id,
            name: c.name,
            handle: c.handle,
            is_active: c.is_active,
            description: c.description ?? "",
          }))}
          collections={collections.map((c) => ({
            id: c.id,
            title: c.title,
            handle: c.handle,
          }))}
        />
      )}
    </div>
  )
}
