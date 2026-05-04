# ENROLA LEGENDS — Documento de Diseno de Juego (GDD)

**Version:** 2.0
**Fecha:** 31 de marzo de 2026
**Proyecto:** Enrola Legends
**Plataforma:** Navegador web (enrola.shop)
**Genero:** Roguelike RPG por turnos, estilo Pokemon
**Ambientacion:** Valencia, Venezuela
**Vinculado a:** enrola.shop (tienda de accesorios para fumar)

---

## TABLA DE CONTENIDOS

1. Vision general
2. Especificaciones tecnicas
3. Direccion visual
4. Sistema de tipos (10 tipos)
5. Tabla de efectividad 10x10
6. Sistema de sinergias de equipo
7. Zona de descanso — El Vinedo / La Vina
8. Mazmorras (12 zonas)
9. El Dex — 150 criaturas

---

## 1. VISION GENERAL

Enrola Legends es un roguelike RPG por turnos jugable desde el navegador, integrado en la tienda enrola.shop. El jugador explora mazmorras basadas en lugares reales de Valencia, Venezuela, captura y entrena criaturas inspiradas en la cultura valenciana, venezolana y la cultura del fumado. El objetivo es completar el Dex de 150 criaturas, derrotar a los jefes de cada mazmorra y convertirse en Maestro Enrolador.

**Mecanicas clave:**
- Equipos de **6 criaturas**
- Combate por turnos 1v1 con cambios estrategicos
- Mazmorras roguelike con pisos generados proceduralmente
- Sistema de 10 tipos elementales con sinergias de equipo
- Captura de criaturas usando "Papelillos" (equivalente a las Pokeballs)
- Zona hub "El Vinedo / La Vina" para gestion entre runs
- Integracion con la tienda: desbloquear cosmeticos y descuentos al completar logros

---

## 2. ESPECIFICACIONES TECNICAS

| Parametro | Valor |
|---|---|
| Framerate objetivo | **24 FPS** |
| Resolucion base | 320x240 (escalado x2 o x3) |
| Tamano de equipo | **6 criaturas** |
| Motor | Canvas 2D / WebGL ligero |
| Audio | Web Audio API, samples cortos |
| Guardado | LocalStorage + sync con cuenta enrola.shop |
| Tamano objetivo | < 5 MB carga inicial, assets bajo demanda |

---

## 3. DIRECCION VISUAL

**Filosofia: Minimalismo funcional.**

