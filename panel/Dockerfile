# ─── Multi-stage build para Next.js standalone ─────────────────────────
# Imagen final ~150MB. La key está en `output: "standalone"` (next.config)
# que Next copia a .next/standalone con SOLO el subset de node_modules
# que se usa server-side. node_modules completos NO se shippean.
# ───────────────────────────────────────────────────────────────────────

FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat tini
WORKDIR /app

# ─── deps stage: install once, cache aggressively ─────────────────────
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund

# ─── build stage ──────────────────────────────────────────────────────
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# PANEL_SESSION_SECRET es required at build time? No — solo runtime.
# Pero NEXT necesita validar tipos contra los env vars que sí usamos.
RUN npm run build

# ─── runtime stage: minimal image ─────────────────────────────────────
FROM base AS runtime
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3001
ENV HOSTNAME=0.0.0.0

# Usuario non-root para defensa en profundidad
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 panel

# Standalone trae el server.js + tree-shaken node_modules
COPY --from=build --chown=panel:nodejs /app/.next/standalone ./
COPY --from=build --chown=panel:nodejs /app/.next/static    ./.next/static
COPY --from=build --chown=panel:nodejs /app/public          ./public

USER panel
EXPOSE 3001

# tini para manejar SIGTERM correctamente (graceful shutdown)
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.js"]
