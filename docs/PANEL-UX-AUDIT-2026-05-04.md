# Panel UX/UI Audit · 2026-05-04

Análisis estructural del panel `panel.enrola.shop` con foco en **navegabilidad**, **jerarquía de información** y **fricción operativa**. Las recomendaciones están priorizadas por impacto vs esfuerzo.

---

## Mental model actual del usuario

El panel tiene **20 secciones top-level** (sidebar) + **13 sub-tabs** en marketing + **6 sub-tabs** en settings = ~40 destinos navegables. Cualquier admin recién contratado se pierde en los primeros 30s.

**Problema raíz:** mezcla de tres mental models distintos en el sidebar:
- **Operación** (Pedidos, Productos, Inventario) — "qué hago hoy"
- **Análisis** (Reports, Activity, Marketing/insight) — "qué entiendo"
- **Setup** (Locations, Shipping, Settings) — "qué configuro una vez"

Hoy están entremezclados sin pistas visuales fuertes.

---

## Issues encontrados

### 🔴 1 · Loyalty duplicado — **FIXED**

`Loyalty` aparecía como tab en `/marketing` Y como entry top-level en sidebar. Removido del MarketingNav (queda como top-level por ser un dominio post-compra distinto a marketing de adquisición).

### 🔴 2 · "Segmentos" colisión semántica — **FIXED**

Había dos cosas llamadas "Segmentos":
- Sidebar `/customer-groups` → grupos manuales de Medusa (ej: VIPs, Mayoristas)
- `/marketing/segments` → segmentación RFM automática

Renombrado el del sidebar a **"Grupos"**. Ahora:
- `/customer-groups` = Grupos manuales (lista que vos curás)
- `/marketing/segments` = Segmentos RFM (lista que el sistema computa)

### 🟡 3 · Marketing tiene 13 tabs sin jerarquía — **PARTIAL FIX**

Antes era una tira lineal de 13 tabs. Ahora agrupados con divider visual:

```
[ Resumen ] | [ Promos · Segmentos · Reglas · Envíos · Campañas ] | [ Analytics · Patrones · Funnels · Attribution · Intel · User 360 ]
              └── ACCIONES (operar) ──┘                            └── INSIGHTS (entender) ──┘
```

Próximo paso opcional: agregar etiquetas pequeñas "ACTION" / "INSIGHT" arriba de cada cluster para reforzar la separación.

### 🟡 4 · Tres "summary pages" sin diferencia clara

`/dashboard`, `/reports`, `/activity` — los tres son "vistas resumen" pero ninguno tiene un purpose explícito en su título.

**Recomendación:**
- `/dashboard` → renombrar a **"Hoy"** o **"Inicio"** (foco: pedidos pendientes, alertas, snapshot de las próximas 24h)
- `/reports` → **"KPIs"** o **"Métricas"** (foco: revenue, AOV, tendencia mensual)
- `/activity` → **"Bitácora"** o **"Audit log"** (foco: quién cambió qué, eventos del sistema)

Si los purposes ya están así, sólo hace falta cambiar las labels. Si no, conviene mergeear (ej: `/activity` puede ser un tab dentro de `/dashboard`).

### 🟡 5 · "Setup" desperdicia espacio

La sección "Setup" del sidebar tiene un solo ítem (`Configuración`). Y dentro hay 6 sub-tabs: payments · regions · store · tax · team.

**Recomendación:** O subir esas 6 al sidebar como "Setup → Payments / Regions / Store / Tax / Team", o eliminar la sección "Setup" como agrupador y dejar `Configuración` como hijo de "Negocio" o flotando al final.

### 🟡 6 · Jerarquía de Operativo confusa

Hoy:
```
Operativo:
  Dashboard, Reports, Actividad,    ← son META (sobre el negocio)
  Pedidos, Productos, Catálogo,     ← son OBJETOS (lo que vendés)
  Inventario, Clientes, Grupos       ← son OBJETOS
```

**Recomendación:** dividir en dos sub-bloques con un mini-divider:
```
RESUMEN
  Dashboard, Reports, Actividad
GESTIÓN
  Pedidos, Productos, Catálogo, Inventario, Clientes, Grupos
```
Esto reduce la lista visual de 9 ítems a 2 grupos de 3 y 6.

### 🟡 7 · Fricción de "tabs" en módulos grandes

`/marketing` y `/settings` usan tabs lineales que se overflowean. En screens <1280px varios tabs quedan ocultos detrás del scroll horizontal sin indicador visible. El usuario no sabe que hay 5 más.

**Recomendación rápida:** agregar un fade gradiente a la derecha cuando hay overflow + cursor "→" sutil. Long-term: secondary nav en columna izquierda (como GitHub Issues view) para módulos con >7 sub-páginas.

### 🟡 8 · Webmail mal categorizado

Webmail está en "Negocio" pero conceptualmente es una herramienta de comunicación interna del equipo, no una herramienta de negocio cara al cliente.

**Recomendación:** moverlo a una nueva sección "Comunicación" junto con Social, o dejarlo cerca de Settings.

### 🟡 9 · Catálogo vs Productos ambiguo

