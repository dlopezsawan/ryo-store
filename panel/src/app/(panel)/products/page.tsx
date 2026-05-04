import Link from "next/link"
import { PageHeader, PageWatermark } from "@/components/layout/PageHeader"
import { Search } from "lucide-react"
import { listProducts, MedusaError, type AdminProduct } from "@/lib/medusa"
import { CreateProductButton } from "./CreateProductButton"
import { CsvImporter } from "./CsvImporter"
import { ProductsGrid, type ProductRow } from "./ProductsGrid"
import { LowStockAlert } from "./LowStockAlert"
import { SavedViews } from "@/components/util/SavedViews"

interface SearchParams {
  q?: string
  status?: string
  order?: string
  page?: string
}

const PAGE_SIZE = 24

const SORT_OPTIONS = [
  { value: "-created_at", label: "Más recientes" },
  { value: "created_at",  label: "Más antiguos" },
  { value: "title",       label: "Título A→Z" },
  { value: "-title",      label: "Título Z→A" },
  { value: "-updated_at", label: "Recién editados" },
] as const

export default async function ProductsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams
  const status = params.status === "all" || !params.status ? undefined : [params.status]
  const q = params.q?.trim() || undefined
  const order = params.order || "-created_at"
  const page = Math.max(1, Number(params.page) || 1)
  const offset = (page - 1) * PAGE_SIZE

  let products: AdminProduct[] = []
  let totalCount = 0
  let errorMsg: string | null = null

  try {
    const res = await listProducts({ limit: PAGE_SIZE, offset, q, status, order })
    products = res.products
    totalCount = res.count
  } catch (e) {
    if (e instanceof MedusaError && e.status === 401) {
      errorMsg = "Sesión expirada. Recarga la página."
    } else {
      errorMsg = `No se pudo cargar productos: ${e instanceof Error ? e.message : "error desconocido"}`
    }
  }

  const activeCount = products.filter((p) => p.status === "published").length

  return (
    <div className="p-7 space-y-5 relative">
      <PageWatermark />

      <PageHeader
        title="PRODUCTOS"
        stamp={<span>{totalCount} SKUS · {activeCount} ACTIVOS</span>}
        stampTone="secondary"
        description={`${totalCount} productos en catálogo`}
        actions={
          <div className="flex items-center gap-2">
            <CsvImporter />
            <CreateProductButton />
          </div>
        }
      />

      {/* Filter pills + search */}
      <div className="stamp-card p-3">
        <form className="flex items-center gap-2" method="GET" action="/products">
          <div className="flex-1 relative">
            <Search size={14} strokeWidth={2} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3" />
            <input
              type="text"
              name="q"
              defaultValue={params.q ?? ""}
              placeholder="Buscar por título, descripción, handle…"
              className="w-full pl-8 pr-3 py-2 bg-cream rounded-md text-[12px] font-medium focus:outline-none"
              style={{ border: "1.5px solid var(--border)" }}
            />
          </div>
          <select
            name="status"
            defaultValue={params.status ?? "all"}
            className="px-3 py-2 bg-cream rounded-md text-[10px] font-display font-bold uppercase tracking-wider text-ink hover:bg-cream-2"
            style={{ border: "1.5px solid var(--border)" }}
          >
            <option value="all">Todos</option>
            <option value="published">Publicados</option>
            <option value="draft">Borradores</option>
            <option value="proposed">Propuestos</option>
          </select>
          <select
            name="order"
            defaultValue={params.order ?? "-created_at"}
            className="px-3 py-2 bg-cream rounded-md text-[10px] font-display font-bold uppercase tracking-wider text-ink hover:bg-cream-2"
            style={{ border: "1.5px solid var(--border)" }}
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <button
            type="submit"
            className="px-3 py-2 bg-cream rounded-md text-[10px] font-display font-bold uppercase tracking-wider text-ink hover:bg-cream-2"
            style={{ border: "1.5px solid var(--border)" }}
          >
            Filtrar
          </button>
          {(params.q || params.status || params.order) && (
            <Link
              href="/products"
              className="px-3 py-2 text-[10px] font-display font-bold uppercase tracking-wider text-ink-3 hover:text-ink"
            >
              Limpiar
            </Link>
          )}
        </form>
      </div>

      {errorMsg && (
        <div className="stamp-card p-4 bg-primary/5" style={{ borderColor: "#BB3B2E" }}>
          <p className="text-[13px] font-medium text-primary">{errorMsg}</p>
        </div>
      )}

      <SavedViews
        storageKey="panel_views_products"
        presets={[
          { id: "p-all",        name: "Todos",         query: "",                              createdAt: 0 },
          { id: "p-published",  name: "Publicados",    query: "status=published",              createdAt: 0 },
          { id: "p-draft",      name: "Borradores",    query: "status=draft",                  createdAt: 0 },
          { id: "p-recent",     name: "Más recientes", query: "order=-created_at",             createdAt: 0 },
          { id: "p-az",         name: "A → Z",         query: "order=title",                   createdAt: 0 },
        ]}
      />

      {!errorMsg && products.length > 0 && (
        <LowStockAlert rows={products.map<ProductRow>((p) => {
          const firstVariant = p.variants?.[0]
          const firstPrice = firstVariant?.prices?.[0]
          const totalStock = (p.variants ?? []).reduce((s, v) => s + (v.inventory_quantity ?? 0), 0)
          return {
            id: p.id,
            title: p.title,
            handle: p.handle ?? null,
            status: p.status,
            thumbnail: p.thumbnail ?? null,
            firstSku: firstVariant?.sku ?? null,
            firstPrice: firstPrice ? Number(firstPrice.amount) || 0 : null,
            totalStock,
          }
        })} />
      )}

      {!errorMsg && (
        <ProductsGrid
          rows={products.map<ProductRow>((p) => {
            const firstVariant = p.variants?.[0]
            const firstPrice = firstVariant?.prices?.[0]
            const totalStock = (p.variants ?? []).reduce((s, v) => s + (v.inventory_quantity ?? 0), 0)
            return {
              id: p.id,
              title: p.title,
              handle: p.handle ?? null,
              status: p.status,
              thumbnail: p.thumbnail ?? null,
              firstSku: firstVariant?.sku ?? null,
              firstPrice: firstPrice ? Number(firstPrice.amount) || 0 : null,
              totalStock,
            }
          })}
        />
      )}

      {!errorMsg && totalCount > PAGE_SIZE && (
        <Pagination
          current={page}
          total={Math.max(1, Math.ceil(totalCount / PAGE_SIZE))}
          q={params.q}
          status={params.status}
          order={params.order}
        />
      )}
    </div>
  )
}

function Pagination({
  current, total, q, status, order,
}: {
  current: number; total: number; q?: string; status?: string; order?: string
}) {
  const buildHref = (p: number) => {
    const sp = new URLSearchParams()
    if (p > 1) sp.set("page", String(p))
    if (q) sp.set("q", q)
    if (status) sp.set("status", status)
    if (order) sp.set("order", order)
    const s = sp.toString()
    return s ? `/products?${s}` : "/products"
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

