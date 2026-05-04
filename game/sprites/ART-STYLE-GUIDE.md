# ENROLA LEGENDS — Guia de Estilo de Arte

## Referencia: Pokemon Crystal / Pokemon Prism (GBC era)

---

## 1. REGLAS TECNICAS

| Parametro | Valor |
|---|---|
| Canvas | 56x56 px (front sprite), 48x48 (back sprite) |
| Colores por sprite | **4 total**: negro (outline), 2 tonos del cuerpo, blanco/transparente |
| Outline | 1px negro (#000000), completamente cerrado |
| Fuente de luz | Arriba-izquierda (highlights arriba-izq, sombras abajo-der) |
| Sombreado | Solo 2 tonos: color medio (body) + color claro (highlight). Sin dithering |
| Anti-aliasing | NINGUNO. Bordes duros, pixeles limpios |
| Animacion | 2 frames (idle breathing/sway). Minimalista |
| Target FPS | 24 |

---

## 2. PALETA ENROLA LEGENDS

Inspirada en Pokemon Crystal Legacy pero con identidad propia.
Tonos ligeramente desaturados, calidos, armoniosos. NO colores primarios puros.

### Paletas por tipo (3 colores visibles + negro outline):

**HIERBA (Cogollito line)**
| Rol | Hex | Descripcion |
|---|---|---|
| Outline | #1A2E1A | Verde muy oscuro (casi negro) |
| Sombra/cuerpo | #4A7A3A | Verde bosque medio, calido |
| Highlight | #8EC86A | Verde claro suave, ligeramente amarillento |

**BRASA (Mechita line)**
| Rol | Hex | Descripcion |
|---|---|---|
| Outline | #4A1A0A | Marron rojizo muy oscuro |
| Sombra/cuerpo | #C8623A | Naranja terracota, calido |
| Highlight | #F0C878 | Amarillo dorado suave, cremoso |

**AGUA (Gotirro line)**
| Rol | Hex | Descripcion |
|---|---|---|
| Outline | #0A2A4A | Azul marino muy oscuro |
| Sombra/cuerpo | #4888B0 | Azul medio, ligeramente grisaceo |
| Highlight | #90D0E8 | Celeste suave, relajante |

**CRISTAL**
| Rol | Hex | Descripcion |
|---|---|---|
| Outline | #1A2A3A | Azul acero oscuro |
| Sombra/cuerpo | #6898B8 | Azul cristalino medio |
| Highlight | #B8E0F0 | Azul hielo muy claro |

**TIERRA**
| Rol | Hex | Descripcion |
|---|---|---|
| Outline | #2A1A0A | Marron tierra oscuro |
| Sombra/cuerpo | #A07848 | Marron arena calido |
| Highlight | #D8C098 | Beige claro, arenoso |

**HUMO**
| Rol | Hex | Descripcion |
|---|---|---|
| Outline | #2A2A3A | Gris azulado oscuro |
| Sombra/cuerpo | #8888A0 | Gris lavanda medio |
| Highlight | #C8C8D8 | Gris claro casi blanco |

**VIENTO**
| Rol | Hex | Descripcion |
|---|---|---|
| Outline | #1A3A2A | Verde grisaceo oscuro |
| Sombra/cuerpo | #78A890 | Verde menta medio, aireado |
| Highlight | #C0E8D0 | Menta muy claro |

**RESINA**
| Rol | Hex | Descripcion |
|---|---|---|
| Outline | #3A2A0A | Ambar muy oscuro |
| Sombra/cuerpo | #B89040 | Ambar dorado medio |
| Highlight | #E8D090 | Ambar claro, miel |

**METAL**
| Rol | Hex | Descripcion |
|---|---|---|
| Outline | #1A1A2A | Gris acero muy oscuro |
| Sombra/cuerpo | #7888A0 | Gris azulado metalico |
| Highlight | #B8C8D8 | Plateado claro |

**ESPIRITU**
| Rol | Hex | Descripcion |
|---|---|---|
| Outline | #2A1A3A | Purpura muy oscuro |
| Sombra/cuerpo | #8868A8 | Lavanda medio |
| Highlight | #C8A8E0 | Lavanda claro, mistico |

---

## 3. PROPORCIONES Y DISENO

### Etapa Basica (baby):
- Tamano en canvas: ~24x24 a 32x32 px (centrado en 56x56)
- Proporciones: **super chibi** — cabeza = 50-60% del cuerpo
- Expresion: tierna, ojos grandes (2-3px), sonrisa simple
- Pose: frontal, cuerpo compacto, patas cortas
- Detalles: minimos, solo los rasgos esenciales del monstruo

### Etapa 1 (medio):
- Tamano en canvas: ~36x40 px
- Proporciones: **chibi moderado** — cabeza = 35-40% del cuerpo
- Expresion: mas segura/determinada, ojos medios
- Pose: frontal con leve actitud, brazos/extremidades mas definidos
- Detalles: se agregan 1-2 features nuevas (alas incipientes, patron, cresta)

### Etapa 2 (final):
- Tamano en canvas: ~44x52 px (llena 70-85% del canvas)
- Proporciones: **semi-chibi** — cabeza = 25-30% del cuerpo. MAS BALANCEADO, no monstruoso
- Expresion: **confiada y serena, NO agresiva**. Mirada firme pero no amenazante
- Pose: de pie, erguida, postura de "companero poderoso"
- Detalles: features del baby evolucionadas (llama pequeña → llama grande, brote → arbol)

### REGLA CLAVE PARA EVOLUCIONES FINALES:
- Deben verse como **"companeros fuertes"**, no como bestias terrorficas
- Mantener proporciones organicas y amigables
- Los ojos siguen siendo expresivos y relativamente grandes
- La silueta debe ser legible y limpia, no sobrecargada
- Piensa en Typhlosion, Meganium, Feraligatr de Crystal — fuertes pero NO monstruosos

---

## 4. PROMPT TEMPLATE PARA GENERACION

Usar este template base para TODOS los sprites, cambiando solo la descripcion de la criatura:

```
[CREATURE DESCRIPTION].
Pokemon Crystal GBC sprite style, 56x56 pixel art, exactly 4 colors only (black outline + 2 body tones + white/transparent),
front-facing battle pose, 1-pixel black outline fully closed,
light source from upper-left, 2-tone shading only (mid tone body + lighter highlight),
NO anti-aliasing, NO dithering, NO gradients, hard pixel edges,
semi-chibi proportions with large expressive eyes,
calm confident expression NOT aggressive or monstrous,
clean readable silhouette, transparent background,
use ONLY these exact colors: outline [HEX], body [HEX], highlight [HEX], plus transparency
```

---

## 5. LO QUE NO HACER

- NO usar mas de 4 colores por sprite
- NO usar gradientes o sombreado suave
- NO hacer evoluciones finales que parezcan demonios/kaijus
- NO sobreccargar de detalles — en 56x56 menos es mas
- NO usar colores saturados/neon — todo debe ser calido y armonioso
- NO hacer outlines de color — siempre negro o el tono mas oscuro
- NO poner texto, etiquetas o fondos de color
