import Link from "next/link"
import { Search } from "lucide-react"
import { PageHeader, PageWatermark } from "@/components/layout/PageHeader"
import {
  listInventoryItems,
  listStockLocations,
  MedusaError,
  type AdminInventoryItem,
  type AdminStockLocation,
} from "@/lib/medusa"
import { InventoryAdjust } from "./InventoryAdjust"
import { CreateInventoryItem } from "./CreateInventoryItem"
import { InventoryTransfer } from "./InventoryTransfer"
import { BulkAdjustToggle } from "./BulkAdjustToggle"

interface SearchParams {
  q?: string
  location_id?: string
  page?: string
}

const PAGE_SIZE = 50

/** Stock total (suma de stocked - reserved en todas las locations). */
function totalAvailable(it: AdminInventoryItem): number {
  if (typeof it.stocked_quantity === "number") {
    const reserved = it.reserved_quantity ?? 0
    return Math.max(0, it.stocked_quantity - reserved)
  }
  if (!it.location_levels) return 0
  return it.location_levels.reduce(
    (s, l) => s + Math.max(0, (l.stocked_quantity ?? 0) - (l.reserved_quantity ?? 0)),
    0,
  )
}

function totalStocked(it: AdminInventoryItem): number {
  if (typeof it.stocked_quantity === "number") return it.stocked_quantity
  if (!it.location_levels) return 0
  return it.location_levels.reduce((s, l) => s + (l.stocked_quantity ?? 0), 0)
}

function totalReserved(it: AdminInventoryItem): number {
  if (typeof it.reserved_quantity === "number") return it.reserved_quantity
  if (!it.location_levels) return 0
  return it.location_levels.reduce((s, l) => s + (l.reserved_quantity ?? 0), 0)
}

function stockState(available: number): "critical" | "low" | "healthy" | "out" {
  if (available <= 0) return "out"
  if (available < 10) return "critical"
  if (available < 25) return "low"
  return "healthy"
}

const STATE_META = {
  out:      { label: "✕ Sin stock",  color: "text-primary",   tone: "primary" as const },
  critical: { label: "⚠ Crítico",    color: "text-primary",   tone: "primary" as const },
  low:      { label: "⚠ Bajo",       color: "text-orange",    tone: "orange" as const },
  healthy:  { label: "✓ Saludable",  color: "text-secondary", tone: "secondary" as const },
}

