import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import ProductCard from "@/components/products/ProductCard";
import HeroSlider from "@/components/layout/HeroSlider";
import HeroTitle from "@/components/layout/HeroTitle";
import CategoryTicker from "@/components/layout/CategoryTicker";
import NewsletterForm from "@/components/layout/NewsletterForm";
import Link from "next/link";
import Image from "next/image";
import { getBestSellerProducts, getFeaturedProducts } from "@/lib/medusa";
import ProductCardSkeleton from "@/components/products/ProductCardSkeleton";

// ISR: revalidate home every 60s to allow CDN edge caching + fresh product data
export const revalidate = 60;

export default async function Home() {
  const [bestSellers, heroSlides] = await Promise.all([
    getBestSellerProducts(),
    getFeaturedProducts(),
  ]);

  return (
    <div className="min-h-screen bg-cream">
      <Header />

      <main>
        <a id="main-content" tabIndex={-1} className="sr-only" aria-hidden="true">
          Inicio del contenido principal
        </a>
        {/* ===== HERO ===== */}
        <section className="relative max-w-[1380px] mx-auto px-4 pt-10 md:pt-16 pb-0 text-center">
          <HeroTitle />

          {/* Slider */}
          <div className="mb-10 md:mb-14">
            <HeroSlider
              slides={heroSlides.map((p) => ({
                slug: p.slug,
                name: p.name,
                price: p.price,
                image: p.sliderImage || p.image,
              }))}
            />
          </div>
        </section>

        {/* ===== CATEGORY TICKER ===== */}
        <CategoryTicker />

        {/* ===== COMBOS INLINE ===== */}
        <div className="max-w-[1380px] mx-auto px-4 pt-6 pb-0">
          <div className="flex items-center gap-2 text-[11px] md:text-xs text-dark/70 font-medium tracking-wide">
            <span className="text-orange">⚡</span>
            <span>COMBO:</span>
            <span className="font-black text-dark/80">3+</span>
            <span className="text-orange font-black">10%</span>
            <span className="text-dark/55" aria-hidden="true">·</span>
            <span className="font-black text-dark/80">5+</span>
            <span className="text-orange font-black">15%</span>
            <span className="text-dark/55" aria-hidden="true">·</span>
            <span className="font-black text-dark/80">10+</span>
            <span className="text-orange font-black">20%</span>
            <span className="text-dark/55 hidden md:inline" aria-hidden="true">—</span>
            <span className="hidden md:inline text-dark/65">mezcla lo que quieras</span>
          </div>
        </div>

        {/* ===== BEST SELLERS ===== */}
        <section className="max-w-[1380px] mx-auto px-4 py-12 md:py-20">
          <div className="flex items-center gap-4 mb-2">
            <div className="h-1 w-12 bg-primary" />
            <h2 className="font-black text-dark text-3xl md:text-5xl uppercase tracking-tight">
              Los Más Vendidos
            </h2>
          </div>
          <p className="text-muted text-sm md:text-base mb-8 md:mb-12 ml-16">
            Lo más pedido por la comunidad Enrola
          </p>

          {bestSellers.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
              {bestSellers.map((product) => (
                <ProductCard key={product.id} {...product} />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <ProductCardSkeleton key={i} />
              ))}
            </div>
          )}

          <div className="flex justify-center mt-10 md:mt-14">
            <Link
              href="/tienda"
              className="bg-orange text-white px-10 py-3.5 font-black text-sm uppercase tracking-widest rounded-lg retro-border retro-shadow hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none transition-all"
            >
              Ver Todos los Productos
            </Link>
          </div>
        </section>

        {/* ===== CTA CLUB ===== */}
        <section className="bg-primary border-y-4 border-dark overflow-hidden">
          <div className="max-w-[1380px] mx-auto px-4 py-10 md:py-14 flex flex-col md:flex-row items-center justify-between gap-8 relative">
            {/* Mascota decorativa — desktop */}
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 opacity-15 pointer-events-none select-none hidden md:block">
              <Image
                src="/mascota-ryo-blanca.png"
                alt=""
                width={180}
                height={240}
                sizes="160px"
                className="w-40 h-auto"
                aria-hidden="true"
              />
            </div>
            <div className="flex items-center gap-5 md:gap-8 relative z-10">
              {/* Mascota visible en mobile */}
              <Image
                src="/mascota-ryo-blanca.png"
                alt="Mascota Club Enrola"
                width={80}
                height={107}
                sizes="64px"
                className="w-16 h-auto flex-shrink-0 sm:hidden opacity-80"
              />
              <div>
                <h2 className="font-black text-white text-3xl md:text-5xl uppercase tracking-tight mb-2">
                  Únete al Club Enrola
                </h2>
                <p className="text-white/80 text-base md:text-lg max-w-md">
                  Ofertas exclusivas, lanzamientos y contenido solo para miembros.
                </p>
              </div>
            </div>
            <div className="relative z-10 w-full md:w-auto">
              <NewsletterForm />
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
