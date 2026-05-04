# Phase C — Hallazgos de exploración PostHog

**Ejecutado:** 2026-04-24 por Claude
**Periodo analizado:** últimos 30 días (datos reales disponibles)
**Método:** HogQL queries vía Personal API key

---

## ⚠️ Contexto primero

El dataset es **muy pequeño aún** (272 eventos totales, 2 usuarios identificados reales), así que los "patrones" aquí son señales de UN caso específico + forma del funnel, no estadísticas generalizables. **La buena noticia:** ese caso concreto es un retrato-robot perfecto de abandono que vale oro para diseñar las reglas de Phase B.

---

## 1 · Audit básico

| Métrica | Valor |
|---|---|
| Total events (histórico) | 272 |
| Persons total | 6 (4 son tests CLI míos, **2 son reales**) |
| Persons con email identificado | 2 |
| Events últimos 7d | ~270 |

**Personas reales con email:**

| Email | Primera visita | Geo | Canal inicial |
|---|---|---|---|
| `francisfratta2022@outlook.com` | 2026-04-23 | 🇻🇪 Caracas, Mobile Safari iOS | Instagram link-in-bio |
| `test@enrola.shop` | 2026-04-22 | 🇺🇸 New York (mi test CLI) | — |

**Top events 7d:**
```
126  $autocapture      (clicks automáticos)
 65  $web_vitals        (CWV)
 60  $pageview          (navegación)
  8  product_viewed
  2  $identify          (logins reales post-signup)
  2  add_to_cart
  2  checkout_started
  1  cart_viewed
  1  $rageclick         ⚠️ frustración en /
```

---

## 2 · Funnel de conversión 30d (usuarios únicos)

```
$pageview           57 users  ████████████████████████████████████
product_viewed       3 users  ██  (-95% drop)         ← ⚠️ drop-off brutal
add_to_cart          1 user   █   (-67%)
checkout_started     1 user   █   (-0%)
order_placed         0 users      (-100%)             ← ⚠️ cero conversiones
```

### Interpretación

- **Drop-off catastrófico: pageview → product_viewed (95%)**. Es la señal más fuerte.
  - Posibles causas: 45 de esos 57 pageviews son desde IP de US (muy probable bots/crawlers: Google, Meta, etc). Sin eso quedan ~12 visitantes humanos, de los cuales 3 sí llegaron a PDP (25%, más razonable).
  - Acción: filtrar bots en futuras queries. **Recomendación:** habilitar filtro "Bot" en PostHog Project Settings.
- **Drop-off add_to_cart → order_placed (100%)**. El único que añadió al carrito no completó compra. **→ el caso francisfratta.**

---

## 3 · Tráfico por origen y dispositivo

### Por referrer inicial

| Referrer | Pageviews | Usuarios |
|---|---|---|
| `$direct` | 47 | 47 |
| `l.instagram.com` | 13 | 10 |

### Por UTM (tráfico atribuido)

| Source | Content | Pageviews | Usuarios |
|---|---|---|---|
| `ig` | `link_in_bio` | 11 | 8 |

**Insight:** el único canal medible con atribución es Instagram link-in-bio. Todo lo demás es "direct" (gente tipeando URL o crawlers).

### Por dispositivo

| Device | Pageviews | Usuarios | % |
|---|---|---|---|
| Mobile | 36 | 33 | **60%** |
| Desktop | 24 | 24 | 40% |

**Mobile domina.** Significativo para UX de checkout.

### Por geografía

| País / Ciudad | Pageviews | Usuarios |
|---|---|---|
| 🇺🇸 US / (unknown) | 45 | 45 | ← **casi seguro bots** |
| 🇻🇪 Venezuela / Caracas | 6 | 4 |
| 🇻🇪 Venezuela / Valencia | 4 | 4 |
| 🇻🇪 Venezuela / Maracaibo | 1 | 1 |
| 🇻🇪 Venezuela / Guacara | 1 | 1 |
| 🇸🇬 Singapore | 1 | 1 |

**Tráfico humano real VE:** ~13 pvs de ~8 users reales. Coincide con tamaño esperado de un sitio lanzado hace ~3 semanas.

---

## 4 · Top products

### Most viewed (con DOM de nombre actualizado desde Batch A1)

```
2 views · 2 users · Rolling Paper Marrón
2 views · 1 user  · Grinder Rellenador de Conos con Portaconos
1 view  · 1 user  · Grinder Plástico 60mm
1 view  · 1 user  · Conos Celulosa Alien Puff — 12 uds
1 view  · 1 user  · Rolling Paper Sabores Alien Puff
1 view  · 1 user  · Rolling Paper Celulosa Transparente
```

### Added to cart

```
1 add · 1 user · Grinder Plástico 60mm
1 add · 1 user · Rolling Paper Celulosa Transparente
```

