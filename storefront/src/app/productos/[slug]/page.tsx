import type { Metadata } from "next";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import Link from "next/link";
import Image from "next/image";
import { getProductByHandle, getProductByHandleWithVariant, getProducts } from "@/lib/medusa";
import { getProductMetadata, generateBreadcrumbJsonLd } from "@/lib/seo";
import { ProductJsonLd } from "@/components/seo/ProductJsonLd";
import ProductActions from "@/components/products/ProductActions";
import ProductCard from "@/components/products/ProductCard";
import StickyBuyBar from "@/components/products/StickyBuyBar";
import CostCalculator from "@/components/products/CostCalculator";
import ComboTierInfo from "@/components/combo/ComboTierInfo";
import { formatPrice } from "@/lib/format";

/** Categories/keywords where cost-per-session makes sense (consumibles only) */
const CONSUMABLE_KEYWORDS = ["rolling paper", "paper", "conos", "filtros", "filtro", "hojas", "tips"];
const NON_CONSUMABLE_KEYWORDS = ["grinder", "pipa", "bong", "electr"];

function isConsumable(category: string, name: string, description?: string): boolean {
  const text = `${category} ${name} ${description ?? ""}`.toLowerCase();
  // Exclude hardware first
  if (NON_CONSUMABLE_KEYWORDS.some((k) => text.includes(k))) return false;
  // Include consumables by category or name/description keywords
  return CONSUMABLE_KEYWORDS.some((k) => text.includes(k));
}

/** Extract units-per-pack from product details, description, or subtitle */
function extractUnitsPerPack(details: string[], description?: string, subtitle?: string): number {
  const allText = [...details, description ?? "", subtitle ?? ""];
  for (const d of allText) {
    // "Paquete de 6 unidades", "Pack de 32 conos", "6 conos", "50 hojas"
    const packMatch = d.match(/(?:paquete|pack)\s+de\s+(\d+)/i);
    if (packMatch) return parseInt(packMatch[1], 10);
    const hojasMatch = d.match(/(\d+)\s*hojas/i);
    if (hojasMatch) return parseInt(hojasMatch[1], 10);
    const conosMatch = d.match(/(\d+)\s*(?:conos|unidades|filtros|piezas)/i);
    if (conosMatch) return parseInt(conosMatch[1], 10);
  }
  return 1;
}

const STORE_URL =
  process.env.NEXT_PUBLIC_STORE_URL || "https://enrola.shop";

const productContent: Record<
  string,
  {
    description: string;
    details: string[];
  }
