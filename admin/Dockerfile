# Admin standalone - se sirve en admin.enrola.shop (raíz) para evitar problemas de rutas
FROM node:25-alpine AS base
WORKDIR /app

# Dependencies con Yarn (npm se cuelga con deps Medusa)
FROM base AS deps
COPY backend/package.json ./
RUN node -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync('package.json','utf8'));delete p.packageManager;fs.writeFileSync('package.json',JSON.stringify(p,null,2))"
RUN corepack enable && corepack prepare yarn@1.22.22 --activate
RUN yarn install --ignore-scripts

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY backend/ ./
ENV MEDUSA_ADMIN_BACKEND_URL=https://api.enrola.shop
ARG NODE_OPTIONS=--max-old-space-size=2048
RUN npx medusa build --admin-only

FROM nginx:alpine
COPY --from=build /app/.medusa/admin /usr/share/nginx/html
COPY admin/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
