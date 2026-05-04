#!/bin/bash
# Subir todo el proyecto al VPS (ejecutar desde la carpeta del proyecto en tu Mac)
set -e
VPS="root@72.60.114.242"
REMOTE="/root/ryo-store"
LOCAL="/Users/daniellopez/Desktop/ryo store"

echo "Subiendo backend..."
rsync -avz --exclude node_modules --exclude .medusa --exclude .git "$LOCAL/backend/" "$VPS:$REMOTE/backend/"

echo "Subiendo storefront..."
rsync -avz --exclude node_modules --exclude .next --exclude .git "$LOCAL/storefront/" "$VPS:$REMOTE/storefront/"

echo "Subiendo admin..."
rsync -avz "$LOCAL/admin/" "$VPS:$REMOTE/admin/"

echo "Subiendo docker-compose y .dockerignore..."
rsync -avz "$LOCAL/docker-compose.yml" "$LOCAL/.dockerignore" "$VPS:$REMOTE/"

echo "Listo. En el VPS ejecuta:"
echo "  cd /root/ryo-store"
echo "  docker compose build storefront admin --no-cache"
echo "  docker compose up -d"
