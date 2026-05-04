import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { PageHeader, PageWatermark } from "@/components/layout/PageHeader"
import { listApiKeys, MedusaError, type AdminApiKey } from "@/lib/medusa"
import { ApiKeysManager } from "./ApiKeysManager"

export default async function ApiKeysPage() {
  let keys: AdminApiKey[] = []
  let errorMsg: string | null = null

  try {
    const res = await listApiKeys()
    keys = res.api_keys
  } catch (e) {
    if (e instanceof MedusaError && e.status === 401) errorMsg = "Sesión expirada."
    else errorMsg = `No se pudo cargar API keys: ${e instanceof Error ? e.message : "error"}`
  }

  return (
    <div className="p-7 space-y-5 relative">
      <PageWatermark char="🔑" />
      <Link href="/settings" className="inline-flex items-center gap-1 text-[11px] font-display font-bold uppercase tracking-wider text-ink-3 hover:text-orange">
        <ArrowLeft size={12} strokeWidth={2.5} /> Settings
      </Link>
      <PageHeader
        title="API KEYS"
        stamp={<>{keys.length} REGISTRADAS</>}
        stampTone="orange"
        description="Tokens de acceso para storefronts y servicios externos"
      />

      {errorMsg ? (
        <div className="stamp-card p-4 bg-primary/5" style={{ borderColor: "#BB3B2E" }}>
          <p className="text-[13px] font-medium text-primary">{errorMsg}</p>
        </div>
      ) : (
        <ApiKeysManager
          rows={keys.map((k) => ({
            id: k.id,
            title: k.title,
            type: k.type,
            redacted: k.redacted,
            created_at: k.created_at,
            revoked_at: k.revoked_at ?? null,
            last_used_at: k.last_used_at ?? null,
          }))}
        />
      )}
    </div>
  )
}
