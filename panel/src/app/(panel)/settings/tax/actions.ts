"use server"

import { revalidatePath } from "next/cache"
import {
  createTaxRegion, deleteTaxRegion,
  createTaxRate, updateTaxRate, deleteTaxRate,
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

export async function createTaxRegionAction(input: {
  country_code: string
  province_code?: string
  defaultRate?: { name: string; rate: number; code?: string }
}): Promise<ActionResult> {
  try {
    const country = input.country_code.trim().toLowerCase()
    if (country.length !== 2) return { ok: false, error: "country_code debe ser ISO-2 (ej. ve, us, es)" }
    await createTaxRegion({
      country_code: country,
      province_code: input.province_code?.trim() || undefined,
      default_tax_rate: input.defaultRate?.name && input.defaultRate.rate >= 0
        ? {
            name: input.defaultRate.name.trim(),
            rate: input.defaultRate.rate,
            code: input.defaultRate.code?.trim() || undefined,
          }
        : undefined,
    })
    revalidatePath("/settings/tax")
    return { ok: true }
  } catch (e) { return { ok: false, error: toError(e) } }
}

export async function deleteTaxRegionAction(id: string): Promise<ActionResult> {
  try {
    await deleteTaxRegion(id)
    revalidatePath("/settings/tax")
    return { ok: true }
  } catch (e) { return { ok: false, error: toError(e) } }
}

export async function createTaxRateAction(input: {
  tax_region_id: string
  name: string
  rate: number
  code?: string
}): Promise<ActionResult> {
  try {
    if (!input.name.trim()) return { ok: false, error: "Nombre requerido" }
    if (!Number.isFinite(input.rate) || input.rate < 0) {
      return { ok: false, error: "Rate inválido (>= 0)" }
    }
    await createTaxRate({
      tax_region_id: input.tax_region_id,
      name: input.name.trim(),
      rate: input.rate,
      code: input.code?.trim() || undefined,
    })
    revalidatePath("/settings/tax")
    return { ok: true }
  } catch (e) { return { ok: false, error: toError(e) } }
}

export async function updateTaxRateAction(id: string, patch: {
  name?: string
  rate?: number
  code?: string
}): Promise<ActionResult> {
  try {
    await updateTaxRate(id, patch)
    revalidatePath("/settings/tax")
    return { ok: true }
  } catch (e) { return { ok: false, error: toError(e) } }
}

export async function deleteTaxRateAction(id: string): Promise<ActionResult> {
  try {
    await deleteTaxRate(id)
    revalidatePath("/settings/tax")
    return { ok: true }
  } catch (e) { return { ok: false, error: toError(e) } }
}
