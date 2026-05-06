# Enrola Shop · Social media workspace

Todo el contenido social de Enrola organizado para publicación rápida.

## 📁 Estructura

```
social/
├── launch/           🗂️  Drop 001 · 20 abr 2026 (referencia/archivo)
├── mes-2/            📅  Mes 2 · 27 abr – 26 may 2026 (activo)
├── stories/          🗓️  Stories diarias (Mes 2)
├── canva/            🎨  HTMLs standalone para importar a Canva
├── assets/products/  📷  10 fotos reales sin fondo (WebP)
├── lib/shared.css    🎨  Tokens de marca + @font-face Kanit
└── scripts/          🔧  render.sh · render-all.sh · export-html.sh
```

## 🚀 ¿Dónde está X?

| Quieres... | Abre... |
|---|---|
| El Reel del 4:20 | [`launch/post-03-reel-420/reel.mp4`](launch/post-03-reel-420/reel.mp4) |
| Cualquier post del mes 2 | `mes-2/post-NN-<slug>/` → `INSTRUCCIONES.md` + deliverable al tope |
| Una story específica | `stories/daily/YYYY-MM-DD/` |
| Portadas de highlights | `launch/highlights/covers/` |
| Los 14 stories dentro de highlights | `launch/highlights/content/<categoría>/` |
| HTMLs para Canva | `canva/` (46 archivos, drag & drop) |
| Fotos de productos | `assets/products/` |

## 📋 Mes 2 — posts (05-12)

| # | Fecha | Tipo | Carpeta |
|---|---|---|---|
| 05 | Jue 30 Abr | Reel · Carbón activo | [`mes-2/post-05-carbon-activo/`](mes-2/post-05-carbon-activo/) |
| 06 | Lun 4 May | Carrusel · 15 sabores | [`mes-2/post-06-sabores-alien/`](mes-2/post-06-sabores-alien/) |
| 07 | Jue 7 May | Reel · Pedido BTS | [`mes-2/post-07-pedido-bts/`](mes-2/post-07-pedido-bts/) |
| 08 | Lun 11 May | Single · Grinder vs | [`mes-2/post-08-grinder-vs/`](mes-2/post-08-grinder-vs/) |
| 09 | Jue 14 May | Reel · Mezcla combo | [`mes-2/post-09-mezcla-combo/`](mes-2/post-09-mezcla-combo/) |
| 10 | Lun 18 May | Carrusel · Un mes | [`mes-2/post-10-un-mes/`](mes-2/post-10-un-mes/) |
| 11 | Jue 21 May | Reel · 3 errores | [`mes-2/post-11-tips-enrolar/`](mes-2/post-11-tips-enrolar/) |
| 12 | Dom 24 May | Single · Dominguero | [`mes-2/post-12-dominguero/`](mes-2/post-12-dominguero/) |

Plan completo en [`mes-2/README.md`](mes-2/README.md).

## 🗓️ Stories

- Calendario + estrategia: [`stories/STORIES-PLAN.md`](stories/STORIES-PLAN.md)
- Renders por día: `stories/daily/YYYY-MM-DD/NN-tipo.png`
- Generar o re-generar: `cd stories && python3 generate.py`

## 🔧 Scripts útiles

```bash
# Re-renderizar un HTML a PNG
./scripts/render.sh path/al/archivo.html path/salida.png 1080 1350

# Re-renderizar todos los estáticos (launch + mes-2)
./scripts/render-all.sh

# Exportar HTMLs standalone para Canva
./scripts/export-html.sh

# Exportar PDFs (legacy, HTMLs son mejor)
./scripts/export-pdfs.sh
```

## 🎬 Reels (HyperFrames)

Los 4 Reels del Mes 2 (posts 05, 07, 09, 11) son composiciones HyperFrames:

```bash
cd mes-2/post-05-carbon-activo/source/hyperframes
npx hyperframes preview    # estudio en vivo en el browser
npx hyperframes render --output ../../reel.mp4
```

## ✅ Reglas de marca

1. **Nunca referenciar envíos/MRW/ciudades/clientes** en posts públicos (principio de discreción).
2. **Precios en €** (BCV es solo tasa de referencia, no el tipo de moneda).
3. **Tagline oficial:** *"El arte de armar."*
4. **Fuente:** Kanit (weights 400, 500, 600, 700, 900) vía Google Fonts.
5. **Paleta:** cream `#F5F2E8` · orange `#FF3B27` · primary `#BB3B2E` · secondary `#4D5431` · dark `#1A1A1A` · background-dark `#221610`.
6. **Español venezolano** (tuteo — nunca voseo).
