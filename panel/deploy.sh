#!/usr/bin/env bash
#
# Deploy del panel al VPS de Hostinger.
#
# Uso:
#   cd panel
#   ./deploy.sh
#
# Pre-requisitos:
#   - Acceso SSH a root@72.60.114.242 (clave en ~/.ssh/vps_ryo o passwd)
#   - El panel/ ya existe en /root/ryo-store/panel del VPS
#   - El bloque del panel ya está en /root/ryo-store/docker-compose.yml
#   - PANEL_SESSION_SECRET ya está en /root/ryo-store/.env
#   - (opcional B6) RESEND_API_KEY + RESEND_FROM_ADDRESS en /root/ryo-store/.env
#
# Flujo:
#   1. rsync del panel/ (excluyendo node_modules y .next — el VPS reconstruye)
#   2. docker compose build panel
#   3. docker compose up -d --no-deps panel    ← CRÍTICO: sin --no-deps
#                                                 compose v2 puede recrear
#                                                 medusa también si tiene
#                                                 cambios pendientes en
#                                                 backend/, lo cual puede
#                                                 dejarlo en crash loop si
#                                                 hay código uncommitted
#                                                 incompleto en /backend/.
#                                                 Ver "Gotchas" en README.md
#   4. Tail de logs para verificar healthy
#
# IMPORTANTE: este script SOLO toca el contenedor `panel`. Si quieres
# redesplegar también medusa o storefront, hazlo aparte y conscientemente.
#

set -euo pipefail

VPS_HOST="${VPS_HOST:-root@72.60.114.242}"
VPS_PATH="${VPS_PATH:-/root/ryo-store}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/vps_ryo}"
PANEL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Si la key no existe, dejamos que ssh use el default agent
SSH_OPTS=()
if [ -f "$SSH_KEY" ]; then
  SSH_OPTS+=("-i" "$SSH_KEY")
fi

echo "→ Deploy de panel desde: $PANEL_DIR"
echo "→ Destino:               $VPS_HOST:$VPS_PATH/panel/"
echo "→ SSH key:               ${SSH_KEY:-default agent}"
echo

# 1. Sync (excluye builds y deps locales — el VPS reconstruye)
echo "─── 1/4  rsync ─────────────────────────────────────────"
rsync -avz --delete \
  -e "ssh ${SSH_OPTS[*]:-}" \
  --exclude 'node_modules' \
  --exclude '.next' \
  --exclude 'tsconfig.tsbuildinfo' \
  --exclude '.env.local' \
  --exclude '.DS_Store' \
  --exclude 'mockups' \
  --exclude 'deploy.sh' \
  "$PANEL_DIR/" "$VPS_HOST:$VPS_PATH/panel/"

# 2. Build (sólo la imagen del panel, no toca medusa)
#
# ⚠️ Usamos --no-cache en panel SIEMPRE porque vimos un caso real
# (mayo 2026) donde Docker BuildKit reusaba el layer de `npm run build`
# aunque añadiéramos archivos nuevos client components, dejándolos fuera
# del client-reference-manifest. Resultado en runtime:
#   "Could not find the module ... in the React Client Manifest"
# El build de Next es ~80s, asumible.
echo
echo "─── 2/4  docker compose build --no-cache panel ───────"
ssh "${SSH_OPTS[@]}" "$VPS_HOST" "cd $VPS_PATH && docker compose build --no-cache panel"

# 3. Up con --no-deps (no recrear medusa/postgres/redis aunque dependa de ellos)
#
# ⚠️ NUNCA quitar --no-deps. Sin él, compose v2 puede rebuild + recreate
#    medusa si detecta cambios en backend/, lo que ha dejado el server en
#    crash loop antes (ej. job sin export const config en backend/src/jobs/).
#
echo
echo "─── 3/4  docker compose up -d --no-deps panel ────────"
ssh "${SSH_OPTS[@]}" "$VPS_HOST" "cd $VPS_PATH && docker compose up -d --no-deps panel"

# 4. Logs
echo
echo "─── 4/4  últimos logs (Ctrl+C para salir) ────────────"
ssh "${SSH_OPTS[@]}" "$VPS_HOST" "docker compose -f $VPS_PATH/docker-compose.yml logs --tail=50 -f panel"
