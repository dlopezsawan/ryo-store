# ENROLA LEGENDS — Plan de Desarrollo

**Fecha:** 1 de abril de 2026
**Concepto:** Roguelike de captura de criaturas estilo Pokemon + Pocket Mortys
**Ambientacion:** Valencia, Venezuela
**Target:** Web (jugable en enrola.shop, solo para usuarios registrados)

---

## 1. TECH STACK

| Componente | Tecnologia | Razon |
|---|---|---|
| Engine | **Phaser 3** (Canvas/WebGL) | Ligero, web-native, excelente para pixel art 2D, 24fps, mobile-friendly |
| Lenguaje | **TypeScript** | Consistente con el stack existente (Next.js + Medusa) |
| Rendering | Canvas 2D (no WebGL) | Maximo rendimiento en dispositivos bajos, pixel-perfect |
| Hosting | Embebido en Next.js storefront como `/juego` | Usa auth existente de Medusa, no necesita server aparte |
| State | **Zustand** (cliente) + API calls a Medusa | Inventario/progreso se guarda en Medusa como metadata del customer |
| Audio | Phaser Audio + Web Audio API | Chiptune/lo-fi BGM, SFX retro |
| Assets | Spritesheets PNG compilados de los sprites individuales | Se pre-procesan los 150 front + 150 back + characters en sheets |

### Arquitectura de alto nivel:

```
enrola.shop/juego (Next.js page, requiere auth)
  └── Phaser Game (Canvas)
       ├── Escenas:
       │    ├── BootScene (carga assets)
       │    ├── TitleScene (menu principal)
       │    ├── OverworldScene (exploracion mazmorras)
       │    ├── BattleScene (combates por turnos)
       │    ├── InventoryScene (equipo + items)
       │    ├── DexScene (coleccion de criaturas)
       │    └── RestScene (zona de descanso / tienda)
       ├── Managers:
       │    ├── DungeonManager (generacion procedural)
       │    ├── BattleManager (logica de combate)
       │    ├── CreatureManager (dex + stats + evoluciones)
       │    ├── InventoryManager (items + equipo)
       │    └── SaveManager (sync con Medusa API)
       └── Data:
            ├── creatures.json (150 criaturas: stats, moves, evolution)
            ├── moves.json (todos los movimientos)
            ├── items.json (items del juego)
            ├── dungeons.json (configuracion mazmorras)
            └── type-chart.json (efectividad de tipos)
```

---

## 2. INTEGRACION CON ENROLA SHOP

### Autenticacion:
- La pagina `/juego` requiere login (middleware de Next.js verifica sesion)
- Si no estas logueado, redirige a `/login?redirect=/juego`
- El customer ID de Medusa es el save slot del jugador

### Puntos Club Enrola (economia):
- **Ganar puntos:** Comprar en la tienda real (ya existe)
- **Gastar puntos en el juego:** Comprar mejoras en zonas de descanso
  - Pociones de cura
  - Esferas de captura mejoradas
  - Boost de stats temporales
  - Cosmeticos (skins de personaje)
- **Ganar puntos jugando:**
  - Completar una mazmorra = X puntos
  - Capturar criatura nueva = X puntos
  - Derrotar boss = X puntos
- Los puntos son los MISMOS del Club Enrola (no moneda separada)

### Guardado:
- Se guarda como `metadata` del customer en Medusa
- Auto-save al terminar cada piso/batalla
- Endpoint: `POST /store/game/save` y `GET /store/game/load`

---

## 3. CORE GAME DESIGN

### 3.1 Loop Principal (Roguelike)

```
MENU PRINCIPAL
  └── Elegir mazmorra
       └── PISO 1 (generado proceduralmente)
            ├── Explorar tiles (overworld top-down)
            ├── Encuentros aleatorios → BATALLA
            ├── Cofres → Items
            ├── Trainer NPC → Batalla obligatoria
            └── Escalera → PISO 2, 3, 4...
                 └── PISO FINAL: BOSS
                      ├── Victoria → Recompensas + vuelta a zona descanso
                      └── Derrota → Pierdes items consumibles, mantienes criaturas
```

