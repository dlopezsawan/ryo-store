"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createProduct, updateProduct, deleteProduct, MedusaError } from "@/lib/medusa"

type ActionResult = { ok: true; data?: { id: string } } | { ok: false; error: string }

function toError(e: unknown): string {
  if (e instanceof MedusaError) {
    if (e.status === 401) return "Sesión expirada — recarga el panel."
    if (e.status === 403) return "No tienes permisos para esta acción."
    return e.message
  }
  return e instanceof Error ? e.message : "Error desconocido"
}

export async function createProductAction(input: {
  title: string
  handle?: string
  description?: string
  status: "draft" | "published"
  /** Precio base en EUR (0 = sin precio inicial) */
  price?: number
  currency_code?: string
  sku?: string
}): Promise<ActionResult> {
  try {
    if (!input.title.trim()) return { ok: false, error: "El título es requerido" }

    const variants = []
    const hasPrice = input.price !== undefined && input.price > 0
    if (hasPrice || input.sku) {
      variants.push({
        title: "Default",
        sku: input.sku?.trim() || undefined,
        manage_inventory: true,
        options: { Default: "Default" },
        prices: hasPrice
          ? [{ amount: input.price as number, currency_code: input.currency_code ?? "eur" }]
          : [],
      })
    }

    const res = await createProduct({
      title: input.title.trim(),
      handle: input.handle?.trim() || undefined,
      description: input.description?.trim() || undefined,
      status: input.status,
      options: [{ title: "Default option", values: ["Default"] }],
      variants: variants.length > 0 ? variants : undefined,
    })
    revalidatePath("/products")
    return { ok: true, data: { id: res.product.id } }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}

export async function gotoProductAction(id: string): Promise<never> {
  redirect(`/products/${id}`)
}

// ─── CSV import ──────────────────────────────────────────────────────

export interface CsvProduct {
  title: string
  handle?: string
  description?: string
  status?: "draft" | "published"
  sku?: string
  price?: number
  currency_code?: string
}

export interface CsvImportResult {
  ok: number
  failed: Array<{ row: number; title: string; error: string }>
}

export async function importProductsCsvAction(rows: CsvProduct[]): Promise<CsvImportResult> {
  const results = await Promise.allSettled(
    rows.map((r) => createProductAction({
      title: r.title,
      handle: r.handle,
      description: r.description,
      status: r.status ?? "draft",
      sku: r.sku,
      price: r.price,
      currency_code: r.currency_code,
    })),
  )
  const failed: CsvImportResult["failed"] = []
  let ok = 0
  results.forEach((r, i) => {
    if (r.status === "fulfilled" && r.value.ok) ok += 1
    else {
      const err = r.status === "fulfilled"
        ? (r.value.ok ? "" : r.value.error)
        : (r.reason instanceof Error ? r.reason.message : "error")
      failed.push({ row: i + 1, title: rows[i].title, error: err })
    }
  })
  if (ok > 0) revalidatePath("/products")
  return { ok, failed }
}

// ─── Bulk actions ────────────────────────────────────────────────────

export interface BulkProductResult {
  ok: number
  failed: Array<{ id: string; error: string }>
}

export async function bulkSetProductStatusAction(
  productIds: string[],
  status: "draft" | "published",
): Promise<BulkProductResult> {
  const results = await Promise.allSettled(
    productIds.map((id) => updateProduct(id, { status })),
  )
  const failed: BulkProductResult["failed"] = []
  let ok = 0
  results.forEach((r, i) => {
    if (r.status === "fulfilled") ok += 1
    else failed.push({
      id: productIds[i],
      error: r.reason instanceof Error ? r.reason.message : "error",
    })
  })
  if (ok > 0) {
    revalidatePath("/products")
    for (const id of productIds) revalidatePath(`/products/${id}`)
  }
  return { ok, failed }
}

export async function bulkDeleteProductsAction(
  productIds: string[],
): Promise<BulkProductResult> {
  const results = await Promise.allSettled(
    productIds.map((id) => deleteProduct(id)),
  )
  const failed: BulkProductResult["failed"] = []
  let ok = 0
  results.forEach((r, i) => {
    if (r.status === "fulfilled") ok += 1
    else failed.push({
      id: productIds[i],
      error: r.reason instanceof MedusaError ? r.reason.message : "error",
    })
  })
  if (ok > 0) revalidatePath("/products")
  return { ok, failed }
}

/**
 * Bulk price adjustment. Aplica un cambio porcentual o fijo a TODOS los precios
 * de TODAS las variants de los productos seleccionados.
 *  - mode "percent" → multiplica cada precio por (1 + amount/100). Ej amount=10 → +10%
 *  - mode "fixed"   → suma `amount` (en EUR) a cada precio
 *
 * NOTA: este endpoint usa retrieveProduct + updateProductVariant para cada variant
 * por lo que es lento si seleccionás muchos productos. Para volúmenes grandes
 * conviene un endpoint custom batch en el backend.
 */
export async function bulkAdjustPricesAction(
  productIds: string[],
  mode: "percent" | "fixed",
  amount: number,
): Promise<BulkProductResult> {
  const { retrieveProduct, updateVariant } = await import("@/lib/medusa")
  const failed: BulkProductResult["failed"] = []
  let ok = 0

  for (const productId of productIds) {
    try {
      const { product } = await retrieveProduct(productId)
      const variants = product.variants ?? []
      for (const v of variants) {
        const updatedPrices = (v.prices ?? []).map((p) => {
          const cur = Number(p.amount) || 0
          const next = mode === "percent"
            ? cur * (1 + amount / 100)
            : cur + amount
          return {
            currency_code: p.currency_code,
            amount: Math.max(0, Math.round(next * 100) / 100),
          }
        })
        if (updatedPrices.length > 0) {
          await updateVariant(productId, v.id, { prices: updatedPrices })
        }
      }
      ok += 1
    } catch (e) {
      failed.push({
        id: productId,
        error: e instanceof Error ? e.message : "error",
      })
    }
  }
  if (ok > 0) {
    revalidatePath("/products")
    for (const id of productIds) revalidatePath(`/products/${id}`)
  }
  return { ok, failed }
}

/**
 * Bulk duplicate. Para cada productId crea una copia (delegando en el endpoint
 * de duplicación si existe en el backend, sino reconstruyendo manualmente).
 * Aquí simplemente delegamos en el `duplicateProductAction` por producto.
 */
export async function bulkDuplicateProductsAction(
  productIds: string[],
): Promise<BulkProductResult> {
  const { retrieveProduct, createProduct } = await import("@/lib/medusa")
  const failed: BulkProductResult["failed"] = []
  let ok = 0

  for (const productId of productIds) {
    try {
      const { product } = await retrieveProduct(productId)
      // Reconstruir payload mínimo para crear (sin images — el copia arranca fresca)
      await createProduct({
        title: `${product.title} (copia)`,
        handle: product.handle ? `${product.handle}-copy-${Date.now().toString(36).slice(-4)}` : undefined,
        description: product.description ?? undefined,
        status: "draft",  // siempre draft la copia
        thumbnail: product.thumbnail ?? undefined,
      })
      ok += 1
    } catch (e) {
      failed.push({
        id: productId,
        error: e instanceof Error ? e.message : "error",
      })
    }
  }
  if (ok > 0) revalidatePath("/products")
  return { ok, failed }
}
