import type { Metadata } from "next"
import Image from "next/image"

export const metadata: Metadata = {
  title: "Enrola Shop — Volvemos Pronto",
  description: "Estamos trabajando en mejoras para ti. ¡Volvemos pronto!",
  robots: { index: false, follow: false },
}

export default function MantenimientoPage() {
  return (
    <div id="maintenance-page" className="min-h-screen bg-cream flex flex-col items-center justify-center px-6 py-12 relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 pointer-events-none select-none overflow-hidden">
        {/* Floating dots pattern */}
        <div className="absolute top-10 left-10 w-3 h-3 bg-orange/20 rounded-full" />
        <div className="absolute top-32 right-20 w-5 h-5 bg-primary/15 rounded-full" />
        <div className="absolute bottom-20 left-1/4 w-4 h-4 bg-secondary/20 rounded-full" />
        <div className="absolute top-1/3 right-1/3 w-2 h-2 bg-orange/30 rounded-full" />
        <div className="absolute bottom-1/3 right-10 w-6 h-6 bg-primary/10 rounded-full" />
        {/* Diagonal lines */}
        <div className="absolute -top-20 -left-20 w-[200%] h-px bg-dark/5 rotate-[30deg]" />
        <div className="absolute -top-10 -left-20 w-[200%] h-px bg-dark/5 rotate-[30deg]" />
        <div className="absolute top-0 -left-20 w-[200%] h-px bg-dark/5 rotate-[30deg]" />
      </div>

      {/* Content */}
      <div className="relative z-10 text-center max-w-lg">
        {/* Logo */}
        <div className="mb-8">
          <Image
            src="/logo-web-nuevo.svg"
            alt="Enrola Shop"
            width={240}
            height={124}
            className="mx-auto"
            priority
          />
        </div>

        {/* Mascot */}
        <div className="mb-8 flex justify-center">
          <div className="relative">
            <Image
              src="/mascota-ryo.svg"
              alt="Bichito Enrola"
              width={120}
              height={120}
              className="w-24 h-24 md:w-32 md:h-32 animate-bounce-slow"
              priority
            />
          </div>
        </div>

        {/* Main text */}
        <div className="retro-border bg-white px-8 py-10 md:px-12 md:py-14">
          <h1 className="font-black text-dark text-3xl md:text-5xl uppercase tracking-tight mb-4 leading-tight">
            Estaremos Pronto<br />
            <span className="text-orange">Contigo!</span>
          </h1>

          <div className="h-1 w-16 bg-orange mx-auto mb-6" />

          <p className="text-muted text-sm md:text-base mb-8 leading-relaxed">
            Estamos preparando algo increíble para ti.
            <br />
            Volvemos muy pronto con novedades.
          </p>

          {/* Social / contact hint */}
          <div className="flex items-center justify-center gap-4 text-xs text-dark/40 font-medium uppercase tracking-widest">
            <span className="text-orange">●</span>
            <span>enrola.shop</span>
            <span className="text-orange">●</span>
          </div>
        </div>

        {/* Bottom tagline */}
        <p className="mt-8 text-[10px] text-dark/30 font-bold uppercase tracking-[0.3em]">
          Tu Tienda de Rolling Papers y Accesorios
        </p>
      </div>

      {/* Inline styles: animation + hide shell elements */}
      <style>{`
        @keyframes bounce-slow {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        .animate-bounce-slow {
          animation: bounce-slow 3s ease-in-out infinite;
        }
        /* Hide cart drawer, mobile nav, combo toast on maintenance page */
        #maintenance-page ~ div[role="dialog"],
        #maintenance-page ~ nav,
        #maintenance-page ~ div[role="status"] {
          display: none !important;
        }
        body { padding-bottom: 0 !important; }
      `}</style>
    </div>
  )
}
