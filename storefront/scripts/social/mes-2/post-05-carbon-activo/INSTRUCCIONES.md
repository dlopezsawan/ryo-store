# Post 05 · ¿Qué hace el carbón activo?

## Cuándo publicar
- **Fecha:** Jueves 30 de abril 2026
- **Hora:** 20:00 VE
- **Plataforma:** Instagram Reel + auto-share al feed

## Pilar
Educational — explicar la función del filtro menos autoexplicativo del catálogo.

## Formato
Reel 9:16 · 1080×1920 · 12 segundos · 30 fps · sin voiceover (usar audio trending).

## Producto referenciado (real)
- **Filtro Carbón Activo Alien Puff — 10 uds** · **€7.00** (precio BCV en web)
- Link: enrola.shop → Tienda → Filtros

## Storyboard

| Escena | Dur | Qué pasa |
|---|---|---|
| 1 · Hook | 0–2.5s | Texto grande: "¿Por qué carbón activo?" Fondo cream, Kanit Black. |
| 2 · Sin filtro | 2.5–5.5s | Demo visual: humo/aire "cargado" pasa directo → sensación áspera (usar íconos o animación abstracta, no consumo real). Subtítulo: "Sin filtro = todo pasa." |
| 3 · Con filtro | 5.5–8.5s | Cross-section del filtro: capas de cream + black + orange con partículas atrapándose. Subtítulo: "Con carbón activo = humo más limpio." |
| 4 · Producto | 8.5–10.5s | Producto real (pack 10u) sobre fondo cream, rota suave. Stamp de precio "€7" esquina. |
| 5 · CTA | 10.5–12s | "Pack 10u · enrola.shop" + handle. |

## Copy del post (pegar en IG)

```
El arte de armar empieza por cómo termina.

El carbón activo atrapa partículas y calor — el humo pasa más limpio, el sabor se nota más.

Pack de 10 uds · €7
Link en la bio → Filtros.

#EnrolaShop #ElArteDeArmar #CarbonActivo
```

## Hashtags
```
#RollingPapers #AlienPuff #Filtros #Venezuela #TabacoArtesanal
```

## Notas producción
- Usar pipeline HyperFrames (ya configurado en `storefront/scripts/social/hyperframes-reel/`) como base.
- Incluir en el proyecto: `carbon-activo-s1.html`, `carbon-activo-s2.html`, etc.
- **CRÍTICO:** No mostrar consumo real. Mostrar el filtro como objeto técnico, no su uso.
- Audio: sonido trending de IG al subir (no voiceover).

## Archivos
- `templates/cover-frame.html` — frame estático de portada (para mientras se desarrolla el Reel completo)
- `renders/cover-frame.png` — preview PNG
- `renders/post-05-carbon.mp4` — Reel final (pendiente — dispárame cuando esté listo para render)
