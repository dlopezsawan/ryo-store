import { getProducts, getProductCategories } from "@/lib/medusa";
import TiendaContent from "./TiendaContent";

type Props = {
  searchParams: Promise<{ category?: string; q?: string }>;
};

export default async function TiendaPage({ searchParams }: Props) {
  const { category, q } = await searchParams;
  const [products, categories] = await Promise.all([
    getProducts({
      categoryId: category ?? undefined,
      q: q ?? undefined,
    }),
    getProductCategories(),
  ]);
  return (
    <TiendaContent
      products={products}
      categories={categories}
      selectedCategoryId={category ?? null}
    />
  );
}