> = {
  "conos-hemp": {
    description:
      "Conos de cáñamo natural. Sin blanqueadores ni químicos. Sabor limpio y combustión lenta.",
    details: [
      "Paquete de 6 unidades",
      "Tamaño King Size",
      "Papel Hemp 100% natural",
      "Con filtro incluido",
    ],
  },
  celulosa: {
    description:
      "Papers de celulosa Trip. Transparentes, sabor limpio y experiencia premium.",
    details: [
      "50 hojas por paquete",
      "Ultrafinos",
      "Sin sabor añadido",
      "Tamaño 1¼",
    ],
  },
  rolling: {
    description:
      "Papers de rolling clásicos. Perfectos para cualquier ocasión.",
    details: [
      "40 hojas por paquete",
      "Papel natural",
      "Combustión uniforme",
      "Tamaño 1¼",
    ],
  },
  "grinder-pl": {
    description: "Grinder de vidrio azul premium. Diseño elegante y funcional.",
    details: [
      "Material de vidrio",
      "Diseño premium",
      "Fácil de limpiar",
      "Diámetro 55mm",
    ],
  },
  "filtros-de-carb": {
    description:
      "Filtros de carbón activo para una fumada más limpia y suave.",
    details: [
      "Filtros de carbón activo",
      "Tamaño regular",
      "Reduce toxinas",
      "Alta eficiencia",
    ],
  },
  "grinder-elec": {
    description:
      "Grinder eléctrico potente y compacto. La forma más rápida y cómoda de moler.",
    details: [
      "Motor eléctrico potente",
      "Carga USB",
      "Compacto y portátil",
      "Cuchillas de acero",
    ],
  },
  "conos-celulosa": {
    description:
      "Conos pre-armados de celulosa orgánica. Listos para usar.",
    details: ["Conos pre-armados", "Celulosa orgánica", "Con filtro", "Pack individual"],
  },
};

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductByHandle(slug);
  const content = productContent[slug];
  if (!product)
    return { title: "Producto no encontrado | Enrola Shop" };

  return getProductMetadata({
    title: product.name,
    description: content?.description ?? product.description ?? "",
    handle: product.slug,
    image: product.image,
    price: product.price,
    currency: "EUR",
    availability: product.inStock,
    category: product.category,
  });
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const productWithVariant = await getProductByHandleWithVariant(slug);
  const baseProduct = productWithVariant?.product ?? null;
  const content = productContent[slug];

  if (!baseProduct) {
    return (
      <div className="min-h-screen bg-cream">
        <Header />
        <main className="max-w-[1380px] mx-auto px-4 py-20 text-center">
          <h1 className="font-black text-dark text-4xl mb-6 uppercase">
            Producto no encontrado
          </h1>
          <Link
            href="/tienda"
            className="text-primary text-lg font-bold hover:underline"
          >
            Volver a la tienda
          </Link>
        </main>
        <Footer />
      </div>
    );
  }

  const product = {
    ...baseProduct,
    description: content?.description ?? baseProduct.description ?? "",
    details: content?.details ?? [],
  };

  // Productos relacionados: misma categoría, excluir el actual, máximo 4
  const relatedProducts = baseProduct.category_id
    ? (await getProducts({ categoryId: baseProduct.category_id }))
        .filter((p) => p.id !== baseProduct.id)
        .slice(0, 4)
    : (await getProducts()).filter((p) => p.id !== baseProduct.id).slice(0, 4);

  const breadcrumbJsonLd = generateBreadcrumbJsonLd([
    { name: "Inicio", url: STORE_URL },
    { name: "Tienda", url: `${STORE_URL}/tienda` },
    { name: product.name, url: `${STORE_URL}/productos/${product.slug}` },
  ]);

  return (
    <div className="min-h-screen bg-cream">
      <ProductJsonLd
        product={{
          name: product.name,
          description: product.description,
          handle: product.slug,
          images: [product.image],
          price: product.price,
          currency: "EUR",
          inStock: baseProduct.inStock,
          category: product.category,
          // ratingValue/reviewCount removidos hasta tener reseñas reales verificables
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <Header />

      <main className="max-w-[1380px] mx-auto px-4 py-8 md:py-12">
        {/* Breadcrumbs */}
        <nav className="flex items-center gap-2 text-sm mb-8 font-medium">
          <Link href="/" className="text-muted hover:text-primary transition-colors">Inicio</Link>
          <span className="text-muted">/</span>
          <Link href="/tienda" className="text-muted hover:text-primary transition-colors">Tienda</Link>
          <span className="text-muted">/</span>
          <span className="text-dark">{product.name}</span>
        </nav>

        <div className="grid md:grid-cols-5 gap-6 md:gap-10 items-start">
          {/* Image — 2 columns on desktop, smaller */}
          <div className="md:col-span-2 border-[8px] md:border-[10px] border-dark bg-white aspect-square w-full overflow-hidden"
            style={{ boxShadow: "6px 6px 0px 0px var(--primary)" }}>
            <Image
              src={product.image}
              alt={product.name}
              width={500}
              height={500}
              sizes="(max-width: 768px) 100vw, 40vw"
              priority
              className="w-full h-full object-cover"
            />
          </div>

          {/* Info — 3 columns on desktop */}
          <div className="md:col-span-3 flex flex-col justify-start">
            <span className="inline-block bg-secondary text-cream text-xs font-bold uppercase tracking-[0.15em] px-3 py-1 mb-3 self-start">
              {product.category || "Premium Quality"}
            </span>

            <h1 className="font-black text-dark text-2xl md:text-[38px] leading-tight uppercase tracking-tight mb-1">
              {product.name}
            </h1>

            {baseProduct.subtitle && (
              <p className="text-muted text-sm font-medium mb-2 leading-snug">
                {baseProduct.subtitle}
              </p>
            )}

            <p className="font-black text-primary text-3xl md:text-[44px] mb-4">
              €{formatPrice(product.price)} <span className="text-sm font-bold text-dark/40 align-middle">BCV</span>
            </p>

            {/* Cost per session — only for consumables */}
            {isConsumable(baseProduct.category, product.name, product.description) && (
              <div className="mb-4">
                <CostCalculator
                  price={product.price}
                  unitsPerPack={extractUnitsPerPack(product.details, product.description, baseProduct.subtitle)}
                />
              </div>
            )}

            {/* Actions — quantity + add to cart FIRST */}
            {productWithVariant && baseProduct.inStock ? (
              <ProductActions
                variantId={productWithVariant.variantId}
                variants={productWithVariant.variants}
                productId={baseProduct.id}
                productTitle={product.name}
                productPrice={product.price}
                category={baseProduct.category}
              />
            ) : productWithVariant ? (
              <div className="py-4 px-4 border-2 border-dark bg-cream text-center">
                <span className="font-black text-sm uppercase tracking-widest text-dark/60">
                  Agotado — Sin stock disponible
                </span>
              </div>
            ) : null}

            {/* Wholesale */}
            {productWithVariant && (
              <div className="mt-4">
                <ComboTierInfo
                  variantId={productWithVariant.variantId}
                  productName={product.name}
                />
              </div>
            )}

            {/* Description — below actions */}
            {product.description && (
              <p className="text-muted text-sm leading-relaxed mt-6 pt-5 border-t border-dark/10">
                {product.description}
              </p>
            )}

            {/* Material */}
            {baseProduct.material && (
              <div className="mt-3 flex items-center gap-2 text-sm text-dark">
                <span className="font-bold uppercase tracking-wider text-secondary">Material:</span>
                <span>{baseProduct.material}</span>
              </div>
            )}

            {/* Specs */}
            {product.details.length > 0 && (
              <div className="mt-4 border-2 border-secondary/30 p-4">
                <h3 className="font-bold text-sm uppercase tracking-wider text-secondary mb-3">
                  Especificaciones
                </h3>
                <ul className="flex flex-col gap-2">
                  {product.details.map((detail, i) => (
                    <li key={i} className="flex items-center gap-3 text-sm text-dark">
                      <span className="w-2 h-2 bg-primary flex-shrink-0" />
                      {detail}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* ===== PRODUCTOS RELACIONADOS ===== */}
        {relatedProducts.length > 0 && (
          <section className="mt-16 md:mt-20 pt-10 border-t-[3px] border-dark">
            <div className="flex items-center gap-4 mb-8">
              <div className="h-1 w-12 bg-primary" />
              <h2 className="font-black text-dark text-2xl md:text-4xl uppercase tracking-tight">
                También te puede gustar
              </h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
              {relatedProducts.map((p) => (
                <ProductCard key={p.id} {...p} />
              ))}
            </div>
          </section>
        )}
      </main>

      <Footer />

      {/* Mobile sticky buy bar — only shown when in stock */}
      {productWithVariant && baseProduct.inStock && (
        <StickyBuyBar
          productName={product.name}
          price={product.price}
          variantId={productWithVariant.variantId}
        />
      )}
    </div>
  );
}
