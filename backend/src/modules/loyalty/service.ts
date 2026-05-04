import { MedusaService } from "@medusajs/framework/utils"
import LoyaltyReward from "./models/loyalty-reward"
import LoyaltyTransaction from "./models/loyalty-transaction"
import LoyaltyReferralCode from "./models/loyalty-referral-code"
import LoyaltyReferral from "./models/loyalty-referral"
import { deriveReferralCode, normalizeReferralCode } from "./lib/code"

export const REFERRER_POINTS = 200
export const REFEREE_POINTS = 200

export type ReferralRejectReason =
  | "self_referral"
  | "code_not_found"
  | "referee_already_referred"
  | "not_first_purchase"
  | "no_customer"

export type AwardReferralResult =
  | { ok: true; referrer_customer_id: string; referrer_points: number; referee_points: number }
  | { ok: false; reason: ReferralRejectReason }

class LoyaltyModuleService extends MedusaService({
  LoyaltyReward,
  LoyaltyTransaction,
  LoyaltyReferralCode,
  LoyaltyReferral,
}) {
  async getCustomerPoints(customerId: string): Promise<number> {
    const transactions = await this.listLoyaltyTransactions({ customer_id: customerId })
    return transactions.reduce((sum, t) => sum + (t.points ?? 0), 0)
  }

  // ─── Referral codes ──────────────────────────────────────────────────────

  /**
   * Returns the customer's canonical referral code, creating the row on first
   * call. Idempotent — safe to call from anywhere.
   */
  async getOrCreateReferralCode(customerId: string): Promise<string> {
    if (!customerId) throw new Error("customer_id required")
    const existing = await this.listLoyaltyReferralCodes(
      { customer_id: customerId },
      { take: 1 } as never
    )
    if (existing.length > 0) return existing[0].code

    const code = deriveReferralCode(customerId)
    // Tolerate the (extremely unlikely) collision: append 2 chars from id tail.
    let finalCode = code
    const collision = await this.listLoyaltyReferralCodes({ code: finalCode }, { take: 1 } as never)
    if (collision.length > 0) {
      finalCode = `${code}${customerId.slice(-2).toUpperCase().replace(/[^A-Z0-9]/g, "")}`
    }
    await this.createLoyaltyReferralCodes({ customer_id: customerId, code: finalCode })
    return finalCode
  }

  /**
   * Lookup the referrer customer_id by code. Returns null if code unknown.
   * Accepts raw user input — normalizes before query.
   */
  async findReferrerByCode(rawCode: string | null | undefined): Promise<string | null> {
    const code = normalizeReferralCode(rawCode)
    if (!code) return null
    const rows = await this.listLoyaltyReferralCodes({ code }, { take: 1 } as never)
    return rows[0]?.customer_id ?? null
  }

  /**
   * Has this customer already received any "earned" loyalty (i.e. completed
   * any prior order)? Used to gate the referee bonus to FIRST purchase only.
   * We exclude referral_referee transactions so a customer's referral bonus
   * itself doesn't make subsequent orders look like "non-first".
   */
  async customerHasPriorEarnings(customerId: string): Promise<boolean> {
    const txns = await this.listLoyaltyTransactions(
      { customer_id: customerId },
      { take: 100 } as never
    )
    return txns.some((t) => t.type === "earned")
  }

  // ─── Award (called from order.placed subscriber) ────────────────────────

  /**
   * Atomically validate + award a referral.
   *
   * Idempotent: if a row already exists for (referee_customer_id, status=awarded)
   * we no-op. If a `rejected` row exists we still try to upgrade if the new
   * attempt qualifies (e.g. first attempt ran before the customer existed).
   */
  async tryAwardReferral(args: {
    referee_customer_id: string
    referee_email?: string | null
    raw_code: string
    order_id: string
  }): Promise<AwardReferralResult> {
    const { referee_customer_id, referee_email, raw_code, order_id } = args

    if (!referee_customer_id) {
      await this.recordRejected({ raw_code, order_id, reason: "no_customer" })
      return { ok: false, reason: "no_customer" }
    }

    // Already awarded for this referee? Idempotent return.
    const existingAwarded = await this.listLoyaltyReferrals(
      { referee_customer_id, status: "awarded" } as never,
      { take: 1 } as never
    )
    if (existingAwarded.length > 0) {
      const r = existingAwarded[0]
      return {
        ok: true,
        referrer_customer_id: r.referrer_customer_id,
        referrer_points: r.referrer_points,
        referee_points: r.referee_points,
      }
    }

    const referrer_customer_id = await this.findReferrerByCode(raw_code)
    if (!referrer_customer_id) {
      await this.recordRejected({
        referee_customer_id,
        referee_email,
        raw_code,
        order_id,
        reason: "code_not_found",
      })
      return { ok: false, reason: "code_not_found" }
    }

    if (referrer_customer_id === referee_customer_id) {
      await this.recordRejected({
        referrer_customer_id,
        referee_customer_id,
        referee_email,
        raw_code,
        order_id,
        reason: "self_referral",
      })
      return { ok: false, reason: "self_referral" }
    }

    if (await this.customerHasPriorEarnings(referee_customer_id)) {
      await this.recordRejected({
        referrer_customer_id,
        referee_customer_id,
        referee_email,
        raw_code,
        order_id,
        reason: "not_first_purchase",
      })
      return { ok: false, reason: "not_first_purchase" }
    }

    const code = normalizeReferralCode(raw_code)!

    // Award: create relationship row + 2 ledger transactions.
    const now = new Date()
    await this.createLoyaltyReferrals({
      referrer_customer_id,
      referee_customer_id,
      referee_email: referee_email ?? null,
      code,
      order_id,
      status: "awarded",
      referrer_points: REFERRER_POINTS,
      referee_points: REFEREE_POINTS,
      awarded_at: now,
    })

    await this.createLoyaltyTransactions([
      {
        customer_id: referrer_customer_id,
        points: REFERRER_POINTS,
        type: "referral_referrer",
        order_id,
        description: `Bono por referir un nuevo cliente (${code})`,
      },
      {
        customer_id: referee_customer_id,
        points: REFEREE_POINTS,
        type: "referral_referee",
        order_id,
        description: `Bono por venir referido (${code})`,
      },
    ])

    return {
      ok: true,
      referrer_customer_id,
      referrer_points: REFERRER_POINTS,
      referee_points: REFEREE_POINTS,
    }
  }

  private async recordRejected(args: {
    referrer_customer_id?: string
    referee_customer_id?: string
    referee_email?: string | null
    raw_code: string
    order_id: string
    reason: ReferralRejectReason
  }): Promise<void> {
    try {
      const code = normalizeReferralCode(args.raw_code) ?? args.raw_code.slice(0, 32)
      await this.createLoyaltyReferrals({
        referrer_customer_id: args.referrer_customer_id ?? "unknown",
        referee_customer_id: args.referee_customer_id ?? "unknown",
        referee_email: args.referee_email ?? null,
        code,
        order_id: args.order_id,
        status: "rejected",
        rejected_reason: args.reason,
        referrer_points: 0,
        referee_points: 0,
      })
    } catch {
      // never block on audit row creation
    }
  }

  // ─── Stats (for the account UI) ─────────────────────────────────────────

  async getReferralStats(customerId: string): Promise<{
    code: string
    friends_invited: number
    points_earned: number
    awarded: Array<{ referee_customer_id: string; referee_email: string | null; awarded_at: Date | null }>
  }> {
    const code = await this.getOrCreateReferralCode(customerId)
    const awarded = await this.listLoyaltyReferrals(
      { referrer_customer_id: customerId, status: "awarded" } as never,
      { order: { awarded_at: "DESC" } as never, take: 50 } as never
    )
    const points_earned = awarded.reduce((s, r) => s + (r.referrer_points ?? 0), 0)
    return {
      code,
      friends_invited: awarded.length,
      points_earned,
      awarded: awarded.map((r) => ({
        referee_customer_id: r.referee_customer_id,
        referee_email: r.referee_email,
        awarded_at: r.awarded_at,
      })),
    }
  }

  /**
   * Validate a raw code without awarding. Used by the cart UI to confirm to
   * the user that "yes, this code is real" before they checkout.
   */
  async describeReferralCode(rawCode: string | null | undefined): Promise<{
    valid: boolean
    code: string | null
    referrer_initial: string | null
  }> {
    const code = normalizeReferralCode(rawCode)
    if (!code) return { valid: false, code: null, referrer_initial: null }
    const referrer = await this.findReferrerByCode(code)
    if (!referrer) return { valid: false, code, referrer_initial: null }
    // We deliberately don't leak the full referrer email/name — just the
    // first character of the code suffix is enough to make it feel real.
    const suffix = code.replace(/^ENR-/, "")
    return { valid: true, code, referrer_initial: suffix.charAt(0) }
  }
}

export default LoyaltyModuleService
