# Despliegue RYO Store en Hostinger VPS

## Requisitos

- VPS con n8n ya corriendo (proyecto `n8n` con Traefik)
- Dominio `enrola.shop` apuntando al VPS

## 1. Configurar DNS

En tu proveedor de DNS (donde está enrola.shop), crea estos registros **A**:

| Tipo | Nombre | Valor          | TTL |
|------|--------|----------------|-----|
| A    | @      | 72.60.114.242  | 3600 |
| A    | www    | 72.60.114.242  | 3600 |
| A    | api    | 72.60.114.242  | 3600 |

> **IP del VPS:** 72.60.114.242 (srv977695). Si usas otro VPS, cambia la IP.

**Nota:** Si usas `ns1.dns-parking.com` y `ns2.dns-parking.com` como nameservers, asegúrate de crear los registros A en el panel de DNS de tu proveedor (Hostinger, Cloudflare, etc.) antes de cambiar los nameservers.

## 2. Subir el proyecto a GitHub

```bash
cd "/Users/daniellopez/Desktop/ryo store"
git init
git add .
git commit -m "Initial deploy"
git remote add origin https://github.com/TU_USUARIO/TU_REPO.git
git push -u origin main
```

## 3. Crear el proyecto en Hostinger

Usa el MCP de Hostinger o el panel:

- **project_name:** `ryo-store`
- **content:** `https://github.com/TU_USUARIO/TU_REPO`
- **environment:** (variables en formato KEY=VALUE, una por línea)

```
POSTGRES_PASSWORD=una_password_segura
JWT_SECRET=otro_secret_largo
COOKIE_SECRET=otro_secret_largo
NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=pk_2b8bf1204d065793b1c08f29b64d02809e325165a7cc0b6ae92687f089703134
CONTACT_EMAIL=hola@ryostore.com
RESEND_API_KEY=tu_resend_key
RESEND_FROM=RYO Store <onboarding@resend.dev>
NEXT_PUBLIC_RECAPTCHA_SITE_KEY=tu_recaptcha_site_key
RECAPTCHA_SECRET_KEY=tu_recaptcha_secret_key
BCV_EUR_RATE=510.49
```

## 4. Red compartida

El proyecto `ryo-store` usa la red `n8n_default` (creada por el proyecto n8n). Asegúrate de que n8n esté corriendo antes de desplegar ryo-store.

## 5. Migrar base de datos (primera vez)

Tras el primer deploy, entra al contenedor de Medusa y ejecuta las migraciones y seed:

```bash
# Conectarte por SSH al VPS, luego:
docker exec -it ryo-store-medusa-1 sh
npx medusa db:migrate
npx medusa exec ./src/scripts/seed.ts
npx medusa exec ./src/scripts/add-venezuela-shipping.ts
exit
```

## URLs

- **Tienda:** https://enrola.shop
- **API/Admin:** https://api.enrola.shop
- **n8n:** https://n8n.srv977695.hstgr.cloud (sin cambios)
