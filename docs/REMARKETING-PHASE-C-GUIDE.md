# Phase C — Exploración guiada PostHog (30-60 min)

Objetivo: **entender qué patrones reales existen en tu data** antes de automatizar. Evita construir reglas de remarketing incorrectas.

No requiere código — solo PostHog UI.

---

## Prerequisito

Estar logueado en https://us.posthog.com/project/393363

---

## Paso 1 — Audit básico (10 min)

### 1.1 ¿Cuántas personas identificadas tenemos?

Ve a: https://us.posthog.com/project/393363/persons

Anota:
- Total de persons
- Cuántas tienen email (identified vs anonymous)
- Distribución geográfica (columna country)

### 1.2 ¿Qué eventos están llegando?

Ve a: https://us.posthog.com/project/393363/activity/explore

Filtra por últimos 7d. Anota los **top 10 eventos por volumen**. Esperable ver:
- `$pageview` (siempre #1)
- `$autocapture`
- `product_viewed`
- `add_to_cart`
- `cart_viewed`
- `checkout_started`
- `$identify`
- `order_placed`

Si alguno no aparece o tiene volumen raro, anótalo.

---

## Paso 2 — Funnel de conversión (10 min)

**Crea un Insight → Funnels:**

Steps:
1. `$pageview` (cualquiera)
2. `product_viewed`
3. `add_to_cart`
4. `checkout_started`
5. `order_placed`

Date range: últimos 30 días.

**Anota:**
- Conversion rate entre cada step
- **¿Dónde está el drop-off más grande?** (→ ahí es donde más urge hacer remarketing)

**Preguntas clave que este funnel te responde:**
- ¿La gente ve productos pero no añade al carrito? → problema de precio/descripción/imágenes
- ¿Añade al carrito pero no inicia checkout? → problema de shipping/trust
- ¿Inicia checkout pero no completa? → problema de pago/conversión técnica

---

## Paso 3 — Top products viewed vs compared (10 min)

**Crea un Insight → Trends:**

- Event: `product_viewed`
- Breakdown by: `product_id` (o `properties.title`)
- Date range: últimos 30 días

Anota los **top 10 productos más vistos**.

**Luego crea otro Trend idéntico pero con event `order_placed`.**

Compara: **¿hay productos que se ven mucho pero NO aparecen en los más vendidos?** Esos son candidatos #1 para remarketing ("viste mucho X, te dejo 10% off").

---

## Paso 4 — Exploración de 3 usuarios específicos (20 min)

### 4.1 Encuentra tus 3 usuarios

En **Medusa admin → Orders**, escoge 3 customers con distintos perfiles:

- **Buyer recurrente:** compró 2+ veces en total
- **One-time buyer:** compró 1 vez hace 30+ días
- **Browser silencioso:** tienes su email pero nunca compró

Si no tienes los 3 perfiles aún (sitio joven), busca los que más se acerquen.

### 4.2 Perfil de cada uno en PostHog

Para cada email:
1. https://us.posthog.com/project/393363/persons → search por email
2. Click en la persona
3. Tab **Events** → ve los últimos 100 events
4. **Observa patrones:**
   - ¿Cuántas sesiones distintas?
   - ¿Qué productos vio más veces?
   - ¿Completó add_to_cart? ¿Inició checkout? ¿Dónde se frenó?
   - ¿Qué horas del día visita?
   - ¿De qué referrer llegó (IG, Google, directo)?

**Anota para cada user:** `email → 2-3 observaciones cortas de su patrón`.

### 4.3 Recording en Clarity (opcional)

Si quieres ver visualmente cómo navegó:
- https://clarity.microsoft.com/projects/view/wfp9s5wh5i/impressions
- Filtra por device/date que corresponda
- Mira 1-2 sesiones de cada perfil

---

## Paso 5 — Cohorts útiles (10 min)

Crea 3 cohorts en PostHog (https://us.posthog.com/project/393363/cohorts):

### Cohort 1 — "Abandoned cart últimos 7d"
- Performed event `add_to_cart` in the last 7 days
- AND did NOT perform event `order_placed` in the last 7 days

Anota: **cuántas personas están en este cohort**.

### Cohort 2 — "Viewed product 3+ times without purchase"
- Performed event `product_viewed` at least 3 times in last 14 days
- AND did NOT perform event `order_placed` in last 14 days

Anota: **cuántas personas**.

### Cohort 3 — "High engagement no convert"
- Performed event `$pageview` at least 20 times in last 30 days
- AND did NOT perform event `order_placed` ever

Anota: **cuántas personas**.

Los números te dicen cuánto tráfico hay para cada tipo de remarketing. Si cohort 1 tiene 50 personas al día, un rule bien diseñado puede recuperar 5-10 ventas/día.

---

## Entregable (lo que me pasas)

Un mensaje/voice note con:

```
Funnel drop-off más grande: [dónde]
Top 5 productos viewed-not-bought: [lista]
3 patrones observados en usuarios específicos:
  1. ...
  2. ...
  3. ...
Cohort sizes:
  - Abandoned cart 7d: X personas
  - 3+ views no purchase: Y
  - High engagement no convert: Z
Sorpresas (cosas que no esperabas): ...
```

Con esto diseño las **reglas concretas** de Phase B (cuáles reglas implementar primero, con qué conditions, qué mensaje envía cada una).

---

## Mientras tanto yo estoy corriendo Batch A1

En paralelo estoy instrumentando 9 eventos nuevos que enriquecen la data:
- `search_performed`, `category_viewed`, `filter_applied`, `product_removed_from_cart`, `variant_selected`, `whatsapp_clicked`, `coupon_applied/failed`, `high_engagement_page`, `scroll_depth`

Para cuando termines la exploración de C, ya tendremos 2x más datos granulares para las reglas.
