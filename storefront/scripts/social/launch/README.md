# Launch · Drop 001 (20 abr 2026)

Material del lanzamiento del 4:20 — archivo de referencia.

## 📁 Contenido

```
launch/
├── post-01-lanzamiento/       # "Hoy es 4:20 · Venezuela tiene tienda nueva" (single image)
├── post-02-catalogo/          # Carrusel 8 slides — catálogo completo
├── post-03-reel-420/          # Reel 12s — código ENROLA420 · 20% OFF
└── highlights/
    ├── covers/                # 4 portadas de highlights (Tienda · Productos · Cómo comprar · Envíos)
    └── content/
        ├── tienda/            # 3 stories dentro del highlight Tienda
        ├── productos/         # 4 stories dentro del highlight Productos
        ├── comprar/           # 4 stories dentro del highlight Cómo comprar
        └── envios/            # 3 stories dentro del highlight Envíos
```

## 📋 Deliverables

| Post | Formato | Archivo |
|---|---|---|
| Post 01 Lanzamiento | single image | [`post-01-lanzamiento/post.png`](post-01-lanzamiento/post.png) |
| Post 02 Catálogo | carrusel 8 slides | [`post-02-catalogo/slides/`](post-02-catalogo/slides/) |
| Post 03 Reel 420 | MP4 12.5s | [`post-03-reel-420/reel.mp4`](post-03-reel-420/reel.mp4) |
| 4 portadas highlights | PNG 1080×1920 | [`highlights/covers/`](highlights/covers/) |
| 14 stories de highlights | PNG 1080×1920 | [`highlights/content/`](highlights/content/) |

## 🎬 Reel del 4:20

El Reel del lanzamiento usa HyperFrames. Source en:
[`post-03-reel-420/source/hyperframes/`](post-03-reel-420/source/hyperframes/)

Para re-renderizar:
```bash
cd launch/post-03-reel-420/source/hyperframes
npx hyperframes render --output ../../reel.mp4
```

## 📝 Notas

- Este material **ya fue publicado** y se conserva como referencia.
- El cupón **ENROLA420** estaba vigente del 20 al 26 de abril (primera compra, mín. 15 €, registro requerido).
- Las highlights siguen activas en IG — los PNGs y stories pueden re-usarse si se actualiza un highlight.
