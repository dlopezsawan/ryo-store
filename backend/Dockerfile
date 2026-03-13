FROM node:20-alpine AS base
WORKDIR /app

# Dependencies (Yarn evita el cuelgue de npm con deps Medusa)
FROM base AS deps
COPY package.json ./
# Quitar packageManager para que Yarn pueda instalar (Corepack obliga npm si está definido)
RUN node -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync('package.json','utf8'));delete p.packageManager;fs.writeFileSync('package.json',JSON.stringify(p,null,2))"
RUN corepack enable && corepack prepare yarn@1.22.22 --activate
RUN yarn install --ignore-scripts

# Build
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG NODE_OPTIONS=--max-old-space-size=2048
ENV NODE_OPTIONS=${NODE_OPTIONS}
RUN npm run build && \
  mkdir -p .medusa/server/public/admin && \
  cp -r .medusa/client/* .medusa/server/public/admin/ && \
  test -f .medusa/server/public/admin/index.html || (echo "Admin build failed: index.html not found" && exit 1)

# Production: Medusa ejecuta desde .medusa/server; admin en public/admin
FROM base AS runner
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/.medusa/server ./
COPY --from=build /app/.medusa/client ./.medusa/client/
# Medusa espera public/admin; el build pone el admin en .medusa/client
RUN mkdir -p public .medusa && rm -rf public/admin 2>/dev/null; ln -sfn /app/.medusa/client /app/public/admin && test -f /app/public/admin/index.html || (echo "Admin missing" && exit 1)
# Instalar deps de producción del build standalone
RUN npm install --omit=dev
EXPOSE 9000
CMD ["npm", "run", "start"]
