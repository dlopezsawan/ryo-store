import { Construction } from "lucide-react"

/**
 * Placeholder uniforme para las pantallas que ya tenemos diseñadas en
 * mockups/index.html pero todavía no portadas a JSX.
 *
 * Se ven coherentes con el resto del panel y enlazan al mockup local
 * para que durante el desarrollo se pueda ir verificando el visual.
 */
export function ComingSoonScreen({
  title,
  description,
  mockupHash,
}: {
  title: string
  description: string
  mockupHash: string
}) {
  return (
    <div className="p-7 space-y-5 relative">
      <div className="watermark-amp text-[400px] -top-32 right-0 select-none italic">&amp;</div>

      <div className="flex items-end justify-between relative">
        <div>
          <h1 className="font-display font-black text-[34px] text-ink leading-none tracking-tight mb-1">{title}</h1>
          <p className="text-[13px] text-ink-3 font-medium">{description}</p>
        </div>
        <div className="vintage-stamp text-orange">EN CONSTRUCCIÓN</div>
      </div>

      <div className="stamp-card p-10 text-center relative overflow-hidden">
        <div className="watermark-amp text-[200px] -top-12 -right-12 select-none italic">⚙</div>
        <div className="relative">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-orange/10 mb-4"
               style={{ border: "2px solid #1A1A1A", borderRadius: 4 }}>
            <Construction size={28} strokeWidth={2} className="text-orange" />
          </div>
          <h2 className="font-display font-black text-[22px] text-ink uppercase tracking-tight mb-2">
            Pantalla en desarrollo
          </h2>
          <p className="text-[13px] text-ink-2 max-w-md mx-auto leading-relaxed">
            El diseño visual está aprobado en los mockups. Esta pantalla se conectará a la
            Medusa Admin API en el próximo batch — manteniendo la misma firma estética que
            ves en el resto del panel.
          </p>
          <div className="mt-5 flex items-center justify-center gap-2">
            <a
              href={`/mockups/index.html#${mockupHash}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-cream rounded-md text-[11px] font-display font-bold uppercase tracking-wide text-ink hover:bg-cream-2"
              style={{ border: "1.5px solid var(--border)", boxShadow: "3px 3px 0 0 var(--shadow-color)" }}
            >
              Ver mockup visual ↗
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