Usuarios nuevos no saben la diferencia. Catálogo = categorías + colecciones. Productos = SKUs.

**Recomendación:** renombrar `/catalog` → **"Categorías"** o **"Colecciones"** (lo que sea más usado). El término "Catálogo" en e-commerce usualmente _incluye_ los productos, así que crea overlap mental.

### 🟢 10 · Top bar / breadcrumbs ausentes

Cuando estás en `/marketing/user360/cust_xyz` no hay breadcrumb que te diga "Marketing > User 360 > [cliente]". Sólo el sidebar resaltando "Marketing".

**Recomendación:** agregar breadcrumb arriba del PageHeader en todas las páginas con depth >1. Mejora orientación enormemente.

### 🟢 11 · Búsqueda global / Command Palette

Ya existe `CommandPalette.tsx` (vi referencias). Verificar que esté:
- Atajo `⌘K` visible en algún lugar (ej: barra superior con un mock input "Buscar… ⌘K")
- Indexado con todas las páginas + acciones rápidas (ej: "Crear promo", "Marcar pedido como enviado")

Si ya está bien implementado, agregá un hint visual permanente.

### 🟢 12 · Estados vacíos genéricos

Páginas como Patterns, Recordings, Attribution muestran "Sin datos en este período" sin ayudar al usuario a entender **por qué** ni **qué hacer**.

**Recomendación:** template de empty state con:
- Icono temático (no genérico)
- Título: lo que falta ("Aún no hay recordings")
- Razón probable ("PostHog necesita ≥5s de sesión válida")
- CTA siguiente ("Configurá session recording → Settings/Analytics")

### 🟢 13 · BCV ticker — **FIXED**

Mostraba `ERR` por DNS issue con `pydolarve.org`. Ahora usa `ve.dolarapi.com` como fuente primaria + `pydolarve` como fallback + sirve cache stale antes de romper. Estado nuevo: `LIVE` / `STALE` / `ERR`.

### 🟢 14 · Densidad de información en tablas

Algunas tablas (orders, customers, marketing/fires) tienen 10+ columnas que comprimen texto y obligan a scroll horizontal en laptops 13".

**Recomendación:** column visibility toggle (settings icon en header de tabla) + "compact mode" que oculta columnas secundarias por default. Persistir preferencia en localStorage por usuario.

### 🟢 15 · Confirmaciones destructivas inconsistentes

Algunos botones destructivos usan `confirm()` nativo del browser, otros usan modal custom, algunos no piden confirmación. Ejemplo: en webmail "Mover a papelera" usa confirm() (lo acabo de ver).

**Recomendación:** estandarizar con un componente `<DangerConfirm>` que tenga:
- Modal custom con styling del panel
- Texto que diga el efecto explícito ("Esto archivará 1 mensaje")
- Soporte para "Mantener pulsado para confirmar" en acciones masivas

---

## Quick wins aplicados en este audit

| Cambio | Archivo |
|---|---|
| Removido Loyalty del MarketingNav | `marketing/MarketingNav.tsx` |
| Marketing tabs agrupados (action / insight) con divider | `marketing/MarketingNav.tsx` |
| Sidebar: "Segmentos" → "Grupos" para `/customer-groups` | `components/layout/Sidebar.tsx` |
| BCV multi-source con fallback + estado STALE | `api/finanzas/bcv/route.ts`, `BcvTicker.tsx` |

---

## Roadmap sugerido (priorizado)

### Semana 1 — Foundation (alto impacto, bajo esfuerzo)

1. **Renombrar Dashboard / Reports / Activity** con purposes claros
2. **Sub-divisores en Operativo** del sidebar (Resumen vs Gestión)
3. **Breadcrumbs** en todas las páginas con depth ≥2
4. **Renombrar Catálogo → Categorías**

### Semana 2 — Empty states + global search

5. Component `<EmptyState>` con title + razón + CTA, usado en todas las páginas
6. Verificar que Command Palette tenga `⌘K` visible y bien indexado

### Mes 2 — Polish

7. Component `<DangerConfirm>` consistente para destructive actions
8. Column visibility en tablas grandes (orders, customers, fires)
9. Fade gradient + scroll indicator en tab strips overflow
10. Mover Webmail a sección "Comunicación" (junto con Social)

### Después (low priority pero alto valor)

11. Onboarding tour la primera vez que un admin nuevo entra (5 tooltips contextuales)
12. Keyboard shortcuts globales: `g+o` = orders, `g+p` = products, etc. (estilo Linear/GitHub)
13. Light/dark mode tweaks: ya existe ThemeToggle, verificar que TODOS los componentes respeten el theme (algunas tablas tienen colores hardcoded)

---

## Métricas para medir si el rediseño funciona

- **Time-to-first-action** del admin nuevo (medir con PostHog: tiempo desde login al primer click útil)
- **% de admins que usan Command Palette** vs sidebar
- **Bounce rate por página** (páginas que la gente abre y abandona en <5s probablemente tienen mal labeling)
- **Heatmap de clicks en sidebar** — qué entries nadie usa = candidatos a remover

Todo esto se puede trackear con los eventos PostHog que ya existen.
