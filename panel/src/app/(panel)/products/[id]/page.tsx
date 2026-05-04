import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Package, Tag, Calendar, ImageIcon } from "lucide-react"
import {
  retrieveProduct, listSalesChannels, listCategories, listCollections, listStores,
  MedusaError, type AdminProductDetail,
} from "@/lib/medusa"
import { fmtEur, fmtRelative } from "@/lib/utils"
import { ProductEdit } from "./ProductEdit"
import { ImageManager } from "./ImageManager"
import { VariantsManager, type VariantRow } from "./VariantsManager"
import { AssignmentsPanel } from "./AssignmentsPanel"

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  let product: AdminProductDetail
  try {
    const res = await retrieveProduct(id)
    product = res.product
  } catch (e) {
    if (e instanceof MedusaError && e.status === 404) notFound()
    throw e
  }

  const variants = product.variants ?? []
  const images = product.images ?? []
  const totalStock = variants.reduce((s, v) => s + (v.inventory_quantity ?? 0), 0)
  const minPrice = variants.reduce<number | null>((min, v) => {
    const price = v.prices?.[0]?.amount
    if (price == null) return min
    return min == null ? Number(price) : Math.min(min, Number(price))
  }, null)
  const maxPrice = variants.reduce<number | null>((max, v) => {
    const price = v.prices?.[0]?.amount
    if (price == null) return max
    return max == null ? Number(price) : Math.max(max, Number(price))
  }, null)

  const status = product.status === "published"
    ? { label: "Publicado", cls: "text-secondary" }
    : product.status === "draft"
      ? { label: "Borrador", cls: "text-ink-3" }
      : { label: product.status, cls: "text-orange" }

  const stockTone = totalStock === 0 ? "primary" : totalStock < 10 ? "orange" : "secondary"

  // Catálogos para los panels de asignación — cada uno fail-soft
  const [channelsRes, categoriesRes, collectionsRes, storesRes] = await Promise.all([
    listSalesChannels().catch(() => ({ sales_channels: [] })),
    listCategories().catch(() => ({ product_categories: [] })),
    listCollections().catch(() => ({ collections: [] })),
    listStores().catch(() => ({ stores: [] })),
  ])
  const allChannels = channelsRes.sales_channels.filter((c) => !c.is_disabled).map((c) => ({ id: c.id, name: c.name }))
  const allCategories = categoriesRes.product_categories.map((c) => ({ id: c.id, name: c.name }))
  const allCollections = collectionsRes.collections.map((c) => ({ id: c.id, name: c.title }))

  // Currencies del store (para columnas de precio en variantes)
  const storeCurrencies = (storesRes.stores[0]?.supported_currencies ?? []).map((c) => c.currency_code)

  // Map de variants → rows del manager
  const variantRows: VariantRow[] = variants.map((v) => ({
    id: v.id,
    title: v.title,
    sku: v.sku ?? "",
    manage_inventory: false, // no expuesto en list — se asume true
    inventoryQuantity: v.inventory_quantity ?? 0,
    prices: (v.prices ?? []).map((p) => ({
      id: undefined, // Medusa v2 maneja IDs internos al hacer update
      amount: Number(p.amount) || 0,
      currency_code: p.currency_code,
    })),
  }))

  return (
    <div className="p-7 space-y-5 relative">
      <div className="watermark-amp text-[400px] -top-32 right-0 select-none italic">&amp;</div>

      <div className="flex items-start justify-between relative">
        <div className="flex items-center gap-4">
          <Link
            href="/products"
            className="w-10 h-10 hover:bg-cream-2 flex items-center justify-center text-ink transition-colors"
            style={{ border: "1.5px solid var(--border)", borderRadius: 3 }}
          >
            <ArrowLeft size={16} strokeWidth={2.5} />
          </Link>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="font-display font-black text-[28px] text-ink leading-none tracking-tight">
                {product.title}
              </h1>
              <span className={`pill ${status.cls}`}>
                <span className="pill-dot" />
                {status.label}
              </span>
            </div>
            <p className="text-[12px] text-ink-3 font-mono">
              {product.handle && <>/{product.handle} · </>}
              creado {fmtRelative(product.created_at)}
              {product.collection && <> · {product.collection.title}</>}
            </p>
          </div>
        </div>
        <ProductEdit
          productId={product.id}
          initial={{
            title: product.title,
            handle: product.handle ?? "",
            description: product.description ?? "",
            status: product.status,
          }}
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        <Stat label="Variantes" value={String(variants.length)} icon={<Tag size={16} />} />
        <Stat
          label="Stock total"
          value={String(totalStock)}
          icon={<Package size={16} />}
          tone={stockTone}
        />
        <Stat
          label="Precio"
          value={
            minPrice == null
              ? "—"
              : minPrice === maxPrice
                ? fmtEur(minPrice)
                : `${fmtEur(minPrice)} – ${fmtEur(maxPrice ?? minPrice)}`
          }
          icon={<Calendar size={16} />}
          accent
        />
        <Stat label="Imágenes" value={String(images.length)} icon={<ImageIcon size={16} />} />
      </div>

      <div className="grid grid-cols-12 gap-5">
        {/* LEFT — variants table + description */}
        <div className="col-span-8 space-y-5">
          <VariantsManager
            productId={product.id}
            variants={variantRows}
            storeCurrencies={storeCurrencies}
          />

          {product.description && (
            <div className="stamp-card p-5">
              <h3 className="font-display font-black text-[14px] uppercase tracking-wider mb-3">
                Descripción
              </h3>
              <p className="text-[13px] text-ink-2 leading-relaxed whitespace-pre-line">
                {product.description}
              </p>
            </div>
          )}

          {product.options && product.options.length > 0 && (
            <div className="stamp-card p-5">
              <h3 className="font-display font-black text-[12px] uppercase tracking-wider mb-3">
                Opciones
              </h3>
              <dl className="text-[11px] font-mono space-y-1.5">
                {product.options.map((opt) => (
                  <div key={opt.id} className="flex justify-between gap-3">
                    <dt className="text-ink-3 uppercase tracking-wider">{opt.title}</dt>
                    <dd className="text-ink text-right">
                      {opt.values?.map((v) => v.value).join(" · ") ?? "—"}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </div>

        {/* RIGHT — media + asignaciones */}
        <div className="col-span-4 space-y-4">
          <ImageManager
            productId={product.id}
            thumbnail={product.thumbnail ?? null}
            images={images.map((i) => ({ id: i.id, url: i.url }))}
          />

          <AssignmentsPanel
            productId={product.id}
            allChannels={allChannels}
            allCategories={allCategories}
            allCollections={allCollections}
            currentChannelIds={(product.sales_channels ?? []).map((c) => c.id)}
            currentCategoryIds={(product.categories ?? []).map((c) => c.id)}
            currentCollectionId={product.collection?.id ?? null}
          />
        </div>
      </div>
    </div>
  )
}

function Stat({
  label,
  value,
  icon,
  accent,
  tone,
}: {
  label: string
  value: string
  icon: React.ReactNode
  accent?: boolean
  tone?: "primary" | "orange" | "secondary"
}) {
  const valueColor = accent
    ? "text-orange"
    : tone === "primary"
      ? "text-primary"
      : tone === "orange"
        ? "text-orange"
        : tone === "secondary"
          ? "text-secondary"
          : "text-ink"
  return (
    <div
      className="stamp-card p-4"
      style={{
        boxShadow: accent ? "4px 4px 0 0 var(--shadow-color)" : undefined,
      }}
    >
      <div className="flex items-center gap-2 mb-1.5 text-ink-3">
        {icon}
        <span className="text-[10px] font-display font-bold uppercase tracking-[0.18em]">{label}</span>
      </div>
      <div className={`font-display font-black text-[20px] num ${valueColor}`}>{value}</div>
    </div>
  )
}
