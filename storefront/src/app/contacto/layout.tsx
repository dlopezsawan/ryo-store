import type { Metadata } from "next";

const STORE_NAME = "Enrola Shop";
const STORE_URL =
  process.env.NEXT_PUBLIC_STORE_URL || "https://enrola.shop";

export const metadata: Metadata = {
  title: `Contacto | ${STORE_NAME}`,
  description:
    "Contáctanos para consultas, pedidos y soporte. WhatsApp, Instagram, TikTok. Enrola Shop - parafernalia canábica en Venezuela.",
  openGraph: {
    title: `Contacto | ${STORE_NAME}`,
    description:
      "Contáctanos para consultas, pedidos y soporte. Enrola Shop - parafernalia canábica en Venezuela.",
    url: `${STORE_URL}/contacto`,
    siteName: STORE_NAME,
    type: "website",
    locale: "es_VE",
  },
  alternates: {
    canonical: `${STORE_URL}/contacto`,
  },
};

export default function ContactoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
