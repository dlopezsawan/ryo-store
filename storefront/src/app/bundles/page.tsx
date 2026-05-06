import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import Link from "next/link";
import Image from "next/image";
import { getComboProducts } from "@/lib/medusa";
import { formatPrice } from "@/lib/format";
import { getPageMetadata } from "@/lib/seo";

export const metadata = getPageMetadata(
  "Combos & Promociones",
  "Ahorra con nuestros combos exclusivos. Encuentra kits completos de parafernalia con descuentos especiales en Enrola Shop.",
  "/bundles"
);

export const dynamic = "force-dynamic";

export default async function BundlesPage() {
  const combos = await getComboProducts();

  return (
    <div className="min-h-screen bg-cream">
      <Header />

      <main className="max-w-[1380px] mx-auto px-4 py-8 md:py-12">
        {/* CTA Banner - Combo Builder */}
        <Link
          href="/arma-tu-combo"
          className="block mb-8 bg-dark text-cream border-[3px] border-dark overflow-hidden hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
          style={{ boxShadow: "6px 6px 0px 0px var(--orange)" }}
        >
          <div className="flex items-center justify-between px-5 py-4 md:px-8 md:py-5 gap-4">
            <div className="flex items-center gap-3 md:gap-4">
              <span className="text-2xl md:text-3xl">&#9889;</span>
              <div>
                <span className="font-black text-lg md:text-2xl uppercase tracking-tight block leading-tight">
                  Arma tu propio combo y ahorra 10%
                </span>
                <span className="text-cream/70 text-xs md:text-sm">
                  Elige tus productos favoritos y crea tu combo personalizado
                </span>
              </div>
            </div>
            <span className="flex-shrink-0 bg-orange text-white px-4 py-2 md:px-6 md:py-2.5 font-black text-xs md:text-sm uppercase tracking-widest border-2 border-cream/30">
              CREAR COMBO
            </span>
          </div>
        </Link>

        <div className="flex items-center gap-4 mb-2">
          <div className="h-1 w-12 bg-primary" />
          <h1 className="font-black text-dark text-4xl md:text-6xl uppercase tracking-tight">
            Combos
          </h1>
        </div>
        <p className="text-muted text-sm md:text-base mb-8 ml-16">Combos especiales con descuento</p>

        {combos.length === 0 ? (
          <div className="text-center py-16 border-3 border-dark bg-white" style={{ borderWidth: "3px", boxShadow: "6px 6px 0 0 var(--secondary)" }}>
            <p className="text-muted text-base">No hay combos disponibles.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {combos.map((combo) => (
              <div
                key={combo.id}
                className="border-3 border-dark bg-white overflow-hidden hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
                style={{ borderWidth: "3px", boxShadow: "6px 6px 0 0 var(--primary)" }}
              >
                <div className="md:flex">
                  <div className="md:w-1/3 aspect-[4/3] md:aspect-auto relative overflow-hidden min-h-[200px]">
                    <Image
                      src={combo.image}
                      alt={combo.name}
                      fill
                      className="object-cover"
                    />
                  </div>
                  <div className="flex-1 p-6 md:p-8 flex flex-col justify-between">
                    <div>
                      <h2 className="font-black text-dark text-2xl md:text-4xl uppercase tracking-tight mb-2">
                        {combo.name}
                      </h2>
                      {combo.description && (
                        <p className="text-muted text-sm mb-4">{combo.description}</p>
                      )}
                      {combo.items && combo.items.length > 0 && (
                        <ul className="mb-6">
                          {combo.items.map((item, i) => (
                            <li key={i} className="flex items-center gap-3 text-sm text-dark py-1.5 border-b border-dark/10 last:border-0">
                              <span className="w-2 h-2 bg-primary flex-shrink-0" />
                              {item}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div className="flex items-center justify-between flex-wrap gap-4">
                      <div>
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="font-black text-dark text-3xl md:text-[40px]">€{formatPrice(combo.price)}</span>
                          {combo.originalPrice != null && (
                            <span className="text-muted text-lg line-through">€{formatPrice(combo.originalPrice)}</span>
                          )}
                        </div>
                        {combo.savings != null && combo.savings > 0 && (
                          <span className="text-secondary text-sm font-bold">Ahorras €{formatPrice(combo.savings)}</span>
                        )}
                      </div>
                      <Link
                        href={`/productos/${combo.slug}`}
                        className="bg-orange text-white px-8 py-3 font-black text-sm uppercase tracking-widest rounded-lg retro-border retro-shadow-sm hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none transition-all"
                      >
                        VER COMBO
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
