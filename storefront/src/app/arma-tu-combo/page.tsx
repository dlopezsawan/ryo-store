import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { getProducts, getProductCategories } from "@/lib/medusa";
import ComboBuilder from "@/components/combo/ComboBuilder";

export const metadata = {
  title: "Arma Tu Combo | Enrola Shop",
  description:
    "Crea tu propio combo personalizado y ahorra 10%. Elige entre papeles, conos, grinders, filtros y accesorios en Enrola Shop.",
};

export const dynamic = "force-dynamic";

export default async function ArmaTuComboPage() {
  const [products, categories] = await Promise.all([
    getProducts(),
    getProductCategories(),
  ]);

  const mappedProducts = products.map((p) => ({
    id: p.id,
    slug: p.slug,
    name: p.name,
    price: p.price,
    image: p.image,
    category: p.category,
    category_id: p.category_id,
  }));

  const mappedCategories = categories.map((c) => ({
    id: c.id,
    name: c.name,
  }));

  return (
    <div className="min-h-screen bg-cream">
      <Header />

      <main className="max-w-[1380px] mx-auto px-4 py-8 md:py-12">
        <div className="flex items-center gap-4 mb-2">
          <div className="h-1 w-12 bg-primary" />
          <h1 className="font-black text-dark text-4xl md:text-6xl uppercase tracking-tight">
            Arma Tu Combo
          </h1>
        </div>
        <p className="text-muted text-sm md:text-base mb-8 ml-16">
          Elige tus productos favoritos y ahorra 10% al combinar 3 o mas
        </p>

        <ComboBuilder products={mappedProducts} categories={mappedCategories} />
      </main>

      <Footer />
    </div>
  );
}
