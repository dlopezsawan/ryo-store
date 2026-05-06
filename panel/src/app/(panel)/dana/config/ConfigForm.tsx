"use client"

import { useState, useTransition } from "react"
import { Save, AlertCircle, CheckCircle2 } from "lucide-react"
import type { DanaConfig } from "@/lib/medusa"
import { updateConfigAction } from "../actions"

type Toast = { kind: "ok" | "err"; msg: string } | null

export function ConfigForm({ initial, hasOverride }: { initial: DanaConfig; hasOverride: boolean }) {
  const [config, setConfig] = useState<DanaConfig>(initial)
  const [dirty, setDirty] = useState<Record<string, boolean>>({})
  const [pending, startTransition] = useTransition()
  const [toast, setToast] = useState<Toast>(null)

  function update<K extends keyof DanaConfig>(key: K, value: DanaConfig[K]) {
    setConfig((c) => ({ ...c, [key]: value }))
    setDirty((d) => ({ ...d, [key]: true }))
  }

  function save() {
    const updates: Partial<DanaConfig> = {}
    for (const k of Object.keys(dirty) as (keyof DanaConfig)[]) {
      if (dirty[k]) updates[k] = config[k]
    }
    if (Object.keys(updates).length === 0) {
      setToast({ kind: "ok", msg: "Sin cambios" })
      setTimeout(() => setToast(null), 2000)
      return
    }
    startTransition(async () => {
      const r = await updateConfigAction(updates)
      if (!r.ok) {
        setToast({ kind: "err", msg: r.error })
      } else {
        setToast({ kind: "ok", msg: `Guardado (${r.updated.length} cambios)` })
        setDirty({})
      }
      setTimeout(() => setToast(null), 3000)
    })
  }

  return (
    <div className="space-y-4 max-w-3xl pb-12">
      <Section title="General">
        <div className="grid grid-cols-2 gap-3">
          <Toggle
            label="Bot activado"
            checked={config.enabled === "true"}
            onChange={(v) => update("enabled", v ? "true" : "false")}
            help="Si está apagado, Dana ignora todos los mensajes entrantes."
          />
          <Toggle
            label="Modo mantenimiento"
            checked={config.maintenance_mode === "true"}
            onChange={(v) => update("maintenance_mode", v ? "true" : "false")}
            help="Storefront muestra página de mantenimiento. Dana sigue respondiendo."
          />
        </div>
        <Field label="Nombre del bot" help="Aparece en algunos mensajes públicos. Default: 'Enrola Bot'.">
          <Input value={config.bot_name} onChange={(v) => update("bot_name", v)} />
        </Field>
      </Section>

      <Section title="Sesiones (timeouts)">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Timeout de control humano (min)" help="Si tomas control y no respondes en este tiempo, Dana retoma.">
            <Input type="number" value={config.human_timeout} onChange={(v) => update("human_timeout", v)} />
          </Field>
          <Field label="Timeout de sesión activa (min)" help="Tiempo de inactividad antes de cerrar la conversación.">
            <Input type="number" value={config.bot_timeout} onChange={(v) => update("bot_timeout", v)} />
          </Field>
        </div>
      </Section>

      <Section title="Notificaciones">
        <Field label="Teléfono del dueño (E.164)" help="Recibe notificaciones de pedido y handoffs.">
          <Input value={config.owner_phone} onChange={(v) => update("owner_phone", v)} placeholder="+58414..." />
        </Field>
        <Field label="Telegram chat ID — mensajes de Dana" help="Donde Dana avisa de pedidos / handoffs. Si vacío usa telegram_chat_id legacy.">
          <Input value={config.telegram_messages_chat_id} onChange={(v) => update("telegram_messages_chat_id", v)} />
        </Field>
        <Field label="Grupo WhatsApp de logística" help="Grupo donde caen las notificaciones de envío.">
          <Input value={config.delivery_whatsapp_group} onChange={(v) => update("delivery_whatsapp_group", v)} />
        </Field>
      </Section>

      <Section title="Credenciales (sensibles — enmascaradas)">
        <p className="text-[11px] text-ink-3 mb-2">Las llaves se muestran enmascaradas. Para rotarlas, pega el valor nuevo. Si dejas la máscara (`abc12...`), no se sobrescribe.</p>
        <Field label="WaSenderAPI key" help="Necesaria para enviar mensajes WhatsApp.">
          <Input value={config.wasender_key} onChange={(v) => update("wasender_key", v)} placeholder="wsdr_..." />
        </Field>
        <Field label="DeepSeek key" help="Cerebro de Dana + reescritor de voz. Sin esta, el modo 'as-dana' falla.">
          <Input value={config.deepseek_key} onChange={(v) => update("deepseek_key", v)} placeholder="sk-..." />
        </Field>
        <Field label="Telegram bot token" help="Para mandar notificaciones a los grupos de Telegram.">
          <Input value={config.telegram_bot_token} onChange={(v) => update("telegram_bot_token", v)} placeholder="123:ABC..." />
        </Field>
        <Field label="Groq key" help="Backup LLM (opcional). Solo se usa si DeepSeek falla.">
          <Input value={config.groq_key} onChange={(v) => update("groq_key", v)} />
        </Field>
        <Field label="Google Maps key" help="Para sugerir direcciones cuando el cliente pide envío.">
          <Input value={config.google_maps_key} onChange={(v) => update("google_maps_key", v)} />
        </Field>
      </Section>

      <Section title="Pago Móvil (público — Dana lo comparte con el cliente)">
        <div className="grid grid-cols-3 gap-3">
          <Field label="Banco" help="Ej: Banco de Venezuela">
            <Input value={config.pago_movil_banco} onChange={(v) => update("pago_movil_banco", v)} />
          </Field>
          <Field label="Cédula">
            <Input value={config.pago_movil_cedula} onChange={(v) => update("pago_movil_cedula", v)} />
          </Field>
          <Field label="Teléfono">
            <Input value={config.pago_movil_telefono} onChange={(v) => update("pago_movil_telefono", v)} />
          </Field>
        </div>
      </Section>

      <Section title="Instagram (auto-DM por comentario)">
        <Toggle
          label="Habilitar Instagram"
          checked={config.ig_enabled === "true"}
          onChange={(v) => update("ig_enabled", v ? "true" : "false")}
        />
        <Field label="Comment trigger" help="Palabra clave en el comentario de IG que dispara el DM (ej: REGALO).">
          <Input value={config.ig_comment_trigger} onChange={(v) => update("ig_comment_trigger", v)} />
        </Field>
        <Field label="Mensaje de bienvenida IG" help="DM automático cuando alguien comenta el trigger.">
          <Textarea value={config.ig_welcome_message} onChange={(v) => update("ig_welcome_message", v)} rows={5} />
        </Field>
      </Section>

      <Section title="System prompt (avanzado)">
        <p className="text-[11px] text-ink-3 mb-2">
          Texto opcional que se concatena al system prompt base de Dana. Útil para campañas (ej: "Esta semana hay 20% off en filtros") sin tocar el código.
          {!hasOverride && <span className="text-orange"> Actualmente vacío — Dana usa el prompt hardcoded.</span>}
        </p>
        <Textarea
          value={config.system_prompt_override}
          onChange={(v) => update("system_prompt_override", v)}
          rows={10}
          placeholder="(vacío = usa el prompt base hardcoded)"
        />
      </Section>

      <div className="sticky bottom-4 flex justify-end pt-4">
        <button
          type="button"
          onClick={save}
          disabled={pending || Object.keys(dirty).length === 0}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-orange text-dark rounded-md text-[11px] font-display font-bold uppercase tracking-wider transition-all hover:translate-x-[2px] hover:translate-y-[2px] disabled:opacity-50"
          style={{ border: "2px solid #1A1A1A", boxShadow: "4px 4px 0 0 var(--shadow-color)" }}
        >
          <Save size={12} strokeWidth={3} />
          {pending ? "Guardando…" : `Guardar cambios${Object.keys(dirty).length ? ` (${Object.keys(dirty).length})` : ""}`}
        </button>
      </div>

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-md flex items-center gap-2 text-[12px] font-medium animate-in fade-in slide-in-from-bottom-2"
          style={{ background: toast.kind === "ok" ? "#4D5431" : "#BB3B2E", color: "#fff", border: "2px solid #1A1A1A", boxShadow: "4px 4px 0 0 var(--shadow-color)", minWidth: 280, maxWidth: 480 }}>
          {toast.kind === "ok" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{toast.msg}</span>
        </div>
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section
      className="bg-page rounded-md p-5"
      style={{ border: "1.5px solid var(--border)", boxShadow: "3px 3px 0 0 var(--shadow-color)" }}
    >
      <h3 className="font-display font-black text-[14px] uppercase tracking-tight text-ink mb-3">{title}</h3>
      <div className="space-y-3">{children}</div>
    </section>
  )
}

function Field({ label, help, children }: { label: string; help?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] font-display font-bold uppercase tracking-[0.18em] text-ink-2 mb-1.5">{label}</label>
      {children}
      {help && <p className="text-[10px] text-ink-3 mt-1">{help}</p>}
    </div>
  )
}

function Input({ value, onChange, type, placeholder }: { value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <input
      type={type ?? "text"}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-3 py-2 bg-cream rounded-md text-[12px] font-mono focus:outline-none"
      style={{ border: "1.5px solid var(--border)" }}
    />
  )
}

function Textarea({ value, onChange, rows, placeholder }: { value: string; onChange: (v: string) => void; rows: number; placeholder?: string }) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={rows}
      placeholder={placeholder}
      className="w-full px-3 py-2 bg-cream rounded-md text-[12px] font-mono focus:outline-none resize-y"
      style={{ border: "1.5px solid var(--border)" }}
    />
  )
}

function Toggle({ label, checked, onChange, help }: { label: string; checked: boolean; onChange: (v: boolean) => void; help?: string }) {
  return (
    <div>
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="w-4 h-4 accent-orange"
        />
        <span className="text-[12px] font-display font-bold uppercase tracking-wider text-ink">{label}</span>
      </label>
      {help && <p className="text-[10px] text-ink-3 mt-1 ml-6">{help}</p>}
    </div>
  )
}
