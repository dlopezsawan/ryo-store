# Mes 2 · Plan de posts

**Período:** 27 abr – 26 may 2026 (30 días)
**Frecuencia:** 8 posts al mes · Lunes y jueves como anclas
**Tono:** post-launch consolidación. Educar + probar + humanizar.

## 📅 Calendario

| # | Fecha | Hora | Pilar | Formato | Post |
|---|---|---|---|---|---|
| 05 | Jue 30 Abr | 20:00 | Educational | Reel 12s | [Carbón activo](post-05-carbon-activo/) |
| 06 | Lun 4 May | 19:00 | Educational | Carrusel (4 slides) | [15 sabores](post-06-sabores-alien/) |
| 07 | Jue 7 May | 20:00 | BTS | Reel 15s | [Pedido BTS](post-07-pedido-bts/) |
| 08 | Lun 11 May | 19:00 | Engagement | Single | [Grinder vs](post-08-grinder-vs/) |
| 09 | Jue 14 May | 20:00 | Promotional | Reel 11s | [Mezcla combo](post-09-mezcla-combo/) |
| 10 | Lun 18 May | 19:00 | Social Proof | Carrusel (5 slides) | [1 mes](post-10-un-mes/) |
| 11 | Jue 21 May | 20:00 | Educational | Reel 13s | [3 errores](post-11-tips-enrolar/) |
| 12 | Dom 24 May | 14:00 | Engagement | Single | [Dominguero](post-12-dominguero/) |

Todas las horas en hora Venezuela (VE).

## 🎯 Pillar mix

| Pilar | Meta | Cuántos |
|---|---|---|
| Educational | 30% | 3 (posts 05, 06, 11) |
| Social Proof | 12% | 1 (post 10) |
| Engagement | 25% | 2 (posts 08, 12) |
| BTS | 12% | 1 (post 07) |
| Promotional | 12% | 1 (post 09) |

## 📁 Estructura de cada post

```
post-NN-slug/
├── INSTRUCCIONES.md      # cuándo + copy + notas (leer primero)
├── reel.mp4 | post.png | slides/*.png   # deliverable al tope
└── source/               # HTMLs editables (o hyperframes/ para Reels)
```

## ✅ Checklist antes de publicar

- [ ] Leer `INSTRUCCIONES.md` del post
- [ ] Verificar copy del caption
- [ ] Confirmar datos específicos (ej. sabor ganador en post 10, si aplica)
- [ ] Subir deliverable (MP4/PNG) a IG
- [ ] Pegar caption + hashtags tal cual
- [ ] Si es post-10, activar sticker de encuesta para post 11 de follow-up

## 🔄 Regenerar un post

Para Reels (composición HyperFrames):
```bash
cd mes-2/post-NN-slug/source/hyperframes
npx hyperframes render --output ../../reel.mp4
```

Para posts estáticos y carruseles:
```bash
cd ../..                                   # vuelta a social/
./scripts/render.sh mes-2/post-NN/source.html mes-2/post-NN/post.png 1080 1350
```

## 🧭 Principios

1. **Sin referencia a envíos** — nunca mencionar MRW, ciudades, cajas, guías, handles de clientes.
2. **Precios en €** — BCV es solo tasa de referencia (NO el tipo de moneda).
3. **Tagline oficial:** *"El arte de armar."*
4. **Tuteo venezolano** — nunca voseo.
