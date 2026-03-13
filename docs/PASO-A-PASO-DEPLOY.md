# RYO Store – Guía paso a paso (orden cronológico)

## Parte 1: En tu Mac (local)

### 1.1 Subir cambios a GitHub

```bash
cd "/Users/daniellopez/Desktop/ryo store"
git add .
git status
git commit -m "Fix: productos, email, comprobantes, precios"
git push origin main
```

---

### 1.2 Configurar variables en Hostinger / VPS

Antes de hacer deploy, asegúrate de que estas variables estén definidas (Hostinger MCP, `.env` o panel del VPS):

```
POSTGRES_PASSWORD=tu_password_seguro
JWT_SECRET=tu_jwt_secret_largo
COOKIE_SECRET=tu_cookie_secret_largo
NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=pk_xxxxxxxx
CONTACT_EMAIL=hola@ryostore.com
RESEND_API_KEY=re_xxxxxxxxxxxx
RESEND_FROM=RYO Store <noreply@tu-dominio.com>
NEXT_PUBLIC_RECAPTCHA_SITE_KEY=xxx
RECAPTCHA_SECRET_KEY=xxx
BCV_EUR_RATE=510.49
```

**Opcional** – precios 1:1 (si pones 15 en Medusa, ves 15 en la web):

```
NEXT_PUBLIC_PRICE_DIVISOR=1
```

---

## Parte 2: En el VPS (SSH)

Conéctate por SSH al VPS (ejemplo para Hostinger):

```bash
ssh root@srv977695.hstgr.cloud
# o
ssh root@72.60.114.242
```

---

### 2.1 Configurar Git (solo primera vez)

```bash
git config --global --add safe.directory /root/ryo-store
```

---

### 2.2 Ir al proyecto y actualizar código

```bash
cd ~/ryo-store
git pull origin main
```

---

### 2.3 Reconstruir imagen del storefront

```bash
cd ~/ryo-store
docker buildx build --provenance=false --load -f storefront/Dockerfile -t ryo-store-storefront ./storefront
```

Espera a que termine el build (puede tardar varios minutos).

---

### 2.4 Levantar/actualizar contenedores

```bash
cd ~/ryo-store
docker compose up -d --force-recreate storefront
```

---

### 2.5 Comprobar que todo está arriba

```bash
docker compose ps
```

Todos los servicios deben aparecer como `Up`.

---

### 2.6 Verificar variables de entorno del storefront

```bash
docker compose exec storefront env | grep -E "PUBLISHABLE|BACKEND|RESEND|PRICE"
```

Confirma que existan: `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY`, `NEXT_PUBLIC_MEDUSA_BACKEND_URL`, `RESEND_API_KEY`, `RESEND_FROM`.

---

## Parte 3: Configuración en Medusa Admin

Abre en el navegador: **https://api.enrola.shop/app**

### 3.1 Comprobar que los productos se muestren

1. **Products** → productos publicados (no en borrador).
2. **Settings → Sales Channels** → productos en el canal por defecto.
3. **Settings → Regions** → Venezuela con precios definidos para cada producto.

### 3.2 Comprobar envíos

1. **Settings → Stock Locations** → ubicación con Fulfillment Provider **Manual** activo.
2. **Service Zones** → zona con Venezuela y opciones de envío creadas.

### 3.3 Crear usuario admin (si hace falta)

```bash
cd ~/ryo-store

# Borrar invite pendiente (opcional)
docker compose exec postgres psql -U medusa -d medusa -c "DELETE FROM invite WHERE email = 'tu@email.com';"

# Crear nuevo invite
docker compose exec medusa npx medusa user -e tu@email.com -p "TuPasswordSeguro" --invite
```

Copia la URL que imprima el comando (sin saltos de línea) y ábrela en el navegador.

---

## Parte 4: DNS y SSL (Cloudflare, opcional)

### 4.1 En tu Mac o navegador

1. Entra en [dash.cloudflare.com](https://dash.cloudflare.com).
2. **Add site** → `enrola.shop`.
3. Plan **Free**.
4. Anota los nameservers (p. ej. `ada.ns.cloudflare.com`, `bob.ns.cloudflare.com`).

### 4.2 En tu registrador (Hostinger, etc.)

1. Dominio `enrola.shop` → **Manage** → **Nameservers**.
2. Cambia los actuales por los de Cloudflare.
3. Guarda y espera 1–24 horas a la propagación.

### 4.3 En Cloudflare (cuando la propagación esté activa)

1. **DNS** → Registros A:

   | Type | Name | Content        | Proxy      |
   |------|------|----------------|------------|
   | A    | @    | 72.60.114.242 | Proxied    |
   | A    | www  | 72.60.114.242 | Proxied    |
   | A    | api  | 72.60.114.242 | Proxied    |

2. **SSL/TLS** → Overview → **Full (strict)**.
3. **Caching** → Configuration → **Standard**.

---

## Parte 5: Scripts de configuración (VPS, cuando haga falta)

### 5.1 Región Venezuela

```bash
cd ~/ryo-store
docker compose exec medusa npx medusa exec ./src/scripts/setup-venezuela.ts
```

### 5.2 Envíos (Inmediato, MRW, etc.)

```bash
cd ~/ryo-store
docker compose exec medusa npx medusa exec ./src/scripts/add-venezuela-shipping.ts
```

### 5.3 Sales channels y stock locations

```bash
cd ~/ryo-store
docker compose exec medusa npx medusa exec ./src/scripts/fix-sales-channel-stock-location.ts
```

---

## Parte 6: Comprobar que todo funcione

### 6.1 Tienda

- https://enrola.shop  
- https://www.enrola.shop  

### 6.2 API y Admin

- https://api.enrola.shop  
- https://api.enrola.shop/app  

### 6.3 Probar checkout

1. Añadir producto al carrito.
2. Ir al checkout.
3. Completar datos y subir comprobante de pago.
4. Verificar:
   - Página de gracias.
   - Email de confirmación.
   - Imagen del comprobante en Medusa Admin (detalle del pedido).

---

## Resumen de comandos (solo VPS)

```bash
git config --global --add safe.directory /root/ryo-store
cd ~/ryo-store
git pull origin main
docker buildx build --provenance=false --load -f storefront/Dockerfile -t ryo-store-storefront ./storefront
docker compose up -d --force-recreate storefront
```

---

## Si algo falla

- **Productos no aparecen:** revisar sales channel, región Venezuela y precios en Medusa Admin.
- **No llega el email:** comprobar `RESEND_API_KEY` y `RESEND_FROM` en el storefront.
- **Comprobante 404:** confirmar volumen `payment_proofs` en `docker-compose` y que se haya hecho `docker compose up -d --force-recreate storefront`.
- **Logs:**
  - `docker compose logs medusa -f`
  - `docker compose logs storefront -f`
