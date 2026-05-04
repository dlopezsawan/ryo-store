import Link from "next/link"
import { ArrowLeft, AtSign } from "lucide-react"
import { PageHeader, PageWatermark } from "@/components/layout/PageHeader"
import {
  listAudiences, listContacts, isConfigured, defaultFromAddress,
  ResendError,
  type ResendAudience, type ResendContact,
} from "@/lib/resend"
import { fmtRelative } from "@/lib/utils"
import { BroadcastComposer } from "./BroadcastComposer"

export default async function AudiencesPage() {
  const configured = isConfigured()
  let audiences: ResendAudience[] = []
  let contactsByAudience: Record<string, ResendContact[]> = {}
  let errorMsg: string | null = null

  if (configured) {
    try {
      const aRes = await listAudiences()
      audiences = aRes.data
      // Cargar contacts de cada audience en paralelo
      const contactsArr = await Promise.all(
        audiences.map((a) => listContacts(a.id, { limit: 1000 }).catch(() => ({ data: [] as ResendContact[] }))),
      )
      contactsByAudience = Object.fromEntries(
        audiences.map((a, i) => [a.id, contactsArr[i].data]),
      )
    } catch (e) {
      errorMsg = e instanceof ResendError ? `Resend ${e.status}: ${e.message}` : "error"
    }
  } else {
    errorMsg = "RESEND_API_KEY no configurado"
  }

  const totalContacts = Object.values(contactsByAudience).reduce((s, arr) => s + arr.length, 0)
  const totalUnsubscribed = Object.values(contactsByAudience).reduce(
    (s, arr) => s + arr.filter((c) => c.unsubscribed).length,
    0,
  )

  return (
    <div className="p-7 space-y-5 relative">
      <PageWatermark char="@" />
      <Link href="/webmail" className="inline-flex items-center gap-1 text-[11px] font-display font-bold uppercase tracking-wider text-ink-3 hover:text-orange">
        <ArrowLeft size={12} strokeWidth={2.5} /> Webmail
      </Link>
      <PageHeader
        title="AUDIENCES"
        stamp={<>{audiences.length} TOTALES · {totalContacts.toLocaleString("es-VE")} CONTACTOS</>}
        stampTone="orange"
        description="Listas de contactos en Resend para campañas y newsletters"
        actions={
          configured && audiences.length > 0 ? (
            <BroadcastComposer
              audiences={audiences.map((a) => ({
                id: a.id,
                name: a.name,
                contactCount: contactsByAudience[a.id]?.length ?? 0,
              }))}
              defaultFrom={defaultFromAddress()}
            />
          ) : undefined
        }
      />

      {errorMsg && (
        <div className="stamp-card p-4 bg-primary/5" style={{ borderColor: "#BB3B2E" }}>
          <p className="text-[13px] font-medium text-primary">{errorMsg}</p>
        </div>
      )}

      {!errorMsg && audiences.length === 0 && (
        <div className="stamp-card p-10 text-center">
          <p className="font-display font-bold text-[14px] uppercase tracking-wider text-ink-3">
            Sin audiences en Resend
          </p>
          <p className="text-[12px] text-ink-3 mt-1">
            Crea una desde <a href="https://resend.com/audiences" target="_blank" rel="noopener noreferrer" className="text-orange hover:underline">resend.com/audiences</a>
          </p>
        </div>
      )}

      {!errorMsg && audiences.length > 0 && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-3 gap-3">
            <Kpi label="Audiences"        value={audiences.length.toString()}     sub="totales" />
            <Kpi label="Contactos"        value={totalContacts.toLocaleString("es-VE")} sub="suscritos + no" tone="secondary" />
            <Kpi label="Unsubscribed"     value={totalUnsubscribed.toString()}    sub={totalContacts > 0 ? `${((totalUnsubscribed / totalContacts) * 100).toFixed(1)}%` : "—"} tone={totalUnsubscribed > 0 ? "primary" : undefined} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {audiences.map((a) => {
              const contacts = contactsByAudience[a.id] ?? []
              const unsubs = contacts.filter((c) => c.unsubscribed).length
              const active = contacts.length - unsubs
              return (
                <div key={a.id} className="stamp-card p-5">
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-9 h-9 bg-orange text-dark flex items-center justify-center flex-shrink-0" style={{ border: "1.5px solid var(--border)" }}>
                      <AtSign size={14} strokeWidth={2.4} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-display font-black text-[14px] uppercase tracking-wider truncate">{a.name}</h3>
                      <p className="text-[10px] font-mono text-ink-3">desde {fmtRelative(a.created_at)}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <Pill value={contacts.length} label="Total" />
                    <Pill value={active} label="Activos" tone="secondary" />
                    <Pill value={unsubs} label="Unsubs" tone={unsubs > 0 ? "primary" : undefined} />
                  </div>
                  {contacts.length > 0 && (
                    <div className="space-y-1 text-[11px] font-mono max-h-40 overflow-y-auto">
                      {contacts.slice(0, 8).map((c) => (
                        <div key={c.id} className="flex items-center justify-between gap-2 py-1 px-2 bg-cream-2/40 rounded-md">
                          <span className="truncate text-ink-2">{c.email}</span>
                          {c.unsubscribed && (
                            <span className="text-[9px] uppercase text-primary font-display font-bold flex-shrink-0">unsub</span>
                          )}
                        </div>
                      ))}
                      {contacts.length > 8 && (
                        <p className="text-[10px] text-ink-3 italic text-center pt-1">
                          + {contacts.length - 8} más
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: "primary" | "secondary" }) {
  const bgClass = tone === "primary" ? "bg-primary/5" : tone === "secondary" ? "bg-secondary/5" : ""
  const labelTone = tone === "primary" ? "text-primary" : tone === "secondary" ? "text-secondary" : "text-ink-3"
  const valueTone = tone === "primary" ? "text-primary" : tone === "secondary" ? "text-secondary" : ""
  return (
    <div className={`stamp-card p-3 ${bgClass}`}>
      <div className={`text-[9px] font-display font-bold uppercase tracking-[0.18em] ${labelTone}`}>{label}</div>
      <div className={`stat-display text-[24px] mt-1 num ${valueTone}`}>{value}</div>
      <div className="text-[9px] text-ink-3 font-mono mt-1">{sub}</div>
    </div>
  )
}

function Pill({ value, label, tone }: { value: number; label: string; tone?: "primary" | "secondary" }) {
  const cls = tone === "primary" ? "text-primary" : tone === "secondary" ? "text-secondary" : "text-ink"
  return (
    <div className="text-center">
      <div className={`font-display font-black text-[18px] num ${cls}`}>{value}</div>
      <div className="text-[9px] font-display font-bold uppercase tracking-wider text-ink-3">{label}</div>
    </div>
  )
}
