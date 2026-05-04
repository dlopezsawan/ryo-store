import Link from "next/link"
import { PageHeader, PageWatermark } from "@/components/layout/PageHeader"
import { initials, fmtRelative } from "@/lib/utils"
import { listCustomers, listCustomerGroups, MedusaError, type AdminCustomer } from "@/lib/medusa"
import { CustomerHeaderActions } from "./CustomerHeaderActions"
import { CustomersBulkBar } from "./CustomersBulkBar"
import { KeyboardNavList } from "@/components/util/KeyboardNavList"
import { SavedViews } from "@/components/util/SavedViews"

interface SearchParams {
  q?: string
  page?: string
  has_account?: string
}

const PAGE_SIZE = 50

export default async function CustomersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams
  const q = params.q?.trim() || undefined
  const page = Math.max(1, Number(params.page) || 1)
  const offset = (page - 1) * PAGE_SIZE
  const has_account =
    params.has_account === "true" ? true :
    params.has_account === "false" ? false :
    undefined

  let customers: AdminCustomer[] = []
  let totalCount = 0
  let registeredCount = 0
  let errorMsg: string | null = null

  try {
    const res = await listCustomers({ limit: PAGE_SIZE, offset, q, has_account })
    customers = res.customers
    totalCount = res.count
    registeredCount = customers.filter((c) => c.has_account).length
  } catch (e) {
    if (e instanceof MedusaError && e.status === 401) {
      errorMsg = "Sesión expirada. Recarga la página."
    } else {
      errorMsg = `No se pudo cargar clientes: ${e instanceof Error ? e.message : "error desconocido"}`
    }
  }

  // Customers nuevos en últimos 30 días
  const thirtyDaysAgo = Date.now() - 30 * 86400 * 1000
  const newCount = customers.filter((c) => new Date(c.created_at).getTime() >= thirtyDaysAgo).length

  // Groups para el bulk bar (fail-soft)
  let groups: Array<{ id: string; name: string }> = []
  try {
    const r = await listCustomerGroups()
    groups = r.customer_groups.map((g) => ({ id: g.id, name: g.name }))
  } catch { /* silent */ }

  return (
    <div className="p-7 space-y-5 relative">
      <PageWatermark />

      <PageHeader
        title="CLIENTES"
        stamp={<span>{totalCount.toLocaleString("es-VE")} TOTALES · {newCount} NUEVOS</span>}
        stampTone="secondary"
        description={`${totalCount} clientes · ${registeredCount} con cuenta · ${totalCount - registeredCount} guests`}
        actions={<CustomerHeaderActions />}
      />

      {/* Search + filter */}
      <div className="stamp-card p-3">
        <div className="flex items-center gap-1 mb-3 overflow-x-auto pb-1" style={{ borderBottom: "2px dashed var(--border)" }}>
          {[
            { key: "all", label: "Todos", value: undefined },
            { key: "registered", label: "Con cuenta", value: "true" },
            { key: "guest", label: "Guests", value: "false" },
          ].map((f) => {
            const active = (params.has_account ?? "all") === (f.value ?? "all") ||
                           (!params.has_account && f.key === "all")
            const sp = new URLSearchParams()
            if (f.value) sp.set("has_account", f.value)
            if (params.q) sp.set("q", params.q)
            return (
              <Link
                key={f.key}
                href={`/customers${sp.toString() ? `?${sp}` : ""}`}
                className={`px-3 py-1.5 font-display font-bold text-[11px] uppercase tracking-wider rounded-md whitespace-nowrap ${
                  active ? "bg-dark text-cream" : "hover:bg-cream-2 text-ink-3"
                }`}
              >
                {f.label}
              </Link>
            )
          })}
        </div>
        <form className="flex items-center gap-2" method="GET" action="/customers">
          {params.has_account && <input type="hidden" name="has_account" value={params.has_account} />}
          <input
            type="text"
            name="q"
            defaultValue={params.q ?? ""}
            placeholder="Buscar por email, nombre, teléfono…"
            className="flex-1 px-3 py-2 bg-cream rounded-md text-[12px] font-medium focus:outline-none"
            style={{ border: "1.5px solid var(--border)" }}
          />
          <button
            type="submit"
            className="px-3 py-2 bg-cream rounded-md text-[10px] font-display font-bold uppercase tracking-wider text-ink hover:bg-cream-2"
            style={{ border: "1.5px solid var(--border)" }}
          >
            Buscar
          </button>
          {(params.q || params.has_account) && (
            <Link
              href="/customers"
              className="px-3 py-2 text-[10px] font-display font-bold uppercase tracking-wider text-ink-3 hover:text-ink"
            >
              Limpiar
            </Link>
          )}
        </form>
      </div>

      {errorMsg && (
        <div className="stamp-card p-4 bg-primary/5" style={{ borderColor: "#BB3B2E" }}>
          <p className="text-[13px] font-medium text-primary">{errorMsg}</p>
        </div>
      )}

      <SavedViews
        storageKey="panel_views_customers"
        presets={[
          { id: "p-all",       name: "Todos",         query: "",                                createdAt: 0 },
          { id: "p-registered", name: "Con cuenta",   query: "has_account=true",                createdAt: 0 },
          { id: "p-guest",     name: "Guests",        query: "has_account=false",               createdAt: 0 },
        ]}
      />

      {!errorMsg && customers.length === 0 && (
        <div className="stamp-card p-10 text-center">
          <p className="font-display font-bold text-[14px] uppercase tracking-wider text-ink-3">
            Sin clientes en este filtro
          </p>
        </div>
      )}

      {!errorMsg && customers.length > 0 && (
        <CustomersBulkBar
          customerIds={customers.map((c) => c.id)}
          groups={groups}
        />
      )}

      {!errorMsg && customers.length > 0 && (
        <div className="stamp-card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 bg-dark text-cream">
            <h3 className="font-display font-black text-[14px] uppercase tracking-wider">Clientes</h3>
            <span className="text-[10px] font-mono text-cream/60">Mostrando {customers.length} de {totalCount}</span>
          </div>
          <table className="w-full">
            <thead>
              <tr className="bg-cream-2 text-[10px] uppercase tracking-[0.12em]" style={{ borderBottom: "2px solid var(--border)" }}>
                <th className="px-3 py-2.5 text-left w-10">
                  <input type="checkbox" data-customer-master className="rounded-md" />
                </th>
                <th className="px-3 py-2.5 text-left font-display font-bold text-ink-2">Cliente</th>
                <th className="px-3 py-2.5 text-left font-display font-bold text-ink-2">Email</th>
                <th className="px-3 py-2.5 text-left font-display font-bold text-ink-2">Teléfono</th>
                <th className="px-3 py-2.5 text-left font-display font-bold text-ink-2">Cuenta</th>
                <th className="px-3 py-2.5 text-left font-display font-bold text-ink-2">Registrado</th>
              </tr>
            </thead>
            <tbody className="text-[13px]">
              {customers.map((c, idx) => {
                const fullName = [c.first_name, c.last_name].filter(Boolean).join(" ") || c.email.split("@")[0]
                return (
                  <tr key={c.id} data-knl-row={idx} className="row-hover row-zebra border-b border-warm-200/50 last:border-b-0 cursor-pointer">
                    <td className="px-3 py-3">
                      <input type="checkbox" data-customer-id={c.id} className="rounded-md" />
                    </td>
                    <td className="px-3 py-3">
                      <Link href={`/customers/${c.id}`} className="flex items-center gap-2.5">
                        <div className={`w-9 h-9 ${c.has_account ? "bg-secondary/15 text-secondary" : "bg-cream-2 text-ink"} flex items-center justify-center font-display font-black text-[12px]`}
                             style={{ border: `1.5px solid ${c.has_account ? "#4D5431" : "#1A1A1A"}` }}>
                          {initials(fullName)}
                        </div>
                        <div>
                          <div className="font-display font-bold text-ink">{fullName}</div>
                          {c.metadata && typeof c.metadata.cedula === "string" && (
                            <div className="text-[10px] text-ink-3 font-mono">CI {c.metadata.cedula}</div>
                          )}
                        </div>
                      </Link>
                    </td>
                    <td className="px-3 py-3 font-mono text-[11px] text-ink-2">
                      <Link href={`/customers/${c.id}`} className="block">{c.email}</Link>
                    </td>
                    <td className="px-3 py-3 font-mono text-[11px] text-ink-3 num">
                      <Link href={`/customers/${c.id}`} className="block">{c.phone ?? "—"}</Link>
                    </td>
                    <td className="px-3 py-3">
                      <Link href={`/customers/${c.id}`} className="block">
                        {c.has_account ? (
                          <span className="pill text-secondary"><span className="pill-dot" />Registrado</span>
                        ) : (
                          <span className="pill text-ink-3"><span className="pill-dot" />Guest</span>
                        )}
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-ink-3 font-mono text-[11px] num">
                      <Link href={`/customers/${c.id}`} className="block">{fmtRelative(c.created_at)}</Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div className="flex items-center justify-between px-4 py-3 bg-cream-2 text-[11px]" style={{ borderTop: "1.5px dashed var(--border)" }}>
            <div className="font-mono text-ink-3">Mostrando <span className="text-orange font-bold num">{customers.length}</span> de <span className="text-orange font-bold num">{totalCount.toLocaleString("es-VE")}</span></div>
          </div>
        </div>
      )}

      {!errorMsg && customers.length > 0 && (
        <KeyboardNavList hrefs={customers.map((c) => `/customers/${c.id}`)} />
      )}

      {!errorMsg && totalCount > PAGE_SIZE && (
        <Pagination
          current={page}
          total={Math.max(1, Math.ceil(totalCount / PAGE_SIZE))}
          q={params.q}
          has_account={params.has_account}
        />
      )}
    </div>
  )
}

function Pagination({
  current, total, q, has_account,
}: {
  current: number; total: number; q?: string; has_account?: string
}) {
  const buildHref = (p: number) => {
    const sp = new URLSearchParams()
    if (p > 1) sp.set("page", String(p))
    if (q) sp.set("q", q)
    if (has_account) sp.set("has_account", has_account)
    const s = sp.toString()
    return s ? `/customers?${s}` : "/customers"
  }
  const set = new Set([1, 2, 3, current - 1, current, current + 1, total - 1, total])
  const pages: number[] = []
  for (let i = 1; i <= total; i++) if (set.has(i) && i >= 1 && i <= total) pages.push(i)
  return (
    <div className="flex items-center justify-between px-4 py-3 stamp-card">
      <div className="font-mono text-[11px] text-ink-3">
        Página <span className="text-ink font-bold num">{current}</span> de <span className="text-ink font-bold num">{total}</span>
      </div>
      <div className="flex items-center gap-1 font-display font-bold uppercase tracking-wider text-[11px]">
        {current > 1 ? (
          <Link href={buildHref(current - 1)} className="px-2 py-1 text-ink hover:text-orange">‹ Ant.</Link>
        ) : <span className="px-2 py-1 text-ink-3 opacity-40">‹ Ant.</span>}
        {pages.map((p, i) => (
          <span key={p}>
            {i > 0 && pages[i - 1] !== p - 1 && <span className="px-1 text-ink-3">…</span>}
            {p === current ? (
              <span className="px-2.5 py-1 bg-orange text-dark rounded-md num">{p}</span>
            ) : (
              <Link href={buildHref(p)} className="px-2.5 py-1 hover:bg-cream-2 rounded-md text-ink num">{p}</Link>
            )}
          </span>
        ))}
        {current < total ? (
          <Link href={buildHref(current + 1)} className="px-2 py-1 text-ink hover:text-orange">Sig. ›</Link>
        ) : <span className="px-2 py-1 text-ink-3 opacity-40">Sig. ›</span>}
      </div>
    </div>
  )
}
