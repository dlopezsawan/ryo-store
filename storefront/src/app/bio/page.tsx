import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { BRAND } from "@/config/brand";

/**
 * /bio — Mobile-first link-tree style landing page used as the link in the
 * Instagram bio. Single screen, three big tappable buttons, brand chrome
 * stripped (no Header/Footer) so the focus is on conversion.
 *
 * Routes used:
 *   - /tienda                   → main shop
 *   - WhatsApp wa.me/<num>      → direct chat with sales (number from env)
 *   - /terminos                 → terms & conditions (existing page)
 *
 * Tracking: each button gets a `data-bio-action` attribute that the
 * client-side analytics layer (PostHog/GA via remarketing.ts) can read
 * for IG-bio click attribution. No JS needed here — the existing
 * remarketing layer sees the data attrs on click and fires events.
 */

const STORE_URL = process.env.NEXT_PUBLIC_STORE_URL || "https://enrola.shop";
// Use the WhatsApp Business click-to-chat short link if configured (the
// greeting is pre-set on the WA Business side, no URL encoding here).
// Fall back to wa.me/<phone> with an encoded greeting if no short link.
const WA_GREETING = encodeURIComponent("Hola Enrola, quiero hacer un pedido 🌿");
const WA_HREF = BRAND.social.whatsappLink
  ? BRAND.social.whatsappLink
  : BRAND.social.whatsapp
    ? `https://wa.me/${BRAND.social.whatsapp.replace(/\D/g, "")}?text=${WA_GREETING}`
    : "#";

export const metadata: Metadata = {
  title: "Enrola Shop — Links",
  description: "Compra rolling papers, conos y accesorios en enrola.shop o por WhatsApp.",
  // Stop Google from indexing the bio link — it's not a content page.
  robots: { index: false, follow: false },
  openGraph: {
    title: "Enrola Shop",
    description: "Tu destino para el tabaco artesanal.",
    images: [{ url: `${STORE_URL}/logo-web-nuevo.svg`, width: 1805, height: 934 }],
  },
};

// Inline SVG icons — `currentColor` so each icon picks up the text color
// of its parent button (white on orange/green, dark on cream). Stroke-based
// for clean rendering at any size, no color clash with the bg.
const ICON_CART = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
    className="w-7 h-7 flex-shrink-0">
    <circle cx="9" cy="20" r="1.5"/>
    <circle cx="18" cy="20" r="1.5"/>
    <path d="M2.5 3.5h2.5l2.7 11.4a2 2 0 0 0 2 1.6h8.3a2 2 0 0 0 2-1.5L21.5 7H6.5"/>
  </svg>
);

const ICON_WHATSAPP = (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"
    className="w-7 h-7 flex-shrink-0">
    <path d="M17.4 14.4c-.3-.1-1.7-.8-2-.9-.3-.1-.5-.1-.7.2-.2.3-.7.9-.9 1.1-.2.2-.3.2-.6.1-.3-.1-1.2-.4-2.3-1.4-.8-.8-1.4-1.7-1.6-2-.2-.3 0-.5.1-.6.1-.1.3-.3.4-.5.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5 0-.1-.7-1.6-.9-2.2-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.4 0 1.4 1 2.8 1.2 3 .1.2 2 3.1 4.9 4.3.7.3 1.2.5 1.6.6.7.2 1.3.2 1.8.1.5-.1 1.7-.7 1.9-1.4.2-.7.2-1.3.2-1.4-.1-.1-.3-.2-.6-.3z M20 4A10 10 0 0 0 4.6 16.5L3 21l4.6-1.5A10 10 0 1 0 20 4zM12 20a8 8 0 0 1-4.1-1.1l-.3-.2-3 1 1-2.9-.2-.3a8 8 0 1 1 6.6 3.5z"/>
  </svg>
);

const ICON_DOC = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
    className="w-7 h-7 flex-shrink-0">
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/>
    <path d="M14 3v5h5"/>
    <path d="M9 13h6M9 17h6M9 9h2"/>
  </svg>
);

