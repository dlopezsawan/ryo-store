# ENROLA LEGENDS — Assets Graficos Pendientes

**Ya completado:**
- [x] 150 front sprites criaturas (56x56)
- [x] 150 back sprites criaturas (48x48)
- [x] 40 character sprites (overworld + portrait + battle)

---

## 1. TILESETS DE MAZMORRAS (32x32 por tile)

Cada mazmorra necesita un tileset tematico. Los tiles base son compartidos pero el skin cambia por zona.

### Tiles base (compartidos, re-skinned por zona):
| # | Tile | Descripcion |
|---|------|-------------|
| 1 | Suelo normal | Tile caminable basico |
| 2 | Suelo variante | Suelo con grietas/detalles |
| 3 | Pared norte | Muro superior |
| 4 | Pared lateral | Muro izq/der |
| 5 | Esquina pared | Esquinas de muros |
| 6 | Puerta abierta | Paso entre rooms |
| 7 | Puerta cerrada | Requiere llave/batalla |
| 8 | Escalera subida | Sube de piso |
| 9 | Escalera bajada | Baja de piso |
| 10 | Hierba/encuentro | Tile donde pueden salir criaturas |
| 11 | Cofre cerrado | Contiene item |
| 12 | Cofre abierto | Ya recolectado |
| 13 | Obstaculo | Roca/escombro no caminable |
| 14 | Decoracion A | Especifica por zona |
| 15 | Decoracion B | Especifica por zona |
| 16 | Borde/sombra | Transiciones entre suelo y pared |

### Tilesets por zona (16 tiles × 7 mazmorras = 112 tiles):

| Zona | Skin/Tema visual |
|---|---|
| **Parque Penalver** | Tierra, cesped, arboles, bancas, faroles, caminos de piedra |
| **Rio Cabriales** | Agua, piedras de rio, cuevas humedas, algas, puentes de madera |
| **CC Reda Building** | Piso de ceramica, paredes de concreto, vitrinas rotas, tubos, grafiti |
| **Sambil Valencia** | Piso pulido brillante, columnas de mall, escaleras mecanicas, luces neon |
| **Cerro Casupo** | Roca, tierra, estalactitas, cristales, raices, cueva oscura |
| **Casco Historico** | Adoquin colonial, paredes de ladrillo viejo, arcos, faroles antiguos, telarana |
| **CC Caribbean** | Piso de mall desgastado, pasillos interminables, escaleras mecanicas, tiendas cerradas, senalizacion confusa, flechas contradictorias |

**Total: ~112 tiles unicos**

---

## 2. TILESETS DE ZONAS DE DESCANSO (32x32)

| Zona | Tiles especificos |
|---|---|
| **La Vina (Hub)** | Calle residencial, casas coloniales, arboles, bancas, puesto de comida, centro de criaturas (tipo Pokemon Center), suelo de plaza |
| **El Vinedo** | Interior de tienda, estantes, mostrador, poster, lamparas, alfombra, puerta |

**~20 tiles adicionales por zona = ~40 tiles**

---

## 3. BACKGROUNDS DE BATALLA (240x160 o similar)

Un fondo por cada zona donde peleas. Estilo Pokemon Crystal: suelo en primer plano + escenario atras.

| # | Zona | Descripcion del fondo |
|---|------|----------------------|
| 1 | Parque Penalver | Cesped y arboles, cielo azul, banca al fondo |
| 2 | Rio Cabriales | Orilla del rio, piedras, agua fluyendo, vegetacion |
| 3 | CC Reda Building | Interior de mall abandonado, vitrinas rotas, tubos |
| 4 | Sambil Valencia | Interior de mall brillante, escaleras mecanicas, neon |
| 5 | Cerro Casupo | Interior de cueva, estalactitas, cristales brillando |
| 6 | Casco Historico | Calle colonial nocturna, faroles, edificios viejos |
| 7 | CC Caribbean | Pasillo interminable de mall, tiendas cerradas, luces parpadeantes |
| 8 | La Vina (wild) | Plaza residencial, dia soleado |
| 9 | Boss battle | Version dramatica de la zona (mas oscura, particulas) |

**Total: 9 backgrounds**

---

