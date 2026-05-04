# Enrola Panel

Admin panel custom de Enrola Shop. Next.js 15 standalone que consume la
Medusa Admin API. Desplegado en `https://panel.enrola.shop`.

> El motor de Medusa (módulos, workflows, subscribers, jobs, DB) sigue
> siendo el mismo. Este panel **solo reemplaza la UI** del dashboard de
> Medusa por una experiencia hecha a medida para Enrola.

---

## Stack

| Pieza | Razón |
|---|---|
| **Next.js 15 (App Router)** | Mismo stack que el storefront — cero curva. Server Components para data fetching seguro. |
| **Tailwind 3.4** | Utility-first + tokens de marca compartidos con storefront. |
| **Kanit + Inter + JetBrains Mono** | Display vintage / texto denso / mono para datos. |
| **lucide-react** | Iconos consistentes, ya usados en storefront. |
| **jose** | Verificación JWT (auth cookie). Edge-runtime safe. |
| **Sin SDK de Medusa** | Cliente propio en `src/lib/medusa.ts` — control total sobre auth y cero deps client-side. |

---

## Estructura

```
panel/
├── mockups/              ← HTML estático con todas las pantallas (review previo)
├── public/               ← Logo, favicons, assets
├── src/
│   ├── app/
│   │   ├── layout.tsx          ← root: fonts + globals
│   │   ├── page.tsx            ← redirect a /dashboard
│   │   ├── globals.css         ← tokens + dark mode + custom classes
│   │   ├── login/page.tsx      ← login screen pública
│   │   ├── (panel)/            ← layout group autenticado
│   │   │   ├── layout.tsx      ← sidebar + topbar shell
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── orders/page.tsx
│   │   │   ├── orders/[id]/page.tsx
│   │   │   ├── products/page.tsx
│   │   │   ├── inventory/page.tsx
│   │   │   ├── customers/page.tsx
│   │   │   ├── finanzas/page.tsx
│   │   │   ├── marketing/page.tsx
│   │   │   ├── loyalty/page.tsx
│   │   │   ├── social/page.tsx
│   │   │   ├── webmail/page.tsx
│   │   │   └── settings/page.tsx
│   │   └── api/auth/{login,logout,me}/route.ts
│   ├── components/
│   │   ├── layout/{Sidebar,TopBar,ComingSoonScreen}.tsx
│   │   └── ui/Sparkline.tsx
│   ├── lib/{auth,medusa,utils}.ts
│   └── middleware.ts           ← gate /(panel)/* detrás de cookie válida
├── deploy/
│   ├── docker-compose.snippet.yml
│   └── nginx-panel.conf
├── Dockerfile
├── tailwind.config.ts
├── next.config.ts
└── tsconfig.json
```

---

## Local development

### 1. Instalar deps

```bash
cd panel
npm install
```

### 2. Configurar `.env.local`

```bash
cp .env.example .env.local
# luego editar .env.local
```

Mínimo necesario:

```env
MEDUSA_ADMIN_URL=http://localhost:9000
PANEL_SESSION_SECRET=$(openssl rand -base64 48)
PANEL_COOKIE_SECURE=false
```

### 3. Correr

```bash
npm run dev
```

Abre `http://localhost:3001`. El middleware te redirige a `/login`.
Usa las credenciales de tu admin en Medusa (mismas que `api.enrola.shop/dashboard`).

> Si Medusa no está corriendo localmente, apunta `MEDUSA_ADMIN_URL` a
> staging o al VPS via SSH tunnel: `ssh -L 9000:localhost:9000 root@vps`.

---

## Deploy en el VPS

### Pre-requisitos

- DNS: `panel.enrola.shop` apuntando a la IP del VPS (A record)
- SSH key disponible en `~/.ssh/vps_ryo` (o agent configurado)
- Generar el secreto de cookie:
  ```bash
  openssl rand -base64 48
  ```
- Añadir al archivo `/root/ryo-store/.env` del VPS:
  ```env
  PANEL_SESSION_SECRET=...   # del openssl rand de arriba
  RESEND_API_KEY=re_...      # si quieres /webmail real (B6)
  RESEND_FROM_ADDRESS=Enrola <hola@enrola.shop>
  ```

### Deploy automático (recomendado)

```bash
cd panel
./deploy.sh
```

El script hace todo: rsync + build + `up -d --no-deps panel` + tail de logs.
Sin tocar medusa/postgres/redis. Idempotente. Lee la key de `~/.ssh/vps_ryo` o
del SSH agent.

### Deploy manual

```bash
# 1. Subir código (sin node_modules ni .next — los reconstruye el VPS)
rsync -avz --delete \
  --exclude 'node_modules' --exclude '.next' \
  -e "ssh -i ~/.ssh/vps_ryo" \
  panel/ root@72.60.114.242:/root/ryo-store/panel/

# 2. Build (no toca medusa)
ssh -i ~/.ssh/vps_ryo root@72.60.114.242 \
  "cd /root/ryo-store && docker compose build panel"

# 3. Up CON --no-deps (ver Gotchas más abajo)
ssh -i ~/.ssh/vps_ryo root@72.60.114.242 \
  "cd /root/ryo-store && docker compose up -d --no-deps panel"

# 4. Logs
ssh -i ~/.ssh/vps_ryo root@72.60.114.242 \
  "docker logs -f ryo-store-panel-1"
```

### Setup inicial (sólo primera vez)

1. **Pega el bloque del panel** en `/root/ryo-store/docker-compose.yml` (snippet
   en `deploy/docker-compose.snippet.yml`).
