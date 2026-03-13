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
RUN npm run build

# Production
FROM base AS runner
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.medusa ./.medusa
# Medusa busca admin en ./public/admin; el build lo genera en .medusa/server/public/admin
RUN ln -s /app/.medusa/server/public /app/public
COPY --from=build /app/package.json ./
COPY --from=build /app/medusa-config.ts ./
COPY --from=build /app/tsconfig.json ./
COPY --from=build /app/src ./src
EXPOSE 9000
CMD ["npm", "run", "start"]
