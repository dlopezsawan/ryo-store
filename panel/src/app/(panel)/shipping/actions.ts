"use server"

import { revalidatePath } from "next/cache"
import {
  createShippingOption, updateShippingOption, deleteShippingOption,
  type CreateShippingOptionInput,
  MedusaError,
} from "@/lib/medusa"

type ActionResult = { ok: true } | { ok: false; error: string }

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

export async function createShippingOptionAction(input: {
  name: string
  service_zone_id: string
  shipping_profile_id: string
  provider_id: string
  price_type: "flat" | "calculated"
  price_amount?: number
  currency_code?: string
}): Promise<ActionResult> {
  try {
    if (!input.name.trim()) return { ok: false, error: "Nombre requerido" }
    if (!input.service_zone_id) return { ok: false, error: "Service zone requerida" }
    if (!input.shipping_profile_id) return { ok: false, error: "Shipping profile requerido" }
    if (!input.provider_id) return { ok: false, error: "Provider requerido" }

    const body: CreateShippingOptionInput = {
      name: input.name.trim(),
      service_zone_id: input.service_zone_id,
      shipping_profile_id: input.shipping_profile_id,
      provider_id: input.provider_id,
      price_type: input.price_type,
      type: {
        label: input.name.trim(),
        code: input.name.trim().toLowerCase().replace(/\s+/g, "_"),
      },
      prices: input.price_type === "flat" && input.price_amount && input.currency_code
        ? [{ currency_code: input.currency_code, amount: input.price_amount }]
        : [],
    }
    await createShippingOption(body)
    revalidatePath("/shipping")
    return { ok: true }
  } catch (e) { return { ok: false, error: toError(e) } }
}

export async function updateShippingOptionAction(id: string, patch: {
  name?: string
  price_type?: "flat" | "calculated"
  price_amount?: number
  currency_code?: string
}): Promise<ActionResult> {
  try {
    const body: Parameters<typeof updateShippingOption>[1] = {}
    if (patch.name !== undefined) body.name = patch.name
    if (patch.price_type !== undefined) body.price_type = patch.price_type
    if (patch.price_amount !== undefined && patch.currency_code) {
      body.prices = [{ currency_code: patch.currency_code, amount: patch.price_amount }]
    }
    await updateShippingOption(id, body)
    revalidatePath("/shipping")
    return { ok: true }
  } catch (e) { return { ok: false, error: toError(e) } }
}

export async function deleteShippingOptionAction(id: string): Promise<ActionResult> {
  try {
    await deleteShippingOption(id)
    revalidatePath("/shipping")
    return { ok: true }
  } catch (e) { return { ok: false, error: toError(e) } }
}