export default async function InventoryPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams
  const page = Math.max(1, Number(params.page) || 1)
  const offset = (page - 1) * PAGE_SIZE
  const q = params.q?.trim() || undefined
  const locationFilter = params.location_id || undefined

  let items: AdminInventoryItem[] = []
  let locations: AdminStockLocation[] = []
  let totalCount = 0
  let errorMsg: string | null = null

  try {
    const [itemsRes, locsRes] = await Promise.all([
      listInventoryItems({ limit: PAGE_SIZE, offset, q, location_id: locationFilter }),
      listStockLocations(),
    ])
    items = itemsRes.inventory_items
    totalCount = itemsRes.count
    locations = locsRes.stock_locations
  } catch (e) {
    if (e instanceof MedusaError && e.status === 401) {
      errorMsg = "Sesión expirada. Recarga el panel."
    } else if (e instanceof MedusaError && e.status === 404) {
      errorMsg = "Endpoint de inventario no disponible — ¿módulo de inventory activado en Medusa?"
    } else {
      errorMsg = `No se pudo cargar inventario: ${e instanceof Error ? e.message : "error desconocido"}`
    }
  }

  // Agregados visibles
  const totalSkus = totalCount
  const aggStocked = items.reduce((s, it) => s + totalStocked(it), 0)
  const aggReserved = items.reduce((s, it) => s + totalReserved(it), 0)
  const lowCount = items.filter((it) => {
    const st = stockState(totalAvailable(it))
    return st === "critical" || st === "low" || st === "out"
  }).length
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  return (
    <div className="p-7 space-y-5 relative">
      <PageWatermark />

      <PageHeader
        title="INVENTARIO"
        stamp={
          lowCount > 0 ? (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-primary inline-block streak" />
              {lowCount} SKU{lowCount === 1 ? "" : "S"} BAJO{lowCount === 1 ? "" : "S"}
            </>
          ) : (
            <>✓ TODO OK</>
          )
        }
        stampTone={lowCount > 0 ? "primary" : "secondary"}
        description={
          <>
            {totalSkus} SKUs · stock total <span className="text-ink font-bold num">{aggStocked.toLocaleString("es-VE")}</span> · reservado <span className="text-ink font-bold num">{aggReserved.toLocaleString("es-VE")}</span>
          </>
        }
        actions={
          <>
            <BulkAdjustToggle />
            <CreateInventoryItem />
          </>
        }
      />

      {/* Filters */}
      <div className="stamp-card p-3">
        <form className="flex items-center gap-2" method="GET" action="/inventory">
          <div className="flex-1 relative">
            <Search size={14} strokeWidth={2} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3" />
            <input
              type="text"
              name="q"
              defaultValue={params.q ?? ""}
              placeholder="Buscar por SKU, título…"
              className="w-full pl-8 pr-3 py-2 bg-cream rounded-md text-[12px] font-medium focus:outline-none"
              style={{ border: "1.5px solid var(--border)" }}
            />
          </div>
          {locations.length > 0 && (
            <select
              name="location_id"
              defaultValue={params.location_id ?? ""}
              className="px-3 py-2 bg-cream rounded-md text-[10px] font-display font-bold uppercase tracking-wider text-ink"
              style={{ border: "1.5px solid var(--border)" }}
            >
              <option value="">Todas las locations</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          )}
          <button
            type="submit"
            className="px-3 py-2 bg-cream rounded-md text-[10px] font-display font-bold uppercase tracking-wider text-ink hover:bg-cream-2"
            style={{ border: "1.5px solid var(--border)" }}
          >
            Filtrar
          </button>
          {(params.q || params.location_id) && (
            <Link
              href="/inventory"
              className="px-3 py-2 text-[10px] font-display font-bold uppercase tracking-wider text-ink-3 hover:text-ink"
            >
              Limpiar
            </Link>
          )}
        </form>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-5">
        <KpiBlock label="SKUs trackeados" value={totalSkus.toLocaleString("es-VE")} sub={`${locations.length} location${locations.length === 1 ? "" : "s"}`} />
        <KpiBlock label="Stock crítico" value={lowCount.toString()} sub="bajo o sin stock" tone={lowCount > 0 ? "primary" : "secondary"} />
        <KpiBlock label="Unidades disponibles" value={(aggStocked - aggReserved).toLocaleString("es-VE")} sub={`${aggReserved.toLocaleString("es-VE")} reservadas`} tone="orange" />
        <KpiBlock label="Total stocked" value={aggStocked.toLocaleString("es-VE")} sub="incluye reservas" tone="secondary" />
      </div>

      {errorMsg && (
        <div className="stamp-card p-4 bg-primary/5" style={{ borderColor: "#BB3B2E" }}>
          <p className="text-[13px] font-medium text-primary">{errorMsg}</p>
        </div>
      )}

      {/* Inventory table */}
      {!errorMsg && (
        <div className="stamp-card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 bg-dark text-cream">
            <h3 className="font-display font-black text-[14px] uppercase tracking-wider">
              Niveles de stock
            </h3>
            <span className="text-[10px] font-mono text-orange">
              {items.length} de {totalCount}
            </span>
          </div>

          {items.length === 0 ? (
            <div className="p-12 text-center text-[13px] text-ink-3">
              {q || locationFilter
                ? "No hay items que coincidan con el filtro."
                : "No hay inventory items todavía. Crea uno desde un producto en Medusa."}
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="bg-cream-2 text-[10px] uppercase tracking-[0.12em]" style={{ borderBottom: "2px solid var(--border)" }}>
                  <th className="px-3 py-2.5 text-left font-display font-bold text-ink-2">Producto / SKU</th>
                  <th className="px-3 py-2.5 text-right font-display font-bold text-ink-2">Disponible</th>
                  <th className="px-3 py-2.5 text-right font-display font-bold text-ink-2">Reservado</th>
                  <th className="px-3 py-2.5 text-right font-display font-bold text-ink-2">Stocked</th>
                  <th className="px-3 py-2.5 text-left font-display font-bold text-ink-2">Locations</th>
                  <th className="px-3 py-2.5 text-right font-display font-bold text-ink-2 w-32">Acción</th>
                </tr>
              </thead>
              <tbody className="text-[13px]">
                {items.map((it) => {
                  const available = totalAvailable(it)
                  const stocked = totalStocked(it)
                  const reserved = totalReserved(it)
                  const st = stockState(available)
                  const meta = STATE_META[st]
                  const variant = it.variants?.[0]
                  const productTitle = variant?.product?.title ?? it.title ?? "(sin título)"
                  const productThumb = variant?.product?.thumbnail ?? it.thumbnail
                  const variantTitle = variant?.title && variant.title !== "Default Title" ? variant.title : null

                  // Construir locationStock para el modal de ajuste
                  const levelByLoc = new Map(
                    (it.location_levels ?? []).map((l) => [l.location_id, l]),
                  )
                  const locationStock = locations.map((loc) => {
                    const lvl = levelByLoc.get(loc.id)
                    return {
                      locationId: loc.id,
                      locationName: loc.name,
                      stockedQuantity: lvl?.stocked_quantity ?? 0,
                      reservedQuantity: lvl?.reserved_quantity ?? 0,
                      exists: !!lvl,
                    }
                  })

                  return (
                    <tr key={it.id} className="row-hover row-zebra border-b border-warm-200/50 last:border-b-0">
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-cream-2 overflow-hidden flex-shrink-0" style={{ border: "1.5px solid var(--border)" }}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            {productThumb && <img src={productThumb} alt="" className="w-full h-full object-cover" />}
                          </div>
                          <div className="min-w-0">
                            {variant?.product?.id ? (
                              <Link
                                href={`/products/${variant.product.id}`}
                                className="font-display font-bold text-ink text-[13px] hover:text-orange transition-colors block truncate"
                              >
                                {productTitle}
                              </Link>
                            ) : (
                              <div className="font-display font-bold text-ink text-[13px] truncate">{productTitle}</div>
                            )}
                            <div className="flex items-center gap-2 text-[10px] mt-0.5">
                              {variantTitle && <span className="text-ink-3">{variantTitle}</span>}
                              {it.sku && <span className="font-mono text-ink-3">{it.sku}</span>}
                              <span className={`font-display font-bold uppercase ${meta.color}`}>{meta.label}</span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <span className={`stat-display text-[20px] num ${meta.color}`}>{available}</span>
                      </td>
                      <td className="px-3 py-3 text-right text-ink-2 num text-[12px]">
                        {reserved > 0 ? reserved : "—"}
                      </td>
                      <td className="px-3 py-3 text-right text-ink-3 num text-[12px]">{stocked}</td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-1 items-center">
                          {locationStock.filter((l) => l.exists).map((l) => (
                            <span
                              key={l.locationId}
                              className="inv-chip px-2 py-0.5 text-[10px] font-mono bg-cream-2 rounded-md inline-flex items-center gap-1"
                              style={{ border: "1px solid var(--border)" }}
                              title={`reservado: ${l.reservedQuantity}`}
                            >
                              <span className="text-ink-3">{l.locationName}:</span>
                              <span className="inv-chip-static num font-bold">{l.stockedQuantity}</span>
                              <input
                                type="number"
                                min={0}
                                defaultValue={l.stockedQuantity}
                                data-stock-input
                                data-item-id={it.id}
                                data-location-id={l.locationId}
                                data-original={l.stockedQuantity}
                                className="inv-chip-input num font-bold w-14 px-1 py-0 bg-cream rounded text-right focus:outline-none hidden"
                                style={{ border: "1px solid #FF3B27" }}
                              />
                            </span>
                          ))}
                          {locationStock.filter((l) => l.exists).length === 0 && (
                            <span className="text-[10px] text-ink-3 font-mono">sin levels</span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {locations.length >= 2 && (
                            <InventoryTransfer
                              inventoryItemId={it.id}
                              itemTitle={productTitle}
                              locations={locationStock
                                .filter((l) => l.exists)
                                .map((l) => ({
                                  locationId: l.locationId,
                                  locationName: l.locationName,
                                  stockedQuantity: l.stockedQuantity,
                                }))}
                            />
                          )}
                          <InventoryAdjust
                            inventoryItemId={it.id}
                            itemTitle={productTitle}
                            itemSku={it.sku}
                            locations={locationStock}
                          />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Pagination */}
      {!errorMsg && totalPages > 1 && (
        <Pagination current={page} total={totalPages} q={params.q} location_id={params.location_id} />
      )}
    </div>
  )
}

function Pagination({
  current, total, q, location_id,
}: {
  current: number; total: number; q?: string; location_id?: string
}) {
  const buildHref = (p: number) => {
    const sp = new URLSearchParams()
    if (p > 1) sp.set("page", String(p))
    if (q) sp.set("q", q)
    if (location_id) sp.set("location_id", location_id)
    const s = sp.toString()
    return s ? `/inventory?${s}` : "/inventory"
  }
  const set = new Set([1, 2, 3, current - 1, current, current + 1, total - 1, total])
  const pages: number[] = []
  for (let i = 1; i <= total; i++) if (set.has(i) && i >= 1 && i <= total) pages.push(i)
  return (
    <div className="flex items-center justify-between px-4 py-3 stamp-card">
      <div className="font-mono text-[11px] text-ink-3">
        Página <span className="text-ink font-bold num">{current}</span> de <span className="text-ink font-bold num">{total}</span>
      </div>
      <div className="flex items-center gap-1 font-display font-bold uppercase tracking-wider text-[11px]">
        {current > 1 ? (
          <Link href={buildHref(current - 1)} className="px-2 py-1 text-ink hover:text-orange">‹ Ant.</Link>
        ) : <span className="px-2 py-1 text-ink-3 opacity-40">‹ Ant.</span>}
        {pages.map((p, i) => (
          <span key={p}>
            {i > 0 && pages[i - 1] !== p - 1 && <span className="px-1 text-ink-3">…</span>}
            {p === current ? (
              <span className="px-2.5 py-1 bg-orange text-dark rounded-md num">{p}</span>
            ) : (
              <Link href={buildHref(p)} className="px-2.5 py-1 hover:bg-cream-2 rounded-md text-ink num">{p}</Link>
            )}
          </span>
        ))}
        {current < total ? (
          <Link href={buildHref(current + 1)} className="px-2 py-1 text-ink hover:text-orange">Sig. ›</Link>
        ) : <span className="px-2 py-1 text-ink-3 opacity-40">Sig. ›</span>}
      </div>
    </div>
  )
}

function KpiBlock({
  label, value, sub, tone,
}: {
  label: string; value: string; sub: string; tone?: "primary" | "orange" | "secondary"
}) {
  const bgClass = tone === "primary" ? "bg-primary/5" : tone === "orange" ? "bg-orange/5" : tone === "secondary" ? "bg-secondary/5" : ""
  const labelTone = tone === "primary" ? "text-primary" : tone === "orange" ? "text-orange" : tone === "secondary" ? "text-secondary" : "text-ink-3"
  const valueTone = tone === "primary" ? "text-primary" : tone === "orange" ? "text-orange" : tone === "secondary" ? "text-secondary" : ""
  return (
    <div className={`stamp-card p-4 ${bgClass}`}>
      <div className={`text-[9px] font-display font-bold uppercase tracking-[0.18em] ${labelTone}`}>{label}</div>
      <div className={`stat-display text-[28px] mt-2 num ${valueTone}`}>{value}</div>
      <div className="text-[10px] text-ink-3 font-mono mt-1">{sub}</div>
    </div>
  )
}
