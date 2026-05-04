"use server"

import { revalidatePath } from "next/cache"
import { setInventoryLevel, createInventoryItem, transferInventory, retrieveInventoryItem, MedusaError } from "@/lib/medusa"

type ActionResult = { ok: true } | { ok: false; error: string }

function toError(e: unknown): string {
  if (e instanceof MedusaError) {
    if (e.status === 401) return "Sesión expirada — recarga el panel."
    if (e.status === 403) return "No tienes permisos para esta acción."
    return e.message
  }
  if (e instanceof Error) return e.message
  return "Error desconocido"
}

/**
 * Ajusta el stock de un inventory item en una location concreta.
 * Si el `level` no existe (primera vez en esa warehouse), lo crea con POST;
 * si ya existe, hace POST de update.
 */
export async function adjustStockAction(args: {
  inventoryItemId: string
  locationId: string
  stockedQuantity: number
  exists: boolean
}): Promise<ActionResult> {
  try {
    const qty = Math.max(0, Math.floor(args.stockedQuantity))
    if (!Number.isFinite(qty)) {
      return { ok: false, error: "Cantidad inválida" }
    }
    await setInventoryLevel({
      inventoryItemId: args.inventoryItemId,
      locationId: args.locationId,
      stockedQuantity: qty,
      exists: args.exists,
    })
    revalidatePath("/inventory")
    return { ok: true }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}

/**
 * Crea un nuevo inventory item independiente (no ligado a un product
 * variant). Útil para trackear materiales raw, packaging, etc.
 * Para variantes de productos lo más limpio es crearlas desde el
 * detail del producto.
 */
export async function createInventoryItemAction(input: {
  sku: string
  title: string
  description?: string
  requires_shipping?: boolean
}): Promise<ActionResult> {
  try {
    if (!input.sku.trim()) return { ok: false, error: "SKU requerido" }
    if (!input.title.trim()) return { ok: false, error: "Título requerido" }
    await createInventoryItem({
      sku: input.sku.trim(),
      title: input.title.trim(),
      description: input.description?.trim() || undefined,
      requires_shipping: input.requires_shipping ?? true,
    })
    revalidatePath("/inventory")
    return { ok: true }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}

// ─── Transfer entre locations ────────────────────────────────────────

export async function transferInventoryAction(args: {
  inventoryItemId: string
  fromLocationId: string
  toLocationId: string
  quantity: number
}): Promise<ActionResult & { from?: number; to?: number }> {
  try {
    const r = await transferInventory(args)
    revalidatePath("/inventory")
    return { ok: true, from: r.from, to: r.to }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}

// ─── Bulk adjust (multiple items + locations en una transacción) ─────

export interface BulkAdjustEntry {
  inventoryItemId: string
  locationId: string
  stockedQuantity: number
}

export interface BulkAdjustResult {
  ok: number
  failed: Array<{ key: string; error: string }>
}

export async function bulkAdjustStockAction(entries: BulkAdjustEntry[]): Promise<BulkAdjustResult> {
  // Determinar `exists` para cada entry leyendo el item primero
  // (paralelo). Si la performance se vuelve un problema, batchear.
  const items = await Promise.allSettled(
    Array.from(new Set(entries.map((e) => e.inventoryItemId))).map((id) => retrieveInventoryItem(id)),
  )
  const itemsMap = new Map<string, Awaited<ReturnType<typeof retrieveInventoryItem>>["inventory_item"]>()
  items.forEach((r, i) => {
    if (r.status === "fulfilled") {
      const id = Array.from(new Set(entries.map((e) => e.inventoryItemId)))[i]
      itemsMap.set(id, r.value.inventory_item)
    }
  })

  const results = await Promise.allSettled(
    entries.map(async (entry) => {
      if (!Number.isFinite(entry.stockedQuantity) || entry.stockedQuantity < 0) {
        throw new Error("Cantidad inválida")
      }
      const item = itemsMap.get(entry.inventoryItemId)
      const exists = !!item?.location_levels?.find((l) => l.location_id === entry.locationId)
      await setInventoryLevel({
        inventoryItemId: entry.inventoryItemId,
        locationId: entry.locationId,
        stockedQuantity: Math.floor(entry.stockedQuantity),
        exists,
      })
    }),
  )
  const failed: BulkAdjustResult["failed"] = []
  let ok = 0
  results.forEach((r, i) => {
    if (r.status === "fulfilled") ok += 1
    else {
      const e = entries[i]
      failed.push({
        key: `${e.inventoryItemId}@${e.locationId}`,
        error: r.reason instanceof Error ? r.reason.message : "error",
      })
    }
  })
  if (ok > 0) revalidatePath("/inventory")
  return { ok, failed }
}
