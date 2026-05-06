import type { Metadata } from "next";
import "./globals.css";
import {
  getHomeMetadata,
  generateOrganizationJsonLd,
  generateWebsiteJsonLd,
} from "@/lib/seo";
import Providers from "@/components/Providers";
import AgeGate from "@/components/layout/AgeGate";
import Analytics from "@/components/layout/Analytics";

export const metadata: Metadata = getHomeMetadata();

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="overflow-x-hidden">
      <head>
        <link rel="preconnect" href="https://api.enrola.shop" />
        <link
          rel="preload"
          href="/fonts/Kanit-Regular.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/Kanit-Medium.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/Kanit-Bold.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/Kanit-Black.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <style
          dangerouslySetInnerHTML={{
            __html:
              "html.age-verified #age-gate{display:none!important}",
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{if(document.cookie.indexOf('enrola_age_verified=true')!==-1)document.documentElement.classList.add('age-verified')}catch(e){}",
          }}
        />
      </head>
      <body className="antialiased bg-cream text-dark overflow-x-hidden w-full">
        {/* Analytics (GA4 + Umami + PostHog) is gated behind the +18
            age verification — pixels never fire before the visitor has
            clicked through the gate. See compliance/02-WEB.md §6.3 +
            components/layout/Analytics.tsx. */}
        <Analytics />
        <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:bg-orange focus:text-white focus:px-4 focus:py-2 focus:font-black focus:text-sm focus:uppercase focus:tracking-widest focus:border-2 focus:border-dark">
          Saltar al contenido
        </a>
        <AgeGate />
        <Providers>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(generateOrganizationJsonLd()),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(generateWebsiteJsonLd()),
          }}
        />
        {children}
        </Providers>
      </body>
    </html>
  );
}
