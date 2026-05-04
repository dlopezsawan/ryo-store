# SEO Analytics — Manual

Dashboard completo de SEO dentro del admin de Medusa (`/dashboard/seo`). Datos en tiempo real de Google Search Console (GSC), Google Analytics 4, Chrome UX Report (CrUX) y base de datos propia.

**Proyecto:** enrola.shop
**Fuentes de datos:** gratis (GSC + GA4 + CrUX + Google Autocomplete + sitemap propio)

---

## 1. Arquitectura rápida

```
Admin UI (React · Medusa SDK)
    ↓ HTTP
/admin/seo/{overview,queries,pages,keywords,...,venezuela,export,snapshots}
    ↓
Módulo seo-analytics (Medusa service + 13 tablas Postgres)
    ↓
Clientes de APIs externas: GSC · GA4 · CrUX · Autocomplete
    ↓
Jobs programados (cron) pobla las tablas diariamente
```

---

## 2. Tabs del dashboard

### Overview
- KPIs GSC 28d: impresiones, clics, CTR, posición + delta vs 28d anterior
- Sparkline de clics diarios
- Top queries (últimos 28d, top 20 por clics)
- Tráfico por país (barras con % del total)
- Bloque de **Atribución** (GA4 + Medusa): revenue orgánico, mix de canales, orders web vs manual
- **Comparativa mes a mes** (snapshots auto-generados)
- Lista de competidores monitoreados

### Keywords (3 sub-tabs)
- **Tracker** — keywords seguidas con posición actual, impresiones, clics, acción sugerida (defender / optimizar CTR / striking distance / alejada)
- **Research** — buscador que combina Google Autocomplete VE + lookup de GSC ("¿ya rankeamos?") + intent classifier
- **Sugerencias VE** — 3 grupos:
  - 🔥 Striking distance (pos 11-20 con impresiones)
  - 🇻🇪 Local intent (regex sobre queries rankeadas)
  - 🎯 Marcas ausentes (pre-cargadas del análisis competitivo)

### Páginas
- Tabla de URLs con impresiones, clics, CTR, posición, número de queries únicas. Ordenable por cualquier columna.

### 🇻🇪 Venezuela
- VE vs Resto del mundo (cards comparativas)
- **CTR mismatch** — queries donde VE CTR < 70% del CTR global (meta no optimizada para audiencia local)
- Estacionalidad semanal (barras por día de la semana)
- Top queries y geo queries VE
- Competitor SERP check (botones que abren `google.com?gl=ve&hl=es` con `site:competidor.com` pre-armado)

### Oportunidades
6 detectores SQL on-the-fly:
- ✨ Queries emergentes (nuevas últimos 7d)
- 🚀 Páginas que entraron al top 10
- ⚠️ Páginas que cayeron del top 10
- 🏷️ Brand vs Non-Brand (healthy = non-brand ≥40%)
- 🔥 Striking distance (pos 11-20)
- 🥊 Canibalización (2+ URLs compitiendo por la misma query)

### Salud Técnica
- Core Web Vitals (CrUX field data) por URL × device
- Sitemap status (total URLs, URLs con lastmod, oldest lastmod)
- Conteo de alertas sin atender por severidad

### Alertas
- Feed con severity badges
- Botón "✓ Atender" por alerta
- Toggle "Mostrar resueltas"
- Alertas `critical`/`high` envían email automático a `CONTACT_EMAIL`

---

## 3. Reglas de alertas activas

| Tipo | Regla | Severidad | Email |
|---|---|---|---|
| `page_lost_top10` | Pos ≤10 semana pasada, ahora >10 | high | ✓ |
| `page_entered_top10` | Cruzó de >10 a ≤10 | medium | — |
| `cwv_regressed` | Métrica CWV pasó de `good` a `needs_improvement`/`poor` | high | ✓ |
| `sitemap_stale` | `oldest_lastmod` >7 días | medium | — |
| `revenue_organic_drop` | Revenue 7d <60% del 7d previo | high | ✓ |
| `query_impressions_drop` | Query top 20 pierde >40% impresiones WoW | high | ✓ |

**Dedupe:** no re-fire la misma alerta (por `type + dedupe_key`) dentro de 24h.

---

## 4. Jobs programados (cron)

