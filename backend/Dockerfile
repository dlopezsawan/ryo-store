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
  test -f .medusa/server/public/admin/index.html || (echo "Admin build failed" && exit 1) && \
  cd .medusa/server && npm install --omit=dev --prefer-offline --no-audit --no-fund

# Production: copiamos todo pre-instalado; public/admin ya viene del build (no symlink)
FROM base AS runner
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/.medusa/server ./
RUN test -f /app/public/admin/index.html || (echo "Admin missing in public/admin" && exit 1)
EXPOSE 9000
CMD ["npm", "run", "start"]
