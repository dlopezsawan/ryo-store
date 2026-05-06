import type { Metadata } from "next";
import { getCollectionMetadata } from "@/lib/seo";

export const metadata: Metadata = getCollectionMetadata({
  title: "Tienda",
  description:
    "Explora nuestra colección de papers, conos, grinders y accesorios para rolling. Envíos en Venezuela y al exterior.",
  handle: "tienda",
});

export default function TiendaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