| Job | Horario UTC | Qué hace |
|---|---|---|
| `seo-gsc-sync` | 03:00 | Sync GSC últimos 3d (idempotente) |
| `seo-ga4-sync` | 03:15 | Sync GA4 últimos 3d |
| `seo-cwv-sync` | 04:00 | CrUX field data para 5 URLs clave |
| `seo-sitemap-check` | 04:30 | Parse sitemap.xml, guarda snapshot |
| `seo-monthly-snapshot` | 07:00 | Recalcula mes actual + mes anterior |
| `seo-alerts-compute` | cada hora | Corre las 6 reglas |

Todos gated por `SEO_SYNC_ENABLED=true`.

---

## 5. Backfills manuales

```bash
# GSC (90d default; set SEO_BACKFILL_DAYS para override)
docker exec ryo-store-medusa-1 npx medusa exec ./src/scripts/seo-gsc-backfill.js

# GA4
docker exec ryo-store-medusa-1 npx medusa exec ./src/scripts/seo-ga4-backfill.js

# CrUX (solo hoy — CrUX tiene ventana rolling de 28d)
docker exec ryo-store-medusa-1 node -e "
const { Pool } = require('pg');
const { syncAllCwv } = require('./src/lib/seo-cwv-sync.js');
(async () => { const p = new Pool({ connectionString: process.env.DATABASE_URL }); await syncAllCwv(p); await p.end(); })();
"

# Alerts compute on-demand
docker exec ryo-store-medusa-1 node -e "
const { Pool } = require('pg');
const { computeAllAlerts } = require('./src/lib/seo-alerts.js');
(async () => { const p = new Pool({ connectionString: process.env.DATABASE_URL }); await computeAllAlerts(p); await p.end(); })();
"

# Seed inicial (competidores + starter keywords VE)
docker exec ryo-store-medusa-1 npx medusa exec ./src/scripts/seed-seo-analytics.js
```

---

## 6. Export de datos

Menú **⬇ Export** arriba a la derecha del dashboard. Cada tabla:

| Tabla | Contenido |
|---|---|
| `keywords` | Keywords trackeadas enriquecidas con GSC 28d |
| `competitors` | Lista completa de competidores |
| `gsc_daily` | Raw GSC (query × page × country × device × date) |
| `gsc_totals` | Raw totals diarios (country × device × date) |
| `ga4_daily` | Raw GA4 channel/source/medium/country/date |
| `ga4_pages` | Raw GA4 page/source/medium/date |
| `alerts` | Historial de alertas (90d) |
| `suggestions_ve` | Sugerencias computadas on-the-fly |

Formatos: `CSV` y `JSON`. Endpoint: `GET /admin/seo/export?table=<name>&format=csv&days=90`.

---

## 7. Env vars

```bash
# Google APIs
GSC_PROPERTY=sc-domain:enrola.shop
GA4_PROPERTY_ID=534031397
GOOGLE_SERVICE_ACCOUNT_EMAIL=seo-analytics@enrola-490304.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_KEY_BASE64=<base64 del JSON key>
CRUX_API_KEY=<free API key>

# Tag en storefront
NEXT_PUBLIC_GA4_MEASUREMENT_ID=G-BP5HL3X1WH

# Sync control
SEO_SYNC_ENABLED=true
SEO_BACKFILL_DAYS=90                  # opcional, para scripts de backfill
```

---

## 8. Tablas Postgres

| Tabla | Propósito |
|---|---|
| `seo_gsc_daily` | Raw GSC: query × page × country × device × date |
| `seo_gsc_totals` | Daily totals (country × device), supera anonimización de sitios nuevos |
| `seo_ga4_daily` | Raw GA4 por canal/source/medium |
| `seo_ga4_page_daily` | Raw GA4 por landing page |
| `seo_cwv_snapshot` | CrUX field data LCP/INP/CLS/TTFB |
| `seo_kw_tracked` | Keywords que sigues |
| `seo_kw_position_history` | (reservada para rank tracking v2) |
| `seo_kw_research_cache` | Cache de research KW (30d TTL) |
| `seo_competitor` | Competidores |
| `seo_competitor_ranking` | (reservada para rank de competidores v2) |
| `seo_crawl_error` | (reservada para parsing de logs) |
| `seo_sitemap_snapshot` | Snapshots diarios del sitemap |
| `seo_monthly_snapshot` | Comparativa mes a mes |
| `seo_alert` | Feed de alertas con dedupe y ack |