## 4. MAPA DE SELECCION DE ZONA

Una imagen grande o composicion de la "ciudad" de Valencia donde el jugador selecciona la mazmorra. Estilo mapa de mundo de Pokemon pero urbano.

| Asset | Descripcion |
|---|---|
| Mapa base | Vista cenital estilizada de Valencia con las 7 zonas marcadas |
| Iconos de zona | 7 iconitos que representan cada mazmorra (arbol, rio, edificio, etc.) |
| Icono del jugador | Chincheta/marcador de posicion actual |
| Zona bloqueada | Version gris/candado de zonas no desbloqueadas |
| Caminos | Lineas que conectan las zonas |

**Total: 1 mapa grande + ~10 iconos**

---

## 5. UI KIT

### Menu principal / Title screen:
| Asset | Tamano | Descripcion |
|---|---|---|
| Logo "Enrola Legends" | ~200x80 | Titulo del juego en pixel art |
| Fondo title screen | 240x160 | Escena con los 3 starters y Valencia al fondo |
| Boton "Nueva Partida" | ~80x16 | Boton estilizado |
| Boton "Continuar" | ~80x16 | |
| Boton "Opciones" | ~80x16 | |

### HUD de batalla:
| Asset | Tamano | Descripcion |
|---|---|---|
| Caja de stats aliado | ~120x40 | Muestra nombre, nivel, HP bar (abajo derecha) |
| Caja de stats enemigo | ~120x40 | Muestra nombre, nivel, HP bar (arriba izquierda) |
| Barra de HP (verde/amarillo/rojo) | ~60x4 | Cambia color segun % |
| Barra de XP | ~60x2 | Azul |
| Menu de acciones | ~120x60 | Atacar / Cambiar / Item / Huir |
| Menu de movimientos | ~200x60 | 4 slots con nombre, tipo, PP |
| Caja de texto narrador | ~240x40 | "Cogollito uso Hoja Afilada!" |
| Animacion de captura | spritesheet | Esfera volando, sacudiendose, click |

### HUD de overworld:
| Asset | Tamano | Descripcion |
|---|---|---|
| Minimap frame | ~60x60 | Marco del minimapa (esquina) |
| Indicador de piso | ~40x12 | "Piso 3/7" |
| Barra de equipo mini | ~120x16 | 6 circulos con cara de cada criatura |

### Menus generales:
| Asset | Descripcion |
|---|---|
| Frame de dialogo | Caja de texto con portrait a la izquierda |
| Frame de menu | Borde de ventana estilo GBC |
| Cursor de seleccion | Flechita o mano que indica opcion |
| Frame de inventario | Grid de items |
| Frame de equipo | 6 slots con criatura + stats |
| Frame de Dex | Grid de criaturas coleccionadas |
| Scrollbar | Para listas largas |
| Fondo de menu | Patron/textura de fondo de menus |

**Total UI: ~25-30 assets**

---

## 6. ICONOS DE ITEMS (16x16)

| # | Item | Icono |
|---|------|-------|
| 1 | Pocion | Botella verde |
| 2 | Super Pocion | Botella azul |
| 3 | Pocion Max | Botella dorada |
| 4 | Revivir | Estrella/pluma amarilla |
| 5 | Esfera Basica | Esfera roja/blanca |
| 6 | Esfera Pro | Esfera azul/blanca |
| 7 | Esfera Ultra | Esfera negra/amarilla |
| 8 | Esfera Maestra | Esfera morada/dorada |
| 9 | Boost ATK | Flecha roja arriba |
| 10 | Boost DEF | Escudo azul |
| 11 | Boost SPD | Rayo amarillo |
| 12 | Piedra Evolucion | Cristal brillante |
| 13 | Reset Movimientos | Libro abierto |
| 14 | Llave | Llave dorada (para puertas) |
| 15 | Mapa | Pergamino (revela minimap en Caribbean) |
| 16 | Antidoto | Hoja verde |
| 17 | Repelente | Spray gris |
| 18 | Moneda Enrola | Moneda con logo E |

**Total: ~18 iconos de items**

---

## 7. ICONOS DE TIPOS (16x16)

