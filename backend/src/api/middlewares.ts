import { defineMiddlewares } from "@medusajs/medusa"
import { authenticate } from "@medusajs/framework/http"
import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import express from "express"

// Capture raw body for signature-verified webhooks (Meta Instagram).
// Must run BEFORE express.json() so we can read the raw bytes for HMAC.
const rawBodyCapture = express.json({
  verify: (req, _res, buf) => {
    ;(req as unknown as { rawBody: string }).rawBody = buf.toString("utf8")
  },
})

export default defineMiddlewares({
  routes: [
    {
      // Bot admin API (/bot/config, /bot/conversations, /bot/stats).
      // These endpoints expose WhatsApp/Meta bot configuration and customer
      // conversation history, so they must require an authenticated admin —
      // the SAME guard Medusa applies to /admin/* (session cookie used by the
      // dashboard, bearer JWT, or an admin API key). Without this they were
      // publicly readable/writable by anyone on the internet. Applies to every
      // HTTP method (no `method` restriction → GET, POST, etc.).
      matcher: "/bot/*",
      middlewares: [authenticate("user", ["session", "bearer", "api-key"])],
    },
    {
      matcher: "/maintenance",
      middlewares: [],
    },
    {
      matcher: "/webhooks/instagram",
      method: ["POST"],
      middlewares: [
        (req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) =>
          rawBodyCapture(req, res, next as unknown as express.NextFunction),
      ],
    },
    {
      // Replai firma con HMAC sobre el body crudo → necesitamos los bytes raw.
      matcher: "/webhooks/replai",
      method: ["POST"],
      middlewares: [
        (req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) =>
          rawBodyCapture(req, res, next as unknown as express.NextFunction),
      ],
    },
  ],
})
