"use server"

import { revalidatePath } from "next/cache"
import {
  createCategory, updateCategory, deleteCategory,
  createCollection, updateCollection, deleteCollection,
  MedusaError,
} from "@/lib/medusa"

type ActionResult = { ok: true } | { ok: false; error: string }

function toError(e: unknown): string {
  if (e instanceof MedusaError) {
    if (e.status === 401) return "Sesión expirada — recarga el panel."
    if (e.status === 403) return "No tienes permisos para esta acción."
    return e.message
  }
  return e instanceof Error ? e.message : "Error desconocido"
}

// ─── Categories ──────────────────────────────────────────────────────

export async function createCategoryAction(input: {
  name: string
  handle?: string
  description?: string
  parent_category_id?: string | null
  is_active?: boolean
}): Promise<ActionResult> {
  try {
    if (!input.name.trim()) return { ok: false, error: "El nombre es requerido" }
    await createCategory({
      name: input.name.trim(),
      handle: input.handle?.trim() || undefined,
      description: input.description?.trim() || undefined,
      parent_category_id: input.parent_category_id || null,
      is_active: input.is_active ?? true,
    })
    revalidatePath("/catalog")
    return { ok: true }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}

export async function updateCategoryAction(id: string, patch: {
  name?: string
  handle?: string
  description?: string | null
  is_active?: boolean
}): Promise<ActionResult> {
  try {
    await updateCategory(id, patch)
    revalidatePath("/catalog")
    return { ok: true }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}

export async function deleteCategoryAction(id: string): Promise<ActionResult> {
  try {
    await deleteCategory(id)
    revalidatePath("/catalog")
    return { ok: true }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}

// ─── Collections ─────────────────────────────────────────────────────

export async function createCollectionAction(input: {
  title: string
  handle?: string
}): Promise<ActionResult> {
  try {
    if (!input.title.trim()) return { ok: false, error: "El título es requerido" }
    await createCollection({
      title: input.title.trim(),
      handle: input.handle?.trim() || undefined,
    })
    revalidatePath("/catalog")
    return { ok: true }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}

export async function updateCollectionAction(id: string, patch: {
  title?: string
  handle?: string
}): Promise<ActionResult> {
  try {
    await updateCollection(id, patch)
    revalidatePath("/catalog")
    return { ok: true }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}

export async function deleteCollectionAction(id: string): Promise<ActionResult> {
  try {
    await deleteCollection(id)
    revalidatePath("/catalog")
    return { ok: true }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}
