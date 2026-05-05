# Cómo hacer un Reel · Workflow Enrola

**Orden no negociable** — el Reel se arma al ritmo de la narración:

```
1. Guion        →  define qué se dice y cuánto dura
2. Narración    →  generar voz con ElevenLabs
3. Gráficos     →  escenas sincronizadas al audio
4. Música       →  capa de fondo ducked
```

Hacerlo en este orden garantiza que nada suene apurado ni sobre-dilatado.

---

## Fase 1 · Guion

Template para escribir el guion (archivo `mes-2/post-NN/narration.txt`):

```
[Escena 1 · Hook — 2 a 3 segundos]
Frase de apertura corta. Una pregunta o afirmación fuerte.

[Escena 2 · Desarrollo — 4 a 6 segundos]
La primera explicación. Sin relleno. Dato concreto.

[Escena 3 · Desarrollo — 4 a 6 segundos]
Segunda explicación o contraste.

[Escena 4 · CTA — 2 a 3 segundos]
Producto + precio + link.

[Cierre · 1 a 2 segundos]
El arte de armar.
```

### Reglas del guion

- **Español de Venezuela** — tuteo, nunca voseo. "Aplica" no "aplicá".
- **Lee en voz alta con cronómetro.** Si no cabe en el tiempo indicado, recorta.
- **Números en palabras** si es posible ("siete euros" suena mejor que "€7").
- **Nombres propios** tal cual ("Alien Puff", "enrola.shop") — ElevenLabs los dice bien.
- **Menos es más.** 1 idea por escena. No sobre-explicar.
- **Cierre fijo:** "Enrola. El arte de armar."

### Duraciones estimadas (multiplicador ElevenLabs × velocidad 0.90)

| Palabras | Segundos hablados aprox |
|---|---|
| 10 palabras | ≈ 4 s |
| 20 palabras | ≈ 8 s |
| 30 palabras | ≈ 12 s |
| 40 palabras | ≈ 16 s |

Un Reel de 15-18s tiene un guion de **35-45 palabras** máximo.

---

## Fase 2 · Narración (ElevenLabs)

### Configuración fija

| Parámetro | Valor |
|---|---|
| **Voice** | Daniela Valentina — Youthful and Upbeat |
| **Voice ID** | `fqf2iY1NwgXWQDrrPZjv` |
| **Model** | `eleven_multilingual_v2` |
| **Speed** | `0.98` |
| **Stability** | `0.50` |
| **Similarity boost** | `0.75` |
| **Style** | `0.00` |

Sample de referencia: [`lib/voice-samples/daniela-valentina-test.mp3`](lib/voice-samples/daniela-valentina-test.mp3)

### Generación — paso a paso (dashboard ElevenLabs)

> ⚠️ **Daniela Valentina es una professional voice.** El plan free permite generarla desde el dashboard UI pero **no** vía API. Hasta que subas a Starter ($5/mes), este paso es manual. Son 4 reels/mes · 30 segundos por cada uno.

