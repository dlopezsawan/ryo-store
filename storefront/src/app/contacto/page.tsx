import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import ContactForm from "./ContactForm";
import { getPageMetadata } from "@/lib/seo";

export const metadata = getPageMetadata(
  "Contacto",
  "¿Tienes dudas sobre tu pedido o quieres unirte al Club? Contáctanos por WhatsApp, Instagram o email.",
  "/contacto"
);

export default function ContactoPage() {
  return (
    <div className="min-h-screen bg-cream">
      <Header />

      <main className="max-w-[1380px] mx-auto px-4 py-10 md:py-14">
        {/* Title */}
        <div className="flex items-center gap-4 mb-8">
          <div className="h-1 w-12 bg-primary" />
          <h1 className="font-black text-dark text-4xl md:text-6xl uppercase tracking-tight">
            Contacto
          </h1>
        </div>

        <div className="grid md:grid-cols-2 gap-6 md:gap-8">
          {/* Contact cards */}
          <div className="flex flex-col gap-5">
            {/* WhatsApp / Instagram */}
            <a
              href="https://instagram.com/ryo.smoke"
              target="_blank"
              rel="noopener noreferrer"
              className="border-3 border-dark bg-white p-5 flex items-center gap-4 vintage-border-sm hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all"
              style={{ borderWidth: "2px" }}
            >
              <span className="w-12 h-12 bg-primary text-white flex items-center justify-center flex-shrink-0">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
                </svg>
              </span>
              <div>
                <p className="text-xs font-bold text-secondary uppercase tracking-wider">Instagram</p>
                <p className="font-bold text-dark text-lg">@ryo.smoke</p>
              </div>
            </a>

            <a
              href="https://tiktok.com/@ryo.smoke"
              target="_blank"
              rel="noopener noreferrer"
              className="border-3 border-dark bg-white p-5 flex items-center gap-4 vintage-border-sm hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all"
              style={{ borderWidth: "2px" }}
            >
              <span className="w-12 h-12 bg-dark text-cream flex items-center justify-center flex-shrink-0">
                <svg width="18" height="18" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M9 0h1.98c.144.715.54 1.617 1.235 2.512C12.895 3.389 13.797 4 15 4v2c-1.753 0-3.07-.814-4-1.829V11a5 5 0 1 1-5-5v2a3 3 0 1 0 3 3V0z"/>
                </svg>
              </span>
              <div>
                <p className="text-xs font-bold text-secondary uppercase tracking-wider">TikTok</p>
                <p className="font-bold text-dark text-lg">@ryo.smoke</p>
              </div>
            </a>

            <div className="border-3 border-dark bg-white p-5 flex items-center gap-4 vintage-border-sm"
              style={{ borderWidth: "2px" }}>
              <span className="w-12 h-12 bg-secondary text-cream flex items-center justify-center flex-shrink-0">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
                </svg>
              </span>
              <div>
                <p className="text-xs font-bold text-secondary uppercase tracking-wider">Email</p>
                <p className="font-bold text-dark text-lg">hola@enrola.shop</p>
              </div>
            </div>

            {/* Payment info */}
            <div className="bg-primary border-3 border-dark p-5 text-white"
              style={{ borderWidth: "3px", boxShadow: "4px 4px 0 0 var(--dark)" }}>
              <h3 className="font-black text-lg uppercase tracking-wide mb-2">MÉTODOS DE PAGO</h3>
              <p className="text-white/80 text-sm mb-3">Aceptamos pagos desde Venezuela:</p>
              <span className="inline-block bg-white text-primary px-3 py-1 font-bold text-sm uppercase">
                Pago Móvil
              </span>
            </div>
          </div>

          {/* Contact form */}
          <div className="border-3 border-dark bg-white p-6 md:p-8"
            style={{ borderWidth: "3px", boxShadow: "6px 6px 0px 0px var(--primary)" }}>
            <h2 className="font-black text-dark text-xl uppercase tracking-wide mb-6 pb-3 border-b-2 border-dark">
              Mensaje para el Club
            </h2>
            <ContactForm />
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
