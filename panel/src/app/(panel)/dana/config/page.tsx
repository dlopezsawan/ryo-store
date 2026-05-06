import { getDanaConfig, MedusaError } from "@/lib/medusa"
import { PageHeader } from "@/components/layout/PageHeader"
import { ConfigForm } from "./ConfigForm"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function DanaConfigPage() {
  let config = null
  let hasOverride = false
  let error: string | undefined
  try {
    const r = await getDanaConfig()
    config = r.config
    hasOverride = r.has_system_prompt_override
  } catch (e) {
    if (e instanceof MedusaError && e.status === 401) {
      error = "Sesión expirada — recarga la página."
    } else {
      error = e instanceof Error ? e.message : "No se pudo cargar el config"
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Configuración de Dana"
        description="Comportamiento del bot, credenciales y system prompt"
        actions={
          <Link
            href="/dana"
            className="flex items-center gap-1.5 px-3 py-2 bg-cream rounded-md text-[10px] font-display font-bold uppercase tracking-wider text-ink hover:bg-cream-2"
            style={{ border: "1.5px solid var(--border)", boxShadow: "3px 3px 0 0 var(--shadow-color)" }}
          >
            <ArrowLeft size={11} strokeWidth={2.5} /> Volver al chat
          </Link>
        }
      />
      {error && (
        <div className="stamp-card p-4 bg-primary/5" style={{ borderColor: "#BB3B2E" }}>
          <p className="text-[13px] font-medium text-primary">{error}</p>
        </div>
      )}
      {config && <ConfigForm initial={config} hasOverride={hasOverride} />}
    </div>
  )
}
