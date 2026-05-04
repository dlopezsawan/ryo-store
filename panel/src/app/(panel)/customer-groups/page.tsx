import { PageHeader, PageWatermark } from "@/components/layout/PageHeader"
import { listCustomerGroups, MedusaError, type AdminCustomerGroup } from "@/lib/medusa"
import { GroupsManager } from "./GroupsManager"

export default async function CustomerGroupsPage() {
  let groups: AdminCustomerGroup[] = []
  let errorMsg: string | null = null

  try {
    const res = await listCustomerGroups()
    groups = res.customer_groups
  } catch (e) {
    if (e instanceof MedusaError && e.status === 401) {
      errorMsg = "Sesión expirada. Recarga el panel."
    } else {
      errorMsg = `No se pudo cargar segmentos: ${e instanceof Error ? e.message : "error desconocido"}`
    }
  }

  return (
    <div className="p-7 space-y-5 relative">
      <PageWatermark char="@" />

      <PageHeader
        title="SEGMENTOS"
        stamp={<>{groups.length} ACTIVOS</>}
        stampTone="secondary"
        description={
          <>
            Grupos de clientes (VIPs, mayoristas, etc.) para targeting de promos y campañas
          </>
        }
      />

      {errorMsg ? (
        <div className="stamp-card p-4 bg-primary/5" style={{ borderColor: "#BB3B2E" }}>
          <p className="text-[13px] font-medium text-primary">{errorMsg}</p>
        </div>
      ) : (
        <GroupsManager
          rows={groups.map((g) => ({
            id: g.id,
            name: g.name,
            memberCount: g.customers?.length ?? 0,
            createdAt: g.created_at,
          }))}
        />
      )}
    </div>
  )
}
