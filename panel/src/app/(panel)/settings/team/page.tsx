import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { PageHeader, PageWatermark } from "@/components/layout/PageHeader"
import { initials, fmtRelative } from "@/lib/utils"
import { listUsers, listInvites, MedusaError, type AdminUser, type AdminInvite } from "@/lib/medusa"
import { InviteSection } from "./InviteForm"

export default async function TeamPage() {
  let users: AdminUser[] = []
  let invites: AdminInvite[] = []
  let errorMsg: string | null = null

  try {
    const [u, i] = await Promise.all([listUsers(), listInvites()])
    users = u.users
    invites = i.invites
  } catch (e) {
    if (e instanceof MedusaError && e.status === 401) errorMsg = "Sesión expirada."
    else errorMsg = `No se pudo cargar el equipo: ${e instanceof Error ? e.message : "error"}`
  }

  return (
    <div className="p-7 space-y-5 relative">
      <PageWatermark char="@" />
      <Link href="/settings" className="inline-flex items-center gap-1 text-[11px] font-display font-bold uppercase tracking-wider text-ink-3 hover:text-orange">
        <ArrowLeft size={12} strokeWidth={2.5} /> Settings
      </Link>
      <PageHeader
        title="EQUIPO"
        stamp={<>{users.length} ADMINS</>}
        stampTone="secondary"
        description="Usuarios con acceso al panel + invitaciones pendientes"
      />

      {errorMsg && (
        <div className="stamp-card p-4 bg-primary/5" style={{ borderColor: "#BB3B2E" }}>
          <p className="text-[13px] font-medium text-primary">{errorMsg}</p>
        </div>
      )}

      {!errorMsg && (
        <div className="grid grid-cols-12 gap-5">
          {/* Users */}
          <div className="col-span-7">
            <div className="stamp-card overflow-hidden">
              <div className="px-5 py-3 bg-dark text-cream">
                <h3 className="font-display font-black text-[14px] uppercase tracking-wider">Admins activos</h3>
              </div>
              {users.length === 0 ? (
                <div className="p-10 text-center text-[13px] text-ink-3">Sin admins.</div>
              ) : (
                <ul className="divide-y divide-warm-200/50">
                  {users.map((u) => {
                    const fullName = [u.first_name, u.last_name].filter(Boolean).join(" ") || u.email.split("@")[0]
                    return (
                      <li key={u.id} className="px-5 py-3 flex items-center gap-3 row-hover">
                        <div className="w-9 h-9 bg-secondary text-cream flex items-center justify-center font-display font-black text-[12px]" style={{ border: "1.5px solid var(--border)" }}>
                          {initials(fullName)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-display font-bold text-ink truncate">{fullName}</div>
                          <div className="text-[11px] font-mono text-ink-3 truncate">{u.email}</div>
                        </div>
                        <span className="text-[10px] font-mono text-ink-3">desde {fmtRelative(u.created_at)}</span>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </div>

          {/* Invites */}
          <div className="col-span-5">
            <InviteSection
              rows={invites.map((i) => ({
                id: i.id,
                email: i.email,
                accepted: i.accepted,
                expires_at: i.expires_at,
              }))}
            />
          </div>
        </div>
      )}
    </div>
  )
}
