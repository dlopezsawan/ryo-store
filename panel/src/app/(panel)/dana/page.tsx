import { listDanaConversations, MedusaError } from "@/lib/medusa"
import { PageHeader } from "@/components/layout/PageHeader"
import { DanaWorkspace } from "./DanaWorkspace"
import Link from "next/link"
import { Settings } from "lucide-react"

/**
 * Dana — vista principal del módulo de conversaciones.
 *
 * Estructura:
 *   - Sidebar izquierdo: lista de conversaciones (filtrable, buscable)
 *   - Canvas derecho: chat view de la conversación seleccionada
 *
 * Server component carga el primer batch (50 convos), después el
 * componente cliente DanaWorkspace hace polling cada 8s para refrescar.
 *
 * Sin conversación seleccionada → empty state explicando el flujo.
 */

export const dynamic = "force-dynamic"

export default async function DanaPage({ searchParams }: { searchParams: Promise<{ phone?: string; status?: string; q?: string }> }) {
  const params = await searchParams
  const status = (params.status === "bot_active" || params.status === "human_active" ? params.status : "all") as "bot_active" | "human_active" | "all"
  const q = params.q ?? ""

  let initialList: Awaited<ReturnType<typeof listDanaConversations>> | null = null
  let listError: string | undefined
  try {
    initialList = await listDanaConversations({ limit: 50, status, q })
  } catch (e) {
    if (e instanceof MedusaError && e.status === 401) {
      listError = "Sesión expirada — recarga la página."
    } else {
      listError = e instanceof Error ? e.message : "No se pudo cargar las conversaciones"
    }
  }

  return (
    // p-7 matches the rest of the panel pages (finanzas, orders, etc.)
    // The fixed height keeps the chat thread scrollable inside without
    // pushing the whole page beyond the viewport — without it the
    // sidebar list grew to fit all conversations and the body
    // overflowed instead of the inner thread.
    <div className="p-7 flex flex-col gap-4 h-[calc(100vh-3rem)] min-h-0">
      <PageHeader
        title="Dana"
        description={
          initialList ? (
            <>
              {initialList.total} conversación{initialList.total === 1 ? "" : "es"}
              {initialList.human_active_count > 0 && (
                <> · <span className="text-primary font-bold">{initialList.human_active_count}</span> con operador</>
              )}
            </>
          ) : (
            "Cargando…"
          )
        }
        actions={
          <Link
            href="/dana/config"
            className="flex items-center gap-1.5 px-3 py-2 bg-cream rounded-md text-[10px] font-display font-bold uppercase tracking-wider text-ink hover:bg-cream-2"
            style={{ border: "1.5px solid var(--border)", boxShadow: "3px 3px 0 0 var(--shadow-color)" }}
          >
            <Settings size={11} strokeWidth={2.5} /> Config
          </Link>
        }
      />

      {listError && (
        <div className="stamp-card p-4 bg-primary/5" style={{ borderColor: "#BB3B2E" }}>
          <p className="text-[13px] font-medium text-primary">{listError}</p>
        </div>
      )}

      {initialList && (
        <DanaWorkspace
          initialConversations={initialList.conversations}
          initialTotal={initialList.total}
          initialStatus={status}
          initialQuery={q}
          selectedPhone={params.phone}
        />
      )}
    </div>
  )
}
