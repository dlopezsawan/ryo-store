/**
 * GET  /admin/finanzas/conversions          — list, optionally ?pago_movil_id=
 * POST /admin/finanzas/conversions          — register a Bs→USDT swap
 *
 * Two flavors supported:
 *
 * 1. **Linked** (body includes pago_movil_id):
 *    The conversion eats from a pago_movil's pending Bs balance. The
 *    POST writes the conversion row + twin ledger entries, recomputes
 *    the parent pago_movil status, and emits an audit log.
 *
 * 2. **Standalone** (body omits pago_movil_id):
 *    The operator converted Bs from the business's own wallet — surplus
 *    from manual sales, accumulated change, refunds, etc. Records the
 *    conversion + ledger entries; no pago_movil to recompute.
 *
 * Body: { pago_movil_id?, amount_bs, amount_usdt,
 *         source_wallet_id?, dest_wallet_id?, note?, converted_at? }
 */

import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import FinanzasModuleService from "../../../../modules/finanzas/service"
import { FINANZAS_MODULE } from "../../../../modules/finanzas"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const fin: FinanzasModuleService = req.scope.resolve(FINANZAS_MODULE)
  const pmId = typeof req.query.pago_movil_id === "string" ? req.query.pago_movil_id : undefined
  const filters: Record<string, unknown> = {}
  if (pmId) filters.pago_movil_id = pmId
  const conversions = await fin.listFinanzasConversions(filters, {
    order: { converted_at: "DESC" },
  } as never)
  res.json({ conversions })
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const fin: FinanzasModuleService = req.scope.resolve(FINANZAS_MODULE)
  const body = (req.body || {}) as {
    pago_movil_id?: string
    amount_bs?: number
    amount_usdt?: number
    source_wallet_id?: string
    dest_wallet_id?: string
    note?: string
    converted_at?: string
  }

  // amount_bs and amount_usdt are always required; pago_movil_id is
  // optional (standalone conversions skip the linkage logic below).
  if (!body.amount_bs || !body.amount_usdt) {
    return res.status(400).json({
      error: "amount_bs and amount_usdt are required",
    })
  }
  if (Number(body.amount_bs) <= 0 || Number(body.amount_usdt) <= 0) {
    return res.status(400).json({ error: "amounts must be > 0" })
  }

  // If linked, validate the parent pago_movil exists and has enough
  // pending Bs balance. Standalone conversions skip both checks.
  let pagoMovil: Awaited<ReturnType<FinanzasModuleService["retrieveFinanzasPagoMovil"]>> | null = null
  if (body.pago_movil_id) {
    pagoMovil = await fin.retrieveFinanzasPagoMovil(body.pago_movil_id).catch(() => null)
    if (!pagoMovil) return res.status(404).json({ error: "pago_movil not found" })

    const remaining = Number(pagoMovil.amount_bs_total) - Number(pagoMovil.bs_converted_total)
    if (Number(body.amount_bs) > remaining + 0.01) {
      return res.status(400).json({
        error: `amount_bs ${body.amount_bs} excede el saldo pendiente ${remaining.toFixed(2)} Bs`,
      })
    }
  }

  // Default wallets when caller omits them.
  let source_wallet_id = body.source_wallet_id ?? null
  let dest_wallet_id = body.dest_wallet_id ?? null
  if (!source_wallet_id) {
    const w = await fin.getDefaultWalletForCurrency("bs")
    source_wallet_id = w?.id ?? null
  }
  if (!dest_wallet_id) {
    const w = await fin.getDefaultWalletForCurrency("usdt")
    dest_wallet_id = w?.id ?? null
  }

  const convertedAt = body.converted_at ? new Date(body.converted_at) : new Date()
  const created = await fin.createFinanzasConversions({
    pago_movil_id: body.pago_movil_id ?? null,
    amount_bs: Number(body.amount_bs),
    amount_usdt: Number(body.amount_usdt),
    rate_bs_per_usdt:
      Math.round((Number(body.amount_bs) / Number(body.amount_usdt)) * 100) / 100,
    source_wallet_id,
    dest_wallet_id,
    note: body.note ?? null,
    converted_at: convertedAt,
  })
  const conversion = Array.isArray(created) ? created[0] : created

  // Twin ledger entries. Note descriptor differs slightly based on flavor
  // so the wallet view shows clear provenance.
  const ledgerNote =
    body.note ??
    (pagoMovil ? `Conversión #${pagoMovil.order_display_id}` : "Conversión Bs→USDT (manual)")

  if (source_wallet_id) {
    await fin.writeWalletEntry({
      wallet_id: source_wallet_id,
      amount: -Math.abs(Number(body.amount_bs)),
      currency: "bs",
      source_type: "conversion_out",
      source_id: conversion.id,
      note: ledgerNote,
      entry_at: convertedAt,
    })
  }
  if (dest_wallet_id) {
    await fin.writeWalletEntry({
      wallet_id: dest_wallet_id,
      amount: Math.abs(Number(body.amount_usdt)),
      currency: "usdt",
      source_type: "conversion_in",
      source_id: conversion.id,
      note: ledgerNote,
      entry_at: convertedAt,
    })
  }

  // Recompute only the linked flavor's parent.
  if (body.pago_movil_id) {
    await fin.recomputePagoMovilConversionStatus(body.pago_movil_id)
  }

  await fin.recordAudit({
    entity_type: "conversion",
    entity_id: conversion.id,
    action: "create",
    after: conversion as unknown as Record<string, unknown>,
  })

  // For linked conversions also return the refreshed parent so the UI
  // can update the pago_movil row in place. Standalone returns just the
  // conversion.
  if (body.pago_movil_id) {
    const fresh = await fin.retrieveFinanzasPagoMovil(body.pago_movil_id)
    return res.status(201).json({ conversion, pago_movil: fresh })
  }
  return res.status(201).json({ conversion })
}
