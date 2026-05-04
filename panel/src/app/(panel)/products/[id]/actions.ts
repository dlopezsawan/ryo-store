"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import {
  updateProduct, updateVariant, createVariant, deleteVariant,
  uploadFiles, retrieveProduct, createProduct, deleteProduct,
  MedusaError,
} from "@/lib/medusa"

type ActionResult<T = void> = { ok: true; data?: T } | { ok: false; error: string }

function toError(e: unknown): string {
  if (e instanceof MedusaError) {
    if (e.status === 401) return "Sesión expirada — recarga el panel."
    if (e.status === 403) return "No tienes permisos para esta acción."
    if (e.status === 422 || e.status === 400) {
      const d = e.details as { message?: string } | undefined
      return d?.message ?? `Datos inválidos (${e.status})`
    }
    return e.message
  }
  return e instanceof Error ? e.message : "Error desconocido"
}

export async function updateProductAction(
  productId: string,
  patch: {
    title?: string
    handle?: string
    description?: string | null
    status?: "draft" | "published" | "proposed" | "rejected"
  },
): Promise<ActionResult> {
  try {
    await updateProduct(productId, patch)
    revalidatePath(`/products/${productId}`)
    revalidatePath("/products")
    return { ok: true }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}

export async function toggleProductStatusAction(
  productId: string,
  next: "draft" | "published",
): Promise<ActionResult> {
  try {
    await updateProduct(productId, { status: next })
    revalidatePath(`/products/${productId}`)
    revalidatePath("/products")
    return { ok: true }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}

export async function updateVariantAction(
  productId: string,
  variantId: string,
  patch: { title?: string; sku?: string | null; manage_inventory?: boolean },
): Promise<ActionResult> {
  try {
    await updateVariant(productId, variantId, patch)
    revalidatePath(`/products/${productId}`)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}

// ─── Variants: precios ───────────────────────────────────────────────

export async function updateVariantPricesAction(
  productId: string,
  variantId: string,
  prices: Array<{ id?: string; amount: number; currency_code: string }>,
): Promise<ActionResult> {
  try {
    if (prices.some((p) => !Number.isFinite(p.amount) || p.amount < 0)) {
      return { ok: false, error: "Algún precio es inválido (debe ser ≥ 0)" }
    }
    await updateVariant(productId, variantId, { prices })
    revalidatePath(`/products/${productId}`)
    revalidatePath("/products")
    return { ok: true }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}

// ─── Variants: create ────────────────────────────────────────────────

export async function createVariantAction(
  productId: string,
  input: {
    title: string
    sku?: string
    manage_inventory?: boolean
    prices?: Array<{ amount: number; currency_code: string }>
  },
): Promise<ActionResult> {
  try {
    if (!input.title.trim()) return { ok: false, error: "Título de variante requerido" }
    // Medusa exige asignar value para cada option del producto. Tomamos
    // el primer value de cada option como default.
    const { product } = await retrieveProduct(productId)
    const options: Record<string, string> = {}
    for (const opt of product.options ?? []) {
      const firstValue = opt.values?.[0]?.value
      if (firstValue) options[opt.title] = firstValue
    }
    await createVariant(productId, {
      title: input.title.trim(),
      sku: input.sku?.trim() || undefined,
      manage_inventory: input.manage_inventory ?? true,
      options,
      prices: (input.prices ?? []).filter((p) => p.amount > 0),
    })
    revalidatePath(`/products/${productId}`)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}

// ─── Variants: delete ────────────────────────────────────────────────

export async function deleteVariantAction(
  productId: string,
  variantId: string,
): Promise<ActionResult> {
  try {
    await deleteVariant(productId, variantId)
    revalidatePath(`/products/${productId}`)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}

// ─── Imágenes ────────────────────────────────────────────────────────

/**
 * Sube imágenes al store de Medusa y las añade al array `images` del
 * producto. Si `setThumbnail` y aún no hay thumbnail, usa la primera
 * subida como thumbnail.
 *
 * El argumento es un FormData con `files` (puede ser uno o varios).
 * Si llega vacío, no hace nada.
 */
export async function uploadProductImagesAction(
  productId: string,
  formData: FormData,
): Promise<ActionResult<{ urls: string[] }>> {
  try {
    const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0)
    if (files.length === 0) return { ok: false, error: "Sin archivos para subir" }
    // Validar tamaños/tipos en server side
    for (const f of files) {
      if (f.size > 8 * 1024 * 1024) {
        return { ok: false, error: `${f.name} supera 8 MB` }
      }
      if (!/^image\//.test(f.type)) {
        return { ok: false, error: `${f.name} no es imagen` }
      }
    }

    // Re-empaquetar en un FormData sólo con los `files` válidos
    const fd = new FormData()
    for (const f of files) fd.append("files", f, f.name)

    const uploaded = await uploadFiles(fd)
    const newImages = uploaded.files.map((f) => ({ url: f.url }))

    // Append a los existentes
    const { product } = await retrieveProduct(productId)
    const existing = (product.images ?? []).map((img) => ({ url: img.url }))
    const merged = [...existing, ...newImages]

    const patch: Parameters<typeof updateProduct>[1] = { images: merged }
    if (!product.thumbnail && newImages[0]?.url) {
      patch.thumbnail = newImages[0].url
    }
    await updateProduct(productId, patch)

    revalidatePath(`/products/${productId}`)
    revalidatePath("/products")
    return { ok: true, data: { urls: newImages.map((i) => i.url) } }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}

export async function removeProductImageAction(
  productId: string,
  imageUrl: string,
): Promise<ActionResult> {
  try {
    const { product } = await retrieveProduct(productId)
    const remaining = (product.images ?? [])
      .filter((img) => img.url !== imageUrl)
      .map((img) => ({ url: img.url }))

    const patch: Parameters<typeof updateProduct>[1] = { images: remaining }
    if (product.thumbnail === imageUrl) {
      patch.thumbnail = remaining[0]?.url ?? null
    }
    await updateProduct(productId, patch)
    revalidatePath(`/products/${productId}`)
    revalidatePath("/products")
    return { ok: true }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}

export async function setProductThumbnailAction(
  productId: string,
  imageUrl: string,
): Promise<ActionResult> {
  try {
    await updateProduct(productId, { thumbnail: imageUrl })
    revalidatePath(`/products/${productId}`)
    revalidatePath("/products")
    return { ok: true }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}

/** Reordena las imágenes del producto. Recibe el array ordenado de URLs. */
export async function reorderProductImagesAction(
  productId: string,
  orderedUrls: string[],
): Promise<ActionResult> {
  try {
    if (!Array.isArray(orderedUrls)) return { ok: false, error: "orderedUrls inválido" }
    // updateProduct con images:[{url}] preserva orden — Medusa indexa rank por posición
    const images = orderedUrls.map((url) => ({ url }))
    await updateProduct(productId, { images })
    revalidatePath(`/products/${productId}`)
    revalidatePath("/products")
    return { ok: true }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}

// ─── Sales Channels assignment ──────────────────────────────────────

export async function updateProductSalesChannelsAction(
  productId: string,
  channelIds: string[],
): Promise<ActionResult> {
  try {
    await updateProduct(productId, {
      sales_channels: channelIds.map((id) => ({ id })),
    })
    revalidatePath(`/products/${productId}`)
    revalidatePath("/products")
    return { ok: true }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}

// ─── Categories + Collection assignment ──────────────────────────────

export async function updateProductCategoriesAction(
  productId: string,
  categoryIds: string[],
  collectionId: string | null,
): Promise<ActionResult> {
  try {
    await updateProduct(productId, {
      categories: categoryIds.map((id) => ({ id })),
      collection_id: collectionId,
    })
    revalidatePath(`/products/${productId}`)
    revalidatePath("/products")
    return { ok: true }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}

// ─── Duplicate + delete product ─────────────────────────────────────

/**
 * Clona un producto: copia title (sufijo " (copia)"), description, status=draft,
 * options + variants con prices, collection y categories.
 * NO copia images (mismas URLs apuntarían al mismo file).
 */
export async function duplicateProductAction(
  productId: string,
  opts?: { redirectToNew?: boolean },
): Promise<ActionResult<{ id: string }>> {
  let newId: string | null = null
  try {
    const { product: src } = await retrieveProduct(productId)
    const baseTitle = src.title.replace(/\s+\(copia\s*\d*\)$/i, "")
    const newTitle = `${baseTitle} (copia)`
    const newHandle = src.handle
      ? `${src.handle}-copy-${Date.now().toString(36).slice(-4)}`
      : undefined

    const variants = (src.variants ?? []).map((v) => ({
      title: v.title || "Default",
      sku: v.sku ? `${v.sku}-COPY` : undefined,
      manage_inventory: true,
      prices: (v.prices ?? [])
        .map((p) => ({ amount: Number(p.amount) || 0, currency_code: p.currency_code }))
        .filter((p) => p.amount > 0),
    }))

    const res = await createProduct({
      title: newTitle,
      handle: newHandle,
      description: src.description ?? undefined,
      status: "draft",
      options: (src.options ?? []).map((opt) => ({
        title: opt.title,
        values: (opt.values ?? []).map((v) => v.value),
      })),
      variants: variants.length > 0 ? variants : undefined,
      collection_id: src.collection?.id ?? null,
      category_ids: (src.categories ?? []).map((c) => c.id),
    })
    newId = res.product.id
    revalidatePath("/products")
    if (opts?.redirectToNew && newId) {
      redirect(`/products/${newId}`)
    }
    return { ok: true, data: { id: newId } }
  } catch (e) {
    if (e instanceof Error && e.message === "NEXT_REDIRECT") throw e
    return { ok: false, error: toError(e) }
  }
}

export async function deleteProductAction(productId: string): Promise<ActionResult> {
  try {
    await deleteProduct(productId)
    revalidatePath("/products")
    return { ok: true }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}