- Sprites de criaturas: **2-3 frames** de animacion (idle, ataque, dano)
- Sin sistema de particulas
- Sin screen shake
- Sin animaciones excesivas ni efectos de destello
- UI limpia, texto legible, colores planos con la paleta de enrola.shop (#BB3B2E rojo, #4D5431 verde, #F5F2E8 crema)
- Transiciones simples: fade negro de 0.3s
- Mapas de mazmorra: tiles de 16x16
- Estetica referencial: GBA Pokemon pero aun mas minimalista
- Prioridad absoluta: rendimiento en dispositivos de gama baja y conexiones lentas

---

## 4. SISTEMA DE 10 TIPOS ELEMENTALES

Los 10 tipos combinan tematica valenciana con cultura del fumado:

| # | Tipo | Icono | Tematica |
|---|---|---|---|
| 1 | **HUMO** | Nube gris | Humo, vapor, niebla, lo etéreo |
| 2 | **BRASA** | Ascua roja | Fuego, calor, encendedores, combustion |
| 3 | **HIERBA** | Hoja verde | Cannabis, plantas, naturaleza, hemp |
| 4 | **CRISTAL** | Prisma azul | Vidrio (bongs, pipas), cristales, terpenos cristalizados |
| 5 | **TIERRA** | Roca marron | Suelo, barro del Cabriales, arcilla, ceramica |
| 6 | **AGUA** | Gota azul | Rio Cabriales, cascadas, humedad |
| 7 | **VIENTO** | Espiral blanca | Aire, brisa, corrientes, inhalar/exhalar |
| 8 | **RESINA** | Gota ambar | Resina, pegajoso, terpenos, concentrados |
| 9 | **METAL** | Engranaje plateado | Grinders, pipas metalicas, maquinaria, industria |
| 10 | **ESPIRITU** | Ojo violeta | Lo mistico, la calma, la elevacion, meditacion |

---

## 5. TABLA DE EFECTIVIDAD 10x10

Lectura: Fila ataca a Columna. **2** = super efectivo, **1** = normal, **0.5** = poco efectivo, **0** = inmune.

| Atacante \ Defensor | HUMO | BRASA | HIERBA | CRISTAL | TIERRA | AGUA | VIENTO | RESINA | METAL | ESPIRITU |
|---|---|---|---|---|---|---|---|---|---|---|
| **HUMO** | 1 | 0.5 | 1 | 1 | 1 | 1 | 0.5 | 2 | 1 | 2 |
| **BRASA** | 2 | 1 | 2 | 0.5 | 1 | 0.5 | 1 | 2 | 0.5 | 1 |
| **HIERBA** | 1 | 0.5 | 1 | 1 | 2 | 2 | 1 | 0.5 | 0.5 | 1 |
| **CRISTAL** | 1 | 0.5 | 1 | 1 | 0.5 | 1 | 2 | 1 | 2 | 0.5 |
| **TIERRA** | 1 | 2 | 0.5 | 2 | 1 | 0.5 | 0 | 1 | 2 | 1 |
| **AGUA** | 1 | 2 | 0.5 | 1 | 2 | 1 | 1 | 0.5 | 1 | 1 |
| **VIENTO** | 2 | 1 | 1 | 0.5 | 1 | 1 | 1 | 1 | 0.5 | 2 |
| **RESINA** | 0.5 | 0.5 | 2 | 1 | 1 | 2 | 1 | 1 | 1 | 0.5 |
| **METAL** | 1 | 1 | 2 | 0.5 | 0.5 | 1 | 2 | 1 | 1 | 0.5 |
| **ESPIRITU** | 0.5 | 1 | 1 | 2 | 1 | 1 | 0.5 | 2 | 2 | 1 |

**Logica de la tabla:**
- BRASA quema HIERBA y evapora HUMO, pero el AGUA la apaga y CRISTAL resiste el calor.
- HIERBA absorbe AGUA y TIERRA, pero es debil al fuego y las cuchillas de METAL.
- CRISTAL corta el VIENTO y destruye METAL, pero TIERRA lo aplasta.
- TIERRA es inmune a VIENTO (no lo mueve), aplasta BRASA/CRISTAL/METAL.
- HUMO envuelve a RESINA y confunde al ESPIRITU, pero BRASA lo disipa.
- ESPIRITU trasciende CRISTAL/RESINA/METAL (lo material), pero HUMO y RESINA lo nublan.
- RESINA atrapa HIERBA y AGUA (pegajoso), pero BRASA la quema.
- METAL corta HIERBA y VIENTO, pero TIERRA y CRISTAL lo superan.

---

## 6. SISTEMA DE TIPOS — RESUMEN DEFENSIVO

Igual que Pokemon: cada tipo tiene debilidades, resistencias e inmunidades. Si una criatura tiene dos tipos, se multiplican (4x, 0.25x, etc).

### Resumen por tipo (defensivo):

| Tipo | Debil a (x2 daño recibido) | Resiste (x0.5 daño recibido) | Inmune a (x0 daño) |
|---|---|---|---|
| **HUMO** | BRASA, VIENTO | RESINA, ESPIRITU | — |
| **BRASA** | AGUA, TIERRA | HIERBA, RESINA, METAL | — |
| **HIERBA** | BRASA, METAL | AGUA, TIERRA | — |
| **CRISTAL** | TIERRA, BRASA | VIENTO, METAL | — |
| **TIERRA** | AGUA, HIERBA | BRASA, CRISTAL, METAL | VIENTO |
| **AGUA** | HIERBA, RESINA | BRASA, TIERRA | — |
| **VIENTO** | CRISTAL, METAL | HUMO, ESPIRITU | — |
| **RESINA** | BRASA, HUMO | HIERBA, AGUA | — |
| **METAL** | TIERRA, CRISTAL, ESPIRITU | HIERBA, VIENTO | — |
| **ESPIRITU** | HUMO, VIENTO | CRISTAL, RESINA, METAL | — |

### Inmunidades:
- **TIERRA** es inmune a **VIENTO** (el viento no mueve la montaña)

### Logica narrativa:
- **Triangulo principal:** BRASA > HIERBA > AGUA > BRASA (fuego quema hierba, hierba absorbe agua, agua apaga fuego)
- **Triangulo secundario:** CRISTAL > VIENTO > HUMO > RESINA > CRISTAL (cristal corta viento, viento dispersa humo, humo impregna resina)
- **TIERRA** aplasta lo fragil (Brasa, Cristal, Metal) pero la erosionan (Agua, Hierba)
- **METAL** corta lo organico (Hierba, Viento) pero lo superan los materiales duros (Tierra, Cristal) y lo espiritual
- **ESPIRITU** trasciende lo material (Cristal, Resina, Metal) pero lo confunden el Humo y el Viento
- **RESINA** atrapa lo vivo (Hierba, Agua) pero el calor la destruye (Brasa, Humo)

### Regla STAB:
Igual que Pokemon: si una criatura usa un movimiento de su mismo tipo, el daño recibe un bonus de **x1.5** (Same Type Attack Bonus).

### Criaturas de doble tipo:
Las efectividades se multiplican. Un ataque de BRASA contra una criatura HIERBA/RESINA hace **x4** (2 x 2). Un ataque de BRASA contra una criatura AGUA/CRISTAL hace **x0.25** (0.5 x 0.5).

---

## 7. ZONA DE DESCANSO — EL VINEDO / LA VINA

El Vinedo (tambien conocido como La Vina) es la zona hub central del juego. Es un barrio residencial y comercial iconico de Valencia, y aqui el jugador regresa entre mazmorras.

**Ubicaciones dentro del hub:**

| Lugar | Funcion |
|---|---|
| **Plaza del Vinedo** | Punto de spawn, tablero de misiones diarias |
| **Tienda RYO** | Comprar Papelillos, pociones, items de evolucion (vinculado a enrola.shop) |
| **Centro de Criaturas** | Curar equipo, gestionar equipo de 6, ver stats |
| **El Parque** | Zona de entrenamiento libre contra criaturas salvajes |
| **Cafe La Esquina** | NPC que da lore, tips y misiones secundarias |
| **Casa del Jugador** | Ver logros, trofeos, Dex, estadisticas |
| **Taller del Artesano** | Craftear items, combinar materiales de mazmorras |

---

## 8. MAZMORRAS (12 ZONAS)

Cada mazmorra tiene entre 5 y 15 pisos generados proceduralmente. Al final de cada mazmorra hay un jefe unico.

| # | Mazmorra | Referencia real | Pisos | Nivel sugerido | Tema |
|---|---|---|---|---|---|
| 1 | **Cuevas del Cabriales** | Rio Cabriales, Valencia | 5 | 1-8 | Tutorial. Criaturas de AGUA/TIERRA. Cavernas humedas. |
| 2 | **Parque Fernando Penalver** | Parque Fernando Penalver | 6 | 5-12 | Bosque urbano. HIERBA/VIENTO dominan. |
| 3 | **Ruinas de La Pastora** | Iglesia La Pastora | 7 | 10-18 | Ruinas coloniales. ESPIRITU/TIERRA. |
| 4 | **Mercado Municipal** | Mercado de Valencia | 7 | 12-20 | Caos comercial. Todos los tipos mezclados. |
| 5 | **Fabrica Abandonada** | Zona industrial sur | 8 | 15-25 | Fabrica oxidada. METAL/BRASA. |
| 6 | **Cerro El Cafe** | Cerro El Cafe, Naguanagua | 8 | 18-28 | Montana con niebla. HUMO/VIENTO/HIERBA. |
| 7 | **Acuario de Valencia** | Acuario de Valencia | 9 | 22-32 | Profundidades acuaticas. AGUA/CRISTAL. |
| 8 | **Campo de Carabobo** | Campo de Carabobo historico | 10 | 25-35 | Campos de batalla. BRASA/METAL/TIERRA. |
| 9 | **Universidad de Carabobo** | UC, campus Barbula | 10 | 28-38 | Laboratorios y jardines. RESINA/CRISTAL/HIERBA. |
| 10 | **Torres del Teleférico** | Teleferico de Valencia | 12 | 32-42 | Alturas vertiginosas. VIENTO/ESPIRITU. |
| 11 | **CC Reda Building** | Centro Comercial Reda Building, Valencia | 12 | 36-46 | Centro comercial embrujado. Pisos de tiendas abandonadas, escaleras mecanicas rotas, food court fantasmal. ESPIRITU/METAL/CRISTAL. |
| 12 | **Sambil Valencia** | Centro Comercial Sambil Valencia | 15 | 40-50 | Mazmorra final. El Sambil transformado en laberinto dimensional. Todos los tipos al maximo. Jefe final del juego. |

**Jefes de mazmorra:**
Cada mazmorra tiene un jefe que es una criatura legendaria o epica unica. El jefe del Sambil Valencia es la criatura #150 del Dex.

---

## 9. EL DEX — 150 CRIATURAS

### Leyenda de rareza:
- **(C)** = Comun
- **(R)** = Raro
- **(E)** = Epico
- **(L)** = Legendario

### Leyenda de evolucion:
- **Nv. X** = Evoluciona al nivel X
- **Objeto** = Requiere item especifico
- **Especial** = Condicion unica descrita
- **--** = No evoluciona

---

### LINEA 1 — Tipo HIERBA (Inicial)

**#001 Cogollito** — HIERBA — Basico — (C)
Evolucion: Nv. 16 → #002
Un pequeno cogollo con ojitos. Siempre esta pegajoso.
Inspiracion: Cogollo de cannabis.

**#002 Cogollero** — HIERBA — Etapa 1 — (C)
Evolucion: Nv. 36 → #003
Cogollo maduro con hojas frondosas y actitud relajada.
Inspiracion: Planta de cannabis en floracion.

**#003 Cogolord** — HIERBA/RESINA — Etapa 2 — (R)
Evolucion: --
Majestuoso arbol de cogollos cubierto de tricomas brillantes.
Inspiracion: Planta madre legendaria, cubierta de resina.

---

### LINEA 2 — Tipo BRASA (Inicial)

**#004 Mechita** — BRASA — Basico — (C)
Evolucion: Nv. 16 → #005
Una pequena llama con forma de encendedor.
Inspiracion: Encendedor BIC clasico.

**#005 Flamero** — BRASA — Etapa 1 — (C)
Evolucion: Nv. 36 → #006
Antorcha viviente que camina con paso firme.
Inspiracion: Mechero de soplete para dabbing.

**#006 Inferñal** — BRASA/METAL — Etapa 2 — (R)
Evolucion: --
Bestia de fuego con armadura de metal forjado.
Inspiracion: Soplete industrial + cultura del dab.

---

### LINEA 3 — Tipo AGUA (Inicial)

**#007 Gotirro** — AGUA — Basico — (C)
Evolucion: Nv. 16 → #008
Gotita de agua del rio Cabriales con cara traviesa.
Inspiracion: Rio Cabriales, fuente de vida de Valencia.

**#008 Cabrialin** — AGUA — Etapa 1 — (C)
Evolucion: Nv. 36 → #009
Espiritu acuatico con forma de pez del Cabriales.
Inspiracion: Fauna acuatica del rio Cabriales.

**#009 Cabriator** — AGUA/TIERRA — Etapa 2 — (R)
Evolucion: --
Guardian colosal del rio, mitad agua, mitad piedra de rio.
Inspiracion: El rio Cabriales en su maximo caudal.

---

### LINEA 4 — Tipo VIENTO

**#010 Jalita** — VIENTO — Basico — (C)
Evolucion: Nv. 14 → #011
Pequena brisa con forma de remolino jugueton.
Inspiracion: La brisa calida de Valencia.

**#011 Ventolero** — VIENTO — Etapa 1 — (C)
Evolucion: Nv. 34 → #012
Tornado pequeno que lleva hojas y papelillos volando.
Inspiracion: Los vientos que bajan del Cerro El Cafe.

**#012 Huracanal** — VIENTO/AGUA — Etapa 2 — (R)
Evolucion: --
Tormenta tropical con ojos de ciclon y lluvia constante.
Inspiracion: Temporada de lluvias en Carabobo.

---

### LINEA 5 — Tipo CRISTAL

**#013 Bonguito** — CRISTAL — Basico — (C)
Evolucion: Nv. 18 → #014
Pequeno bong de cristal con burbujitas que suben.
Inspiracion: Mini bong de vidrio artesanal.

**#014 Bonglass** — CRISTAL — Etapa 1 — (C)
Evolucion: Nv. 38 → #015
Bong elaborado con percoladores y colores iridiscentes.
Inspiracion: Bong de cristal borosilicato de alta gama.

**#015 Prismorfo** — CRISTAL/ESPIRITU — Etapa 2 — (R)
Evolucion: --
Entidad de cristal puro que refracta la luz en arcoiris.
Inspiracion: Cristaleria artesanal + prismas opticos.

---

### LINEA 6 — Tipo TIERRA

**#016 Arepita** — TIERRA — Basico — (C)
Evolucion: Nv. 15 → #017
Arepita redonda con patitas y sonrisa calientita.
Inspiracion: La arepa venezolana, base de la alimentacion.

**#017 Arepaso** — TIERRA — Etapa 1 — (C)
Evolucion: Nv. 35 → #018
Arepa rellena gigante con brazos de maiz.
Inspiracion: Arepa reina pepiada, la mas famosa.

**#018 Arepaking** — TIERRA/BRASA — Etapa 2 — (R)
Evolucion: --
Rey de las arepas, corona de maiz dorado, aura de budare caliente.
Inspiracion: El budare (plancha) y la cultura arequera.

---

### LINEA 7 — Tipo METAL

**#019 Grindito** — METAL — Basico — (C)
Evolucion: Nv. 16 → #020
Pequeno grinder con dientes afilados y ojos curiosos.
Inspiracion: Grinder de aluminio basico.

**#020 Grindark** — METAL — Etapa 1 — (C)
Evolucion: Nv. 36 → #021
Grinder oscuro con multiples camaras y cuchillas.
Inspiracion: Grinder premium de 4 piezas.

**#021 Moledron** — METAL/HIERBA — Etapa 2 — (R)
Evolucion: --
Robot triturador gigante con plantas creciendo entre sus engranajes.
Inspiracion: Grinder industrial + simbiosis metal-planta.

---

### LINEA 8 — Tipo HUMO

**#022 Humito** — HUMO — Basico — (C)
Evolucion: Nv. 14 → #023
Nubecita de humo con cara sonolenta.
Inspiracion: La primera calada de humo.

**#023 Nebuloso** — HUMO — Etapa 1 — (C)
Evolucion: Nv. 34 → #024
Banco de niebla denso con ojos que brillan.
Inspiracion: La neblina que baja del Cerro El Cafe por las mananas.

**#024 Fumantis** — HUMO/ESPIRITU — Etapa 2 — (R)
Evolucion: --
Espiritu de humo ancestral que flota serenamente.
Inspiracion: El humo ceremonial, la conexion espiritual.

---

### LINEA 9 — Tipo RESINA

**#025 Terpino** — RESINA — Basico — (C)
Evolucion: Nv. 17 → #026
Gotita de resina ambar con aroma dulce.
Inspiracion: Terpenos del cannabis.

**#026 Terpenol** — RESINA — Etapa 1 — (C)
Evolucion: Nv. 37 → #027
Masa de resina dorada con forma humanoide.
Inspiracion: Concentrados de cannabis (shatter, wax).

**#027 Dabmaster** — RESINA/BRASA — Etapa 2 — (R)
Evolucion: --
Maestro de la resina fundida, aura de vapor dorado.
Inspiracion: Cultura del dabbing, extracciones premium.

---

### LINEA 10 — Tipo ESPIRITU

**#028 Calmita** — ESPIRITU — Basico — (C)
Evolucion: Nv. 18 → #029
Pequeno orbe de luz violeta que flota pacificamente.
Inspiracion: Estado de relajacion profunda.

**#029 Serenox** — ESPIRITU — Etapa 1 — (C)
Evolucion: Nv. 38 → #030
Figura meditativa envuelta en aura violeta.
Inspiracion: La calma del fumador experimentado.

**#030 Nirvanol** — ESPIRITU/HUMO — Etapa 2 — (R)
Evolucion: --
Ser iluminado que trasciende la materia, rodeado de humo sagrado.
Inspiracion: Nirvana, la elevacion total.

---

### LINEA 11 — Tipo HIERBA/TIERRA

**#031 Cachapín** — HIERBA — Basico — (C)
Evolucion: Nv. 20 → #032
Cachapa enrollada con ojitos dulces.
Inspiracion: La cachapa venezolana.

**#032 Cachapote** — HIERBA/TIERRA — Etapa 1 — (C)
Evolucion: Nv. 40 → #033
Cachapa gigante rellena de queso que se desborda.
Inspiracion: Cachapa con queso de mano.

**#033 Maizotán** — HIERBA/TIERRA — Etapa 2 — (R)
Evolucion: --
Titan de maiz con brazos de mazorca y hojas de palma.
Inspiracion: Cultivos de maiz en los valles de Carabobo.

---

### LINEA 12 — Tipo VIENTO/HIERBA

**#034 Turpial** — VIENTO — Basico — (C)
Evolucion: Nv. 22 → #035
Pajarito naranja y negro, el ave nacional.
Inspiracion: Turpial venezolano.

**#035 Turpialar** — VIENTO/HIERBA — Etapa 1 — (R)
Evolucion: --
Turpial majestuoso con alas de hojas tropicales.
Inspiracion: Turpial adulto en su habitat natural.

---

### LINEA 13 — Tipo AGUA/CRISTAL

**#036 Burbujin** — AGUA — Basico — (C)
Evolucion: Nv. 18 → #037
Burbuja de agua con cara de bebe.
Inspiracion: Burbujas de un bong filtrando.

**#037 Percolin** — AGUA/CRISTAL — Etapa 1 — (C)
Evolucion: Nv. 38 → #038
Estructura de cristal llena de agua burbujeante.
Inspiracion: Percolador de bong.

**#038 Filtrador** — AGUA/CRISTAL — Etapa 2 — (R)
Evolucion: --
Torre de cristal con cascadas internas que purifican todo.
Inspiracion: Bong de alta filtracion con multiples camaras.

---

### LINEA 14 — Tipo BRASA/HUMO

**#039 Cenicín** — BRASA — Basico — (C)
Evolucion: Nv. 16 → #040
Monticulo de ceniza con una brasa viva en el centro.
Inspiracion: Ceniza de un porro.

**#040 Cenicero** — BRASA/HUMO — Etapa 1 — (C)
Evolucion: --
Cenicero animado con brazos de humo y cara gruñona.
Inspiracion: El cenicero de la mesa de sesion.

---

### LINEA 15 — Tipo METAL/CRISTAL

**#041 Pipita** — METAL — Basico — (C)
Evolucion: Nv. 20 → #042
Pequena pipa metalica con patas cortas.
Inspiracion: Pipa de metal basica.

**#042 Pipalux** — METAL/CRISTAL — Etapa 1 — (C)
Evolucion: Nv. 40 → #043
Pipa elegante con detalles de cristal y grabados.
Inspiracion: Pipa artesanal de vidrio y metal.

**#043 Pipatron** — METAL/CRISTAL — Etapa 2 — (R)
Evolucion: --
Pipa mecanica colosal que dispara rayos de cristal.
Inspiracion: Pipa steampunk de coleccion.

---

### LINEA 16 — Tipo TIERRA/METAL

**#044 Cunaguín** — TIERRA — Basico — (C)
Evolucion: Nv. 22 → #045
Pequeno cunaguaro cachorro con manchas de barro.
Inspiracion: Cunaguaro (ocelote venezolano).

**#045 Cunaguaro** — TIERRA/METAL — Etapa 1 — (R)
Evolucion: --
Felino feroz con garras metalicas y pelaje terroso.
Inspiracion: El cunaguaro adulto, felino emblematico.

---

### LINEA 17 — Tipo HIERBA/VIENTO

**#046 Semillín** — HIERBA — Basico — (C)
Evolucion: Nv. 14 → #047
Semilla con alitas que flota con el viento.
Inspiracion: Semilla de cannabis feminizada.

**#047 Plantula** — HIERBA — Etapa 1 — (C)
Evolucion: Nv. 32 → #048
Plantita joven con sus primeras hojas de 5 puntas.
Inspiracion: Plantula de cannabis en etapa vegetativa.

**#048 Floresta** — HIERBA/VIENTO — Etapa 2 — (R)
Evolucion: --
Arbol florido que libera semillas con cada brisa.
Inspiracion: Planta madre en exterior, polinizacion por viento.

---

### LINEA 18 — Tipo RESINA/CRISTAL

**#049 Hashito** — RESINA — Basico — (C)
Evolucion: Nv. 20 → #050
Bolita oscura de hash con textura suave.
Inspiracion: Hash artesanal.

**#050 Hashrak** — RESINA/CRISTAL — Etapa 1 — (R)
Evolucion: --
Bloque de hash cristalizado con fracturas brillantes.
Inspiracion: Hash prensado premium con cristales visibles.

---

### LINEA 19 — Tipo BRASA/TIERRA

**#051 Budarín** — BRASA — Basico — (C)
Evolucion: Nv. 18 → #052
Disco de hierro caliente con ojitos.
Inspiracion: El budare (plancha para arepas).

**#052 Budarazo** — BRASA/TIERRA — Etapa 1 — (C)
Evolucion: Nv. 38 → #053
Budare gigante que camina dejando huellas de fuego.
Inspiracion: Budare de lena de campo.

**#053 Fogonero** — BRASA/TIERRA — Etapa 2 — (R)
Evolucion: --
Horno de barro viviente con llamas internas.
Inspiracion: Fogon de lena tradicional venezolano.

---

### LINEA 20 — Tipo AGUA/VIENTO

**#054 Llovizna** — AGUA — Basico — (C)
Evolucion: Nv. 16 → #055
Nubecita que gotea constantemente.
Inspiracion: Lluvias de Valencia.

**#055 Aguaceño** — AGUA/VIENTO — Etapa 1 — (R)
Evolucion: --
Nube de tormenta con vientos que giran a su alrededor.
Inspiracion: Los aguaceros torrenciales de Carabobo.

---

### LINEA 21 — Tipo HUMO/VIENTO

**#056 Vaperín** — HUMO — Basico — (C)
Evolucion: Nv. 18 → #057
Nubecita de vapor aromatico.
Inspiracion: Vaporizador de hierbas.

**#057 Vapornox** — HUMO/VIENTO — Etapa 1 — (C)
Evolucion: Nv. 38 → #058
Tornado de vapor denso con aroma a terpenos.
Inspiracion: Vaporizador de alta potencia.

**#058 Nebulón** — HUMO/VIENTO — Etapa 2 — (R)
Evolucion: --
Nebulosa viviente que cubre areas enteras con vapor.
Inspiracion: Nubes de vapor en una sesion grupal.

---

### LINEA 22 — Tipo ESPIRITU/HIERBA

**#059 Chamán** — ESPIRITU — Basico — (C)
Evolucion: Nv. 24 → #060
Pequeno espiritu con mascarita de hoja.
Inspiracion: Chamanismo herbal venezolano.

**#060 Curandol** — ESPIRITU/HIERBA — Etapa 1 — (R)
Evolucion: --
Sanador espiritual rodeado de hierbas medicinales.
Inspiracion: Curandero tradicional con hierbas.

---

### LINEA 23 — Tipo METAL/BRASA

**#061 Chispín** — METAL — Basico — (C)
Evolucion: Nv. 16 → #062
Piedra de chispa con cara electrica.
Inspiracion: Piedra de encendedor.

**#062 Chispador** — METAL/BRASA — Etapa 1 — (C)
Evolucion: Nv. 36 → #063
Mecanismo de encendido con chispas constantes.
Inspiracion: Mecanismo de encendedor Zippo.

**#063 Zipporion** — METAL/BRASA — Etapa 2 — (R)
Evolucion: --
Encendedor colosal con llama eterna y cuerpo cromado.
Inspiracion: Zippo de coleccion legendario.

---

### LINEA 24 — Tipo TIERRA/AGUA

**#064 Barrín** — TIERRA — Basico — (C)
Evolucion: Nv. 18 → #065
Bolita de barro humedo con ojitos.
Inspiracion: Barro de las orillas del Cabriales.

**#065 Fanguero** — TIERRA/AGUA — Etapa 1 — (C)
Evolucion: Nv. 38 → #066
Golem de fango con plantas creciendo encima.
Inspiracion: Fango fertil de los valles de Carabobo.

**#066 Lodazón** — TIERRA/AGUA — Etapa 2 — (R)
Evolucion: --
Pantano ambulante que arrastra todo a su paso.
Inspiracion: Zonas pantanosas cerca del lago de Valencia.

---

### LINEA 25 — Tipo CRISTAL/BRASA

**#067 Chimbito** — CRISTAL — Basico — (C)
Evolucion: Nv. 20 → #068
Trozo de cristal caliente que brilla rojo.
Inspiracion: Cristal calentado para dabbing.

**#068 Quemacris** — CRISTAL/BRASA — Etapa 1 — (R)
Evolucion: --
Estructura de cristal al rojo vivo con centro de magma.
Inspiracion: Banger de cuarzo calentado al soplete.

---

### LINEA 26 — Tipo RESINA/TIERRA

**#069 Pegosin** — RESINA — Basico — (C)
Evolucion: Nv. 16 → #070
Mancha pegajosa de resina que rueda por el suelo.
Inspiracion: Resina que se pega a los dedos.

**#070 Pegostro** — RESINA/TIERRA — Etapa 1 — (C)
Evolucion: Nv. 36 → #071
Criatura de barro y resina, lenta pero imparable.
Inspiracion: Hash mezclado con tierra (charas).

**#071 Melazón** — RESINA/TIERRA — Etapa 2 — (R)
Evolucion: --
Masa oscura y densa que absorbe todo lo que toca.
Inspiracion: Melaza oscura, lo mas pegajoso que existe.

---

### LINEA 27 — Tipo VIENTO/ESPIRITU

**#072 Suspirín** — VIENTO — Basico — (C)
Evolucion: Nv. 20 → #073
Un suspiro visible con forma de cara relajada.
Inspiracion: Exhalar el humo con paz.

**#073 Exhalón** — VIENTO/ESPIRITU — Etapa 1 — (R)
Evolucion: --
Espiritu de viento que lleva paz a donde va.
Inspiracion: La exhalacion lenta y meditativa.

---

### LINEA 28 — Tipo AGUA/RESINA

**#074 Bubblín** — AGUA — Basico — (C)
Evolucion: Nv. 22 → #075
Burbuja con liquido ambar dentro.
Inspiracion: Bubble hash (extraccion con agua).

**#075 Bubblash** — AGUA/RESINA — Etapa 1 — (C)
Evolucion: Nv. 42 → #076
Esfera de agua con resina flotando dentro.
Inspiracion: Proceso de bubble hash, hielo y agua.

**#076 Icextract** — AGUA/RESINA — Etapa 2 — (E)
Evolucion: --
Cristal de hielo con resina pura atrapada en su interior.
Inspiracion: Ice-o-lator, la extraccion mas pura.

---

### LINEA 29 — Tipo HIERBA/BRASA

**#077 Porrito** — HIERBA — Basico — (C)
Evolucion: Nv. 16 → #078
Porrito enrollado con ojitos y patitas.
Inspiracion: Un porro basico, bien enrollado.

**#078 Canuto** — HIERBA/BRASA — Etapa 1 — (C)
Evolucion: Nv. 36 → #079
Porro grande encendido con humo saliendo de la punta.
Inspiracion: El canuto clasico compartido en grupo.

**#079 Bluntazo** — HIERBA/BRASA — Etapa 2 — (R)
Evolucion: --
Blunt colosal con aura de fuego y aroma irresistible.
Inspiracion: Blunt envuelto en hoja de tabaco.

---

### LINEA 30 — Tipo METAL/VIENTO

**#080 Filtrito** — METAL — Basico — (C)
Evolucion: Nv. 18 → #081
Pequeno filtro metalico con patas de resorte.
Inspiracion: Filtro metalico reutilizable.

**#081 Filtramax** — METAL/VIENTO — Etapa 1 — (R)
Evolucion: --
Turbina de filtracion que purifica el aire a su paso.
Inspiracion: Sistema de filtracion de carbono activado.

---

### LINEA 31 — Tipo CRISTAL/AGUA

**#082 Heladín** — CRISTAL — Basico — (C)
Evolucion: Nv. 20 → #083
Cubo de hielo con cara congelada.
Inspiracion: Hielo en el bong para enfriar el humo.

**#083 Glacirin** — CRISTAL/AGUA — Etapa 1 — (C)
Evolucion: Nv. 40 → #084
Estructura de hielo con agua fluyendo por dentro.
Inspiracion: Ice bong, bong con trampa de hielo.

**#084 Crionebla** — CRISTAL/AGUA — Etapa 2 — (E)
Evolucion: --
Niebla congelada que cristaliza todo a su paso.
Inspiracion: Vapor frio del nitrogeno en extracciones.

---

### LINEA 32 — Tipo HUMO/RESINA

**#085 Rosinín** — HUMO — Basico — (C)
Evolucion: Nv. 22 → #086
Nubecita ambar que huele a pino.
Inspiracion: Rosin (extraccion por calor y presion).

**#086 Rosinero** — HUMO/RESINA — Etapa 1 — (R)
Evolucion: --
Prensa de calor viviente que exuda resina por cada poro.
Inspiracion: Prensa de rosin, tecnologia de extraccion.

---

### LINEA 33 — Tipo TIERRA/ESPIRITU

**#087 Totémico** — TIERRA — Basico — (C)
Evolucion: Nv. 24 → #088
Pequeno totem de piedra con grabados antiguos.
Inspiracion: Totems indigenas de la region de Carabobo.

**#088 Petroglin** — TIERRA/ESPIRITU — Etapa 1 — (C)
Evolucion: Nv. 44 → #089
Petroglifo animado que brilla con luz interior.
Inspiracion: Petroglifos de Vigirima, Valencia.

**#089 Ancestron** — TIERRA/ESPIRITU — Etapa 2 — (E)
Evolucion: --
Guardian ancestral de piedra, escultura viviente de los primeros habitantes.
Inspiracion: Herencia indigena de los Tacarigua.

---

### LINEA 34 — Tipo BRASA/ESPIRITU

**#090 Velita** — BRASA — Basico — (C)
Evolucion: Nv. 20 → #091
Pequena vela encendida con llama que parpadea.
Inspiracion: Velita de sesion nocturna.

**#091 Velarion** — BRASA/ESPIRITU — Etapa 1 — (R)
Evolucion: --
Candelabro flotante con llamas que susurran.
Inspiracion: Velon ceremonial, lo mistico del fuego.

---

### LINEA 35 — Tipo HIERBA/AGUA

**#092 Mangolin** — HIERBA — Basico — (C)
Evolucion: Nv. 18 → #093
Mango pequenito con hojita en la cabeza.
Inspiracion: Mangos de Valencia, abundantes en verano.

**#093 Mangotal** — HIERBA/AGUA — Etapa 1 — (C)
Evolucion: Nv. 38 → #094
Arbol de mango con frutos que gotean jugo.
Inspiracion: Arboles de mango regados por las lluvias.

**#094 Mangoboss** — HIERBA/AGUA — Etapa 2 — (R)
Evolucion: --
Mango gigante con cascada de jugo y corona de hojas.
Inspiracion: El mango de bocado, el mas dulce.

---

### LINEA 36 — Tipo METAL/TIERRA

**#095 Bolivín** — METAL — Basico — (C)
Evolucion: Nv. 22 → #096
Pequeno soldadito de metal con sombrero de batalla.
Inspiracion: Simon Bolivar, heroe de Carabobo.

**#096 Carabobín** — METAL/TIERRA — Etapa 1 — (C)
Evolucion: Nv. 42 → #097
Soldado con armadura y escudo de tierra.
Inspiracion: Batalla de Carabobo.

**#097 Libertador** — METAL/TIERRA — Etapa 2 — (E)
Evolucion: --
General acorazado con espada y capa, aura dorada.
Inspiracion: Simon Bolivar en la Batalla de Carabobo.

---

### LINEA 37 — Tipo CRISTAL/ESPIRITU

**#098 Vitralín** — CRISTAL — Basico — (C)
Evolucion: Nv. 24 → #099
Pedazo de vitral con luz propia.
Inspiracion: Vitrales de la Catedral de Valencia.

**#099 Vitralux** — CRISTAL/ESPIRITU — Etapa 1 — (R)
Evolucion: --
Ventanal de vitral flotante que proyecta luces de colores.
Inspiracion: Vitrales de iglesias coloniales de Valencia.

---

### LINEA 38 — Tipo RESINA/HUMO

**#100 Waxito** — RESINA — Basico — (C)
Evolucion: Nv. 20 → #101
Gotita de cera (wax) con textura cremosa.
Inspiracion: Wax de cannabis.

**#101 Waxmelt** — RESINA/HUMO — Etapa 1 — (R)
Evolucion: --
Masa de wax que se derrite constantemente generando vapor.
Inspiracion: Wax derritiendose en un banger caliente.

---

### LINEA 39 — Tipo VIENTO/METAL

**#102 Molinín** — VIENTO — Basico — (C)
Evolucion: Nv. 18 → #103
Molinillo de viento hecho de metal liviano.
Inspiracion: Molinillos decorativos.

**#103 Turbinox** — VIENTO/METAL — Etapa 1 — (R)
Evolucion: --
Turbina eolica viviente que genera viento cortante.
Inspiracion: Torres de viento industriales.

---

### LINEA 40 — Tipo HUMO/TIERRA

**#104 Sahumerín** — HUMO — Basico — (C)
Evolucion: Nv. 20 → #105
Incensario pequeno de barro que humea suavemente.
Inspiracion: Sahumerio de hierbas.

**#105 Sahumador** — HUMO/TIERRA — Etapa 1 — (C)
Evolucion: Nv. 40 → #106
Vasija de ceramica con humo constante y aromas.
Inspiracion: Sahumerio ceremonial venezolano.

**#106 Incensario** — HUMO/TIERRA — Etapa 2 — (E)
Evolucion: --
Templo miniatura de barro que exhala humo sagrado.
Inspiracion: Incensarios de las iglesias coloniales de Valencia.

---

### LINEA 41 — Tipo AGUA/ESPIRITU

**#107 Tacarito** — AGUA — Basico — (C)
Evolucion: Nv. 22 → #108
Gotita del lago con brillo misterioso.
Inspiracion: Lago de Valencia (Tacarigua).

**#108 Tacarigua** — AGUA/ESPIRITU — Etapa 1 — (R)
Evolucion: --
Espiritu del lago con aura azul y ojos profundos.
Inspiracion: Lago de Valencia y la cultura Tacarigua.

---

### LINEA 42 — Tipo HIERBA/METAL

**#109 Tijerin** — HIERBA — Basico — (C)
Evolucion: Nv. 18 → #110
Plantita con hojas en forma de tijera.
Inspiracion: Tijeras de poda para cannabis.

**#110 Podarex** — HIERBA/METAL — Etapa 1 — (R)
Evolucion: --
Planta con brazos de tijera que poda todo a su paso.
Inspiracion: Poda apical y tecnicas de cultivo.

---

### LINEA 43 — Tipo BRASA/VIENTO

**#111 Chispita** — BRASA — Basico — (C)
Evolucion: Nv. 16 → #112
Chispa diminuta que rebota por todos lados.
Inspiracion: Chispas de un encendedor.

**#112 Llamarada** — BRASA/VIENTO — Etapa 1 — (R)
Evolucion: --
Rafaga de fuego alimentada por el viento.
Inspiracion: Fuego avivado por la brisa.

---

### LINEA 44 — Tipo CRISTAL/METAL

**#113 Perkito** — CRISTAL — Basico — (C)
Evolucion: Nv. 22 → #114
Pequeno percolador de cristal con marco metalico.
Inspiracion: Downstem de bong.

**#114 Perkador** — CRISTAL/METAL — Etapa 1 — (C)
Evolucion: Nv. 42 → #115
Sistema de percolacion complejo con estructura metalica.
Inspiracion: Percolador tree arm.

**#115 Perkmaster** — CRISTAL/METAL — Etapa 2 — (E)
Evolucion: --
Torre de percolacion con mecanismos de relojeria y cristal.
Inspiracion: Bong cientifico de cristal con joins metalicos.

---

### LINEA 45 — Tipo RESINA/ESPIRITU

**#116 Aromín** — RESINA — Basico — (C)
Evolucion: Nv. 20 → #117
Gotita flotante que emite aroma hipnotico.
Inspiracion: Aromas de terpenos (limoneno, mirceno).

**#117 Aromantis** — RESINA/ESPIRITU — Etapa 1 — (R)
Evolucion: --
Nube aromatica con conciencia propia que induce paz.
Inspiracion: Aromaterapia con terpenos de cannabis.

---

### LINEA 46 — Tipo TIERRA/CRISTAL (linea corta epica)

**#118 Polvorín** — TIERRA — Basico — (R)
Evolucion: Nv. 30 → #119
Monticulo de polvo fino con destellos.
Inspiracion: Polvorosas (dulce tipico de Valencia).

**#119 Polvorosa** — TIERRA/CRISTAL — Etapa 1 — (E)
Evolucion: --
Criatura de azucar cristalizada y harina, dulce pero poderosa.
Inspiracion: Las polvorosas de Valencia, patrimonio culinario.

---

### LINEA 47 — Tipo HIERBA/ESPIRITU (linea corta epica)

**#120 Guacamín** — HIERBA — Basico — (R)
Evolucion: Nv. 30 → #121
Guacamaya bebe con plumas verdes brillantes.
Inspiracion: Guacamaya venezolana.

**#121 Guacamaya** — HIERBA/ESPIRITU — Etapa 1 — (E)
Evolucion: --
Guacamaya majestuosa con aura espiritual y plumas de hoja.
Inspiracion: Guacamaya bandera, ave emblematica.

---

### LINEA 48 — Tipo AGUA/METAL (linea corta epica)

**#122 Conservín** — AGUA — Basico — (R)
Evolucion: Nv. 30 → #123
Lata de conserva con liquido magico dentro.
Inspiracion: Conservas (dulce de coco tipico).

**#123 Conservero** — AGUA/METAL — Etapa 1 — (E)
Evolucion: --
Tarro metalico gigante que contiene oceanos enteros.
Inspiracion: Las conservas de coco de Valencia.

---

### LINEA 49 — Tipo BRASA/RESINA (linea corta epica)

**#124 Carboncín** — BRASA — Basico — (R)
Evolucion: Nv. 30 → #125
Carbon encendido que brilla al rojo.
Inspiracion: Carbon para hookah/narguile.

**#125 Narguilor** — BRASA/RESINA — Etapa 1 — (E)
Evolucion: --
Narguile viviente con humo aromatico y brasas eternas.
Inspiracion: Cultura del narguile/hookah.

---

### LINEA 50 — Tipo VIENTO/HUMO (linea corta epica)

**#126 Hallaquín** — VIENTO — Basico — (R)
Evolucion: Nv. 30 → #127
Hallaca envuelta en hojas que flota con el viento.
Inspiracion: La hallaca, plato navideno venezolano.

**#127 Hallacazo** — VIENTO/HUMO — Etapa 1 — (E)
Evolucion: --
Hallaca gigante envuelta en vapor aromatico que vuela.
Inspiracion: Hallaca de abuela, la mas sabrosa.

---

### CRIATURAS INDEPENDIENTES (sin evolucion)

**#128 Papelón** — HIERBA — Independiente — (C)
Evolucion: --
Rollo de papelillos con patas que corre por todos lados.
Inspiracion: Papelillos de liar (rolling papers).

**#129 Filtrox** — METAL — Independiente — (C)
Evolucion: --
Filtro de carton con actitud de guardaespaldas.
Inspiracion: Tips/filtros de carton para porros.

**#130 Clippy** — METAL/BRASA — Independiente — (C)
Evolucion: --
Encendedor recargable con sonrisa picara y rueda giratoria.
Inspiracion: Encendedor Clipper, el favorito de los fumadores.

**#131 Bongolón** — CRISTAL/AGUA — Independiente — (R)
Evolucion: --
Bong enorme y torpe que tropieza pero es muy resistente.
Inspiracion: El bong gigante que todos quieren pero nadie necesita.

**#132 Vaporcito** — HUMO/METAL — Independiente — (R)
Evolucion: --
Vaporizador portatil con pantallita LED y personalidad tech.
Inspiracion: Vaporizador herbal portatil.

**#133 Enrollao** — HIERBA/HUMO — Independiente — (R)
Evolucion: --
Ser humanoide hecho de hojas enrolladas, siempre calmado.
Inspiracion: El arte de enrollar. "Esta bien enrollao."

**#134 Moledora** — METAL/HIERBA — Independiente — (R)
Evolucion: --
Version femenina y elegante del Grinder, con flores brotando.
Inspiracion: Grinder con kief catcher.

**#135 Chaguaramín** — HIERBA/VIENTO — Independiente — (R)
Evolucion: --
Palmera enana del Paseo Cabriales que lanza cocos.
Inspiracion: Chaguaramos del paseo Cabriales.

**#136 Hamaquero** — VIENTO/ESPIRITU — Independiente — (R)
Evolucion: --
Hamaca flotante que duerme y suena perpetuamente.
Inspiracion: La hamaca venezolana, siesta eterna.

**#137 Papagallo** — VIENTO/BRASA — Independiente — (R)
Evolucion: --
Papagayo (cometa) de fuego que surca los cielos.
Inspiracion: Papagayos (cometas) que vuelan en Valencia.

**#138 Roncador** — HUMO/ESPIRITU — Independiente — (R)
Evolucion: --
Criatura dormilona que ronca nubes de humo relajante.
Inspiracion: La siesta post-sesion.

**#139 Munchero** — TIERRA/HIERBA — Independiente — (R)
Evolucion: --
Criatura hambrienta que devora todo, especialmente snacks.
Inspiracion: Los munchies, el hambre post-fumada.

**#140 Pasillero** — ESPIRITU/CRISTAL — Independiente — (R)
Evolucion: --
Fantasma de pasillo de centro comercial, transparente y escurridizo.
Inspiracion: Los pasillos vacios del CC Reda Building.

---

### CRIATURAS EPICAS INDEPENDIENTES

**#141 Caobón** — HIERBA/TIERRA — Independiente — (E)
Evolucion: --
Arbol de caoba viviente, enorme y ancestral.
Inspiracion: Caobos del Parque Fernando Penalver.

**#142 Teleférix** — VIENTO/METAL — Independiente — (E)
Evolucion: --
Cabina de teleferico viviente que patrulla las alturas.
Inspiracion: Teleferico de Valencia.

**#143 Pilandero** — TIERRA/BRASA — Independiente — (E)
Evolucion: --
Pilon gigante de madera que machaca con fuerza volcanica.
Inspiracion: El pilon para hacer hallacas.

**#144 Sambilón** — CRISTAL/METAL — Independiente — (E)
Evolucion: --
Entidad que es un centro comercial miniatura viviente.
Inspiracion: Sambil Valencia, el centro comercial mas grande.

**#145 Redactor** — ESPIRITU/METAL — Independiente — (E)
Evolucion: --
Guardian fantasmal del Reda Building con llaves de todas las tiendas.
Inspiracion: CC Reda Building, el edificio emblematico.

---

### CRIATURAS LEGENDARIAS (1 por ubicacion especial)

**#146 Cabrialesix** — AGUA/ESPIRITU — Legendario — (L)
Evolucion: --
Dragon serpiente ancestral del rio Cabriales. Solo aparece cuando el rio crece.
Inspiracion: Espiritu mitico del rio Cabriales.
Ubicacion: Jefe secreto de Cuevas del Cabriales (requiere completar todas las mazmorras 1-6 primero).

**#147 Penalveris** — HIERBA/ESPIRITU — Legendario — (L)
Evolucion: --
Arbol sagrado gigante, guardián del parque. Sus raíces abarcan toda Valencia.
Inspiracion: Espiritu del Parque Fernando Penalver.
Ubicacion: Evento especial en Parque Fernando Penalver despues de capturar 100 criaturas.

**#148 Carabobex** — METAL/BRASA — Legendario — (L)
Evolucion: --
Guerrero espectral de la Batalla de Carabobo, armadura dorada y espada de fuego.
Inspiracion: Los heroes de la Batalla de Carabobo de 1821.
Ubicacion: Jefe final de Campo de Carabobo.

**#149 Redantom** — ESPIRITU/CRISTAL — Legendario — (L)
Evolucion: --
Entidad dimensional atrapada entre los pisos del Reda Building. Distorsiona la realidad.
Inspiracion: El Reda Building como portal entre dimensiones.
Ubicacion: Jefe final de CC Reda Building (piso 12).

**#150 Enrolador** — TODOS — Legendario — (L)
Evolucion: --
El Maestro Enrolador. Ser supremo que domina los 10 tipos. Corona de humo, cuerpo de cristal, corazon de brasa, alma de espiritu. Es la esencia de Enrola.
Inspiracion: La tienda enrola.shop encarnada. El acto perfecto de enrollar.
Ubicacion: Jefe final del Sambil Valencia (piso 15). Solo accesible tras derrotar a los otros 11 jefes.

---

## RESUMEN DEL DEX

| Rareza | Cantidad | Porcentaje |
|---|---|---|
| Comun (C) | 100 | 66.7% |
| Raro (R) | 30 | 20.0% |
| Epico (E) | 15 | 10.0% |
| Legendario (L) | 5 | 3.3% |
| **Total** | **150** | **100%** |

**Lineas evolutivas:** 50 lineas totales
- 3 etapas (Basico → Etapa 1 → Etapa 2): 22 lineas = 66 criaturas
- 2 etapas (Basico → Etapa 1): 28 lineas = 56 criaturas
- Independientes sin evolucion: 18 criaturas (incluye 5 legendarios)
- Independientes con evolucion: 10 criaturas miscelaneas
- **Total: 150 criaturas**

**Distribucion por tipo primario:**

| Tipo | Como primario | Como secundario |
|---|---|---|
| HIERBA | 22 | 10 |
| BRASA | 16 | 10 |
| AGUA | 15 | 9 |
| METAL | 15 | 11 |
| CRISTAL | 14 | 10 |
| HUMO | 13 | 8 |
| VIENTO | 13 | 8 |
| TIERRA | 14 | 8 |
| RESINA | 12 | 7 |
| ESPIRITU | 11 | 11 |

---

## NOTAS FINALES

- El numero #069 para Pegosin es intencional.
- El Enrolador (#150) es el unico con tipo "TODOS" — recibe STAB de cualquier movimiento pero tambien recibe dano super efectivo de todo.
- Las sinergias de equipo incentivan equipos mixtos en vez de mono-tipo.
- Los 5 legendarios estan distribuidos entre mazmorras tempranas (secreto), medias y tardias.
- El sistema de 24 FPS permite animaciones simples y fluidas en dispositivos de gama baja.
- Los nombres estan limitados a 12 caracteres maximo para caber en la UI minimalista.

---

*Documento generado para enrola.shop — Enrola Legends v2.0*
