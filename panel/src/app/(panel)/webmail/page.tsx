import Link from "next/link"
import { PageHeader, PageWatermark } from "@/components/layout/PageHeader"
import { Mail, ExternalLink } from "lucide-react"
import {
  listEmails, listAudiences, isConfigured, defaultFromAddress,
  ResendError, ResendNotConfigured,
  type ResendEmail, type ResendAudience,
} from "@/lib/resend"
import { listAccounts as listMailAccounts, type WebmailAccount } from "@/lib/webmail"
import { MedusaError } from "@/lib/medusa"
import { WebmailClient } from "./WebmailClient"
import { WebmailTabs } from "./WebmailTabs"
import { MarketingPanel } from "./MarketingPanel"
import { SendEmailForm } from "./SendEmailForm"

export default async function WebmailPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const sp = await searchParams
  const tab = (sp.tab as "inbox" | "marketing" | "send") ?? "inbox"

  // Resend (transactional + audiences)
  const configured = isConfigured()
  let emails: ResendEmail[] = []
  let audiences: ResendAudience[] = []
  let listError: string | null = null

  if (configured) {
    try {
      const [eRes, aRes] = await Promise.all([
        listEmails({ limit: 50 }).catch((e) => {
          if (e instanceof ResendError && e.status === 404) return { data: [] as ResendEmail[] }
          throw e
        }),
        listAudiences().catch(() => ({ data: [] as ResendAudience[] })),
      ])
      emails = eRes.data
      audiences = aRes.data
    } catch (e) {
      if (e instanceof ResendError) listError = `Resend ${e.status}: ${e.message}`
      else if (e instanceof ResendNotConfigured) listError = "RESEND_API_KEY no configurado"
      else listError = e instanceof Error ? e.message : "error desconocido"
    }
  }

  // Webmail accounts (IMAP buzones del admin)
  let accounts: WebmailAccount[] = []
  let adminEmail: string | null = null
  let webmailError: string | null = null
  try {
    const r = await listMailAccounts()
    accounts = r.accounts
    adminEmail = r.admin_email
  } catch (e) {
    if (e instanceof MedusaError) webmailError = `Medusa ${e.status}: ${e.message}`
    else webmailError = e instanceof Error ? e.message : "error"
  }

  const availableAccounts = accounts.filter((a) => a.available).length
  const totalEmails = emails.length

  return (
    <div className="p-7 space-y-5 relative">
      <PageWatermark char="@" />

      <PageHeader
        title="WEBMAIL"
        stamp={
          configured ? (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-secondary inline-block streak" />
              {availableAccounts}/{accounts.length} BUZONES · RESEND OK
            </>
          ) : (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-primary inline-block streak" />
              SIN CONFIGURAR
            </>
          )
        }
        stampTone={configured ? "secondary" : "primary"}
        description={
          configured ? (
            <>
              Inbox · marketing · transaccional para{" "}
              <code className="font-mono text-orange">{adminEmail ?? "—"}</code> ·{" "}
              <span className="text-ink font-bold">{totalEmails}</span> emails Resend ·{" "}
              <span className="text-ink font-bold">{audiences.length}</span> audience{audiences.length === 1 ? "" : "s"}
            </>
          ) : (
            <>
              Configura <code className="font-mono text-orange">RESEND_API_KEY</code> y{" "}
              <code className="font-mono text-orange">WEBMAIL_PASS_*</code> para activar todo
            </>
          )
        }
        actions={
          configured ? (
            <Link href="https://resend.com/emails" target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 bg-cream rounded-md text-[10px] font-display font-bold uppercase tracking-wider text-ink hover:bg-cream-2"
              style={{ border: "1.5px solid var(--border)" }}>
              Resend Dashboard <ExternalLink size={11} strokeWidth={2.5} />
            </Link>
          ) : null
        }
      />

      <WebmailTabs current={tab} />

      {webmailError && tab === "inbox" && (
        <div className="stamp-card p-4 bg-primary/5" style={{ borderColor: "#BB3B2E" }}>
          <p className="text-[12px] text-primary flex items-center gap-2">
            <Mail size={12} /> {webmailError} — el módulo de inbox necesita el endpoint <code className="font-mono mx-1">/admin/webmail/accounts</code> deployed.
          </p>
        </div>
      )}

      {tab === "inbox" && !webmailError && (
        accounts.length === 0 ? (
          <div className="stamp-card p-10 text-center">
            <Mail size={48} className="text-ink-3 mx-auto mb-3" strokeWidth={1.5} />
            <p className="font-display font-bold text-[14px] uppercase tracking-wider text-ink-3">
              Sin buzones asignados
            </p>
            <p className="text-[12px] text-ink-3 mt-1">
              Tu admin <code className="font-mono">{adminEmail ?? "?"}</code> no tiene cuentas IMAP en el mapping.
            </p>
          </div>
        ) : (
          <WebmailClient initialAccounts={accounts} />
        )
      )}

      {tab === "send" && (
        <div className="grid grid-cols-12 gap-5">
          <div className="col-span-12 md:col-span-7">
            <SendEmailForm defaultFrom={defaultFromAddress()} />
          </div>
          <div className="col-span-12 md:col-span-5">
            <RecentEmailsPanel emails={emails} listError={listError} />
          </div>
        </div>
      )}

      {tab === "marketing" && (
        <MarketingPanel
          configured={configured}
          audiences={audiences}
          emails={emails}
          listError={listError}
          defaultFrom={defaultFromAddress()}
        />
      )}
    </div>
  )
}

function RecentEmailsPanel({ emails, listError }: { emails: ResendEmail[]; listError: string | null }) {
  return (
    <div className="stamp-card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 bg-dark text-cream">
        <div className="flex items-center gap-2">
          <Mail size={14} strokeWidth={2.4} />
          <h3 className="font-display font-black text-[14px] uppercase tracking-wider">Últimos enviados</h3>
        </div>
        <span className="text-[11px] text-orange font-mono">{emails.length}</span>
      </div>
      {listError ? (
        <div className="p-4 text-[12px] text-primary">{listError}</div>
      ) : emails.length === 0 ? (
        <div className="p-6 text-[11px] text-ink-3 italic font-mono text-center">Sin emails recientes.</div>
      ) : (
        <ul className="divide-y divide-warm-200/50 max-h-[600px] overflow-y-auto">
          {emails.slice(0, 30).map((e) => (
            <li key={e.id} className="px-4 py-2.5 row-hover">
              <div className="flex items-center gap-2 mb-0.5 text-[10px] font-mono text-ink-3">
                <span className="capitalize">{e.last_event ?? "sent"}</span>
                <span>·</span>
                <span>{new Date(e.created_at).toLocaleDateString("es-VE")}</span>
              </div>
              <div className="font-display font-bold text-[12px] truncate">{e.subject}</div>
              <div className="text-[10px] font-mono text-ink-3 truncate">→ {Array.isArray(e.to) ? e.to.join(", ") : e.to}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