2. **Routing**: usamos Traefik (no nginx). El bloque del compose ya tiene los
   labels para que Traefik genere cert Let's Encrypt automático y route
   `panel.enrola.shop` → puerto 3001 del container. NO hace falta nginx.
3. Primer deploy con `./deploy.sh`.

---

## ⚠️ Gotchas / cosas que han mordido

### NUNCA hagas `docker compose up -d panel` sin `--no-deps`

Compose v2 sigue `depends_on: medusa`. Si hay cualquier cambio uncommitted
en `backend/` (Dockerfile, package.json, src/), `compose up panel` **rebuild
y recrea medusa también**. Esto ya nos rompió producción una vez:

> **Caso real (mayo 2026)**: rebuild de medusa tomó cambios uncommitted en
> `backend/src/jobs/finanzas-monthly-close.ts`. El job tenía `export default`
> pero su `export const config` estaba **comentado a propósito** (deshabilitado
> hace meses por bug que generó 906k ejecuciones en 24h). Medusa 2.13 ahora
> exige `config` en cada archivo de `/jobs/` — antes era opcional. Resultado:
> `Config is required for scheduled jobs` → crash loop → API caída → panel
> server-side fetches fallan → Chrome marca el sitio como "no seguro" aunque
> el cert sea válido.
>
> **Fix permanente**: archivos que NO deben ser scheduled jobs van fuera de
> `backend/src/jobs/`. Movido a `backend/src/lib/`.

### Si una pantalla rompe con "Could not find the module ... React Client Manifest"

**Es caché del Docker BuildKit.** Un caso real (mayo 2026): el archivo
`CreateInventoryItem.tsx` recién añadido se rsyncó al VPS, el `docker compose
build panel` corrió OK, pero el `npm run build` de Next dentro del Docker
**reusó el resultado del build anterior** sin regenerar el client manifest.
El componente queda referenciado en page.tsx pero no existe en
`page_client-reference-manifest.js` → runtime crash.

**Fix:** rebuild con `--no-cache`:

```bash
ssh -i ~/.ssh/vps_ryo root@72.60.114.242 \
  "cd /root/ryo-store && docker compose build --no-cache panel && docker compose up -d --no-deps panel"
```

El `deploy.sh` ya hace esto siempre, pero si ejecutas el rebuild a mano,
acuérdate del flag.

### Si Chrome dice "No es seguro" pero el cert es válido

Casi siempre significa que **Medusa está caído** y los fetches server-side del
panel están fallando. Comprueba:

```bash
ssh -i ~/.ssh/vps_ryo root@72.60.114.242 \
  'docker compose -f /root/ryo-store/docker-compose.yml ps medusa --format "{{.Status}}"'
curl -sS https://api.enrola.shop/health
```

Si medusa está restarting o /health no responde 200, el panel se ve roto
aunque el TLS esté bien. Busca el error en `docker logs ryo-store-medusa-1`.

### Cert TLS

Lo emite Traefik vía Let's Encrypt TLS-ALPN-01 (ver labels en compose snippet).
Renovación automática. Si por alguna razón Traefik no logra emitirlo:

```bash
ssh -i ~/.ssh/vps_ryo root@72.60.114.242 'docker logs traefik 2>&1 | grep -i "panel.enrola"'
```

---

## Auth model

El panel **no almacena tu password**. El flujo:

1. **Login form** envía `{email, password}` a `/api/auth/login`.
2. Esa API hace `POST https://api.enrola.shop/auth/user/emailpass` (Medusa).
3. Medusa devuelve un JWT bearer.
4. El panel **firma una cookie nueva** con su propio secret (`PANEL_SESSION_SECRET`),
   guardando el bearer dentro del payload + email/userId.
5. Cookie es **httpOnly + samesite=lax + secure (en prod)** — el JS del browser nunca la ve.
6. En cada request server-side, el middleware verifica la cookie. Si válida,
   el handler usa el bearer para llamar a Medusa Admin API.

**Beneficios**:
- XSS no puede robar el token (httpOnly)
- Logout instantáneo (borrar cookie)
- TTL independiente de Medusa (8h aquí vs. lo que Medusa configure)

---

## ¿Qué falta?

### Pantallas conectadas a datos reales

Estas ya están en JSX puro y solo esperan wiring:
- ✅ Login (real, conecta a Medusa)
- ✅ Dashboard (mock data)
- ✅ Pedidos lista (mock data)
- ✅ Pedido detalle (mock data)

### Pantallas pendientes (mostrando "Coming Soon")
- Productos, Inventario, Clientes
- Finanzas, Marketing, Loyalty
- Social, Webmail, Configuración

Todas tienen su mockup HTML completo en `mockups/index.html` — son JSX
mecánicos a portar. El plan: 1 pantalla = 1 PR pequeño.

### Features futuras

- [ ] Cmd+K palette global (saltar a cualquier orden/producto/cliente)
- [ ] Atajos de teclado (`j`/`k` en listas, `e` editar, `?` ayuda)
- [ ] Real-time notifications (SSE desde el backend cuando hay nuevos pedidos)
- [ ] Toggle manual de tema (override del prefers-color-scheme)
- [ ] Multi-usuario con roles (Owner / Admin / Operador)
- [ ] Tests E2E con Playwright en flujos críticos

---

## Lema interno

> El motor de Medusa funciona impecable. Lo único que cambia es la UI.
> Si el panel cae, `api.enrola.shop/dashboard` sigue ahí como escape hatch
> hasta que el panel vuelva a arriba.