### Gap "viewed-not-bought"

- **Rolling Paper Marrón** — 2 views desde 2 personas, 0 adds al carrito. Producto interesa pero no suficiente para comprar → candidato a descripción/fotos mejoradas
- **Grinder Rellenador de Conos con Portaconos** — 2 views desde la MISMA persona (francisfratta2022), 0 adds → perdió interés después de verlo dos veces

---

## 5 · 🔍 Caso de estudio: **francisfratta2022@outlook.com**

**La única visita humana completa medida, y es un retrato-robot perfecto de abandoned checkout.**

### Cronología (99 eventos totales)

| Hora | Acción | Interpretación |
|---|---|---|
| 12:51:24 | Llega a `/?utm_source=ig&utm_content=link_in_bio` desde Mobile Safari iOS | 📱 **Instagram, mobile, Venezuela (Caracas)** |
| 12:52:25 | Navega a `/tienda` | Explorando |
| 12:52:54 | **product_viewed** grinder-rellenador-conos | Primer PDP |
| 12:54:01 | **product_viewed** grinder-rellenador-conos (2ª vez) | Volvió al mismo — duda |
| 12:55:09 | **product_viewed** papel-sabores-alien-puff | Browse rápido |
| 12:55:15 | **product_viewed** rolling-paper (marrón) | 6 segundos después — browsing serio |
| 12:56:13 | **product_viewed** papel-celulosa-transparente | — |
| **12:56:40** | **✅ add_to_cart** Rolling Paper Celulosa Transparente × 1 | **Primer add!** |
| 12:56:47 | **product_viewed** grinder-plastico | Sigue browseando |
| **12:56:50** | **✅ add_to_cart** Grinder Plástico 60mm × 1 | **Segundo add, 10s después** — intent altísimo |
| 12:57:00 | 5 clicks rápidos en PDP del grinder | Explorando variantes |
| 12:57:30 | **cart_viewed** (drawer) | Abre el carrito |
| **12:57:56** | **✅ checkout_started** → `/checkout` | Arranca checkout |
| 12:58:36 | Redirect a `/registro?redirect=/checkout` | ⚠️ **Registro forzado** |
| 12:58-13:00 | **~1.5 MIN llenando form de registro** | Muchos autocapture, claro que batalló |
| 13:00:10 | **$identify** como `francisfratta2022@outlook.com` | ✅ Signup exitoso |
| 13:00:10 | **checkout_started** (segunda vez) | Vuelve a checkout |
| 13:00:14 — 13:04:42 | **~4.5 MIN en /checkout**, 60 eventos autocapture | ⚠️ **Llenando dirección, pago, probando cosas** |
| 13:04:42 | 🛑 **Último evento. Se fue sin comprar.** | Abandono total |

### Diagnóstico

- **7 min gastados en checkout** (mobile, desde Instagram, primera vez en el sitio)
- **Fricción clave:** registro forzado antes de checkout (1.5 min solo ahí)
- **60+ autocapture events en /checkout** = muchos clicks, probablemente rellenando form difícil
- **No hay `payment_proof_uploaded`** — se frenó ANTES de subir el comprobante de pago
- **Hipótesis probable:** dirección de envío en VE + montos en €/BCV + flujo mobile complicado = abandonó por fricción, no por precio

### 💰 Oportunidad inmediata

**francisfratta2022@outlook.com es EL candidato #1 para remarketing manual HOY:**
- Email identificado ✅
- Intent ALTÍSIMO (5 products viewed, 2 add_to_cart, 7 min en checkout)
- Abandono reciente (un día)
- Sabemos exactamente qué iba a comprar: **Rolling Paper Celulosa Transparente + Grinder Plástico 60mm**

**Acción sugerida ahora mismo:** manda un WhatsApp/email a mano con:
> "Hola Francis, vi que ayer nos visitaste e ibas a llevarte el Rolling Paper Celulosa + Grinder Plástico. ¿Tuviste algún problema en el pago? Te puedo ayudar a completar el pedido por aquí, incluso te dejo envío gratis 🎁"

Si contesta → tienes tu primera venta. Si no → validaste que el flujo de checkout mobile tiene fricciones.

---

## 6 · Signals operacionales

- **1 rageclick en `/` (home)** — alguien se frustró en la home. Worth checking en Clarity
- **0 excepciones JS** — el código no rompió en prod
- **65 eventos `$web_vitals`** — CWV se está capturando bien

---

## 7 · Conclusiones + recomendaciones para Phase B

### Lo que la data muestra (con tamaño de muestra minúsculo pero igual claro):

