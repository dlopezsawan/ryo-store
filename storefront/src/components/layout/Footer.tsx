import Link from "next/link";
import Image from "next/image";

export default function Footer() {
  return (
    <footer className="bg-secondary border-t-4 border-primary mt-16">
      <div className="max-w-[1380px] mx-auto px-6 md:px-10">

        {/* ── MOBILE: compact 2-col grid ── DESKTOP: 3-col grid */}
        <div className="py-5 md:py-10 grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-8">

          {/* Brand column — full-width row on mobile, normal column on desktop */}
          <div className="col-span-2 md:col-span-1 flex flex-row md:flex-col items-center md:items-start gap-3 md:gap-5">
            {/* Logo box */}
            <div
              className="inline-flex flex-col items-center self-start border-2 border-cream/30 px-3 py-2 md:px-4 md:py-3 bg-dark/30 flex-shrink-0"
              style={{ boxShadow: "4px 4px 0px 0px var(--primary)" }}
            >
              <Image
                src="/logo-web-nuevo.svg"
                alt="Enrola"
                width={180}
                height={94}
                className="h-7 md:h-10 w-auto"
              />
            </div>

            {/* Description (desktop only) + Social icons (mobile only) */}
            <div className="flex flex-col gap-2 md:gap-4">
              <p className="text-cream/55 text-xs font-medium leading-relaxed max-w-[220px] hidden md:block">
                Tu destino para el tabaco artesanal. Calidad, tradición y sabor en cada enrolado.
              </p>
              {/* Social icons — mobile only, desktop moves to contact column */}
              <div className="flex items-center gap-2 md:hidden">
                <a
                  href="https://instagram.com/ryo.smoke"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-8 h-8 border-2 border-cream/30 bg-dark/20 flex items-center justify-center text-cream/70 hover:text-cream hover:border-primary transition-all"
                  style={{ boxShadow: "2px 2px 0px 0px var(--primary)" }}
                  aria-label="Instagram"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
                  </svg>
                </a>
                <a
                  href="https://tiktok.com/@ryo.smoke"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-8 h-8 border-2 border-cream/30 bg-dark/20 flex items-center justify-center text-cream/70 hover:text-cream hover:border-primary transition-all"
                  style={{ boxShadow: "2px 2px 0px 0px var(--primary)" }}
                  aria-label="TikTok"
                >
                  <svg width="12" height="12" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M9 0h1.98c.144.715.54 1.617 1.235 2.512C12.895 3.389 13.797 4 15 4v2c-1.753 0-3.07-.814-4-1.829V11a5 5 0 1 1-5-5v2a3 3 0 1 0 3 3V0z"/>
                  </svg>
                </a>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <div>
            <div className="flex items-center gap-2 md:gap-3 mb-2 md:mb-5">
              <div className="h-[3px] w-4 md:w-6 bg-orange flex-shrink-0" />
              <h3 className="font-black text-cream text-[10px] md:text-xs uppercase tracking-[0.15em] md:tracking-[0.2em]">Navegación</h3>
            </div>
            <nav className="flex flex-col">
              {[
                { label: "INICIO", href: "/" },
                { label: "TIENDA", href: "/tienda" },
                { label: "MAYORISTAS", href: "/mayoristas" },
                { label: "CONTACTO", href: "/contacto" },
                { label: "SEGUIMIENTO", href: "/seguimiento" },
              ].map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className="group flex items-center gap-1.5 md:gap-2 text-cream/65 text-xs md:text-sm font-bold uppercase tracking-wide hover:text-primary transition-colors py-0.5 md:py-1.5"
                >
                  <span className="w-0 h-[2px] bg-primary transition-all duration-200 group-hover:w-3 md:group-hover:w-4 flex-shrink-0" />
                  {item.label}
                </Link>
              ))}
            </nav>

            {/* Divider */}
            <div className="h-px w-full bg-cream/15 my-2 md:my-3" />

            {/* Legal links */}
            <nav className="flex flex-col">
              {[
                { label: "TERMINOS", href: "/terminos" },
                { label: "PRIVACIDAD", href: "/privacidad" },
                { label: "DEVOLUCIONES", href: "/devoluciones" },
                { label: "FAQ", href: "/faq" },
              ].map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className="group flex items-center gap-1.5 md:gap-2 text-cream/45 text-[10px] md:text-xs font-bold uppercase tracking-wide hover:text-primary transition-colors py-0.5 md:py-1"
                >
                  <span className="w-0 h-[2px] bg-primary transition-all duration-200 group-hover:w-3 md:group-hover:w-4 flex-shrink-0" />
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>

          {/* Contact — desktop only */}
          <div className="hidden md:block">
            <div className="flex items-center gap-3 mb-5">
              <div className="h-[3px] w-6 bg-orange flex-shrink-0" />
              <h3 className="font-black text-cream text-xs uppercase tracking-[0.2em]">Contacto</h3>
            </div>
            <div className="flex flex-col gap-3">
              <a
                href="mailto:hola@enrola.shop"
                className="text-cream/65 text-sm font-medium hover:text-primary transition-colors"
              >
                hola@enrola.shop
              </a>
              <p className="text-cream/40 text-xs leading-relaxed">
                Venezuela · Envíos nacionales via MRW
              </p>
              <p className="text-cream/40 text-xs leading-relaxed">
                Entregas inmediatas en Valencia
              </p>
              {/* Social icons — desktop only, below contact info */}
              <div className="flex items-center gap-3 mt-1">
                <a
                  href="https://instagram.com/ryo.smoke"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-10 border-2 border-cream/30 bg-dark/20 flex items-center justify-center text-cream/70 hover:text-cream hover:border-primary transition-all"
                  style={{ boxShadow: "3px 3px 0px 0px var(--primary)" }}
                  aria-label="Instagram"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
                  </svg>
                </a>
                <a
                  href="https://tiktok.com/@ryo.smoke"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-10 border-2 border-cream/30 bg-dark/20 flex items-center justify-center text-cream/70 hover:text-cream hover:border-primary transition-all"
                  style={{ boxShadow: "3px 3px 0px 0px var(--primary)" }}
                  aria-label="TikTok"
                >
                  <svg width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M9 0h1.98c.144.715.54 1.617 1.235 2.512C12.895 3.389 13.797 4 15 4v2c-1.753 0-3.07-.814-4-1.829V11a5 5 0 1 1-5-5v2a3 3 0 1 0 3 3V0z"/>
                  </svg>
                </a>
              </div>
            </div>
          </div>

        </div>

        {/* Legal disclaimer — uso exclusivo tabaco */}
        <div className="border-t border-cream/10 pt-4 mt-2">
          <p className="text-cream/50 text-[10px] md:text-[11px] font-medium leading-relaxed text-center md:text-left max-w-4xl">
            <span className="font-black text-primary uppercase tracking-wider text-[10px] mr-1">Aviso legal:</span>
            Todos los productos comercializados en esta web son{" "}
            <strong className="text-cream/80">accesorios para el consumo exclusivo de tabaco legal</strong>.
            Enrola Shop no promueve, ni directa ni indirectamente, el uso de sus productos con ninguna otra sustancia.
            Condenamos expresamente cualquier uso indebido con sustancias controladas o estupefacientes
            prohibidos por la Ley Orgánica de Drogas y demás normativa venezolana vigente.{" "}
            <a href="/terminos" className="underline hover:text-primary transition-colors">
              Ver Términos y Condiciones
            </a>
            .
          </p>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-cream/10 py-3 md:py-4 flex flex-row items-center justify-between gap-2">
          <p className="text-cream/40 text-[10px] md:text-xs font-medium">
            &copy; {new Date().getFullYear()} Enrola Shop &middot; Todos los derechos reservados
          </p>
          <div
            className="flex items-center gap-1.5 border-2 border-primary/70 px-2.5 py-1"
            style={{ boxShadow: "2px 2px 0px 0px var(--primary)" }}
          >
            <span className="font-black text-primary text-sm">18+</span>
            <span className="text-cream/50 text-[10px] md:text-xs font-medium">Solo mayores de edad</span>
          </div>
        </div>

      </div>
    </footer>
  );
}