const links: Array<{
  href: string;
  label: string;
  sublabel: string;
  icon: React.ReactNode;
  emphasis: "primary" | "whatsapp" | "ghost";
  external?: boolean;
  action: string;
}> = [
  {
    href: "/tienda",
    label: "Comprar ya en la web",
    sublabel: "Catálogo completo · pago en línea",
    icon: ICON_CART,
    emphasis: "primary",
    action: "shop",
  },
  {
    href: WA_HREF,
    label: "Comprar por WhatsApp",
    sublabel: "Te atendemos personal · 9am – 9pm VE",
    icon: ICON_WHATSAPP,
    emphasis: "whatsapp",
    external: true,
    action: "whatsapp",
  },
  {
    href: "/terminos",
    label: "Términos y condiciones",
    sublabel: "Política de envíos, devoluciones, privacidad",
    icon: ICON_DOC,
    emphasis: "ghost",
    action: "terms",
  },
];

export default function BioLinksPage() {
  return (
    <main className="min-h-[100dvh] bg-cream flex flex-col items-center px-5 py-10 sm:py-14">
      {/* Logo block — dark band with the wordmark, mirrors how the email
          header displays the logo so the visual is coherent across IG/email/web. */}
      <header className="w-full max-w-md">
        <div className="bg-dark border-[3px] border-dark text-center px-6 py-6 mb-6 shadow-[6px_6px_0px_0px_#FF3B27]">
          <Image
            src="/logo-web-nuevo.svg"
            alt="Enrola Shop"
            width={1805}
            height={934}
            priority
            className="mx-auto w-full max-w-[260px] h-auto"
          />
          <p className="mt-3 text-cream text-xs tracking-[0.18em] font-bold uppercase">
            El arte de armar.
          </p>
        </div>
      </header>

      {/* Buttons — single column, finger-friendly tap targets (~64px tall),
          full width on mobile, brand brutalist box-shadow style. */}
      <nav aria-label="Enlaces" className="w-full max-w-md flex flex-col gap-4">
        {links.map((l) => {
          const baseStyles =
            "block w-full rounded-none border-[3px] border-dark px-5 py-4 transition-transform " +
            "hover:-translate-x-[2px] hover:-translate-y-[2px] active:translate-x-0 active:translate-y-0 " +
            "active:shadow-none";
          const emphasisStyles = {
            primary: "bg-orange text-cream shadow-[6px_6px_0px_0px_#1A1A1A] hover:shadow-[8px_8px_0px_0px_#1A1A1A]",
            whatsapp: "bg-[#128C7E] text-white shadow-[6px_6px_0px_0px_#1A1A1A] hover:shadow-[8px_8px_0px_0px_#1A1A1A]",
            ghost: "bg-cream text-dark shadow-[6px_6px_0px_0px_#1A1A1A] hover:shadow-[8px_8px_0px_0px_#1A1A1A]",
          }[l.emphasis];

          const content = (
            <div className="flex items-center gap-4">
              <span className="flex-shrink-0">
                {l.icon}
              </span>
              <span className="flex-1 text-left">
                <span className="block text-lg font-black uppercase tracking-wide leading-tight">
                  {l.label}
                </span>
                <span className="block text-[11px] font-medium opacity-80 mt-0.5 normal-case tracking-normal">
                  {l.sublabel}
                </span>
              </span>
              <span className="text-2xl leading-none flex-shrink-0 opacity-90" aria-hidden>
                →
              </span>
            </div>
          );

          // External (wa.me) opens in new tab, internal uses next/link.
          if (l.external) {
            return (
              <a
                key={l.action}
                href={l.href}
                target="_blank"
                rel="noopener noreferrer"
                className={`${baseStyles} ${emphasisStyles}`}
                data-bio-action={l.action}
              >
                {content}
              </a>
            );
          }
          return (
            <Link
              key={l.action}
              href={l.href}
              className={`${baseStyles} ${emphasisStyles}`}
              data-bio-action={l.action}
            >
              {content}
            </Link>
          );
        })}
      </nav>

      {/* Disclaimer — same wording as the legal-footer used on social posts,
          required for IG/Meta compliance for tobacco/smoking accessories. */}
      <footer className="w-full max-w-md mt-10 mb-6 text-center">
        <p className="text-[11px] leading-relaxed text-muted uppercase tracking-[0.08em] font-medium">
          +18 · Accesorios para tabaco legal · Enrola no promueve sustancias
          ilegales · Consume con moderación
        </p>
        <p className="text-[10px] text-muted/70 mt-3">
          © {new Date().getFullYear()} Enrola Shop · enrola.shop
        </p>
      </footer>
    </main>
  );
}
