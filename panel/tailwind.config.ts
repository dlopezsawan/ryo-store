import type { Config } from "tailwindcss"

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  // El user puede elegir manualmente light / dark / system.
  // Class strategy: el prefijo `dark:` activa cuando <html> tiene `class="dark"`.
  // El modo system se implementa client-side: si el user elige "system",
  // toggle script aplica/quita la clase según prefers-color-scheme.
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        // Kanit = display, vintage, chunky — titulares, KPIs, precios
        display: ["var(--font-kanit)", "sans-serif"],
        // Inter = legibilidad densa — tablas, descripciones
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains)", "monospace"],
      },
      colors: {
        // ─── Brand fixed (no swap entre light/dark, son la firma) ───
        primary:   "#BB3B2E",  // brick-red — urgencia / margen negativo
        orange:    "#FF3B27",  // CTA / acento principal
        secondary: "#4D5431",  // verde-oliva — éxito serio
        cream:     "#F5F2E8",
        "cream-2": "#EAE5D6",
        dark:      "#1A1A1A",
        "bg-dark": "#221610",

        // ─── Semantic tokens vía CSS variables (cambian en dark mode) ───
        page:    "rgb(var(--page) / <alpha-value>)",
        surface: "rgb(var(--surface) / <alpha-value>)",
        "surface-2": "rgb(var(--surface-2) / <alpha-value>)",
        "surface-3": "rgb(var(--surface-3) / <alpha-value>)",
        ink:     "rgb(var(--ink) / <alpha-value>)",
        "ink-2": "rgb(var(--ink-2) / <alpha-value>)",
        "ink-3": "rgb(var(--ink-3) / <alpha-value>)",

        // Warm gray ramp para cuando sí queremos un valor estático
        warm: {
          100: "#EFEBDF",
          200: "#DCD7C8",
          300: "#BDB7A6",
          400: "#85827D",
          500: "#5C5A56",
          600: "#3F3D38",
          700: "#28272388",
        },
      },
      boxShadow: {
        // Firma Enrola — offset chunky sin blur
        "stamp-sm":     "3px 3px 0 0 var(--shadow-color)",
        "stamp":        "5px 5px 0 0 var(--shadow-color)",
        "stamp-lg":     "7px 7px 0 0 var(--shadow-color)",
        "stamp-press":  "2px 2px 0 0 var(--shadow-color)",
        "stamp-orange": "5px 5px 0 0 #FF3B27",
        "stamp-olive":  "5px 5px 0 0 #4D5431",
      },
    },
  },
  plugins: [],
}

export default config
