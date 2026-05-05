import { Metadata } from "next";
import { getPageMetadata } from "@/lib/seo";

export const metadata: Metadata = getPageMetadata(
  "Iniciar Sesión",
  "Accede a tu cuenta Enrola Shop para gestionar tus pedidos y ver tus puntos del Club.",
  "/login"
);

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
