import { generateProductJsonLd } from "@/lib/seo";

interface Props {
  product: {
    name: string;
    description: string;
    handle: string;
    images: string[];
    price: number;
    currency: string;
    inStock: boolean;
    sku?: string;
    brand?: string;
    category?: string;
    ratingValue?: number;
    reviewCount?: number;
  };
}

export function ProductJsonLd({ product }: Props) {
  const jsonLd = generateProductJsonLd({
    name: product.name,
    description: product.description,
    handle: product.handle,
    image: product.images,
    price: product.price,
    currency: product.currency,
    availability: product.inStock,
    sku: product.sku,
    brand: product.brand,
    category: product.category,
    ratingValue: product.ratingValue,
    reviewCount: product.reviewCount,
  });

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