1. **Registro forzado pre-checkout es un killer de conversión**. 1.5 min solo en form cuando ya tenía el carrito armado = fricción mayor.
   - **Recomendación inmediata:** implementar **guest checkout** (email + datos de envío sin crear cuenta). Crear la cuenta ASÍNCRONO post-compra.

2. **Checkout mobile es largo** (7 min promedio en la única sesión medida).
   - **Recomendación:** revisar Clarity recording de francisfratta (filtro mobile iOS Safari día 2026-04-23) para ver visualmente qué pasó.

3. **Instagram es el canal primario**. Todos los users humanos reales llegaron de ahí.
   - **Recomendación:** reforzar Instagram + considerar un link-in-bio service con tracking mejor (Beacons, Linktree pro) O un landing page custom `/ig` con flujo más directo al producto.

4. **45 de 57 "pageviews" desde US son probablemente bots**. Filtrar en PostHog settings (Project Settings → Bot filtering).

### Reglas de Phase B priorizadas por evidencia real:

#### 🥇 Regla #1 — **"Abandoned checkout mobile Instagram"** (basada en patrón francisfratta)

```
Trigger: checkout_started hace 2-48h
  AND NOT order_placed
  AND session_duration_in_checkout > 3 min
  AND device = mobile
  AND initial_utm_source = ig
  AND email identificado (después del $identify)
Canal: WhatsApp (personalizado, humano-style)
Mensaje: "Hola {first_name}, vi que te interesaron {product_titles}.
          ¿Problemas con el pago? Te ayudo por aquí 🎁"
Cooldown: 14 días
```

Target actual: **francisfratta2022@outlook.com** (puedes hacerlo manual AHORA mismo mientras construimos el motor)

#### 🥈 Regla #2 — **"Add to cart sin compra"** (clásico abandoned cart mejorado)

```
Trigger: add_to_cart hace 2-48h
  AND NOT order_placed mismo periodo
  AND cart_value > $5
Canal: Email a 2h + WhatsApp a 24h
Mensaje: email con productos + 10% off código
         WhatsApp short + link directo
Cooldown: 14 días
```

#### 🥉 Regla #3 — **"Multi-view no convert"** (indicador de deseo bloqueado)

```
Trigger: product_viewed 3+ veces mismo SKU últimos 7d
  AND NO add_to_cart ese SKU
Canal: Email
Mensaje: "Vi que {title} te llamó la atención — te cuento lo que
          otros clientes dicen + 10% off 48h"
Cooldown: 30 días
```

#### Reglas secundarias (para construir después):

- **Restock due** — cuando el dataset de orders crezca y podamos calcular ciclos reales de compra
- **Win-back 60d** — ya existe como cron job, sólo migrar a PostHog cohort para atribución
- **High engagement no convert** — cohort PostHog + alerta manual al equipo

---

## 8 · Números de cohorts potenciales (para Phase B dimensionar)

Con data actual es impreciso, pero el orden de magnitud:

| Cohort | Users este mes | Tamaño estimado a 30 días post-lanzamiento sostenido |
|---|---|---|
| Abandoned checkout mobile IG | **1** (francisfratta) | ~20-50/mes si mantienes el flujo de IG |
| Add-to-cart without order | **1** | ~30-80/mes |
| 3+ product_views no add-to-cart | 0 (nadie llegó aún) | ~50-100/mes |
| High engagement no convert | 0 | ~10-20/mes |

**Conclusión:** con los volúmenes esperados, el motor de remarketing debería generar 2-5 mensajes/día en promedio cuando el negocio alcance cruise speed. Eso es muy manejable y cada disparo tiene alta probabilidad de conversión por ser 1:1.

---

## 9 · Próximos pasos recomendados

### Inmediato (hoy, sin código):

1. **Contactar a francisfratta2022@outlook.com manualmente** (WhatsApp/email). Resultado real te enseñará más que 10h de código.
2. **Activar bot filtering** en PostHog Project Settings → "Filter out bots" para que el funnel sea más limpio.
3. **Revisar Clarity recording** del 2026-04-23 mobile iOS Caracas → ver qué le frenó en checkout.

### Esta semana (con código):

4. **Batch A2** — endpoint `/admin/remarketing/user360` con el caso de francisfratta como test case perfecto.
5. **Batch A3** — UI Customer 360 sub-tab.
6. **Explorar implementar guest checkout** — probablemente el mayor lift de conversión posible.

### Próximas 2 semanas:

7. **Batch B** — motor de reglas con las 3 reglas priorizadas arriba.
8. Re-run de Phase C con 2-4x más data para validar patrones.

---

## TL;DR para el founder

> **El sitio capturó 1 cliente con intent altísimo esta semana, llegó de Instagram, mobile, hizo todo bien, se frustró en checkout de 7 min y se fue sin comprar. Tienes su email. Escríbele por WhatsApp hoy. Después construimos el motor que hace esto automático.**
