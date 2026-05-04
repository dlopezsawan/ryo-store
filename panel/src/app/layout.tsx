import type { Metadata, Viewport } from "next"
import { Inter, Kanit, JetBrains_Mono } from "next/font/google"
import "./globals.css"
import { PwaInstaller } from "@/components/layout/PwaInstaller"
import { ShortcutsHelp } from "@/components/layout/ShortcutsHelp"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
})

const kanit = Kanit({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-kanit",
  display: "swap",
})

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
})

export const metadata: Metadata = {
  title: "Enrola Panel",
  description: "Admin panel · Enrola Shop",
  // Hard-block search engines on the panel (defense-in-depth con headers)
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  // Auto-detect del color scheme — el panel respeta la preferencia
  // del sistema operativo (light/dark) sin toggle manual.
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F5F2E8" },
    { media: "(prefers-color-scheme: dark)", color: "#08070A" },
  ],
}

/**
 * Script inline anti-FOUC: lee localStorage + prefers-color-scheme y aplica
 * .dark al <html> ANTES de que el browser pinte. Sin esto, hay un flash
 * blanco al cargar en dark mode.
 *
 * El código es minificado-mano, lee:
 *   localStorage.panel_theme = "light" | "dark" | "system" (default "system")
 * Sincronizado con ThemeToggle component.
 */
const themeScript = `
(function(){try{
var t=localStorage.getItem("panel_theme")||"system";
var d=t==="dark"||(t==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);
if(d)document.documentElement.classList.add("dark");
var c=localStorage.getItem("panel_sidebar_collapsed")==="true";
document.documentElement.setAttribute("data-sidebar",c?"collapsed":"expanded");
}catch(e){}})();
`

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" className={`${inter.variable} ${kanit.variable} ${jetbrains.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        {children}
        <PwaInstaller />
        <ShortcutsHelp />
      </body>
    </html>
  )
}
