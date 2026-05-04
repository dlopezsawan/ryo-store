import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Enrola Panel",
    short_name: "Enrola",
    description: "Panel admin de Ryo Store · Enrola — pedidos, productos, finanzas, social",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#FAF6EE",  // cream
    theme_color: "#FF3B27",       // orange
    lang: "es-VE",
    icons: [
      // SVG vectorial — soportado por Chrome/Firefox/Edge desktop + Android.
      // iOS no usa estos (lee meta apple-touch-icon en <head>) pero no es target principal.
      {
        src: "/logo.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/logo.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      { name: "Pedidos LIVE",   short_name: "Live",   url: "/orders/live",  description: "Feed live de pedidos" },
      { name: "Pedidos",        short_name: "Pedidos", url: "/orders",       description: "Listado completo" },
      { name: "Inventario",     short_name: "Stock",  url: "/inventory",     description: "Inventario y stock" },
      { name: "Finanzas",       short_name: "Money",  url: "/finanzas",      description: "P&L, cashflow, runway" },
    ],
    categories: ["business", "productivity"],
  }
}
