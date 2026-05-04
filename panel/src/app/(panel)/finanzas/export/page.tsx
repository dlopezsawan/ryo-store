import Link from "next/link"
import { ArrowLeft, Download, FileSpreadsheet } from "lucide-react"
import { PageHeader, PageWatermark } from "@/components/layout/PageHeader"
import { FinanzasNav } from "../FinanzasNav"

export default function ExportPage() {
  // Generar lista de últimos 12 meses para el select
  const months: { value: string; label: string }[] = []
  const today = new Date()
  for (let i = 0; i < 12; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1)
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    const label = d.toLocaleDateString("es-VE", { month: "long", year: "numeric" })
    months.push({ value, label })
  }
  const currentMonth = months[0].value

  return (
    <div className="p-7 space-y-5 relative">
      <PageWatermark char="€" />

      <Link href="/finanzas" className="inline-flex items-center gap-1 text-[11px] font-display font-bold uppercase tracking-wider text-ink-3 hover:text-orange">
        <ArrowLeft size={12} strokeWidth={2.5} /> Finanzas
      </Link>

      <PageHeader
        title="EXPORT"
        stamp="SENIAT-FRIENDLY"
        stampTone="orange"
        description="Descarga reportes contables en CSV (Excel/LibreOffice) listos para conciliación contable Venezolana"
      />

      <FinanzasNav />

      <div className="grid grid-cols-2 gap-5">
        {/* Formulario configurable */}
        <div className="stamp-card p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <FileSpreadsheet size={16} className="text-orange" strokeWidth={2.5} />
            <h3 className="font-display font-black text-[14px] uppercase tracking-wider text-ink">Export personalizado</h3>
          </div>

          <form action="/finanzas/export/download" method="GET" className="space-y-3">
            <div>
              <label className="block text-[10px] font-display font-bold uppercase tracking-[0.18em] text-ink-2 mb-1.5">Tipo de movimientos</label>
              <select name="kind" defaultValue="all"
                className="w-full px-3 py-2 bg-cream rounded-md text-[12px] focus:outline-none"
                style={{ border: "1.5px solid var(--border)" }}>
                <option value="all">Todo (ingresos + gastos + conversiones)</option>
                <option value="income">Sólo ingresos (Pago Móvil)</option>
                <option value="expense">Sólo gastos</option>
                <option value="conversion">Sólo conversiones Bs→USDT</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-display font-bold uppercase tracking-[0.18em] text-ink-2 mb-1.5">Mes</label>
              <select name="month" defaultValue=""
                className="w-full px-3 py-2 bg-cream rounded-md text-[12px] focus:outline-none"
                style={{ border: "1.5px solid var(--border)" }}>
                <option value="">Todos los meses (sin filtro)</option>
                {months.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-display font-bold uppercase tracking-[0.18em] text-ink-2 mb-1.5">Formato</label>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 text-[11px]">
                  <input type="radio" name="format" value="csv" defaultChecked /> CSV (Excel/LibreOffice)
                </label>
                <label className="flex items-center gap-1.5 text-[11px]">
                  <input type="radio" name="format" value="json" /> JSON (raw)
                </label>
              </div>
            </div>

            <button type="submit"
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-orange text-dark rounded-md text-[12px] font-display font-bold uppercase tracking-wider hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
              style={{ border: "2px solid #1A1A1A", boxShadow: "4px 4px 0 0 var(--shadow-color)" }}>
              <Download size={13} strokeWidth={2.5} /> Descargar
            </button>
          </form>
        </div>

        {/* Quick downloads */}
        <div className="stamp-card p-5 space-y-3">
          <div>
            <h3 className="font-display font-black text-[14px] uppercase tracking-wider text-ink">Descargas rápidas</h3>
            <p className="text-[11px] text-ink-3 mt-1">Atajos para los exports más usados</p>
          </div>
          <div className="space-y-2">
            <QuickDownload href={`/finanzas/export/download?kind=all&month=${currentMonth}`}
              label={`Mes en curso · ${months[0].label}`} sub="Ingresos + gastos + conversiones" />
            <QuickDownload href={`/finanzas/export/download?kind=income&month=${currentMonth}`}
              label="Ingresos del mes · Libro de ventas" sub="Pedidos con BCV, IVA implícito" />
            <QuickDownload href={`/finanzas/export/download?kind=expense&month=${currentMonth}`}
              label="Gastos del mes · Libro de compras" sub="Para retenciones ISLR/IVA" />
            <QuickDownload href={`/finanzas/export/download?kind=all`}
              label="HISTÓRICO COMPLETO · Sin filtro" sub="Todo lo que hay en el sistema" />
          </div>
        </div>
      </div>

      {/* Notas formato */}
      <div className="stamp-card p-4 bg-cream-2/30">
        <h4 className="text-[10px] font-display font-bold uppercase tracking-wider text-ink-3 mb-2">Notas del formato</h4>
        <ul className="text-[11px] text-ink-2 space-y-1 font-mono">
          <li>· <strong>Separador:</strong> punto y coma (<code>;</code>) — Excel ES-VE lo abre sin lío</li>
          <li>· <strong>Encoding:</strong> UTF-8 con BOM — Tildes y eñes correctas</li>
          <li>· <strong>Decimal:</strong> coma (<code>,</code>) — Locale Venezolano</li>
          <li>· <strong>Fechas:</strong> DD/MM/YYYY</li>
          <li>· Cada sección tiene encabezado <code># NOMBRE</code> y termina con fila TOTAL</li>
          <li>· Tasa BCV se exporta tal como se capturó al momento del pago</li>
        </ul>
      </div>
    </div>
  )
}

function QuickDownload({ href, label, sub }: { href: string; label: string; sub: string }) {
  return (
    <a href={href}
      className="flex items-center gap-3 p-3 bg-cream-2/40 rounded-md hover:bg-orange/10 hover:border-orange transition-all group"
      style={{ border: "1.5px dashed var(--border)" }}>
      <Download size={14} className="text-ink-3 group-hover:text-orange flex-shrink-0" strokeWidth={2.5} />
      <div className="flex-1 min-w-0">
        <div className="font-display font-bold text-[12px] text-ink truncate">{label}</div>
        <div className="text-[10px] text-ink-3 font-mono truncate">{sub}</div>
      </div>
    </a>
  )
}
