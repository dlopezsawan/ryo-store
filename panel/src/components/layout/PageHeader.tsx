/**
 * Header consistente para todas las páginas del panel.
 *  - h1 en Kanit Black con title uppercase
 *  - stamp opcional al lado (LIVE, X NUEVOS, etc.)
 *  - subtitle de contexto
 *  - slot de acciones a la derecha
 *  - watermark "&" decorativo de fondo
 */
export function PageHeader({
  title,
  stamp,
  stampTone = "secondary",
  description,
  actions,
}: {
  title: string
  stamp?: React.ReactNode
  stampTone?: "primary" | "orange" | "secondary"
  description?: React.ReactNode
  actions?: React.ReactNode
}) {
  const stampToneClass =
    stampTone === "primary"  ? "text-primary"  :
    stampTone === "orange"   ? "text-orange"   :
                               "text-secondary"
  return (
    <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 relative">
      <div className="min-w-0">
        <div className="flex items-center gap-3 mb-1 flex-wrap">
          <h1 className="font-display font-black text-[26px] md:text-[34px] text-ink leading-none tracking-tight">
            {title}
          </h1>
          {stamp && <div className={`vintage-stamp mt-1.5 ${stampToneClass}`}>{stamp}</div>}
        </div>
        {description && (
          <p className="text-[13px] text-ink-3 font-medium">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
  )
}

/** Botón secundario con offset shadow chunky — el patrón "Exportar" / "Filtro" */
export function ChunkyButton({
  children,
  primary = false,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { primary?: boolean }) {
  const base = "flex items-center gap-2 rounded-md font-display font-bold uppercase tracking-wide transition-all"
  if (primary) {
    return (
      <button
        {...props}
        className={`${base} px-4 py-2 bg-orange text-dark text-[11px] hover:translate-x-[2px] hover:translate-y-[2px] ${className}`}
        style={{ border: "2px solid #1A1A1A", boxShadow: "4px 4px 0 0 var(--shadow-color)", ...(props.style ?? {}) }}
      >
        {children}
      </button>
    )
  }
  return (
    <button
      {...props}
      className={`${base} px-3 py-2 bg-cream text-ink text-[11px] hover:bg-cream-2 ${className}`}
      style={{ border: "1.5px solid var(--border)", boxShadow: "3px 3px 0 0 var(--shadow-color)", ...(props.style ?? {}) }}
    >
      {children}
    </button>
  )
}

/** Page-level watermark del "&" Enrola */
export function PageWatermark({ char = "&" }: { char?: string }) {
  return <div className="watermark-amp text-[400px] -top-32 right-0 select-none italic">{char}</div>
}
