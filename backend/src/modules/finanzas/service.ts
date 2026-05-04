import { MedusaService } from "@medusajs/framework/utils"
import FinanzasWallet from "./models/wallet"
import FinanzasSplitRule from "./models/split-rule"
import FinanzasProductCost from "./models/product-cost"
import FinanzasPagoMovil from "./models/pago-movil"
import FinanzasPagoMovilLine from "./models/pago-movil-line"
import FinanzasConversion from "./models/conversion"
import FinanzasExpenseCategory from "./models/expense-category"
import FinanzasExpense from "./models/expense"
import FinanzasWalletEntry from "./models/wallet-entry"
import FinanzasTransfer from "./models/transfer"
import FinanzasAuditLog from "./models/audit-log"
import FinanzasRateSnapshot from "./models/rate-snapshot"
import FinanzasProductCostHistory from "./models/product-cost-history"
import FinanzasMonthClose from "./models/month-close"
import FinanzasUserRole from "./models/user-role"
import FinanzasComment from "./models/comment"
import { applyComboDiscount } from "./lib/combo-tiers"

/**
 * Map adjustment codes → human-readable tier label. Used when order arrives
 * with line_item adjustments already materialized — finanzas no recalcula,
 * sólo reporta cuál tier dominó la orden para el dashboard.
 */
function dominantTierLabelFromCodes(codes: string[]): string | null {
  const set = new Set(codes)
  if (set.has("WHOLESALE30")) return "30% Mayorista"
  if (set.has("COMBO20")) return "20% OFF"
  if (set.has("COMBO15")) return "15% OFF"
  if (set.has("COMBO10")) return "10% OFF"
  return null
}

const r2 = (n: number) => Math.round(n * 100) / 100
const r4 = (n: number) => Math.round(n * 10000) / 10000

export type LineInput = {
  order_line_item_id?: string | null
  product_id: string | null
  variant_id: string | null
  product_handle: string | null
  title: string
  quantity: number
  unit_price_eur: number
  /**
   * Descuento ya aplicado a esta línea (en EUR). Si está presente, finanzas
   * lo respeta tal cual sin recalcular. Comes from order_line_item_adjustment
   * para órdenes completadas, o calculado en el frontend para previews.
   * Si está ausente o null, finanzas hace el cálculo legacy (combo-tiers
   * vs. medusaDiscount, prorrateado por línea).
   */
  line_discount_eur?: number | null
  /**
   * Códigos comma-separated de los adjustments aplicados a esta línea
   * (e.g. "COMBO10", "WHOLESALE30", "ENROLAWELCOME"). Usado para derivar
   * `combo_tier_label` en el output sin recalcular.
   */
  adjustment_codes?: string | null
}

export type ComputeOutput = {
  amount_eur_subtotal: number
  amount_eur_discount: number
  amount_eur_total: number
  amount_bs_total: number
  amount_usdt_theoretical: number
  amount_eur_cogs: number
  amount_bs_cogs: number
  amount_usdt_cogs: number
  amount_eur_margin: number
  amount_bs_margin: number
  amount_usdt_margin: number
  split_restock_eur: number
  split_restock_bs: number
  split_restock_usdt: number
  split_gastos_fijos_eur: number
  split_gastos_fijos_bs: number
  split_gastos_fijos_usdt: number
  split_marketing_eur: number
  split_marketing_bs: number
  split_marketing_usdt: number
  split_ganancia_eur: number
  split_ganancia_bs: number
  split_ganancia_usdt: number
  cogs_complete: boolean
  margin_negative: boolean
  combo_tier_label: string | null
  lines: Array<{
    order_line_item_id: string | null
    product_id: string | null
    variant_id: string | null
    product_handle: string | null
    title: string
    quantity: number
    unit_price_eur: number
    line_subtotal_eur: number
    line_discount_eur: number
    line_revenue_eur: number
    unit_cost_eur: number | null
    line_cost_eur: number | null
    line_margin_eur: number | null
  }>
}

