"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  Mail, MessageCircle, Power, Edit2, Trash2, Plus, X, Save, Play, AlertCircle, CheckCircle2,
  Activity, FlaskConical, Clock, Moon,
} from "lucide-react"
import {
  upsertRuleAction, upsertMultiChannelRuleAction, toggleRuleAction, deleteRuleAction, runEngineAction,
} from "../actions"
import type { RemarketingRuleFull } from "@/lib/medusa"

type Toast = { kind: "ok" | "err"; msg: string } | null

const CHANNEL_META: Record<string, { label: string; color: string }> = {
  auto:     { label: "AUTO",     color: "#9C9285" },
  email:    { label: "EMAIL",    color: "#FF3B27" },
  whatsapp: { label: "WHATSAPP", color: "#25D366" },
}

const SEVERITY_META: Record<string, { label: string; color: string }> = {
  high:   { label: "HIGH",   color: "#BB3B2E" },
  medium: { label: "MED",    color: "#FF3B27" },
  low:    { label: "LOW",    color: "#D4A015" },
  info:   { label: "INFO",   color: "#9C9285" },
}

export function RulesClient({ rules }: { rules: RemarketingRuleFull[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [toast, setToast] = useState<Toast>(null)
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  function flash(k: "ok" | "err", m: string) {
    setToast({ kind: k, msg: m })
    setTimeout(() => setToast(null), 4500)
  }

  function toggle(rule: RemarketingRuleFull) {
    startTransition(async () => {
      const res = await toggleRuleAction(rule.key, !rule.enabled)
      if (!res.ok) return flash("err", res.error)
      flash("ok", `${rule.name} ${!rule.enabled ? "activada" : "pausada"}`)
      router.refresh()
    })
  }

  function deleteOne(rule: RemarketingRuleFull) {
    if (!window.confirm(`¿Eliminar la regla "${rule.name}"?`)) return
    startTransition(async () => {
      const res = await deleteRuleAction(rule.key)
      if (!res.ok) return flash("err", res.error)
      flash("ok", "Regla eliminada")
      router.refresh()
    })
  }

  function runEngine(dryRun: boolean) {
    startTransition(async () => {
      const res = await runEngineAction({ dry_run: dryRun })
      if (!res.ok) return flash("err", res.error)
      const r = res.result
      const breakdown = Object.entries(r.by_status).map(([k, v]) => `${k}:${v}`).join(" · ")
      flash("ok", `${dryRun ? "DRY RUN · " : ""}Evaluó ${r.candidates_evaluated} candidatos → ${r.fires_created} fires${breakdown ? ` (${breakdown})` : ""}`)
      router.refresh()
    })
  }

  return (
    <>
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={() => setCreating(!creating)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-[10px] font-display font-bold uppercase tracking-wider ${
            creating ? "bg-cream text-ink" : "bg-orange text-dark hover:translate-x-[1px] hover:translate-y-[1px]"
          }`}
          style={{ border: "2px solid #1A1A1A", boxShadow: creating ? "none" : "3px 3px 0 0 var(--shadow-color)" }}>
          {creating ? <X size={11} strokeWidth={2.5} /> : <Plus size={11} strokeWidth={3} />}
          {creating ? "Cancelar" : "Nueva regla"}
        </button>
        <button onClick={() => runEngine(true)} disabled={pending}
          className="flex items-center gap-1.5 px-3 py-2 bg-cream rounded-md text-[10px] font-display font-bold uppercase tracking-wider hover:bg-cream-2 disabled:opacity-50"
          style={{ border: "1.5px solid var(--border)", boxShadow: "3px 3px 0 0 var(--shadow-color)" }}>
          <Play size={11} strokeWidth={2.5} /> Dry-run engine
        </button>
        <button onClick={() => runEngine(false)} disabled={pending}
          className="flex items-center gap-1.5 px-3 py-2 bg-primary text-cream rounded-md text-[10px] font-display font-bold uppercase tracking-wider hover:opacity-90 disabled:opacity-50"
          style={{ border: "1.5px solid #1A1A1A", boxShadow: "3px 3px 0 0 var(--shadow-color)" }}>
          <Send size={11} strokeWidth={2.5} /> Run engine (LIVE)
        </button>
      </div>

      {creating && (
        <RuleForm
          mode="create"
          onSubmit={(rule, multiChannels) => {
            startTransition(async () => {
              if (multiChannels && multiChannels.length > 1) {
                // Multi-channel: separar el rule en uno por canal
                const { key, name, channel: _channel, ...rest } = rule
                const res = await upsertMultiChannelRuleAction({
                  baseKey: key,
                  baseName: name,
                  channels: multiChannels,
                  rule: rest,
                })
                if (!res.ok) return flash("err", res.error)
                if (res.failed.length > 0) {
                  flash("err", `${res.created} OK · ${res.failed.length} fallaron — ${res.failed[0].error}`)
                } else {
                  flash("ok", `${res.created} reglas creadas (una por canal)`)
                }
              } else {
                const res = await upsertRuleAction(rule)
                if (!res.ok) return flash("err", res.error)
                flash("ok", "Regla creada")
              }
              setCreating(false)
              router.refresh()
            })
          }}
          onCancel={() => setCreating(false)}
          pending={pending}
        />
      )}

      {/* Rules list */}
      {rules.length === 0 ? (
        <div className="stamp-card p-10 text-center">
          <Activity size={48} className="text-ink-3 mx-auto mb-3" strokeWidth={1.5} />
          <p className="font-display font-bold text-[14px] uppercase tracking-wider text-ink-3">Sin reglas configuradas</p>
          <p className="text-[12px] text-ink-3 mt-1">Las reglas matchean signals (eg. abandoned_cart, multi_view) y disparan campañas</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rules.sort((a, b) => b.priority - a.priority).map((rule) => (
            <div key={rule.key} className="stamp-card overflow-hidden">
              {editingKey === rule.key ? (
                <div className="p-4">
                  <RuleForm
                    mode="edit"
                    rule={rule}
                    onSubmit={(updated) => {
                      startTransition(async () => {
                        const res = await upsertRuleAction(updated)
                        if (!res.ok) return flash("err", res.error)
                        flash("ok", "Regla actualizada")
                        setEditingKey(null)
                        router.refresh()
                      })
                    }}
                    onCancel={() => setEditingKey(null)}
                    pending={pending}
                  />
                </div>
              ) : (
                <RuleRow rule={rule} onToggle={() => toggle(rule)} onEdit={() => setEditingKey(rule.key)} onDelete={() => deleteOne(rule)} pending={pending} />
              )}
            </div>
          ))}
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 z-[60] px-4 py-3 rounded-md flex items-center gap-2 text-[12px] font-medium animate-in fade-in slide-in-from-bottom-2"
          style={{ background: toast.kind === "ok" ? "#4D5431" : "#BB3B2E", color: "#fff", border: "2px solid #1A1A1A", boxShadow: "4px 4px 0 0 var(--shadow-color)", minWidth: 280, maxWidth: 480 }}>
          {toast.kind === "ok" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{toast.msg}</span>
        </div>
      )}
    </>
  )
}

function RuleRow({ rule, onToggle, onEdit, onDelete, pending }: {
  rule: RemarketingRuleFull
  onToggle: () => void
  onEdit: () => void
  onDelete: () => void
  pending: boolean
}) {
  const cm = CHANNEL_META[rule.channel] ?? CHANNEL_META.auto
  const sm = SEVERITY_META[rule.min_severity ?? "info"] ?? SEVERITY_META.info
  const fires = rule.stats?.fires_total ?? 0
  const sent = rule.stats?.sent ?? 0
  const converted = rule.stats?.converted ?? 0
  const convRate = sent > 0 ? (converted / sent) * 100 : 0
  const variants = rule.variant_stats ?? []
  const hasABTest = variants.length >= 2

  return (
    <div className="p-4">
      <div className="flex items-start gap-3">
        <button onClick={onToggle} disabled={pending}
          className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center disabled:opacity-50 ${
            rule.enabled ? "bg-secondary text-cream" : "bg-cream-2 text-ink-3"
          }`}
          style={{ border: "1.5px solid var(--border)" }}
          title={rule.enabled ? "Pausar" : "Activar"}>
          <Power size={14} strokeWidth={2.5} />
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-display font-bold text-[14px] text-ink truncate">{rule.name}</span>
            <span className="px-1.5 py-0.5 text-[9px] font-display font-bold uppercase tracking-wider rounded-md text-white"
              style={{ background: cm.color }}>
              {cm.label}
            </span>
            <span className="px-1.5 py-0.5 text-[9px] font-display font-bold uppercase tracking-wider rounded-md text-white"
              style={{ background: sm.color }}>
              {sm.label}
            </span>
            <span className="text-[9px] font-mono text-ink-3">prio {rule.priority}</span>
            {hasABTest && (
              <span className="px-1.5 py-0.5 text-[9px] font-display font-bold uppercase tracking-wider bg-orange/15 text-orange rounded-md flex items-center gap-1">
                <FlaskConical size={9} /> A/B
              </span>
            )}
          </div>
          {rule.description && <p className="text-[11px] text-ink-3 mb-1">{rule.description}</p>}
          <div className="flex items-center gap-3 text-[10px] font-mono text-ink-3 flex-wrap">
            <span><strong className="text-ink-2">match:</strong> {rule.match_signal_id ?? `${rule.match_signal_prefix ?? ""}*`}</span>
            <span><Clock size={9} className="inline mr-0.5" /> cooldown {rule.cooldown_hours}h</span>
            {(rule.quiet_hours_start != null && rule.quiet_hours_end != null) && (
              <span><Moon size={9} className="inline mr-0.5" /> quiet {rule.quiet_hours_start}–{rule.quiet_hours_end}h</span>
            )}
            {rule.daily_cap != null && <span>cap {rule.daily_cap}/día</span>}
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 flex-shrink-0">
          <Stat label="Envíos" value={fires.toLocaleString()} />
          <Stat label="Sent" value={sent.toLocaleString()} tone="secondary" />
          <Stat label="Conv." value={converted.toLocaleString()} tone="orange" />
          <Stat label="Tasa" value={`${convRate.toFixed(1)}%`} tone={convRate > 5 ? "secondary" : convRate > 1 ? "orange" : "primary"} big />
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={onEdit} disabled={pending} className="text-ink-3 hover:text-orange p-1.5">
            <Edit2 size={12} strokeWidth={2.5} />
          </button>
          <button onClick={onDelete} disabled={pending} className="text-ink-3 hover:text-primary p-1.5">
            <Trash2 size={12} strokeWidth={2.5} />
          </button>
        </div>
      </div>

      {/* A/B variants */}
      {hasABTest && (
        <div className="mt-3 pt-3 grid grid-cols-2 lg:grid-cols-4 gap-2" style={{ borderTop: "1.5px dashed var(--border)" }}>
          {variants.map((v) => {
            const vRate = v.fires > 0 ? (v.converted / v.fires) * 100 : 0
            const isWinner = vRate === Math.max(...variants.map((vv) => vv.fires > 0 ? (vv.converted / vv.fires) * 100 : 0))
            return (
              <div key={v.variant_key} className={`p-2 rounded-md ${isWinner ? "bg-secondary/10" : "bg-cream-2/40"}`}
                style={{ border: `1.5px solid ${isWinner ? "#4D5431" : "var(--border)"}` }}>
                <div className="flex items-baseline justify-between">
                  <span className="font-display font-bold text-[10px] uppercase tracking-wider text-orange">
                    {v.variant_key}{isWinner && " 🏆"}
                  </span>
                  <span className="text-[10px] font-mono num">{vRate.toFixed(1)}%</span>
                </div>
                <p className="text-[9px] text-ink-3 font-mono mt-0.5">{v.fires} fires · {v.converted} conv.</p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, tone, big }: { label: string; value: string; tone?: "primary" | "secondary" | "orange"; big?: boolean }) {
  const cls = tone === "primary" ? "text-primary" : tone === "secondary" ? "text-secondary" : tone === "orange" ? "text-orange" : "text-ink"
  return (
    <div className="text-right">
      <div className={`font-display font-black num ${big ? "text-[18px]" : "text-[14px]"} ${cls}`}>{value}</div>
      <div className="text-[8px] font-display font-bold uppercase tracking-wider text-ink-3">{label}</div>
    </div>
  )
}

function Send({ size, strokeWidth, className }: { size?: number; strokeWidth?: number; className?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} className={className}>
    <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
}

interface FormData {
  key: string
  name: string
  description?: string
  enabled?: boolean
  priority?: number
  cooldown_hours?: number
  channel?: "auto" | "email" | "whatsapp"
  match_signal_id?: string
  match_signal_prefix?: string
  min_severity?: "high" | "medium" | "low" | "info"
  email_subject_template?: string
  email_html_template?: string
  whatsapp_template?: string
  quiet_hours_start?: number
  quiet_hours_end?: number
  daily_cap?: number
}

function RuleForm({ mode, rule, onSubmit, onCancel, pending }: {
  mode: "create" | "edit"
  rule?: RemarketingRuleFull
  onSubmit: (rule: FormData, multiChannels?: Array<"email" | "whatsapp" | "auto">) => void
  onCancel: () => void
  pending: boolean
}) {
  const [form, setForm] = useState<FormData>({
    key: rule?.key ?? "",
    name: rule?.name ?? "",
    description: rule?.description ?? "",
    enabled: rule?.enabled ?? false,
    priority: rule?.priority ?? 0,
    cooldown_hours: rule?.cooldown_hours ?? 24,
    channel: rule?.channel ?? "auto",
    match_signal_id: rule?.match_signal_id ?? "",
    match_signal_prefix: rule?.match_signal_prefix ?? "",
    min_severity: rule?.min_severity ?? "info",
    email_subject_template: rule?.email_subject_template ?? "",
    email_html_template: rule?.email_html_template ?? "",
    whatsapp_template: rule?.whatsapp_template ?? "",
    quiet_hours_start: rule?.quiet_hours_start ?? undefined,
    quiet_hours_end: rule?.quiet_hours_end ?? undefined,
    daily_cap: rule?.daily_cap ?? undefined,
  })

  // Multi-channel mode (solo create) — checkboxes que crean N rules
  const [multiMode, setMultiMode] = useState(false)
  const [multiChannels, setMultiChannels] = useState<Array<"email" | "whatsapp" | "auto">>(["email", "whatsapp"])

  const isValid = form.key.trim() && form.name.trim() && (form.match_signal_id?.trim() || form.match_signal_prefix?.trim())
    && (!multiMode || multiChannels.length > 0)

  return (
    <div className={`stamp-card p-4 bg-orange/5 space-y-3 ${mode === "edit" ? "" : ""}`} style={{ borderColor: "#FF3B27" }}>
      <h4 className="font-display font-black text-[12px] uppercase tracking-wider text-orange">
        {mode === "create" ? "Nueva regla" : `Editar · ${rule?.name}`}
      </h4>

      <div className="grid grid-cols-3 gap-2">
        <Field label="Key * (id único)">
          <input type="text" value={form.key}
            onChange={(e) => setForm({ ...form, key: e.target.value.toLowerCase().replace(/\s+/g, "_") })}
            disabled={mode === "edit"} placeholder="abandoned_cart_v2"
            className="w-full px-2 py-1.5 bg-cream rounded-md text-[12px] font-mono focus:outline-none disabled:opacity-50"
            style={{ border: "1.5px solid var(--border)" }} />
        </Field>
        <Field label="Nombre *">
          <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Carrito abandonado v2"
            className="w-full px-2 py-1.5 bg-cream rounded-md text-[12px] focus:outline-none"
            style={{ border: "1.5px solid var(--border)" }} />
        </Field>
        <Field label="Prioridad">
          <input type="number" value={form.priority ?? 0}
            onChange={(e) => setForm({ ...form, priority: Number(e.target.value) || 0 })}
            className="w-full px-2 py-1.5 bg-cream rounded-md text-[12px] font-mono num text-right focus:outline-none"
            style={{ border: "1.5px solid var(--border)" }} />
        </Field>
      </div>

      <Field label="Descripción">
        <input type="text" value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="Qué hace esta regla"
          className="w-full px-2 py-1.5 bg-cream rounded-md text-[12px] focus:outline-none"
          style={{ border: "1.5px solid var(--border)" }} />
      </Field>

      <div className="grid grid-cols-3 gap-2">
        <Field label="Match signal_id">
          <input type="text" value={form.match_signal_id ?? ""} onChange={(e) => setForm({ ...form, match_signal_id: e.target.value, match_signal_prefix: "" })}
            placeholder="abandoned_cart"
            className="w-full px-2 py-1.5 bg-cream rounded-md text-[12px] font-mono focus:outline-none"
            style={{ border: "1.5px solid var(--border)" }} />
        </Field>
        <Field label="o prefix (alternativa)">
          <input type="text" value={form.match_signal_prefix ?? ""} onChange={(e) => setForm({ ...form, match_signal_prefix: e.target.value, match_signal_id: "" })}
            placeholder="multi_view_no_cart:"
            className="w-full px-2 py-1.5 bg-cream rounded-md text-[12px] font-mono focus:outline-none"
            style={{ border: "1.5px solid var(--border)" }} />
        </Field>
        <Field label="Severidad mín">
          <select value={form.min_severity ?? "info"} onChange={(e) => setForm({ ...form, min_severity: e.target.value as FormData["min_severity"] })}
            className="w-full px-2 py-1.5 bg-cream rounded-md text-[12px] focus:outline-none"
            style={{ border: "1.5px solid var(--border)" }}>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
            <option value="info">Info</option>
          </select>
        </Field>
      </div>

      {/* Channel selector — single o multi */}
      {mode === "create" && (
        <div className="p-3 bg-cream-2/40 rounded-md" style={{ border: "1.5px solid var(--border-soft)" }}>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] font-display font-bold uppercase tracking-[0.18em] text-ink-2">Canales</span>
            <div className="flex items-center bg-cream rounded-md overflow-hidden ml-auto" style={{ border: "1.5px solid var(--border)" }}>
              <button type="button" onClick={() => setMultiMode(false)}
                className={`px-2 py-1 text-[10px] font-display font-bold uppercase ${!multiMode ? "bg-dark text-cream" : "text-ink-3"}`}>
                Un canal
              </button>
              <button type="button" onClick={() => setMultiMode(true)}
                className={`px-2 py-1 text-[10px] font-display font-bold uppercase ${multiMode ? "bg-dark text-cream" : "text-ink-3"}`}>
                Multi-canal
              </button>
            </div>
          </div>
          {multiMode ? (
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                {(["email", "whatsapp", "auto"] as const).map((ch) => {
                  const active = multiChannels.includes(ch)
                  return (
                    <label key={ch} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md cursor-pointer text-[10px] font-display font-bold uppercase tracking-wider ${
                      active ? "bg-orange text-dark" : "bg-cream text-ink-3 hover:bg-cream-2"
                    }`} style={{ border: `1.5px solid ${active ? "#1A1A1A" : "var(--border)"}` }}>
                      <input type="checkbox" checked={active}
                        onChange={(e) => {
                          if (e.target.checked) setMultiChannels([...multiChannels, ch])
                          else setMultiChannels(multiChannels.filter((c) => c !== ch))
                        }}
                        className="w-3 h-3" />
                      {ch === "auto" ? "AUTO (WA si phone)" : ch.toUpperCase()}
                    </label>
                  )
                })}
              </div>
              <p className="text-[10px] text-ink-3 font-mono mt-2">
                💡 Se crearán <strong>{multiChannels.length} reglas separadas</strong>: <code>{form.key || "key"}</code>
                {multiChannels.map((c) => c === "auto" ? " (sin sufijo)" : `, ${form.key || "key"}_${c}`).join("")}
                <br />
                Cada una matchea el mismo signal pero envía por su canal asignado.
              </p>
            </div>
          ) : (
            <select value={form.channel ?? "auto"} onChange={(e) => setForm({ ...form, channel: e.target.value as FormData["channel"] })}
              className="w-full px-2 py-1.5 bg-cream rounded-md text-[12px] focus:outline-none"
              style={{ border: "1.5px solid var(--border)" }}>
              <option value="auto">Auto (WhatsApp si phone, sino email)</option>
              <option value="email">Solo email</option>
              <option value="whatsapp">Solo WhatsApp</option>
            </select>
          )}
        </div>
      )}

      <div className="grid grid-cols-4 gap-2">
        {mode === "edit" && (
          <Field label="Canal">
            <select value={form.channel ?? "auto"} onChange={(e) => setForm({ ...form, channel: e.target.value as FormData["channel"] })}
              className="w-full px-2 py-1.5 bg-cream rounded-md text-[12px] focus:outline-none"
              style={{ border: "1.5px solid var(--border)" }}>
              <option value="auto">Auto</option>
              <option value="email">Email</option>
              <option value="whatsapp">WhatsApp</option>
            </select>
          </Field>
        )}
        <Field label="Cooldown (h)">
          <input type="number" value={form.cooldown_hours ?? 24}
            onChange={(e) => setForm({ ...form, cooldown_hours: Number(e.target.value) || 0 })}
            className="w-full px-2 py-1.5 bg-cream rounded-md text-[12px] font-mono num text-right focus:outline-none"
            style={{ border: "1.5px solid var(--border)" }} />
        </Field>
        <Field label="Quiet start (h)">
          <input type="number" min={0} max={23} value={form.quiet_hours_start ?? ""}
            onChange={(e) => setForm({ ...form, quiet_hours_start: e.target.value === "" ? undefined : Number(e.target.value) })}
            placeholder="—"
            className="w-full px-2 py-1.5 bg-cream rounded-md text-[12px] font-mono num text-right focus:outline-none"
            style={{ border: "1.5px solid var(--border)" }} />
        </Field>
        <Field label="Quiet end (h)">
          <input type="number" min={0} max={23} value={form.quiet_hours_end ?? ""}
            onChange={(e) => setForm({ ...form, quiet_hours_end: e.target.value === "" ? undefined : Number(e.target.value) })}
            placeholder="—"
            className="w-full px-2 py-1.5 bg-cream rounded-md text-[12px] font-mono num text-right focus:outline-none"
            style={{ border: "1.5px solid var(--border)" }} />
        </Field>
      </div>

      <Field label="Cap diario (envíos máx/día)">
        <input type="number" value={form.daily_cap ?? ""}
          onChange={(e) => setForm({ ...form, daily_cap: e.target.value === "" ? undefined : Number(e.target.value) })}
          placeholder="sin límite"
          className="w-32 px-2 py-1.5 bg-cream rounded-md text-[12px] font-mono num text-right focus:outline-none"
          style={{ border: "1.5px solid var(--border)" }} />
      </Field>

      {/* Templates */}
      <div className="space-y-2">
        <Field label="Email subject template">
          <input type="text" value={form.email_subject_template ?? ""} onChange={(e) => setForm({ ...form, email_subject_template: e.target.value })}
            placeholder="Hola {{first_name}}, dejaste algo en tu carrito 🛒"
            className="w-full px-2 py-1.5 bg-cream rounded-md text-[12px] font-mono focus:outline-none"
            style={{ border: "1.5px solid var(--border)" }} />
        </Field>
        <Field label="Email HTML template">
          <textarea rows={4} value={form.email_html_template ?? ""} onChange={(e) => setForm({ ...form, email_html_template: e.target.value })}
            placeholder="<p>Hola {{first_name}}...</p>"
            className="w-full px-2 py-1.5 bg-cream rounded-md text-[11px] font-mono focus:outline-none resize-none"
            style={{ border: "1.5px solid var(--border)" }} />
        </Field>
        <Field label="WhatsApp template">
          <textarea rows={3} value={form.whatsapp_template ?? ""} onChange={(e) => setForm({ ...form, whatsapp_template: e.target.value })}
            placeholder="Hola {{first_name}}, te recordamos que..."
            className="w-full px-2 py-1.5 bg-cream rounded-md text-[11px] font-mono focus:outline-none resize-none"
            style={{ border: "1.5px solid var(--border)" }} />
        </Field>
        <p className="text-[10px] text-ink-3 font-mono">
          💡 Variables disponibles: <code>{"{{first_name}}"}</code> <code>{"{{email}}"}</code> <code>{"{{cart_total}}"}</code> <code>{"{{product_title}}"}</code> · si los templates están vacíos, se usa <code>signal.suggested_message</code>
        </p>
      </div>

      <div className="flex items-center justify-end gap-2 pt-2" style={{ borderTop: "1.5px dashed var(--border)" }}>
        <button onClick={onCancel} disabled={pending}
          className="px-4 py-2 bg-cream rounded-md text-[11px] font-display font-bold uppercase tracking-wider hover:bg-cream-2 disabled:opacity-50"
          style={{ border: "1.5px solid var(--border)" }}>
          Cancelar
        </button>
        <button onClick={() => onSubmit(form, multiMode ? multiChannels : undefined)} disabled={pending || !isValid}
          className="px-4 py-2 bg-orange text-dark rounded-md text-[11px] font-display font-bold uppercase tracking-wider hover:translate-x-[1px] hover:translate-y-[1px] disabled:opacity-50 transition-all"
          style={{ border: "2px solid #1A1A1A", boxShadow: "3px 3px 0 0 var(--shadow-color)" }}>
          <Save size={11} strokeWidth={2.5} className="inline mr-1" />
          {pending ? "Guardando…" : mode === "create"
            ? (multiMode ? `Crear ${multiChannels.length} reglas` : "Crear regla")
            : "Guardar cambios"}
        </button>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[9px] font-display font-bold uppercase tracking-[0.18em] text-ink-2 mb-1">{label}</label>
      {children}
    </div>
  )
}
