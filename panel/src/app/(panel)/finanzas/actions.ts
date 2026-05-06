"use server"

import { revalidatePath } from "next/cache"
import {
  createFinanzasExpense, updateFinanzasExpense, deleteFinanzasExpense,
  createFinanzasConversion, createFinanzasTransfer,
  createFinanzasWallet, updateFinanzasWallet, deleteFinanzasWallet,
  MedusaError,
} from "@/lib/medusa"

type ActionResult = { ok: true } | { ok: false; error: string }

function toError(e: unknown): string {
  if (e instanceof MedusaError) {
    if (e.status === 401) return "Sesión expirada — recarga el panel."
    if (e.status === 403) return "No tienes permisos para esta acción."
    if (e.status === 404) return "Endpoint custom de finanzas no implementado en el backend."
    return e.message
  }
  return e instanceof Error ? e.message : "Error desconocido"
}

export async function createExpenseAction(input: {
  category_id: string
  description: string
  amount_usdt: number
  amount_bs?: number
  rate_bs_per_usdt?: number
  paid_from_wallet_id?: string
  receipt_url?: string
  expense_date?: string
  notes?: string
  status?: "paid" | "pending_payment"
}): Promise<ActionResult> {
  try {
    if (!input.category_id) return { ok: false, error: "Categoría requerida" }
    if (!input.description.trim()) return { ok: false, error: "Descripción requerida" }
    if (!Number.isFinite(input.amount_usdt) || input.amount_usdt <= 0) {
      return { ok: false, error: "Monto USDT debe ser > 0" }
    }
    await createFinanzasExpense({
      category_id: input.category_id,
      description: input.description.trim(),
      amount_usdt: input.amount_usdt,
      amount_bs: input.amount_bs,
      rate_bs_per_usdt: input.rate_bs_per_usdt,
      paid_from_wallet_id: input.paid_from_wallet_id,
      receipt_url: input.receipt_url?.trim(),
      expense_date: input.expense_date,
      notes: input.notes?.trim(),
      status: input.status ?? "paid",
    })
    revalidatePath("/finanzas")
    revalidatePath("/finanzas/expenses")
    return { ok: true }
  } catch (e) { return { ok: false, error: toError(e) } }
}

export async function updateExpenseAction(id: string, input: Partial<{
  category_id: string
  description: string
  amount_usdt: number
  amount_bs: number
  paid_from_wallet_id: string
  receipt_url: string
  expense_date: string
  notes: string
  status: "paid" | "pending_payment"
  correction_note: string
}>): Promise<ActionResult> {
  try {
    await updateFinanzasExpense(id, input)
    revalidatePath("/finanzas")
    revalidatePath("/finanzas/expenses")
    return { ok: true }
  } catch (e) { return { ok: false, error: toError(e) } }
}

export async function deleteExpenseAction(id: string): Promise<ActionResult> {
  try {
    await deleteFinanzasExpense(id)
    revalidatePath("/finanzas")
    revalidatePath("/finanzas/expenses")
    return { ok: true }
  } catch (e) { return { ok: false, error: toError(e) } }
}

export async function createConversionAction(input: {
  date?: string
  amount_bs: number
  amount_usdt: number
  reference?: string
  notes?: string
  // Optional. If omitted the backend uses default wallets (first active
  // by sort_order for each currency). The panel surfaces selectors so
  // the operator can pick which Bs wallet to drain and which USDT wallet
  // to credit — the previous default was silently routing every
  // standalone conversion to Leo's USDT wallet.
  source_wallet_id?: string
  dest_wallet_id?: string
}): Promise<ActionResult> {
  try {
    if (input.amount_bs <= 0 || input.amount_usdt <= 0) {
      return { ok: false, error: "Montos deben ser > 0" }
    }
    const rate = input.amount_bs / input.amount_usdt
    await createFinanzasConversion({
      date: input.date || new Date().toISOString().slice(0, 10),
      amount_bs: input.amount_bs,
      amount_usdt: input.amount_usdt,
      rate,
      reference: input.reference?.trim() || undefined,
      notes: input.notes?.trim() || undefined,
      source_wallet_id: input.source_wallet_id || undefined,
      dest_wallet_id: input.dest_wallet_id || undefined,
    })
    revalidatePath("/finanzas")
    return { ok: true }
  } catch (e) { return { ok: false, error: toError(e) } }
}

/**
 * Wallet → wallet transfer. Same-currency transfers just move funds;
 * cross-currency ones (e.g. Bs → USDT) require both `amount` (debited)
 * and `amount_received` (credited at destination).
 */
export async function createTransferAction(input: {
  from_wallet_id: string
  to_wallet_id: string
  amount: number
  amount_received?: number
  rate?: number
  note?: string
  transferred_at?: string
}): Promise<ActionResult> {
  try {
    if (!input.from_wallet_id || !input.to_wallet_id) {
      return { ok: false, error: "Wallets origen y destino son obligatorios" }
    }
    if (input.from_wallet_id === input.to_wallet_id) {
      return { ok: false, error: "Las wallets deben ser distintas" }
    }
    if (!Number.isFinite(input.amount) || input.amount <= 0) {
      return { ok: false, error: "Monto debe ser > 0" }
    }
    await createFinanzasTransfer({
      from_wallet_id: input.from_wallet_id,
      to_wallet_id: input.to_wallet_id,
      amount: input.amount,
      amount_received: input.amount_received,
      rate: input.rate,
      note: input.note?.trim() || undefined,
      transferred_at: input.transferred_at,
    })
    revalidatePath("/finanzas")
    return { ok: true }
  } catch (e) { return { ok: false, error: toError(e) } }
}

// ─── Wallet CRUD ─────────────────────────────────────────────────────

export async function createWalletAction(input: {
  name: string
  currency: string
  description?: string
  sort_order?: number
  is_active?: boolean
}): Promise<ActionResult> {
  try {
    if (!input.name.trim()) return { ok: false, error: "Nombre requerido" }
    if (!input.currency.trim()) return { ok: false, error: "Moneda requerida" }
    await createFinanzasWallet({
      name: input.name.trim(),
      currency: input.currency.trim().toLowerCase(),
      description: input.description?.trim() || undefined,
      sort_order: input.sort_order ?? 0,
      is_active: input.is_active ?? true,
    })
    revalidatePath("/finanzas")
    revalidatePath("/finanzas/settings")
    return { ok: true }
  } catch (e) { return { ok: false, error: toError(e) } }
}

export async function updateWalletAction(id: string, input: Partial<{
  name: string
  currency: string
  description: string | null
  sort_order: number
  is_active: boolean
}>): Promise<ActionResult> {
  try {
    const body: Record<string, unknown> = {}
    if (typeof input.name === "string") body.name = input.name.trim()
    if (typeof input.currency === "string") body.currency = input.currency.trim().toLowerCase()
    if (input.description !== undefined) body.description = input.description
    if (typeof input.sort_order === "number") body.sort_order = input.sort_order
    if (typeof input.is_active === "boolean") body.is_active = input.is_active
    await updateFinanzasWallet(id, body)
    revalidatePath("/finanzas")
    revalidatePath("/finanzas/settings")
    return { ok: true }
  } catch (e) { return { ok: false, error: toError(e) } }
}

export async function deleteWalletAction(id: string): Promise<ActionResult> {
  try {
    await deleteFinanzasWallet(id)
    revalidatePath("/finanzas")
    revalidatePath("/finanzas/settings")
    return { ok: true }
  } catch (e) { return { ok: false, error: toError(e) } }
}