### 3.2 Sistema de Combate (por turnos)

Copia fiel de Pokemon pero simplificado:

- **Equipo:** 6 criaturas max
- **Turnos:** Tu criatura vs criatura enemiga, mas rapido ataca primero
- **Acciones:** Atacar (4 movimientos) | Cambiar criatura | Usar item | Huir
- **Movimientos:** Cada criatura tiene 4 slots, puede aprender nuevos al subir nivel
- **Tipos:** 10 tipos con tabla de efectividad (ver 3.3)
- **Stats:** HP, ATK, DEF, SPD, SPE (Special) — 5 stats base
- **Niveles:** 1-50 (cap mas bajo que Pokemon para partidas mas cortas)
- **Evolucion:** Nivel 16 (etapa 2), Nivel 32 (etapa 3)
- **Captura:** Lanzar esfera durante batalla, probabilidad basada en HP restante + tipo esfera

### 3.3 Tabla de Tipos (10 tipos)

```
           HIERBA BRASA AGUA CRISTAL TIERRA HUMO VIENTO RESINA METAL ESPIRITU
HIERBA       -     x     ✓     -       ✓     x      x      ✓      x      -
BRASA        ✓     -     x     x       -     ✓      x      ✓      ✓      -
AGUA         x     ✓     -     -       ✓     -      x      -      ✓      -
CRISTAL      -     ✓     -     -       x     -      ✓      x      x      ✓
TIERRA       x     -     x     ✓       -     x      x      -      ✓      -
HUMO         ✓     x     -     -       ✓     -      ✓      -      x      ✓
VIENTO       ✓     ✓     ✓     x       ✓     x      -      -      x      -
RESINA       x     x     -     ✓       -     -      -      -      ✓      ✓
METAL        ✓     x     x     ✓       x     ✓      ✓      x      -      -
ESPIRITU     -     -     -     x       -     x      -      x      -      -

✓ = super efectivo (x2)    x = poco efectivo (x0.5)    - = normal (x1)
```

**Logica de diseno:**
- Hierba > Agua > Brasa > Hierba (triangulo clasico)
- Viento es ofensivamente fuerte pero defensivamente debil
- Espiritu es neutro contra casi todo (mistico)
- Metal es defensivamente fuerte pero lento
- Resina es el "dark type" — fuerte vs Espiritu y Cristal

### 3.4 Mazmorras (Zonas)

