import { Metadata } from "next";
import { getPageMetadata } from "@/lib/seo";

export const metadata: Metadata = getPageMetadata(
  "Tu Carrito",
  "Revisa tus productos seleccionados y completa tu pedido de parafernalia canábica en Enrola Shop.",
  "/carrito"
);

export default function CarritoLayout({ children }: { children: React.ReactNode }) {
  return children;
}