1. [elevenlabs.io](https://elevenlabs.io) → **My Workspace → Speech Synthesis**
2. **Voice:** Daniela Valentina – Youthful and Upbeat *(ya está en tu library)*
3. **Model:** Eleven Multilingual v2
4. **Sliders:**
   - Speed `0.98`
   - Stability `50%`
   - Similarity `75%`
   - Style `0%`
5. Pega el contenido de `narration.txt` (sin los `[Escena X]` comments — el script de abajo ya los limpia)
6. **Generate** → **Download MP3**
7. Renombra a `narration.mp3` y muévelo a `mes-2/post-NN/`

### Generación automatizada (cuando upgrade a Starter)

Cuando actives el plan Starter, el siguiente comando genera el MP3 automáticamente:

```bash
cd storefront/scripts/social
./scripts/generate-narration.sh mes-2/post-05-carbon-activo
# lee mes-2/post-05-carbon-activo/narration.txt → genera narration.mp3
```

El script ya está listo. Usa la API key de `.env.local` (nunca se commitea).

### 🎤 Speech-to-Speech (graba tu voz, transforma a Daniela Valentina)

Ideal para Reels donde quieres autenticidad (cadencia/emoción real) pero mantener la voz de marca. Graba con cualquier app (Voice Memos iPhone, QuickTime, Voxal) y el script transforma tu voz a la de Daniela manteniendo todo tu timing.

**Paso a paso:**

1. Graba leyendo el `narration.txt` del Reel (iPhone Voice Memos funciona bien)
2. Exporta como MP3, M4A o WAV
3. Guarda como `<post-dir>/recording.mp3` (ej: `mes-2/post-07-pedido-bts/recording.mp3`)
4. Ejecuta:

```bash
./scripts/voice-changer.sh mes-2/post-07-pedido-bts/recording.mp3
# → genera mes-2/post-07-pedido-bts/narration.mp3 (voz transformada)
```

5. Copia a hyperframes + re-rendereas:
```bash
cp mes-2/post-07-pedido-bts/narration.mp3 mes-2/post-07-pedido-bts/source/hyperframes/narration.mp3
cd mes-2/post-07-pedido-bts/source/hyperframes
npx hyperframes render --output ../../reel.mp4
```

**Tips de grabación:**
- Ambiente silencioso (closet con ropa reduce eco)
- Lee con tu intención real (no actúes — ElevenLabs copia esa emoción)
- Pausa 0.5s entre oraciones — así el audio final tiene ritmo natural
- ⚠️ **Professional voices (como Daniela) requieren plan Starter** para API. Si estás en free, usa la UI web: [ElevenLabs → Voice Changer](https://elevenlabs.io/app/speech-synthesis/speech-to-speech), sube tu archivo, selecciona Daniela, download.

### Verificar duración

```bash
ffprobe -v error -show_entries format=duration -of csv=p=0 \
  mes-2/post-NN/narration.mp3
```

Esa duración es la que dura el Reel. **Los gráficos se ajustan a ella**, no al revés.

---

## Fase 3 · Gráficos (HyperFrames)

### Ajustar timing a la narración

1. Abre `narration.mp3` en QuickTime o en VS Code (vista audio waveform)
2. Identifica marcas de tiempo donde cambia cada "escena" del guion
3. Actualiza `source/hyperframes/index.html`:
   - `data-duration` del root = duración del MP3 + 0.5s buffer
   - Cada escena inicia/termina en la marca correspondiente
   - Las animaciones de entrada (0.4-0.6s) disparan ANTES de que llegue el texto narrado
   - Los holds (pausas) coinciden con las pausas de la voz

### Ejemplo de sincronización

```
narration.mp3 waveform:
0.0 ─┬─┬─┬──── 3.5 ────────── 9.0 ──────── 14.0 ─── 16.5
     │ │ │                    │            │
     │ hook                   │            │
     │ ↓                      │            │
     │ "¿Por qué carbón       │            │
     │  activo?"              │            │
     │                        │            │
     explicación 1            explicación 2  CTA
     "atrapa partículas..."   "humo limpio"  "€7 · enrola.shop"
```

Scene config resultante:
- S1 Hook:       0.0 – 3.5s   (silencio 0.3s al final para respirar)
- S2 Explica-1:  3.5 – 9.0s
- S3 Explica-2:  9.0 – 14.0s
- S4 CTA:        14.0 – 16.5s

### Agregar `<audio>` al composition

Dentro del `<div id="root">` del `index.html`:

```html
<audio id="voice"
       src="../narration.mp3"
       data-start="0"
       data-duration="16.5"
       data-track-index="2"
       data-volume="1.0">
</audio>

<audio id="bgm"
       src="../../../lib/music/seleccionada.mp3"
       data-start="0"
       data-duration="16.5"
       data-track-index="3"
       data-volume="0.22">
</audio>
```

**Reglas de volumen:**
- Voz: `1.0` (full)
- Música: `0.18` – `0.25` (baja, siempre por debajo de la voz)
- Nunca subas la música arriba de `0.30` — tapa la narración

### Lint + render

```bash
cd mes-2/post-NN/source/hyperframes
npx hyperframes lint
npx hyperframes render --output ../../reel.mp4
```

---

## Fase 4 · Música

### Fuentes royalty-free recomendadas

| Fuente | Uso |
|---|---|
| **Pixabay Music** | CC0 · mejor para lo-fi, electronic, ambient |
| **YouTube Audio Library** | Gratis para uso comercial, filtrable por mood |
| **Freesound.org** | CC-BY, loops cortos |
| **Uppbeat.io** | Free tier con créditos de atribución |

### Librería de música de Enrola

Guarda los tracks seleccionados en:

```
social/lib/music/
├── lofi-hiphop-chill.mp3      # educacional, BTS
├── minimal-electronic.mp3      # product-focused
├── warm-analog.mp3             # lifestyle/dominical
└── edgy-trap-beat.mp3          # promo, hype
```

### Asignación por tipo de Reel

| Reel tipo | Música sugerida |
|---|---|
| **Educational** (05 carbón, 11 tips) | minimal-electronic o lofi-hiphop-chill |
| **BTS** (07 pedido) | warm-analog o lofi-hiphop-chill |
| **Promotional** (09 mezcla) | edgy-trap-beat o minimal-electronic |

### Loop / fade

Si la música es más larga que el Reel:
- HyperFrames trimmea al `data-duration`
- Fade-out final (último 0.4s) si el beat corta abrupto:
  ```html
  <audio ... data-volume="0.22" data-fade-out="0.4"></audio>
  ```

---

## Checklist antes de publicar

- [ ] Guion leído en voz alta y cabe en el tiempo
- [ ] `narration.mp3` generado con config correcta
- [ ] Escenas HyperFrames sincronizadas a marcas del audio
- [ ] `<audio>` voz + música agregados al composition
- [ ] Música volumen ≤ 0.25
- [ ] `npx hyperframes lint` limpio (0 warnings)
- [ ] Render final: MP4 con voz + música + gráficos mezclados
- [ ] Duración final: 14-20s (sweet spot IG Reels)
- [ ] Preview en móvil antes de subir

---

## Variables de entorno

Guardar en `.env.local` (nunca commitear):

```bash
ELEVENLABS_API_KEY=sk_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
ELEVENLABS_VOICE_NAME="Daniela Valentina"
ELEVENLABS_MODEL=eleven_multilingual_v2
ELEVENLABS_SPEED=0.90
ELEVENLABS_STABILITY=0.50
ELEVENLABS_SIMILARITY=0.75
ELEVENLABS_STYLE=0.30
```

---

## Archivos de referencia

| Archivo | Uso |
|---|---|
| `scripts/generate-narration.sh` | Genera MP3 desde TXT usando ElevenLabs API |
| `.env.local` | API keys (gitignored) |
| `lib/music/*.mp3` | Biblioteca de pistas de fondo |
| `mes-2/post-NN/narration.txt` | Guion del Reel |
| `mes-2/post-NN/narration.mp3` | Audio generado |
| `mes-2/post-NN/source/hyperframes/index.html` | Composición con `<audio>` |
| `mes-2/post-NN/reel.mp4` | Entregable final |
