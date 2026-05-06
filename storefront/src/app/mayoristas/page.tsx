import type { Metadata } from "next";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import Link from "next/link";
import Image from "next/image";
import { Truck, Package, Zap, ShieldCheck, ArrowRight, Phone } from "lucide-react";

export const metadata: Metadata = {
  title: "Mayoristas | Enrola Shop — Precios Especiales para Revendedores",
  description:
    "Compra al mayor con 30% de descuento. Papers, conos, grinders y accesorios para tu negocio. Envíos a toda Venezuela.",
};

const BENEFITS = [
  {
    icon: Zap,
    title: "30% de Descuento",
    description: "Precio mayorista a partir de 24 unidades del mismo producto.",
  },
  {
    icon: Package,
    title: "Catálogo Completo",
    description: "Acceso a toda nuestra línea de papers, conos, grinders y accesorios.",
  },
  {
    icon: Truck,
    title: "Envíos Nacionales",
    description: "Despachos vía MRW a toda Venezuela. Entregas inmediatas en Valencia.",
  },
  {
    icon: ShieldCheck,
    title: "Calidad Garantizada",
    description: "Productos originales, marcas premium. Soporte directo por Instagram.",
  },
];

const STEPS = [
  { step: "01", title: "Elige tus productos", description: "Navega la tienda y selecciona lo que necesitas." },
  { step: "02", title: "Agrega 24+ unidades", description: "El descuento de 30% se aplica automáticamente por producto." },
  { step: "03", title: "Completa tu pedido", description: "Paga con Pago Móvil y recibe tu mercancía." },
];

export default function MayoristasPage() {
  return (
    <div className="min-h-screen bg-cream">
      <Header />

      <main>
        {/* ===== HERO ===== */}
        <section className="bg-dark border-b-4 border-primary overflow-hidden">
          <div className="max-w-[1380px] mx-auto px-4 py-16 md:py-24 flex flex-col md:flex-row items-center gap-10 md:gap-16">
            <div className="flex-1 min-w-0">
              <span className="inline-block bg-orange text-white text-xs font-black uppercase tracking-[0.15em] px-3 py-1.5 mb-5 border-2 border-white/20">
                Programa Mayoristas
              </span>
              <h1 className="font-black text-white text-4xl md:text-6xl uppercase tracking-tight leading-none mb-4">
                Precios <span className="text-orange">Mayoristas</span> para tu Negocio
              </h1>
              <p className="text-cream/60 text-base md:text-lg max-w-lg mb-8 leading-relaxed">
                Compra desde 24 unidades de cualquier producto y obtén <strong className="text-orange font-black">30% de descuento</strong> automático.
                Sin trámites, sin formularios. Directo desde la tienda.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Link
                  href="/tienda"
                  className="flex items-center justify-center gap-2 bg-orange text-white px-8 py-4 font-black text-sm uppercase tracking-widest border-2 border-white/20 shadow-[4px_4px_0px_0px_var(--primary)] hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none transition-all"
                >
                  Ir a la Tienda
                  <ArrowRight size={18} strokeWidth={2.5} />
                </Link>
                <a
                  href="https://instagram.com/ryo.smoke"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 bg-transparent text-cream px-8 py-4 font-black text-sm uppercase tracking-widest border-2 border-cream/30 hover:border-orange hover:text-orange transition-colors"
                >
                  <Phone size={16} strokeWidth={2.5} />
                  Contactar
                </a>
              </div>
            </div>

            {/* Decorative price tag */}
            <div className="flex-shrink-0 hidden md:flex flex-col items-center">
              <div className="border-[4px] border-orange bg-dark p-8 text-center" style={{ boxShadow: "8px 8px 0px 0px var(--primary)" }}>
                <p className="text-cream/50 text-sm font-bold uppercase tracking-widest mb-2">Desde</p>
                <p className="font-black text-orange text-7xl leading-none">30%</p>
                <p className="text-cream/50 text-sm font-bold uppercase tracking-widest mt-2">de descuento</p>
                <div className="h-1 w-16 bg-orange mx-auto mt-4" />
                <p className="text-cream/30 text-xs font-bold uppercase tracking-wider mt-3">24+ unidades</p>
              </div>
            </div>
          </div>
        </section>

        {/* ===== BENEFITS ===== */}
        <section className="max-w-[1380px] mx-auto px-4 py-14 md:py-20">
          <div className="flex items-center gap-4 mb-10">
            <div className="h-1 w-12 bg-primary" />
            <h2 className="font-black text-dark text-2xl md:text-4xl uppercase tracking-tight">
              Beneficios Mayoristas
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            {BENEFITS.map((b) => (
              <div
                key={b.title}
                className="border-[3px] border-dark bg-white p-5 md:p-6"
                style={{ boxShadow: "4px 4px 0px 0px var(--secondary)" }}
              >
                <div className="w-10 h-10 bg-orange/10 border-2 border-orange/30 flex items-center justify-center mb-4">
                  <b.icon size={20} strokeWidth={2.5} className="text-orange" />
                </div>
                <h3 className="font-black text-dark text-base uppercase tracking-wide mb-2">{b.title}</h3>
                <p className="text-muted text-sm leading-relaxed">{b.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ===== HOW IT WORKS ===== */}
        <section className="bg-secondary/5 border-y-[3px] border-dark">
          <div className="max-w-[1380px] mx-auto px-4 py-14 md:py-20">
            <div className="flex items-center gap-4 mb-10">
              <div className="h-1 w-12 bg-orange" />
              <h2 className="font-black text-dark text-2xl md:text-4xl uppercase tracking-tight">
                Cómo Funciona
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
              {STEPS.map((s) => (
                <div key={s.step} className="flex gap-4 items-start">
                  <div className="flex-shrink-0 w-14 h-14 bg-dark text-orange font-black text-2xl flex items-center justify-center border-2 border-dark" style={{ boxShadow: "3px 3px 0px 0px var(--orange)" }}>
                    {s.step}
                  </div>
                  <div>
                    <h3 className="font-black text-dark text-base uppercase tracking-wide mb-1">{s.title}</h3>
                    <p className="text-muted text-sm leading-relaxed">{s.description}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-10 pt-8 border-t-2 border-dark/10">
              <p className="text-dark/50 text-sm mb-1">
                <strong className="text-dark font-black">Nota:</strong> El descuento de 30% se aplica por producto individual.
                Si compras 24 Rolling Papers + 24 Conos, ambos tienen 30% OFF.
              </p>
              <p className="text-dark/50 text-sm">
                Los descuentos por combo (3+ = 10%, 5+ = 15%, 10+ = 20%) se aplican al mezclar productos diferentes y son independientes del mayorista.
              </p>
            </div>
          </div>
        </section>

        {/* ===== CTA FINAL ===== */}
        <section className="max-w-[1380px] mx-auto px-4 py-14 md:py-20 text-center">
          <h2 className="font-black text-dark text-3xl md:text-5xl uppercase tracking-tight mb-4">
            ¿Listo para Comprar al Mayor?
          </h2>
          <p className="text-muted text-base md:text-lg max-w-lg mx-auto mb-8">
            No necesitas registro especial. Solo agrega 24+ unidades de un producto y el descuento se aplica automáticamente.
          </p>
          <Link
            href="/tienda"
            className="inline-flex items-center gap-2 bg-orange text-white px-12 py-4 font-black text-sm uppercase tracking-widest border-[3px] border-dark retro-shadow hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none transition-all"
          >
            Explorar Productos
            <ArrowRight size={18} strokeWidth={2.5} />
          </Link>
        </section>
      </main>

      <Footer />
    </div>
  );
}
