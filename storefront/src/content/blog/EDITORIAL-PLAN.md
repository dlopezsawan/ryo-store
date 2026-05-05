# Plan editorial del blog — próximos 6 posts

Objetivo: completar los **8 posts fundacionales** del blog (2 ya publicados). Publicar a ritmo de **1 post/semana** durante 6 semanas.

Cada post debe:
- 800-1200 palabras
- Min. 3 links internos al catálogo
- Meta description 150-160 chars
- Hero image en `/public/images/blog/`
- Schema Article + BreadcrumbList (ya emitidos por la template)
- Al menos 1 tabla comparativa o lista numerada (boost de rich snippets)

## Calendario propuesto

### Semana 1 — Filtros: cartón perforado vs carbón activo
- **Slug:** `filtros-carton-vs-carbon-activo`
- **Target keyword:** "filtros para rolling paper venezuela"
- **Ángulo:** comparativa objetiva con tabla, cuándo elegir cada uno
- **Links al catálogo:** `/productos/filtros-carton-perforado`, `/productos/filtro-carbon-activo`

### Semana 2 — Conos pre-armados: la revolución del ritual
- **Slug:** `conos-pre-armados-ventajas-desventajas`
- **Target keyword:** "conos pre armados venezuela"
- **Ángulo:** por qué subieron, cuándo convienen, cómo usarlos con grinder rellenador
- **Links:** `/productos/conos-alien-puff-celulosa`, `/productos/conos-alien-puff-saborizados`, `/productos/grinder-rellenador-conos`

### Semana 3 — Envíos de parafernalia en Venezuela
- **Slug:** `envios-parafernalia-venezuela-mrw-delivery`
- **Target keyword:** "envio rolling papers venezuela"
- **Ángulo:** cómo funciona el envío legal, MRW nacional, same-day Valencia
- **Links:** `/faq`, `/terminos`, `/tienda`

### Semana 4 — Alien Puff: la marca completa
- **Slug:** `alien-puff-guia-marca-completa`
- **Target keyword:** "alien puff venezuela"
- **Ángulo:** brand spotlight — glass, sabores, filtros, conos
- **Links:** todos los productos Alien Puff

### Semana 5 — Puff Man: unbleached y cáñamo puro
- **Slug:** `puff-man-unbleached-cañamo-natural`
- **Target keyword:** "rolling paper hemp venezuela"
- **Ángulo:** por qué el unbleached es la opción sustentable
- **Links:** `/productos/rolling-paper`, `/productos/filtros-carton-perforado`

### Semana 6 — Rituales: armar un liado artesanal paso a paso
- **Slug:** `como-armar-liado-artesanal-paso-a-paso`
- **Target keyword:** "como armar un cigarro artesanal"
- **Ángulo:** guía visual (requiere fotos), 8-10 pasos claros
- **Links:** grinder, rolling paper, filtros, conos

## Cómo agregar un post nuevo

1. Editar `src/content/blog/posts.ts` y agregar objeto al array `posts`.
2. Respetar el shape `BlogPost` (ver types).
3. Body en HTML simple (usar `<h2>`, `<h3>`, `<ul>`, `<a>`, `<strong>`).
4. Si se agrega hero image, subirla a `public/images/blog/` con nombre igual al slug.
5. Al guardar + deploy, se auto-regenera el sitemap + se incluye en listing.

## KPIs a medir (post Batch 9 GSC)

- Impresiones orgánicas por keyword objetivo
- CTR en SERPs (debería mejorar con FAQPage + Article schema)
- Clicks a productos desde posts (attribution interna)
- Tiempo en página (engagement signal)
