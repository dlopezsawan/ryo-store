import Link from "next/link"
import { PageHeader, PageWatermark } from "@/components/layout/PageHeader"
import { Store, Globe2, Network, KeyRound, Users, Megaphone, Tag, Map, Wrench, Percent, CreditCard, ChevronRight } from "lucide-react"
import { getSession } from "@/lib/auth"
import { getMaintenanceStatus, MedusaError } from "@/lib/medusa"
import { MaintenanceToggle } from "./MaintenanceToggle"

interface SettingCard {
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>
  title: string
  subtitle: string
  href?: string
  external?: string
  bg?: "orange" | "secondary"
  iconBg?: "orange" | "secondary" | "neutral"
}

const cards: SettingCard[] = [
  { icon: Store,      title: "Tienda",        subtitle: "Nombre · monedas soportadas · default region", href: "/settings/store",         iconBg: "orange" },
  { icon: Globe2,     title: "Regiones",      subtitle: "Países · moneda por región",                  href: "/settings/regions",       iconBg: "secondary" },
  { icon: Percent,    title: "Tax regions",   subtitle: "IVA por país/provincia · tax rates",          href: "/settings/tax",           iconBg: "neutral" },
  { icon: CreditCard, title: "Pagos",         subtitle: "Providers · asignación por región",           href: "/settings/payments",      iconBg: "secondary" },
  { icon: Network,    title: "Sales Channels",subtitle: "Storefronts · canales de venta",              href: "/settings/sales-channels",iconBg: "neutral" },
  { icon: KeyRound,   title: "API Keys",      subtitle: "Publishable + secret · rotación",             href: "/settings/api-keys",      iconBg: "neutral" },
  { icon: Users,      title: "Equipo",        subtitle: "Usuarios admin · invites pendientes",         href: "/settings/team",          iconBg: "secondary" },
  { icon: Map,        title: "Ubicaciones",   subtitle: "Warehouses · pickup",                         href: "/locations",              iconBg: "neutral" },
  { icon: Tag,        title: "Catálogo",      subtitle: "Categorías + colecciones",                    href: "/catalog",                iconBg: "neutral" },
  { icon: Megaphone,  title: "Marketing",     subtitle: "Promociones + segmentos",                     href: "/marketing",              iconBg: "neutral" },
  { icon: Wrench,     title: "Sistema",       subtitle: "Mantenimiento · cron · logs",                 href: "#",                       bg: "orange", iconBg: "orange" },
]

export default async function SettingsPage() {
  const session = await getSession()
  // Maintenance toggle (custom endpoint, returns { enabled, message? })
  let maintenanceEnabled = false
  let maintenanceMessage: string | null = null
  let maintenanceError = false
  try {
    const m = await getMaintenanceStatus()
    maintenanceEnabled = m.enabled
    maintenanceMessage = m.message ?? null
  } catch (e) {
    if (!(e instanceof MedusaError)) maintenanceError = true
  }

  const buildVersion = process.env.NEXT_PUBLIC_BUILD_VERSION ?? "v1.0"
  const deployTime = process.env.NEXT_PUBLIC_BUILD_TIME ?? new Date().toISOString().slice(0, 16).replace("T", " ")

  return (
    <div className="p-7 space-y-5 relative">
      <PageWatermark char="⚙" />

      <PageHeader
        title="CONFIGURACIÓN"
        description={session ? `Logueado como ${session.email}` : "Setup de la tienda · 9 áreas"}
      />

      <MaintenanceToggle
        enabled={maintenanceEnabled}
        message={maintenanceMessage}
        hadError={maintenanceError}
      />

      {/* Settings grid */}
      <div className="grid grid-cols-3 gap-5">
        {cards.map((c) => {
          const Icon = c.icon
          const inner = (
            <>
              <div className="flex items-start gap-3">
                <div
                  className={`w-12 h-12 flex items-center justify-center ${
                    c.iconBg === "orange" ? "bg-orange text-dark" :
                    c.iconBg === "secondary" ? "bg-secondary text-cream" :
                    "bg-cream-2 text-ink"
                  }`}
                  style={{ border: "2px solid #1A1A1A", boxShadow: "2px 2px 0 0 var(--shadow-color)" }}
                >
                  <Icon size={20} strokeWidth={2.2} />
                </div>
                <div className="flex-1">
                  <div className="font-display font-black text-[16px] uppercase tracking-tight">{c.title}</div>
                  <div className="text-[11px] text-ink-3 mt-0.5">{c.subtitle}</div>
                </div>
                <ChevronRight size={16} className="text-ink-3 flex-shrink-0" />
              </div>
            </>
          )
          const cls = `stamp-card stamp-card-hover p-5 cursor-pointer block ${
            c.bg === "orange" ? "bg-orange/5" : c.bg === "secondary" ? "bg-secondary/5" : ""
          }`
          return c.href && c.href !== "#" ? (
            <Link key={c.title} href={c.href} className={cls}>{inner}</Link>
          ) : (
            <div key={c.title} className={`${cls} opacity-60`} title="Próximamente">{inner}</div>
          )
        })}
      </div>

      {/* Status footer with real session/build info */}
      <div className="stamp-card p-5 bg-dark text-cream relative overflow-hidden">
        <div className="watermark-amp text-[200px] -top-12 right-4 text-orange opacity-15 select-none italic">&amp;</div>
        <div className="grid grid-cols-4 gap-4 relative">
          <StatusBlock
            label="Status sistema"
            value={maintenanceEnabled ? (
              <><span className="w-2 h-2 bg-primary rounded-full streak inline-block mr-2" />MANTENIMIENTO</>
            ) : (
              <><span className="w-2 h-2 bg-secondary rounded-full streak inline-block mr-2" />OPERATIVO</>
            )}
            sub={maintenanceEnabled ? "tienda offline" : "tienda online"}
          />
          <StatusBlock
            label="Versión panel"
            value={buildVersion}
            sub={`deploy ${deployTime}`}
          />
          <StatusBlock
            label="Usuario"
            value={session ? <span className="text-[14px]">{session.email.split("@")[0]}</span> : "—"}
            sub={session ? "sesión activa · 8h TTL" : "no autenticado"}
          />
          <StatusBlock
            label="Soporte"
            value={<span className="text-[14px]">hola@enrola.shop</span>}
            sub="respondemos en <1h"
          />
        </div>
      </div>

      {/* Footer */}
      <div className="text-center pt-4 pb-2">
        <div className="text-[9px] text-ink-3 font-mono uppercase tracking-[0.3em]">
          Enrola Shop · Panel v1.0 · Made in Caracas
        </div>
      </div>
    </div>
  )
}

function StatusBlock({ label, value, sub }: { label: string; value: React.ReactNode; sub: string }) {
  return (
    <div>
      <div className="text-[9px] text-orange font-display font-bold uppercase tracking-[0.18em]">{label}</div>
      <div className="font-display font-black text-[18px] mt-1 flex items-center">{value}</div>
      <div className="text-[10px] text-cream/60 font-mono mt-1">{sub}</div>
    </div>
  )
}
