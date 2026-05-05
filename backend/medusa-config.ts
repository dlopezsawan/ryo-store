import { loadEnv, defineConfig } from '@medusajs/framework/utils'

loadEnv(process.env.NODE_ENV || 'development', process.cwd())

module.exports = defineConfig({
  admin: {
    path: "/dashboard",
    backendUrl: "https://api.enrola.shop",
    vite: (config) => ({ ...config, base: "/dashboard/" }),
  },
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    http: {
      storeCors: process.env.STORE_CORS!,
      adminCors: process.env.ADMIN_CORS!,
      authCors: process.env.AUTH_CORS!,
      jwtSecret: process.env.JWT_SECRET || "supersecret",
      cookieSecret: process.env.COOKIE_SECRET || "supersecret",
    }
  },
  modules: [
    {
      // The finanzas module owns 16 tables (pago_movil, expenses, wallets,
      // conversions, rate snapshots, monthly closes, audit log, etc.) and
      // is the data layer for everything under /admin/finanzas/* and the
      // panel's Finanzas section.
      //
      // The module + its migrations existed for months, but at some point
      // the resolve entry got dropped from this config — leaving the
      // tables in place but the service unregistered. Result:
      // every endpoint that did `container.resolve(FINANZAS_MODULE)`
      // returned 500 ("Could not resolve 'finanzasModuleService'") and
      // the panel's Finanzas tab showed "ERROR WALLETS / medusa GET
      // /finanzas/* failed (500)" across the board.
      resolve: "./src/modules/finanzas",
    },
    {
      resolve: "./src/modules/loyalty",
    },
    {
      resolve: "./src/modules/seo-analytics",
    },
    {
      resolve: "./src/modules/social",
    },
    {
      resolve: "@medusajs/medusa/file",
      options: {
        providers: [
          {
            resolve: "@medusajs/medusa/file-local",
            id: "local",
            options: {
              upload_dir: "static",
              backend_url: `${process.env.BACKEND_PUBLIC_URL || "https://api.enrola.shop"}/static`,
            },
          },
        ],
      },
    },
  ],
})