class FinanzasModuleService extends MedusaService({
  FinanzasWallet,
  FinanzasSplitRule,
  FinanzasProductCost,
  FinanzasPagoMovil,
  FinanzasPagoMovilLine,
  FinanzasConversion,
  FinanzasExpenseCategory,
  FinanzasExpense,
  FinanzasWalletEntry,
  FinanzasTransfer,
  FinanzasAuditLog,
  FinanzasRateSnapshot,
  FinanzasProductCostHistory,
  FinanzasMonthClose,
  FinanzasUserRole,
  FinanzasComment,
}) {
  // ──────────────────────────────────────────────────────────────────────
  // Split rules
  // ──────────────────────────────────────────────────────────────────────

  async assertSplitRulesSumTo100(): Promise<void> {
    const rules = await this.listFinanzasSplitRules({ is_active: true })
    const sum = rules.reduce((s, r) => s + Number(r.percentage || 0), 0)
    if (Math.round(sum) !== 100) {
      throw new Error(
        `Split rules must sum to 100, currently ${sum}. Edit /dashboard/finanzas → Configuración.`
      )
    }
  }

  async getActiveSplitFractions(): Promise<{
    gastos_fijos: number
    marketing: number
    ganancia: number
  }> {
    const rules = await this.listFinanzasSplitRules({ is_active: true })
    const get = (key: string) =>
      Number(rules.find((r) => r.bucket === key)?.percentage ?? 0) / 100
    return {
      gastos_fijos: get("gastos_fijos"),
      marketing: get("marketing"),
      ganancia: get("ganancia"),
    }
  }

  // ──────────────────────────────────────────────────────────────────────
  // Pago móvil math (combo-aware, snapshot of line costs)
  // ──────────────────────────────────────────────────────────────────────

  async computePagoMovilFields(args: {
    lines: LineInput[]
    bcvEurRate: number
    usdtEurRate: number
    medusaTotalEur: number
  }): Promise<ComputeOutput> {
    const { lines, bcvEurRate, usdtEurRate, medusaTotalEur } = args

    const subtotalEur = lines.reduce((s, l) => s + l.unit_price_eur * l.quantity, 0)
    const lineSubs = lines.map((l) => l.unit_price_eur * l.quantity)
    const sumSubs = lineSubs.reduce((s, n) => s + n, 0)

    // ── Path A (preferido): el caller trajo `line_discount_eur` ya
    //    materializado en cada línea (origen: order_line_item_adjustment).
    //    Es la fuente de verdad. Finanzas NO recalcula combos.
    const hasPerLineDiscounts = lines.some(
      (l) => typeof l.line_discount_eur === "number" && l.line_discount_eur > 0
    )

    let allocDiscounts: number[]
    let finalDiscount: number
    let comboTierLabel: string | null = null

    if (hasPerLineDiscounts) {
      allocDiscounts = lines.map((l) => Number(l.line_discount_eur) || 0)
      finalDiscount = allocDiscounts.reduce((s, n) => s + n, 0)
      // Derivamos el tier label desde los códigos visibles en los adjustments
      const allCodes = lines
        .map((l) => l.adjustment_codes || "")
        .join(",")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
      comboTierLabel = dominantTierLabelFromCodes(allCodes)
    } else {
      // ── Path B (legacy fallback): no hay adjustments — caller no migrado
      //    o preview-time. Replicamos lógica vieja: combo-tiers + medusaDiscount,
      //    prorrateado proporcionalmente al subtotal de cada línea.
      const totalQty = lines.reduce((s, l) => s + Number(l.quantity), 0)
      const combo = applyComboDiscount(
        subtotalEur,
        totalQty,
        lines.map((l) => ({ unit_price: l.unit_price_eur, quantity: l.quantity }))
      )
      const medusaDiscount = Math.max(0, subtotalEur - medusaTotalEur)
      finalDiscount = Math.max(combo.discount, medusaDiscount)
      allocDiscounts =
        sumSubs <= 0 || finalDiscount <= 0
          ? lines.map(() => 0)
          : lineSubs.map((sub) => (sub / sumSubs) * finalDiscount)
      comboTierLabel = combo.activeTier?.label ?? null
    }

    const totalEur = subtotalEur - finalDiscount

    const variantIds = lines.map((l) => l.variant_id).filter(Boolean) as string[]
    const costs = variantIds.length
      ? await this.listFinanzasProductCosts({ variant_id: variantIds })
      : []
    const costByVariant = new Map(costs.map((c) => [c.variant_id, Number(c.unit_cost_eur)]))

    let cogsComplete = true
    let totalCogsEur = 0
    const lineRows = lines.map((l, i) => {
      const sub = lineSubs[i]
      const lineDiscount = allocDiscounts[i]
      const revenue = sub - lineDiscount
      const unit = l.variant_id ? costByVariant.get(l.variant_id) : undefined
      let lineCost: number | null = null
      let lineMargin: number | null = null
      if (typeof unit === "number") {
        lineCost = unit * Number(l.quantity)
        lineMargin = revenue - lineCost
        totalCogsEur += lineCost
      } else {
        cogsComplete = false
      }
      return {
        order_line_item_id: l.order_line_item_id ?? null,
        product_id: l.product_id,
        variant_id: l.variant_id,
        product_handle: l.product_handle,
        title: l.title,
        quantity: Number(l.quantity),
        unit_price_eur: l.unit_price_eur,
        line_subtotal_eur: r2(sub),
        line_discount_eur: r2(lineDiscount),
        line_revenue_eur: r2(revenue),
        unit_cost_eur: typeof unit === "number" ? r4(unit) : null,
        line_cost_eur: lineCost != null ? r2(lineCost) : null,
        line_margin_eur: lineMargin != null ? r2(lineMargin) : null,
      }
    })

    const marginEur = totalEur - totalCogsEur
    const marginNegative = marginEur < 0
    const splits = await this.getActiveSplitFractions()
    const gf = marginNegative ? 0 : marginEur * splits.gastos_fijos
    const mk = marginNegative ? 0 : marginEur * splits.marketing
    const gn = marginNegative ? 0 : marginEur * splits.ganancia

    const toBs = (eur: number) => r2(eur * bcvEurRate)
    const toUsdt = (eur: number) => r2(eur / usdtEurRate)

    return {
      amount_eur_subtotal: r2(subtotalEur),
      amount_eur_discount: r2(finalDiscount),
      amount_eur_total: r2(totalEur),
      amount_bs_total: toBs(totalEur),
      amount_usdt_theoretical: toUsdt(totalEur),
      amount_eur_cogs: r2(totalCogsEur),
      amount_bs_cogs: toBs(totalCogsEur),
      amount_usdt_cogs: toUsdt(totalCogsEur),
      amount_eur_margin: r2(marginEur),
      amount_bs_margin: toBs(marginEur),
      amount_usdt_margin: toUsdt(marginEur),
      split_restock_eur: r2(totalCogsEur),
      split_restock_bs: toBs(totalCogsEur),
      split_restock_usdt: toUsdt(totalCogsEur),
      split_gastos_fijos_eur: r2(gf),
      split_gastos_fijos_bs: toBs(gf),
      split_gastos_fijos_usdt: toUsdt(gf),
      split_marketing_eur: r2(mk),
      split_marketing_bs: toBs(mk),
      split_marketing_usdt: toUsdt(mk),
      split_ganancia_eur: r2(gn),
      split_ganancia_bs: toBs(gn),
      split_ganancia_usdt: toUsdt(gn),
      cogs_complete: cogsComplete,
      margin_negative: marginNegative,
      combo_tier_label: comboTierLabel,
      lines: lineRows,
    }
  }

  async recomputePagoMovil(pagoMovilId: string): Promise<void> {
    const pm = await this.retrieveFinanzasPagoMovil(pagoMovilId)
    const lines = await this.listFinanzasPagoMovilLines({ pago_movil_id: pagoMovilId })
    if (lines.length === 0) return
    const computed = await this.computePagoMovilFields({
      lines: lines.map((l) => ({
        order_line_item_id: l.order_line_item_id,
        product_id: l.product_id,
        variant_id: l.variant_id,
        product_handle: l.product_handle,
        title: l.title,
        quantity: Number(l.quantity),
        unit_price_eur: Number(l.unit_price_eur),
      })),
      bcvEurRate: Number(pm.bcv_eur_rate),
      usdtEurRate: Number(pm.usdt_eur_rate),
      medusaTotalEur: Number(pm.amount_eur_total) + Number(pm.amount_eur_discount),
    })

    const beforeSnapshot = { ...pm }
    const { lines: _ignored, ...parentFields } = computed

    // Track delta in amount_bs_total to keep ledger in sync
    const oldBsTotal = Number(pm.amount_bs_total || 0)
    const newBsTotal = Number(parentFields.amount_bs_total)
    const bsDelta = newBsTotal - oldBsTotal

    await this.updateFinanzasPagoMovils({ id: pagoMovilId, ...parentFields })

    if (lines.length) await this.deleteFinanzasPagoMovilLines(lines.map((l) => l.id))
    await this.createFinanzasPagoMovilLines(
      computed.lines.map((l) => ({ ...l, pago_movil_id: pagoMovilId }))
    )

    // Sync ledger: if amount changed, write an "adjustment" entry to the
    // associated Bs wallet so balances remain accurate.
    if (Math.abs(bsDelta) > 0.01) {
      const bsWallet = (await this.listFinanzasWallets({ currency: "bs", is_active: true }))[0]
      if (bsWallet) {
        await this.writeWalletEntry({
          wallet_id: bsWallet.id,
          amount: bsDelta,
          currency: "bs",
          source_type: "adjustment",
          source_id: pagoMovilId,
          note: `Recalculo de orden #${pm.order_display_id}: ${oldBsTotal} → ${newBsTotal}`,
          entry_at: new Date(),
        })
      }
    }

    await this.recordAudit({
      entity_type: "pago_movil",
      entity_id: pagoMovilId,
      action: "recompute",
      before: beforeSnapshot as unknown as Record<string, unknown>,
      after: parentFields as unknown as Record<string, unknown>,
    })

    await this.recomputePagoMovilConversionStatus(pagoMovilId)
  }

  async recomputeAllPagoMovils(): Promise<number> {
    const all = await this.listFinanzasPagoMovils({})
    for (const pm of all) await this.recomputePagoMovil(pm.id)
    return all.length
  }

  async recomputePagoMovilConversionStatus(pagoMovilId: string): Promise<void> {
    const conversions = await this.listFinanzasConversions({ pago_movil_id: pagoMovilId })
    const bsConverted = conversions.reduce((s, c) => s + Number(c.amount_bs || 0), 0)
    const pagoMovil = await this.retrieveFinanzasPagoMovil(pagoMovilId)
    const totalBs = Number(pagoMovil.amount_bs_total || 0)
    const pending = Math.max(0, totalBs - bsConverted)

    let status = pagoMovil.status
    if (status === "pendiente_verificacion") {
      // leave as-is
    } else if (bsConverted <= 0) {
      status = "verificado"
    } else if (bsConverted < totalBs - 0.01) {
      status = "parcialmente_convertido"
    } else {
      status = "convertido"
    }

    await this.updateFinanzasPagoMovils({
      id: pagoMovilId,
      bs_converted_total: bsConverted,
      bs_pending: pending,
      status,
    })
  }

  static allocateDiscount(lineSubtotals: number[], totalDiscount: number): number[] {
    const sum = lineSubtotals.reduce((s, n) => s + n, 0)
    if (sum <= 0 || totalDiscount <= 0) return lineSubtotals.map(() => 0)
    return lineSubtotals.map((sub) => (sub / sum) * totalDiscount)
  }

  // ──────────────────────────────────────────────────────────────────────
  // Wallet ledger
  // ──────────────────────────────────────────────────────────────────────

  async writeWalletEntry(args: {
    wallet_id: string
    amount: number
    currency: string
    source_type: string
    source_id?: string | null
    note?: string | null
    entry_at?: Date
  }): Promise<{ id: string }> {
    const created = await this.createFinanzasWalletEntries({
      wallet_id: args.wallet_id,
      amount: args.amount,
      currency: args.currency,
      source_type: args.source_type,
      source_id: args.source_id ?? null,
      note: args.note ?? null,
      entry_at: args.entry_at ?? new Date(),
    })
    return { id: (Array.isArray(created) ? created[0] : created).id }
  }

  /** All entries authored by a given source (e.g. "conversion", id). */
  async findEntriesBySource(sourceType: string, sourceId: string) {
    return this.listFinanzasWalletEntries({
      source_type: sourceType,
      source_id: sourceId,
    })
  }

  /** Reverse all entries authored by a source — used when source is deleted. */
  async reverseEntriesBySource(sourceType: string, sourceId: string): Promise<void> {
    const entries = await this.findEntriesBySource(sourceType, sourceId)
    if (entries.length) {
      await this.deleteFinanzasWalletEntries(entries.map((e) => e.id))
    }
  }

  async getWalletBalance(walletId: string): Promise<number> {
    const entries = await this.listFinanzasWalletEntries({ wallet_id: walletId })
    const sum = entries.reduce((s, e) => s + Number(e.amount), 0)
    return Math.round(sum * 100) / 100
  }

  /** Default Bs / USDT wallet helpers — used when source rows omit a wallet. */
  async getDefaultWalletForCurrency(currency: string): Promise<{ id: string; name: string } | null> {
    const wallets = await this.listFinanzasWallets({ currency, is_active: true }, {
      order: { sort_order: "ASC" },
    } as never)
    return wallets[0] ? { id: wallets[0].id, name: wallets[0].name } : null
  }

  // ──────────────────────────────────────────────────────────────────────
  // Transfers
  // ──────────────────────────────────────────────────────────────────────

  async createTransfer(args: {
    from_wallet_id: string
    to_wallet_id: string
    amount: number
    rate?: number | null
    amount_received?: number | null
    note?: string | null
    transferred_at?: Date
  }): Promise<{ id: string }> {
    const fromW = await this.retrieveFinanzasWallet(args.from_wallet_id)
    const toW = await this.retrieveFinanzasWallet(args.to_wallet_id)
    if (!fromW || !toW) throw new Error("wallet not found")
    const sameCurrency = fromW.currency === toW.currency
    const amountReceived = sameCurrency
      ? args.amount
      : Number(args.amount_received ?? args.amount)

    const created = await this.createFinanzasTransfers({
      from_wallet_id: args.from_wallet_id,
      to_wallet_id: args.to_wallet_id,
      amount: args.amount,
      currency: fromW.currency,
      rate: args.rate ?? null,
      amount_received: amountReceived,
      note: args.note ?? null,
      transferred_at: args.transferred_at ?? new Date(),
    })
    const tId = (Array.isArray(created) ? created[0] : created).id

    // Twin ledger entries
    await this.writeWalletEntry({
      wallet_id: args.from_wallet_id,
      amount: -Math.abs(args.amount),
      currency: fromW.currency,
      source_type: "transfer_out",
      source_id: tId,
      note: args.note ?? `Transfer to ${toW.name}`,
      entry_at: args.transferred_at ?? new Date(),
    })
    await this.writeWalletEntry({
      wallet_id: args.to_wallet_id,
      amount: Math.abs(amountReceived),
      currency: toW.currency,
      source_type: "transfer_in",
      source_id: tId,
      note: args.note ?? `Transfer from ${fromW.name}`,
      entry_at: args.transferred_at ?? new Date(),
    })

    await this.recordAudit({
      entity_type: "transfer",
      entity_id: tId,
      action: "create",
      after: { ...args, currency: fromW.currency, amount_received: amountReceived },
    })
    return { id: tId }
  }

  async deleteTransferWithReversal(transferId: string): Promise<void> {
    const t = await this.retrieveFinanzasTransfer(transferId).catch(() => null)
    if (!t) return
    await this.reverseEntriesBySource("transfer_out", transferId)
    await this.reverseEntriesBySource("transfer_in", transferId)
    await this.deleteFinanzasTransfers(transferId)
    await this.recordAudit({
      entity_type: "transfer",
      entity_id: transferId,
      action: "delete",
      before: t as unknown as Record<string, unknown>,
    })
  }

  // ──────────────────────────────────────────────────────────────────────
  // Audit log
  // ──────────────────────────────────────────────────────────────────────

  async recordAudit(args: {
    entity_type: string
    entity_id: string
    action: string
    before?: Record<string, unknown> | null
    after?: Record<string, unknown> | null
    user_id?: string | null
    user_email?: string | null
    note?: string | null
  }): Promise<void> {
    try {
      await this.createFinanzasAuditLogs({
        entity_type: args.entity_type,
        entity_id: args.entity_id,
        action: args.action,
        before: args.before ?? null,
        after: args.after ?? null,
        user_id: args.user_id ?? null,
        user_email: args.user_email ?? null,
        note: args.note ?? null,
        at: new Date(),
      })
    } catch (e) {
      console.warn("[finanzas] audit insert failed:", (e as Error).message)
    }
  }

  // ──────────────────────────────────────────────────────────────────────
  // Cost history
  // ──────────────────────────────────────────────────────────────────────

  /**
   * Upsert a product cost AND record history. Closes the previous active
   * version with valid_to=now and opens a new version with valid_from=now.
   */
  async upsertProductCost(args: {
    variant_id: string
    unit_cost_eur: number
    product_handle?: string | null
    product_id?: string | null
    variant_title?: string | null
    notes?: string | null
    changed_by?: string | null
  }): Promise<{ id: string; previous?: number | null }> {
    const existingArr = await this.listFinanzasProductCosts({ variant_id: args.variant_id })
    const existing = existingArr[0]

    let costId: string
    let previousValue: number | null = null

    if (existing) {
      previousValue = Number(existing.unit_cost_eur)
      if (Math.abs(previousValue - args.unit_cost_eur) > 0.000001) {
        await this.updateFinanzasProductCosts({
          id: existing.id,
          unit_cost_eur: args.unit_cost_eur,
          product_handle: args.product_handle ?? existing.product_handle,
          product_id: args.product_id ?? existing.product_id,
          variant_title: args.variant_title ?? existing.variant_title,
          notes: args.notes ?? existing.notes,
        })
        // Close prior history rows
        const open = await this.listFinanzasProductCostHistories({
          variant_id: args.variant_id,
        })
        for (const h of open) {
          if (h.valid_to == null) {
            await this.updateFinanzasProductCostHistories({ id: h.id, valid_to: new Date() })
          }
        }
        // Open new
        await this.createFinanzasProductCostHistories({
          variant_id: args.variant_id,
          unit_cost_eur: args.unit_cost_eur,
          valid_from: new Date(),
          valid_to: null,
          changed_by: args.changed_by ?? null,
          note: args.notes ?? null,
        })
        await this.recordAudit({
          entity_type: "product_cost",
          entity_id: existing.id,
          action: "update",
          before: { unit_cost_eur: previousValue },
          after: { unit_cost_eur: args.unit_cost_eur },
          user_id: args.changed_by ?? null,
        })
      }
      costId = existing.id
    } else {
      const created = await this.createFinanzasProductCosts({
        variant_id: args.variant_id,
        product_id: args.product_id ?? null,
        product_handle: args.product_handle ?? null,
        variant_title: args.variant_title ?? null,
        unit_cost_eur: args.unit_cost_eur,
        notes: args.notes ?? null,
      })
      costId = (Array.isArray(created) ? created[0] : created).id
      await this.createFinanzasProductCostHistories({
        variant_id: args.variant_id,
        unit_cost_eur: args.unit_cost_eur,
        valid_from: new Date(),
        valid_to: null,
        changed_by: args.changed_by ?? null,
        note: args.notes ?? null,
      })
      await this.recordAudit({
        entity_type: "product_cost",
        entity_id: costId,
        action: "create",
        after: { variant_id: args.variant_id, unit_cost_eur: args.unit_cost_eur },
        user_id: args.changed_by ?? null,
      })
    }

    return { id: costId, previous: previousValue }
  }

  // ──────────────────────────────────────────────────────────────────────
  // Month close (immutable snapshots)
  // ──────────────────────────────────────────────────────────────────────

  /**
   * Returns true if the given YYYY-MM is currently closed (not reopened).
   */
  async isMonthClosed(month: string): Promise<boolean> {
    const rows = await this.listFinanzasMonthCloses({ month })
    return rows.some((r) => r.reopened_at == null)
  }

  /** Date → "YYYY-MM" key. */
  static monthKeyOfDate(d: Date | string): string {
    const dt = typeof d === "string" ? new Date(d) : d
    return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}`
  }

  /**
   * Throws if the date falls inside a closed month — unless the caller
   * supplied a non-empty `correction_note`. The note is intentionally
   * required: it forces the caller to acknowledge they're modifying a
   * closed period and gets persisted to the audit log by the route handler.
   */
  async assertNotClosedOrCorrection(
    targetDate: Date | string,
    correctionNote?: string | null
  ): Promise<{ ok: boolean; month: string; needs_correction: boolean }> {
    const month = FinanzasModuleService.monthKeyOfDate(targetDate)
    const closed = await this.isMonthClosed(month)
    if (!closed) return { ok: true, month, needs_correction: false }
    if (correctionNote && correctionNote.trim().length >= 5) {
      return { ok: true, month, needs_correction: true }
    }
    throw new Error(
      `El mes ${month} está cerrado. Para modificarlo pasá un correction_note explicando la razón (≥5 caracteres).`
    )
  }

  /**
   * Close a month: snapshot totals + lock writes. Idempotent: re-closing
   * an already-closed month no-ops. Re-opening sets reopened_at and clears
   * the closed status.
   */
  async closeMonth(args: {
    month: string
    closed_by_email?: string | null
    closed_by_user_id?: string | null
  }): Promise<{ id: string; snapshot: Record<string, unknown> }> {
    const { month } = args
    const existing = (await this.listFinanzasMonthCloses({ month }))
      .filter((r) => r.reopened_at == null)
    if (existing.length > 0) {
      return { id: existing[0].id, snapshot: existing[0].snapshot as Record<string, unknown> }
    }

    const [y, m] = month.split("-").map(Number)
    const from = new Date(Date.UTC(y, m - 1, 1))
    const to = new Date(Date.UTC(y, m, 1))
    const allPm = await this.listFinanzasPagoMovils({})
    const inMonth = allPm.filter((p) => {
      const t = new Date(p.created_at).getTime()
      return t >= from.getTime() && t < to.getTime()
    })
    const totals = inMonth.reduce(
      (a, p) => ({
        orders: a.orders + 1,
        revenue_eur: a.revenue_eur + Number(p.amount_eur_total),
        cogs_eur: a.cogs_eur + Number(p.amount_eur_cogs),
        margin_eur: a.margin_eur + Number(p.amount_eur_margin),
        bs_received: a.bs_received + Number(p.amount_bs_total),
      }),
      { orders: 0, revenue_eur: 0, cogs_eur: 0, margin_eur: 0, bs_received: 0 }
    )

    const allExpenses = await this.listFinanzasExpenses({})
    const expensesInMonth = allExpenses.filter((e) => {
      if (e.status !== "paid") return false
      const t = new Date(e.expense_date).getTime()
      return t >= from.getTime() && t < to.getTime()
    })
    const expensesUsdt = expensesInMonth.reduce(
      (s, e) => s + Number(e.amount_usdt),
      0
    )

    const snapshot = {
      ...totals,
      expenses_paid_usdt: Math.round(expensesUsdt * 100) / 100,
      ebitda_eur: Math.round((totals.margin_eur - expensesUsdt * 1.08) * 100) / 100,
      pago_movil_ids: inMonth.map((p) => p.id),
      expense_ids: expensesInMonth.map((e) => e.id),
      closed_at_iso: new Date().toISOString(),
    }

    const created = await this.createFinanzasMonthCloses({
      month,
      closed_at: new Date(),
      closed_by_user_id: args.closed_by_user_id ?? null,
      closed_by_email: args.closed_by_email ?? null,
      snapshot,
      reopened_at: null,
      reopened_by_email: null,
      reopen_reason: null,
    })
    const row = Array.isArray(created) ? created[0] : created
    await this.recordAudit({
      entity_type: "month_close",
      entity_id: row.id,
      action: "create",
      after: { month, snapshot },
      user_email: args.closed_by_email ?? null,
    })
    return { id: row.id, snapshot }
  }

  async reopenMonth(args: {
    month: string
    reopened_by_email?: string | null
    reopen_reason: string
  }): Promise<void> {
    const list = (await this.listFinanzasMonthCloses({ month: args.month })).filter(
      (r) => r.reopened_at == null
    )
    if (!args.reopen_reason || args.reopen_reason.trim().length < 10) {
      throw new Error("Necesitás un motivo de reapertura (≥10 caracteres)")
    }
    for (const row of list) {
      await this.updateFinanzasMonthCloses({
        id: row.id,
        reopened_at: new Date(),
        reopened_by_email: args.reopened_by_email ?? null,
        reopen_reason: args.reopen_reason,
      })
      await this.recordAudit({
        entity_type: "month_close",
        entity_id: row.id,
        action: "update",
        before: { reopened: false },
        after: { reopened: true, reason: args.reopen_reason },
        note: args.reopen_reason,
        user_email: args.reopened_by_email ?? null,
      })
    }
  }

  // ──────────────────────────────────────────────────────────────────────
  // Roles
  // ──────────────────────────────────────────────────────────────────────

  /**
   * Resolve the role for a given user_id. Default is "admin" (the owner case
   * — Medusa admin users land on this module without explicit grants). We
   * only flip to a restricted role when an explicit row exists.
   */
  async getUserRole(userId: string | null | undefined): Promise<"admin" | "contador" | "operario"> {
    if (!userId) return "admin"
    const rows = await this.listFinanzasUserRoles({ user_id: userId })
    const r = rows[0]?.role
    if (r === "contador" || r === "operario") return r
    return "admin"
  }

  static canMutate(role: "admin" | "contador" | "operario", action: "create_expense" | "edit_pago_movil" | "edit_config" | "close_month"): boolean {
    if (role === "admin") return true
    if (role === "contador") return false
    if (role === "operario") return action === "create_expense"
    return false
  }

  // ──────────────────────────────────────────────────────────────────────
  // Comments
  // ──────────────────────────────────────────────────────────────────────

  async listComments(entityType: string, entityId: string) {
    return this.listFinanzasComments(
      { entity_type: entityType, entity_id: entityId },
      { order: { created_at: "ASC" } } as never
    )
  }
}

export default FinanzasModuleService
