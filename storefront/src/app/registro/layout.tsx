import { Metadata } from "next";
import { getPageMetadata } from "@/lib/seo";

export const metadata: Metadata = getPageMetadata(
  "Crear Cuenta",
  "Únete al Club Enrola, acumula puntos con cada compra y accede a beneficios exclusivos.",
  "/registro"
);

export default function RegistroLayout({ children }: { children: React.ReactNode }) {
  return children;
}
