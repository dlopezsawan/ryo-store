import type { Metadata } from "next";

const STORE_NAME = "Enrola Shop";
const STORE_URL =
  process.env.NEXT_PUBLIC_STORE_URL || "https://enrola.shop";

export const metadata: Metadata = {
  title: `Combos | ${STORE_NAME}`,
  description:
    "Combos especiales con descuento. Starter Pack, Pro Bundle, Ultimate Kit. Papers, conos, grinders y más. Enrola Shop Venezuela.",
  openGraph: {
    title: `Combos | ${STORE_NAME}`,
    description:
      "Combos especiales con descuento. Papers, conos, grinders y accesorios. Enrola Shop Venezuela.",
    url: `${STORE_URL}/bundles`,
    siteName: STORE_NAME,
    type: "website",
    locale: "es_VE",
  },
  alternates: {
    canonical: `${STORE_URL}/bundles`,
  },
};

export default function BoundlesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
