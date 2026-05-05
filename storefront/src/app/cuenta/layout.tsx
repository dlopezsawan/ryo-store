import { Metadata } from "next";
import { getPageMetadata } from "@/lib/seo";

export const metadata: Metadata = getPageMetadata(
  "Mi Cuenta",
  "Gestiona tus pedidos, revisa tus puntos del Club Enrola y actualiza tus datos de envío.",
  "/cuenta"
);

export default function CuentaLayout({ children }: { children: React.ReactNode }) {
  return children;
}
