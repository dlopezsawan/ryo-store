"use server"

import { revalidatePath } from "next/cache"
import {
  createPromotion, updatePromotion, deletePromotion,
  createCustomerGroup, addCustomersToGroup,
  upsertRemarketingRule, toggleRemarketingRule, deleteRemarketingRule,
  runRemarketingEngine, updateRemarketingSetting, saveCrossSellMap, sendTestEmail,
  togglePosthogFlag, updatePosthogFlagRollout,
  type CreatePromotionInput, type RemarketingRuleFull,
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

export async function createPromotionAction(input: {
  code: string
  is_automatic: boolean
  value: number
  type: "percentage" | "fixed"
  target_type: "order" | "items" | "shipping_methods"
  currency_code?: string
}): Promise<ActionResult> {
  try {
    if (!input.code.trim()) return { ok: false, error: "El código es requerido" }
    if (!Number.isFinite(input.value) || input.value <= 0) {
      return { ok: false, error: "El valor debe ser mayor que cero" }
    }
    const payload: CreatePromotionInput = {
      code: input.code.trim().toUpperCase(),
      type: "standard",
      is_automatic: input.is_automatic,
      status: "active",
      application_method: {
        type: input.type,
        value: input.value,
        target_type: input.target_type,
        allocation: "across",
        currency_code: input.type === "fixed" ? (input.currency_code ?? "eur") : undefined,
      },
    }
    await createPromotion(payload)
    revalidatePath("/marketing")
    return { ok: true }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}

export async function togglePromotionAction(
  id: string,
  next: "active" | "inactive" | "draft",
): Promise<ActionResult> {
  try {
    await updatePromotion(id, { status: next })
    revalidatePath("/marketing")
    return { ok: true }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}

export async function updatePromotionCodeAction(
  id: string,
  patch: { code?: string; is_automatic?: boolean; value?: number },
): Promise<ActionResult> {
  try {
    const body: Parameters<typeof updatePromotion>[1] = {}
    if (patch.code !== undefined) body.code = patch.code.trim().toUpperCase()
    if (patch.is_automatic !== undefined) body.is_automatic = patch.is_automatic
    if (patch.value !== undefined && Number.isFinite(patch.value) && patch.value > 0) {
      body.application_method = { value: patch.value }
    }
    await updatePromotion(id, body)
    revalidatePath("/marketing")
    return { ok: true }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}

export async function deletePromotionAction(id: string): Promise<ActionResult> {
  try {
    await deletePromotion(id)
    revalidatePath("/marketing")
    return { ok: true }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}

/** Sincroniza un segmento RFM (lista de customer ids) a un customer-group.
 *  Si el grupo no existe, lo crea. */
export async function syncSegmentToGroupAction(input: {
  groupName: string
  customerIds: string[]
  groupId?: string  // si ya existe, reusar
}): Promise<{ ok: true; groupId: string; added: number } | { ok: false; error: string }> {
  try {
    if (!input.groupName.trim()) return { ok: false, error: "Nombre del grupo requerido" }
    if (input.customerIds.length === 0) return { ok: false, error: "Sin customers en el segmento" }

    let groupId = input.groupId
    if (!groupId) {
      const created = await createCustomerGroup({
        name: input.groupName.trim(),
        metadata: { source: "rfm_segment", synced_at: new Date().toISOString() },
      })
      groupId = created.customer_group.id
    }

    // Medusa acepta hasta cierta cantidad por request — chunkeamos en 50
    const CHUNK = 50
    let added = 0
    for (let i = 0; i < input.customerIds.length; i += CHUNK) {
      const chunk = input.customerIds.slice(i, i + CHUNK)
      await addCustomersToGroup(groupId, chunk)
      added += chunk.length
    }

    revalidatePath("/marketing/segments")
    revalidatePath("/customer-groups")
    return { ok: true, groupId, added }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}

// ─── Remarketing Rules ──────────────────────────────────────────────

export async function upsertRuleAction(rule: Partial<RemarketingRuleFull> & { key: string; name: string }): Promise<ActionResult> {
  try {
    if (!rule.match_signal_id && !rule.match_signal_prefix) {
      return { ok: false, error: "Debe especificar match_signal_id o match_signal_prefix" }
    }
    await upsertRemarketingRule(rule)
    revalidatePath("/marketing")
    revalidatePath("/marketing/rules")
    return { ok: true }
  } catch (e) { return { ok: false, error: toError(e) } }
}

/**
 * Multi-channel: una "regla" lógica crea N rules backend (uno por canal).
 * Cada canal genera una key con sufijo: `${baseKey}_email`, `${baseKey}_whatsapp`.
 * Si el canal "auto" se incluye, mantiene la key base sin sufijo.
 *
 * Útil para reglas que deben dispararse simultáneamente por email + whatsapp
 * (Medusa core sólo soporta un channel por rule).
 */
export async function upsertMultiChannelRuleAction(input: {
  baseKey: string
  baseName: string
  channels: Array<"email" | "whatsapp" | "auto">
  rule: Omit<Partial<RemarketingRuleFull>, "key" | "name" | "channel">
}): Promise<{ ok: true; created: number; failed: Array<{ channel: string; error: string }> } | { ok: false; error: string }> {
  if (input.channels.length === 0) return { ok: false, error: "Selecciona al menos un canal" }
  if (!input.baseKey.trim() || !input.baseName.trim()) return { ok: false, error: "Key y nombre requeridos" }
  if (!input.rule.match_signal_id && !input.rule.match_signal_prefix) {
    return { ok: false, error: "match_signal_id o prefix requerido" }
  }

  const failed: Array<{ channel: string; error: string }> = []
  let created = 0

  for (const ch of input.channels) {
    // El canal "auto" usa la key base; los otros tienen sufijo
    const suffix = ch === "auto" ? "" : `_${ch}`
    const key = input.baseKey + suffix
    const name = `${input.baseName}${ch === "auto" ? "" : ` · ${ch.toUpperCase()}`}`
    try {
      await upsertRemarketingRule({
        ...input.rule,
        key,
        name,
        channel: ch,
      } as Partial<RemarketingRuleFull> & { key: string; name: string })
      created += 1
    } catch (e) {
      failed.push({ channel: ch, error: toError(e) })
    }
  }

  revalidatePath("/marketing/rules")
  return { ok: true, created, failed }
}

export async function toggleRuleAction(key: string, enabled: boolean): Promise<ActionResult> {
  try {
    await toggleRemarketingRule(key, enabled)
    revalidatePath("/marketing")
    revalidatePath("/marketing/rules")
    return { ok: true }
  } catch (e) { return { ok: false, error: toError(e) } }
}

export async function deleteRuleAction(key: string): Promise<ActionResult> {
  try {
    await deleteRemarketingRule(key)
    revalidatePath("/marketing")
    revalidatePath("/marketing/rules")
    return { ok: true }
  } catch (e) { return { ok: false, error: toError(e) } }
}

// ─── Engine run ──────────────────────────────────────────────────────

export async function runEngineAction(args?: { dry_run?: boolean; max_candidates?: number; lookback_hours?: number }): Promise<
  { ok: true; result: { candidates_evaluated: number; fires_created: number; by_status: Record<string, number>; duration_ms: number; dry_run: boolean } }
  | { ok: false; error: string }
> {
  try {
    const result = await runRemarketingEngine(args)
    revalidatePath("/marketing/fires")
    revalidatePath("/marketing")
    return { ok: true, result }
  } catch (e) { return { ok: false, error: toError(e) } }
}

// ─── Remarketing settings + cross-sell + test email ─────────────────

export async function updateSettingAction(key: string, value: Record<string, unknown>): Promise<ActionResult> {
  try {
    await updateRemarketingSetting(key, value)
    revalidatePath("/marketing")
    return { ok: true }
  } catch (e) { return { ok: false, error: toError(e) } }
}

export async function saveCrossSellAction(map: Record<string, string[]>): Promise<ActionResult> {
  try {
    await saveCrossSellMap(map)
    revalidatePath("/marketing")
    return { ok: true }
  } catch (e) { return { ok: false, error: toError(e) } }
}

export async function sendTestEmailAction(input: { type: string; to: string }): Promise<ActionResult & { messageId?: string }> {
  try {
    if (!input.to.includes("@")) return { ok: false, error: "Email inválido" }
    if (!input.type) return { ok: false, error: "Tipo de campaña requerido" }
    const r = await sendTestEmail(input)
    return { ok: true, messageId: r.messageId }
  } catch (e) { return { ok: false, error: toError(e) } }
}

// ─── PostHog flags ───────────────────────────────────────────────────

export async function togglePosthogFlagAction(id: number, active: boolean): Promise<ActionResult> {
  try {
    await togglePosthogFlag(id, active)
    revalidatePath("/marketing/analytics")
    return { ok: true }
  } catch (e) { return { ok: false, error: toError(e) } }
}

export async function updatePosthogRolloutAction(id: number, rollout: number): Promise<ActionResult> {
  try {
    if (rollout < 0 || rollout > 100) return { ok: false, error: "Rollout debe estar entre 0 y 100" }
    await updatePosthogFlagRollout(id, rollout)
    revalidatePath("/marketing/analytics")
    return { ok: true }
  } catch (e) { return { ok: false, error: toError(e) } }
}
