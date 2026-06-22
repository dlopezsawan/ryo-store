import { defineMiddlewares } from "@medusajs/medusa"
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