| Tipo | Icono |
|---|---|
| Hierba | Hoja verde |
| Brasa | Llama naranja |
| Agua | Gota azul |
| Cristal | Diamante celeste |
| Tierra | Montana marron |
| Humo | Nube gris |
| Viento | Espiral verde-menta |
| Resina | Gota ambar |
| Metal | Engranaje plateado |
| Espiritu | Estrella morada |

**Total: 10 iconos**

---

## 8. EFECTOS DE BATALLA (spritesheets animados)

Minimalistas — no queremos nada llamativo, clean y ligero.

| # | Efecto | Frames | Descripcion |
|---|--------|--------|-------------|
| 1 | Golpe fisico | 3 | Flash blanco + lineas de impacto |
| 2 | Ataque Hierba | 3 | Hojas volando |
| 3 | Ataque Brasa | 3 | Chispas/brasas |
| 4 | Ataque Agua | 3 | Gotas/splash |
| 5 | Ataque Cristal | 3 | Fragmentos cristalinos |
| 6 | Ataque Tierra | 3 | Rocas/polvo |
| 7 | Ataque Humo | 3 | Nube gris expandiendose |
| 8 | Ataque Viento | 3 | Lineas de aire/remolino |
| 9 | Ataque Resina | 3 | Gotas ambar pegajosas |
| 10 | Ataque Metal | 3 | Chispas metalicas |
| 11 | Ataque Espiritu | 3 | Aura morada |
| 12 | Criatura recibe dano | 2 | Flash rojo + shake |
| 13 | Criatura debilitada | 3 | Fade out hacia abajo |
| 14 | Esfera lanzada | 4 | Arco + impacto |
| 15 | Esfera sacudiendose | 3 | Wobble 1, 2, 3 |
| 16 | Captura exitosa | 3 | Sparkle/estrellas |
| 17 | Captura fallida | 2 | Esfera se abre, criatura sale |
| 18 | Level up | 3 | Luz dorada ascendente |
| 19 | Evolucion | 4 | Silueta blanca parpadeante → nueva forma |
| 20 | Super efectivo | 2 | Flash grande + texto |

**Total: 20 efectos × ~3 frames = ~60 frames**

---

## 9. WALKING FRAMES (derivados de sprites existentes)

Los overworld sprites de personajes necesitan animacion de caminar. Podemos derivarlos programaticamente de los sprites estaticos existentes:

| Personaje | Frames necesarios |
|---|---|
| Jugador M | 4 dirs × 3 frames = 12 (tenemos 3 dirs, right = mirror left) |
| Jugadora F | 4 dirs × 3 frames = 12 |
| NPCs (10) | Solo idle, no caminan = 0 adicionales |

**Approach:** Generar frame1 (idle) y frame3 (paso opuesto) — frame2 es el idle. O sea necesitamos 1 frame adicional por direccion existente.

**Total: ~6 frames adicionales por jugador = 12 frames**

---

## 10. RESUMEN TOTAL

| Categoria | Cantidad | Prioridad |
|---|---|---|
| Tilesets mazmorras (7 zonas) | ~112 tiles | ALTA |
| Tilesets zonas descanso (2) | ~40 tiles | ALTA |
| Backgrounds de batalla | 9 imagenes | ALTA |
| Mapa de seleccion de zona | 1 + ~10 iconos | MEDIA |
| UI Kit completo | ~30 assets | ALTA |
| Iconos de items | ~18 iconos | MEDIA |
| Iconos de tipos | 10 iconos | MEDIA |
| Efectos de batalla | ~60 frames | MEDIA |
| Walking frames adicionales | ~12 frames | BAJA (derivable) |
| Logo + Title screen | 2 assets | MEDIA |

### GRAN TOTAL: ~285 assets graficos pendientes

### Orden de generacion sugerido:
1. **UI Kit** — necesario para prototipar todo
2. **Tilesets** — sin esto no hay overworld
3. **Backgrounds de batalla** — sin esto no hay combate visual
4. **Iconos** (items + tipos) — necesarios para menus
5. **Efectos de batalla** — polish, puede ser placeholder al inicio
6. **Mapa + Logo + Title** — polish final
7. **Walking frames** — derivables, ultima prioridad