| Zona | Tema | Pisos | Tipos dominantes | Boss |
|---|---|---|---|---|
| **Parque Fernando Penalver** | Bosque urbano, naturaleza | 5 | Hierba, Viento, Tierra | Penalveris (#147) |
| **Rio Cabriales** | Rio, cuevas acuaticas | 5 | Agua, Tierra, Cristal | Cabrialesix (#146) |
| **CC Reda Building** | Centro comercial abandonado | 7 | Metal, Humo, Espiritu | Redantom (#149) |
| **Sambil Valencia** | Mall futurista, neon | 7 | Cristal, Metal, Brasa | Sambilon (#144) |
| **Cerro Casupo** | Montana, cuevas profundas | 8 | Tierra, Resina, Brasa | Carabobex (#148) |
| **Casco Historico** | Ruinas coloniales | 8 | Espiritu, Resina, Humo | Ancestron (#089) |
| **CC Caribbean (Final)** | Laberinto comercial, pisos interconectados, pasillos que no llevan a ningún lado, escaleras falsas, todos los tipos | 10 | Mixto (todos) | Enrolador (#150) |

> **Nota sobre CC Caribbean:** El dungeon final es un homenaje al famoso centro comercial de Valencia conocido por ser un laberinto imposible de navegar. La generacion procedural aqui es especial: en vez de rooms + corridors, genera un layout de pasillos de mall interconectados con tiendas, escaleras mecanicas que te llevan a pisos inesperados, y dead-ends. El mapa NO se revela — el jugador debe explorarlo a ciegas, fiel a la experiencia real del Caribbean.

### 3.5 Zonas de Descanso

| Zona | Servicios |
|---|---|
| **La Vina** (Hub principal) | Profe Cabriales (starter), Curandera (cura gratis), Tienda basica |
| **El Vinedo** | Vendedor premium (items raros por puntos Enrola), Entrenador de movimientos |

En las zonas de descanso:
- Curas tu equipo gratis
- Compras items con puntos Enrola
- Cambias movimientos de tus criaturas
- Revisas la Dex
- Guardas partida
- Eliges la siguiente mazmorra

### 3.6 Items

| Categoria | Items |
|---|---|
| **Cura** | Pocion (30HP), Super Pocion (60HP), Pocion Max (full), Revivir |
| **Captura** | Esfera Basica (1x), Esfera Pro (1.5x), Esfera Ultra (2x), Esfera Maestra (100%) |
| **Combate** | Boost ATK, Boost DEF, Boost SPD (temporales, 1 batalla) |
| **Especial** | Piedra Evolucion (evoluciona sin nivel), Reset Movimientos |

---

## 4. FASES DE DESARROLLO

### FASE 0 — Setup y Data (1 semana)
- [ ] Crear proyecto Phaser 3 + TypeScript dentro de `/storefront/public/game/` o como componente Next.js
- [ ] Compilar spritesheets de los 150 front + 150 back sprites
- [ ] Compilar spritesheets de personajes (overworld + battle)
- [ ] Crear `creatures.json` — 150 entries con stats base, tipos, movimientos, evoluciones
- [ ] Crear `moves.json` — ~80 movimientos (8 por tipo)
- [ ] Crear `type-chart.json` — tabla de efectividad
- [ ] Crear `items.json` — todos los items
- [ ] Crear `dungeons.json` — configuracion de las 7 mazmorras

### FASE 1 — Motor de Combate (2 semanas)
- [ ] BattleScene: layout de batalla (tu criatura back sprite vs enemigo front sprite)
- [ ] Sistema de turnos (velocidad determina orden)
- [ ] Menu de acciones (Atacar/Cambiar/Item/Huir)
- [ ] Calculo de dano (ATK vs DEF * tipo efectividad * STAB * random)
- [ ] Animaciones de ataque (flash, shake, HP bar drain)
- [ ] Sistema de captura (lanzar esfera, probabilidad, animacion)
- [ ] Cambio de criatura en batalla
- [ ] Uso de items en batalla
- [ ] XP + level up + evolucion
- [ ] AI del enemigo (basica: elige movimiento super efectivo si puede, sino random)

### FASE 2 — Overworld y Mazmorras (2 semanas)
- [ ] OverworldScene: mapa top-down con tiles
- [ ] Movimiento del jugador (4 direcciones, animacion caminar)
- [ ] Generacion procedural de pisos (rooms + corridors, BSP algorithm)
- [ ] Encuentros aleatorios (grass tiles = chance de batalla)
- [ ] NPCs trainers en mazmorras (batalla obligatoria)
- [ ] Cofres con items
- [ ] Escaleras entre pisos
- [ ] Boss room en piso final
- [ ] Transiciones entre escenas (fade in/out)

### FASE 3 — Zonas de Descanso y UI (1 semana)
- [ ] RestScene: La Vina y El Vinedo
- [ ] Curandera NPC (cura equipo)
- [ ] Tienda NPC (comprar/vender con puntos Enrola)
- [ ] Menu de equipo (ver stats, cambiar orden, cambiar movimientos)
- [ ] DexScene (galeria de criaturas capturadas)
- [ ] InventoryScene (items)
- [ ] Dialogos con NPCs (textbox con portrait)

### FASE 4 — Integracion Enrola Shop (1 semana)
- [ ] Endpoint `/store/game/save` en Medusa (guardar JSON en customer metadata)
- [ ] Endpoint `/store/game/load` en Medusa
- [ ] Auth gate en `/juego` (redirect si no logueado)
- [ ] Sync de puntos Club Enrola (gastar/ganar)
- [ ] Pantalla de seleccion de genero al inicio
- [ ] Tutorial con Profe Cabriales + elegir starter

### FASE 5 — Arte de Locaciones (1 semana)
- [ ] Tilesets para cada zona (7 mazmorras + 2 zonas descanso)
- [ ] Background de batalla por zona
- [ ] Mapa del mundo (seleccion de mazmorra)
- [ ] UI elements (menus, barras HP, textboxes, iconos items)

### FASE 6 — Audio y Polish (1 semana)
- [ ] BGM: tema de batalla, tema de mazmorra (por zona), tema zona descanso, titulo
- [ ] SFX: ataque, dano, captura, level up, evolucion, menu select, steps
- [ ] Particle effects minimos (hit flash, capture sparkle)
- [ ] Balance de stats y dificultad
- [ ] Bug fixes y QA

### FASE 7 — Deploy (2-3 dias)
- [ ] Build optimizado
- [ ] Deploy en enrola.shop/juego
- [ ] Testing en produccion
- [ ] Anuncio en redes

---

## 5. TIMELINE ESTIMADO

| Fase | Duracion | Acumulado |
|---|---|---|
| Fase 0: Setup y Data | 1 semana | Semana 1 |
| Fase 1: Motor de Combate | 2 semanas | Semana 3 |
| Fase 2: Overworld y Mazmorras | 2 semanas | Semana 5 |
| Fase 3: UI y Zonas Descanso | 1 semana | Semana 6 |
| Fase 4: Integracion Enrola | 1 semana | Semana 7 |
| Fase 5: Arte Locaciones | 1 semana | Semana 8 |
| Fase 6: Audio y Polish | 1 semana | Semana 9 |
| Fase 7: Deploy | 3 dias | Semana 9-10 |

**Total: ~10 semanas para MVP jugable**

---

## 6. ASSETS PENDIENTES (Arte)

### Ya tenemos:
- [x] 150 front sprites de criaturas
- [x] 150 back sprites de criaturas
- [x] 40 character sprites (2 jugadores + 10 NPCs)

### Falta:
- [ ] **Tilesets de mazmorras** (7 zonas × ~30 tiles cada una)
  - Suelo, paredes, puertas, escaleras, cofres, hierba, agua, decoracion
- [ ] **Backgrounds de batalla** (7 zonas + 2 descanso = 9)
- [ ] **Mapa del mundo** (1 imagen grande o mapa de seleccion)
- [ ] **UI Kit** (menus, barras HP, textbox, iconos, cursor)
- [ ] **Spritesheets de animacion** (walking frames derivados de los sprites existentes)
- [ ] **Iconos de items** (~20 items × icono 16x16)
- [ ] **Iconos de tipos** (10 tipos × icono 16x16)
- [ ] **Logo del juego** (Enrola Legends)
- [ ] **Efectos de batalla** (sprites de golpe, fuego, agua, etc.)

---

## 7. RESUMEN DECISION CLAVE

**Phaser 3 como game engine** porque:
1. Nativo web — no necesita descarga ni plugin
2. Excelente rendimiento en Canvas 2D para pixel art
3. Bien documentado, comunidad activa
4. Se embebe en una pagina Next.js sin conflictos
5. Soporte mobile (touch controls)
6. Ligero (~500KB minified)
7. TypeScript nativo

**NO usar:** Unity WebGL (pesado, 10MB+), RPG Maker (no customizable), Godot Web (overhead innecesario)