---

## 9. Escenarios comunes

### "El dashboard está vacío"
Normal si:
- Sitio recién lanzado — GSC tarda días/semanas en indexar y acumular data
- Ejecuta el backfill manual (ver §5)
- Verifica `SEO_SYNC_ENABLED=true` en `.env` y docker-compose

### "CTR en Venezuela es mucho más bajo que global"
Ve al tab **🇻🇪 Venezuela** → sección "Queries con CTR VE bajo". Señala meta title/description no adaptados a audiencia local. Soluciones típicas:
- Añadir "envío Venezuela" / "pago en Bs" / "entrega Caracas" al title
- Precio en bolívares en la description
- Schema LocalBusiness con dirección VE

### "Una página importante cayó del top 10"
Revisar tab **Alertas** — la regla `page_lost_top10` habrá disparado. Pasos:
1. Verificar tab **Páginas** qué URLs específicas cayeron
2. Tab **Salud Técnica** → ¿CWV degradado? (LCP/INP/CLS)
3. Revisar contenido de la URL vs. competidores (tab Venezuela → check SERP)

### "Queda poco espacio en la tabla gsc_daily"
- 90d backfill típicamente = <100k filas = ~50MB
- Para sites con más volumen, configurar pruning: `DELETE FROM seo_gsc_daily WHERE date < CURRENT_DATE - INTERVAL '365 days'`

---

## 10. Lo que NO hace este dashboard (v0)

- Google Shopping integration (mercado VE inmaduro)
- Rank tracking de keywords fuera de las que GSC ya nos muestra (requiere SerpAPI ~$50/mes)
- Volumen absoluto de keywords no rankeadas (requiere DataForSEO/Semrush)
- Backlinks analysis
- Google Trends series (complejidad desproporcionada sin volumen)
- Atribución WhatsApp con `wa_ref` — infra lista pero no instrumentada en storefront

Todo lo anterior puede activarse en v2 cuando el negocio lo justifique.

---

## 11. Cronología de batches (histórico)

### Fase 1 — SEO Analytics
1. **Batch 0** — Spec + credenciales Google
2. **Batch 1** — Módulo seo-analytics + 13 tablas + sidebar placeholder
3. **Batch 2** — GSC sync + overview con datos reales
4. **Batch 3** — KW Research + Tracker + Sugerencias VE
5. **Batch 4** — Oportunidades con 6 detectores
6. **Batch 5** — GA4 + atribución
7. **Batch 6** — CrUX + sitemap + alertas
8. **Batch 7** — Venezuela focus tab + competitor SERP check
9. **Batch 8** — Export CSV/JSON + snapshots mensuales + onboarding + este manual

### Fase 2 — Analytics stack expandido
10. **Umami self-hosted** — analytics propio privacy-first en `analytics.enrola.shop`
11. **Microsoft Clarity** — heatmaps + session replay (cloud, gratis)
12. **Umami tab** en SEO Analytics — integración via API

### Fase 3 — PostHog + DEV split
13. **PostHog Cloud** — product analytics + feature flags + experiments + errors + LLM obs
14. **Batch 1 PostHog** — credentials + snippet en storefront
15. **Batch 2 PostHog** — 8 eventos client + 4 server-side + identify post-login
16. **Batch 3 PostHog** — DEV admin route con 3 tabs (Flags / Errors / Cron Jobs)
17. **Batch 4 unificación** — Overview 5-layer funnel (GSC + Umami + GA4 + PostHog + Medusa + CrUX) + link-out grid + merge de tabs
18. **Batch 5 DEV** — Cron Jobs monitor con `wrapJob()` wrapper + `job_run` table
19. **Batch 6 DEV** — LLM Observability + Services Health
20. **Batch 7 DEV** — Deploy tab (runtime info)

---

## 12. Contacto y ownership

- **Owner:** Daniel
- **Código:** `backend/src/modules/seo-analytics/` + `backend/src/api/admin/seo/` + `backend/src/admin/routes/seo/` + `backend/src/lib/seo-*.ts` + `backend/src/jobs/seo-*.ts`
- **Specs técnicas:** `docs/SEO-ANALYTICS-SPEC.md`
- **Setup Google:** `docs/SEO-ANALYTICS-GOOGLE-SETUP.md`
