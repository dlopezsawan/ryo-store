# ENROLA LEGENDS — Sprite Generation Master Plan

**Version:** 1.0
**Fecha:** 31 de marzo de 2026
**Total criaturas:** 150 (50 lineas evolutivas + independientes + legendarios)
**Estilo:** Pokemon Crystal GBC (56x56, 4 colores, chibi)
**Generador:** OpenAI DALL-E / gpt-image-1

---

## LECCIONES APRENDIDAS (Batch 1-3 ya generados)

1. **OpenAI bloquea:** cannabis, marijuana, weed, drug, smoking, bong, pipe, joint, blunt, hash, lighter (en contexto de drogas)
2. **Generacion secuencial:** paralelo causa problemas de orden de archivos — generar UNO a la vez
3. **Prompts cortos:** < 200 chars en la descripcion, mas largos = mas probabilidad de bloqueo
4. **Consistencia de identidad:** cada linea tiene UN concepto base que se mantiene a traves de las 3 etapas
5. **Ya generados:** #001-#009 (Lineas 1, 2, 3) — Cogollito, Mechita, Gotirro lines

---

## SAFE LANGUAGE MAPPING

| Concepto original | Termino seguro para prompt |
|---|---|
| Cannabis bud / cogollo | botanical bud / plant bud / flower bud |
| Cannabis plant | flowering herb / aromatic plant |
| Bong | glass vessel / crystal flask / glass tower |
| Pipe (smoking) | ornate tube / metal tube creature |
| Rolling paper / papelillo | parchment scroll / paper roll |
| Grinder | gear mill / toothed disc / metal crusher |
| Joint / porro | rolled scroll / wrapped cylinder |
| Blunt | large wrapped staff / leaf-wrapped roll |
| Hash | amber resin block / dark resin ball |
| Lighter (drug context) | pocket flame / fire starter device |
| Filter / tip | metal filter disc / cardboard tube |
| Vaporizer | mist device / aroma diffuser |
| Wax (cannabis) | golden wax drop / melting wax |
| Rosin | amber pressed extract / heat-pressed resin |
| Dabbing | heated crystal method |
| Terpenos | aromatic oils / fragrant essence |
| Hookah / narguile | ornate water vessel / tall ceremonial vessel |
| Kief | golden dust / fine powder |
| Fumada / sesion | gathering / relaxation session |
| Munchies | hunger frenzy / snack craving |

**SAFE as-is:** All Venezuelan culture (arepa, cachapa, hallaca, chiguire, turpial, cunaguaro, etc.), all geographic references (Cabriales, Carabobo, Valencia, Sambil, Reda Building, etc.), fire/flame/ember/ash, crystal, resin (generic), metal gear, wind, spirit, water, earth.

---

## PROMPT TEMPLATE

All prompts follow this structure. The `[DESCRIPTION]` part is what changes per creature.

```
[DESCRIPTION]. Pokemon Crystal GBC sprite, 56x56 pixel art, 4 colors only (black outline + 2 body tones + transparent), front-facing, 1px black outline, upper-left light, no anti-aliasing, no dithering, chibi proportions, large expressive eyes, transparent background, colors: outline [HEX1], body [HEX2], highlight [HEX3]
```

---

## PALETTES QUICK REFERENCE

| Type | Outline | Body | Highlight |
|---|---|---|---|
| HIERBA | #1A2E1A | #4A7A3A | #8EC86A |
| BRASA | #4A1A0A | #C8623A | #F0C878 |
| AGUA | #0A2A4A | #4888B0 | #90D0E8 |
| CRISTAL | #1A2A3A | #6898B8 | #B8E0F0 |
| TIERRA | #2A1A0A | #A07848 | #D8C098 |
| HUMO | #2A2A3A | #8888A0 | #C8C8D8 |
| VIENTO | #1A3A2A | #78A890 | #C0E8D0 |
| RESINA | #3A2A0A | #B89040 | #E8D090 |
| METAL | #1A1A2A | #7888A0 | #B8C8D8 |
| ESPIRITU | #2A1A3A | #8868A8 | #C8A8E0 |

For dual-type creatures, use the PRIMARY type palette.

---

# PART 1: MASTER CONCEPT LIST — ALL 50 LINES + INDEPENDENTS

---

## LINE 1 — HIERBA (Starter) [ALREADY GENERATED]

| # | Name | Base Concept | Safe Keywords |
|---|---|---|---|
| 001 | Cogollito | tiny plant bud with eyes | tiny botanical bud creature, round with small leaves |
| 002 | Cogollero | mature flowering plant | flowering herb creature, leafy and relaxed |
| 003 | Cogolord | majestic resin-covered tree | majestic aromatic tree creature covered in glistening droplets |

**Evolution thread:** Always a plant/bud. Baby=tiny round bud → Mid=leafy flowering plant → Final=grand tree with resin drops.
**Palette:** HIERBA. **Status:** DONE

---

## LINE 2 — BRASA (Starter) [ALREADY GENERATED]

| # | Name | Base Concept | Safe Keywords |
|---|---|---|---|
| 004 | Mechita | tiny flame creature shaped like a fire starter | small flame creature, pocket-sized fire being |
| 005 | Flamero | walking torch creature | living torch creature, walking with steady steps |
| 006 | Inferñal | armored fire beast with metal plating | fire beast with forged metal armor, blazing mane |

**Evolution thread:** Always flame/fire. Baby=tiny flickering flame → Mid=walking torch → Final=armored fire creature.
**Palette:** BRASA. **Status:** DONE

---

## LINE 3 — AGUA (Starter) [ALREADY GENERATED]

| # | Name | Base Concept | Safe Keywords |
|---|---|---|---|
| 007 | Gotirro | water droplet with mischievous face | cute water droplet creature, playful expression |
| 008 | Cabrialin | river fish spirit | aquatic fish spirit creature, flowing fins |
| 009 | Cabriator | colossal river guardian, half water half stone | massive river guardian, half water half rock |

**Evolution thread:** Always water/river. Baby=droplet → Mid=fish spirit → Final=stone-water colossus.
**Palette:** AGUA. **Status:** DONE

---

## LINE 4 — VIENTO

| # | Name | Base Concept | Safe Keywords |
|---|---|---|---|
| 010 | Jalita | tiny playful breeze/whirlwind | tiny swirl creature, playful breeze with a face |
| 011 | Ventolero | small tornado carrying leaves | small tornado creature carrying leaves and papers |
| 012 | Huracanal | tropical storm with cyclone eyes | tropical storm creature with cyclone eyes, rain swirling |

**Evolution thread:** Always wind/air movement. Baby=gentle breeze → Mid=tornado → Final=hurricane with rain.
**Palette:** VIENTO (primary). AGUA secondary for #012.

---

## LINE 5 — CRISTAL

| # | Name | Base Concept | Safe Keywords |
|---|---|---|---|
| 013 | Bonguito | tiny crystal flask with bubbles | small crystal flask creature with rising bubbles, cute face |
| 014 | Bonglass | elaborate crystal vessel, iridescent | elaborate crystal vessel creature, iridescent with internal chambers |
| 015 | Prismorfo | pure crystal entity refracting rainbows | pure crystal entity refracting light into rainbow, ethereal |

**Evolution thread:** Always glass/crystal vessel. Baby=small flask with bubbles → Mid=ornate vessel → Final=transcendent prism being.
**Palette:** CRISTAL. ESPIRITU secondary colors optional for #015.

---

## LINE 6 — TIERRA

| # | Name | Base Concept | Safe Keywords |
|---|---|---|---|
| 016 | Arepita | tiny round arepa with legs and warm smile | tiny round corn cake creature with stubby legs, warm smile |
| 017 | Arepaso | giant stuffed arepa with corn arms | large stuffed corn cake creature, corn-husk arms, cheese filling |
| 018 | Arepaking | king of arepas, golden corn crown | majestic corn cake king, golden corn crown, radiant heat aura |

**Evolution thread:** Always an arepa (corn cake). Baby=tiny warm arepa → Mid=stuffed giant → Final=crowned king.
**Palette:** TIERRA. BRASA secondary for #018.

---

## LINE 7 — METAL

| # | Name | Base Concept | Safe Keywords |
|---|---|---|---|
| 019 | Grindito | small gear mill with sharp teeth and curious eyes | small toothed gear mill creature, curious eyes, metallic body |
| 020 | Grindark | dark multi-chambered gear crusher | dark gear crusher creature, multiple chambers, spinning blades |
| 021 | Moledron | giant crushing robot with plants in gears | giant crushing robot with plants growing between gears |

**Evolution thread:** Always a gear/crusher machine. Baby=tiny gear disc → Mid=dark multi-gear → Final=robot with plant symbiosis.
**Palette:** METAL. HIERBA secondary for #021.

---

## LINE 8 — HUMO

| # | Name | Base Concept | Safe Keywords |
|---|---|---|---|
| 022 | Humito | tiny sleepy cloud of mist | tiny cloud creature with sleepy face, wisps floating |
| 023 | Nebuloso | dense fog bank with glowing eyes | dense fog bank creature with glowing eyes peering through |
| 024 | Fumantis | ancestral mist spirit floating serenely | serene ancestral mist spirit, floating peacefully, ancient |

**Evolution thread:** Always mist/fog/cloud. Baby=tiny sleepy cloud → Mid=dense fog → Final=ancient floating spirit.
**Palette:** HUMO. ESPIRITU secondary for #024.

---

## LINE 9 — RESINA

| # | Name | Base Concept | Safe Keywords |
|---|---|---|---|
| 025 | Terpino | amber resin droplet with sweet scent | tiny amber resin droplet creature, fragrant, golden glow |
| 026 | Terpenol | golden resin humanoid mass | golden resin humanoid creature, translucent, dripping amber |
| 027 | Dabmaster | master of molten resin, golden vapor aura | molten resin master with golden vapor aura, regal stance |

**Evolution thread:** Always amber resin. Baby=tiny drop → Mid=humanoid blob → Final=resin master with vapor aura.
**Palette:** RESINA. BRASA secondary for #027.

---

## LINE 10 — ESPIRITU

| # | Name | Base Concept | Safe Keywords |
|---|---|---|---|
| 028 | Calmita | small floating violet light orb | small floating violet orb creature, peaceful glow |
| 029 | Serenox | meditative figure wrapped in violet aura | meditative figure creature wrapped in violet aura, calm |
| 030 | Nirvanol | enlightened being transcending matter, sacred mist | enlightened being surrounded by sacred mist, transcendent |

**Evolution thread:** Always spiritual/meditative. Baby=light orb → Mid=meditating figure → Final=transcendent being.
**Palette:** ESPIRITU. HUMO secondary for #030.

---

## LINE 11 — HIERBA/TIERRA

| # | Name | Base Concept | Safe Keywords |
|---|---|---|---|
| 031 | Cachapín | rolled cachapa (corn pancake) with cute eyes | small rolled corn pancake creature with cute eyes, golden |
| 032 | Cachapote | giant cachapa stuffed with melting cheese | giant corn pancake creature overflowing with melted cheese |
| 033 | Maizotán | corn titan with corn-cob arms and palm leaves | corn titan creature with corn-cob arms and palm leaf crown |

**Evolution thread:** Always cachapa/corn. Baby=tiny rolled pancake → Mid=stuffed giant → Final=corn titan.
**Palette:** HIERBA.

---

## LINE 12 — VIENTO/HIERBA (2-stage)

| # | Name | Base Concept | Safe Keywords |
|---|---|---|---|
| 034 | Turpial | baby orange-and-black bird | baby orange and black songbird creature, fluffy, perched |
| 035 | Turpialar | majestic bird with tropical leaf wings | majestic orange bird creature with tropical leaf wings, soaring |

**Evolution thread:** Always turpial bird. Baby=fluffy chick → Final=majestic leaf-winged bird.
**Palette:** VIENTO.

---

## LINE 13 — AGUA/CRISTAL

| # | Name | Base Concept | Safe Keywords |
|---|---|---|---|
| 036 | Burbujin | water bubble with baby face | cute water bubble creature with baby face, floating |
| 037 | Percolin | crystal structure full of bubbling water | crystal tower creature filled with bubbling water, chambers |
| 038 | Filtrador | crystal tower with internal cascading waterfalls | tall crystal tower creature with cascading internal waterfalls |

**Evolution thread:** Always bubble/water-in-crystal. Baby=bubble → Mid=crystal chamber → Final=purifying tower.
**Palette:** AGUA.

---

## LINE 14 — BRASA/HUMO (2-stage)

| # | Name | Base Concept | Safe Keywords |
|---|---|---|---|
| 039 | Cenicín | ash mound with a live ember in center | small ash mound creature with glowing ember core, warm |
| 040 | Cenicero | animated ash tray with mist arms and grumpy face | animated stone dish creature with misty arms, grumpy face |

**Evolution thread:** Always ash/ember. Baby=ember in ash → Final=grumpy ash dish.
**Palette:** BRASA.

---

## LINE 15 — METAL/CRISTAL

| # | Name | Base Concept | Safe Keywords |
|---|---|---|---|
| 041 | Pipita | small ornate metal tube with short legs | small ornate metal tube creature with short legs, curious |
| 042 | Pipalux | elegant tube with crystal details and engravings | elegant metal tube creature with crystal accents, engraved |
| 043 | Pipatron | colossal mechanical tube that shoots crystal beams | colossal mechanical tube creature shooting crystal beams |

**Evolution thread:** Always ornate tube/cylinder. Baby=tiny tube → Mid=elegant with crystal → Final=steampunk cannon.
**Palette:** METAL.

---

## LINE 16 — TIERRA/METAL (2-stage)

| # | Name | Base Concept | Safe Keywords |
|---|---|---|---|
| 044 | Cunaguín | baby ocelot cub with mud spots | baby ocelot cub creature with mud-spotted fur, playful |
| 045 | Cunaguaro | fierce ocelot with metallic claws and earthy fur | fierce ocelot creature with metallic claws, earthy spotted fur |

**Evolution thread:** Always cunaguaro/ocelot. Baby=cute cub → Final=fierce cat with metal claws.
**Palette:** TIERRA.

---

## LINE 17 — HIERBA/VIENTO

| # | Name | Base Concept | Safe Keywords |
|---|---|---|---|
| 046 | Semillín | winged seed floating on breeze | tiny winged seed creature floating on the breeze |
| 047 | Plántula | young plant with first five-pointed leaves | young plant creature with first leaves, growing upward |
| 048 | Floresta | flowering tree releasing seeds in the wind | grand flowering tree creature releasing seeds with each breeze |

**Evolution thread:** Always seed→plant→tree. Baby=floating seed → Mid=young sprout → Final=mature tree.
**Palette:** HIERBA.

---

## LINE 18 — RESINA/CRISTAL (2-stage)

| # | Name | Base Concept | Safe Keywords |
|---|---|---|---|
| 049 | Hashito | small dark resin ball with soft texture | small dark amber resin ball creature, smooth texture, cute |
| 050 | Hashrak | crystallized resin block with glowing fractures | crystallized amber resin block creature with glowing fracture lines |

**Evolution thread:** Always resin block. Baby=soft ball → Final=crystallized block.
**Palette:** RESINA.

---

## LINE 19 — BRASA/TIERRA

| # | Name | Base Concept | Safe Keywords |
|---|---|---|---|
| 051 | Budarín | hot iron disc with little eyes | small hot iron disc creature with little eyes, glowing red |
| 052 | Budarazo | giant walking iron disc leaving fire trails | giant walking iron disc creature leaving fire footprints |
| 053 | Fogonero | living clay oven with internal flames | living clay oven creature with roaring internal flames |

**Evolution thread:** Always cooking surface/fire. Baby=hot disc → Mid=walking giant disc → Final=clay oven.
**Palette:** BRASA.

---

## LINE 20 — AGUA/VIENTO (2-stage)

| # | Name | Base Concept | Safe Keywords |
|---|---|---|---|
| 054 | Llovizna | tiny drizzling cloud | tiny drizzling rain cloud creature, constantly dripping |
| 055 | Aguaceño | storm cloud with swirling winds | dark storm cloud creature with swirling winds around it |

**Evolution thread:** Always rain cloud. Baby=drizzle → Final=storm.
**Palette:** AGUA.

---

## LINE 21 — HUMO/VIENTO

| # | Name | Base Concept | Safe Keywords |
|---|---|---|---|
| 056 | Vaperín | tiny aromatic mist cloud | tiny aromatic mist creature, wispy and fragrant |
| 057 | Vapornox | dense vapor tornado with aroma swirls | dense vapor tornado creature with aromatic swirls |
| 058 | Nebulón | living nebula covering entire areas with mist | vast living nebula creature, covering areas with dense mist |

**Evolution thread:** Always vapor/mist. Baby=tiny aromatic cloud → Mid=vapor tornado → Final=nebula being.
**Palette:** HUMO.

---

## LINE 22 — ESPIRITU/HIERBA (2-stage)

| # | Name | Base Concept | Safe Keywords |
|---|---|---|---|
| 059 | Chamán | small spirit with leaf mask | small spirit creature wearing a leaf mask, mystical |
| 060 | Curandol | herbal healer spirit surrounded by medicinal plants | spirit healer creature surrounded by medicinal herbs, serene |

**Evolution thread:** Always shamanic/healer spirit. Baby=masked spirit → Final=herbal healer.
**Palette:** ESPIRITU.

---

## LINE 23 — METAL/BRASA

| # | Name | Base Concept | Safe Keywords |
|---|---|---|---|
| 061 | Chispín | flint stone with electric face | small flint stone creature with electric sparking face |
| 062 | Chispador | sparking ignition mechanism | sparking ignition mechanism creature, constant sparks flying |
| 063 | Zipporion | colossal chrome fire-starter with eternal flame | colossal chrome creature with eternal flame, gleaming body |

**Evolution thread:** Always sparks/ignition. Baby=flint → Mid=mechanism → Final=chrome titan with eternal flame.
**Palette:** METAL.

---

## LINE 24 — TIERRA/AGUA

| # | Name | Base Concept | Safe Keywords |
|---|---|---|---|
| 064 | Barrín | little mud ball with eyes | small wet mud ball creature with tiny eyes, round |
| 065 | Fanguero | mud golem with plants growing on it | mud golem creature with small plants growing on its body |
| 066 | Lodazón | walking swamp that drags everything along | massive walking swamp creature dragging mud and debris |

**Evolution thread:** Always mud/swamp. Baby=mud ball → Mid=mud golem → Final=walking swamp.
**Palette:** TIERRA.

---

## LINE 25 — CRISTAL/BRASA (2-stage)

| # | Name | Base Concept | Safe Keywords |
|---|---|---|---|
| 067 | Chimbito | hot glowing crystal shard | small hot crystal shard creature glowing red, warm |
| 068 | Quemacris | crystal structure at red-hot temperature with magma core | red-hot crystal structure creature with molten magma core |

**Evolution thread:** Always heated crystal. Baby=hot shard → Final=magma-core crystal.
**Palette:** CRISTAL.

---

## LINE 26 — RESINA/TIERRA

| # | Name | Base Concept | Safe Keywords |
|---|---|---|---|
| 069 | Pegosin | sticky resin blob rolling on ground | sticky amber resin blob creature rolling on the ground |
| 070 | Pegostro | mud-and-resin creature, slow but unstoppable | slow mud-and-resin creature, dense and unstoppable |
| 071 | Melazón | dark dense mass that absorbs everything it touches | massive dark dense creature that absorbs everything it touches |

**Evolution thread:** Always sticky/adhesive. Baby=rolling blob → Mid=mud-resin hybrid → Final=all-absorbing mass.
**Palette:** RESINA.

---

## LINE 27 — VIENTO/ESPIRITU (2-stage)

| # | Name | Base Concept | Safe Keywords |
|---|---|---|---|
| 072 | Suspirín | visible sigh with relaxed face shape | gentle visible sigh creature with peaceful relaxed face |
| 073 | Exhalón | wind spirit bringing peace everywhere | wind spirit creature bringing peace wherever it drifts |

**Evolution thread:** Always breath/exhalation. Baby=small sigh → Final=peaceful wind spirit.
**Palette:** VIENTO.

---

## LINE 28 — AGUA/RESINA

| # | Name | Base Concept | Safe Keywords |
|---|---|---|---|
| 074 | Bubblín | bubble with amber liquid inside | water bubble creature with amber liquid swirling inside |
| 075 | Bubblash | water sphere with floating resin inside | water sphere creature with golden resin floating within |
| 076 | Icextract | ice crystal with pure resin trapped inside | ice crystal creature with pure amber trapped in its frozen core |

**Evolution thread:** Always water containing resin. Baby=amber bubble → Mid=water sphere → Final=frozen crystal extraction.
**Palette:** AGUA.

---

## LINE 29 — HIERBA/BRASA

| # | Name | Base Concept | Safe Keywords |
|---|---|---|---|
| 077 | Porrito | small rolled scroll creature with eyes and legs | tiny rolled parchment scroll creature with cute eyes, legs |
| 078 | Canuto | larger scroll creature, lit tip with wisps rising | large rolled scroll creature with glowing tip, wisps rising |
| 079 | Bluntazo | colossal wrapped staff with fire aura and aroma waves | colossal leaf-wrapped staff creature with fire aura, majestic |

**Evolution thread:** Always rolled/wrapped cylinder. Baby=tiny scroll → Mid=lit scroll → Final=massive wrapped staff.
**Palette:** HIERBA.

---

## LINE 30 — METAL/VIENTO (2-stage)

| # | Name | Base Concept | Safe Keywords |
|---|---|---|---|
| 080 | Filtrito | small metal filter disc with spring legs | small metal filter disc creature with bouncy spring legs |
| 081 | Filtramax | turbine filtration device that purifies air | wind turbine filtration creature that purifies air around it |

**Evolution thread:** Always filter/purification. Baby=tiny disc → Final=air-purifying turbine.
**Palette:** METAL.

---

## LINE 31 — CRISTAL/AGUA

| # | Name | Base Concept | Safe Keywords |
|---|---|---|---|
| 082 | Heladín | ice cube with frozen face | cute ice cube creature with frozen surprised face |
| 083 | Glacirín | ice structure with water flowing inside | ice structure creature with water flowing through its interior |
| 084 | Crionebla | freezing mist that crystallizes everything | freezing mist creature that crystallizes everything it touches |

**Evolution thread:** Always ice/frozen water. Baby=ice cube → Mid=ice with flowing water → Final=crystallizing mist.
**Palette:** CRISTAL.

---

## LINE 32 — HUMO/RESINA (2-stage)

| # | Name | Base Concept | Safe Keywords |
|---|---|---|---|
| 085 | Rosinín | small amber cloud smelling of pine | tiny amber-tinted cloud creature with pine-scented wisps |
| 086 | Rosinero | living heat press exuding resin from every pore | living heat press creature exuding golden resin from pores |

**Evolution thread:** Always pressed resin/heat extraction. Baby=amber cloud → Final=heat press being.
**Palette:** HUMO.

---

## LINE 33 — TIERRA/ESPIRITU

| # | Name | Base Concept | Safe Keywords |
|---|---|---|---|
| 087 | Totémico | small stone totem with ancient carvings | small stone totem creature with ancient carved symbols |
| 088 | Petroglin | animated petroglyph glowing from within | animated petroglyph creature glowing with inner light |
| 089 | Ancestrón | ancestral stone guardian, living sculpture | massive ancestral stone guardian creature, living ancient sculpture |

**Evolution thread:** Always stone/ancient artifact. Baby=small totem → Mid=glowing petroglyph → Final=guardian sculpture.
**Palette:** TIERRA.

---

## LINE 34 — BRASA/ESPIRITU (2-stage)

| # | Name | Base Concept | Safe Keywords |
|---|---|---|---|
| 090 | Velita | small flickering candle creature | small flickering candle creature with blinking flame |
| 091 | Velarión | floating candelabra with whispering flames | floating candelabra creature with whispering mystical flames |

**Evolution thread:** Always candle/ceremonial fire. Baby=candle → Final=floating candelabra.
**Palette:** BRASA.

---

## LINE 35 — HIERBA/AGUA

| # | Name | Base Concept | Safe Keywords |
|---|---|---|---|
| 092 | Mangolín | tiny mango fruit with a leaf on top | tiny mango fruit creature with leaf on head, sweet face |
| 093 | Mangotal | mango tree dripping with juice | mango tree creature with juicy fruits dripping golden nectar |
| 094 | Mangoboss | giant mango with juice waterfall and leaf crown | giant mango creature with cascading juice and leaf crown |

**Evolution thread:** Always mango fruit/tree. Baby=tiny fruit → Mid=fruiting tree → Final=giant mango boss.
**Palette:** HIERBA.

---

## LINE 36 — METAL/TIERRA

| # | Name | Base Concept | Safe Keywords |
|---|---|---|---|
| 095 | Bolivín | tiny metal soldier with battle hat | tiny metal toy soldier creature with battle hat, cute |
| 096 | Carabobín | armored soldier with earth shield | armored soldier creature with earth and stone shield |
| 097 | Libertador | golden general with sword and cape | majestic golden general creature with sword, cape, golden aura |

**Evolution thread:** Always soldier/military. Baby=toy soldier → Mid=armored warrior → Final=golden general.
**Palette:** METAL.

---

## LINE 37 — CRISTAL/ESPIRITU (2-stage)

| # | Name | Base Concept | Safe Keywords |
|---|---|---|---|
| 098 | Vitralín | piece of stained glass with inner glow | small glowing stained glass shard creature, colorful light |
| 099 | Vitralux | floating stained glass window projecting colors | floating stained glass window creature projecting colored light |

**Evolution thread:** Always stained glass. Baby=glass shard → Final=full window.
**Palette:** CRISTAL.

---

## LINE 38 — RESINA/HUMO (2-stage)

| # | Name | Base Concept | Safe Keywords |
|---|---|---|---|
| 100 | Waxito | tiny creamy wax droplet | tiny golden creamy wax droplet creature, soft and round |
| 101 | Waxmelt | constantly melting wax mass generating vapor | melting golden wax creature constantly generating warm vapor |

**Evolution thread:** Always wax/melting substance. Baby=wax drop → Final=melting wax vapor.
**Palette:** RESINA.

---

## LINE 39 — VIENTO/METAL (2-stage)

| # | Name | Base Concept | Safe Keywords |
|---|---|---|---|
| 102 | Molinín | small metal windmill creature | small spinning metal windmill creature, lightweight |
| 103 | Turbinox | living wind turbine generating cutting wind | living wind turbine creature generating sharp cutting winds |

**Evolution thread:** Always windmill/turbine. Baby=pinwheel → Final=industrial turbine.
**Palette:** VIENTO.

---

## LINE 40 — HUMO/TIERRA

| # | Name | Base Concept | Safe Keywords |
|---|---|---|---|
| 104 | Sahumerín | small clay incense burner softly steaming | small clay incense burner creature, gently steaming, warm |
| 105 | Sahumador | ceramic vessel with constant aromatic mist | ceramic vessel creature with constant aromatic mist rising |
| 106 | Incensario | miniature clay temple exhaling sacred mist | miniature clay temple creature exhaling sacred aromatic mist |

**Evolution thread:** Always incense/clay burner. Baby=tiny burner → Mid=ceramic vessel → Final=temple.
**Palette:** HUMO.

---

## LINE 41 — AGUA/ESPIRITU (2-stage)

| # | Name | Base Concept | Safe Keywords |
|---|---|---|---|
| 107 | Tacarito | lake water droplet with mysterious glow | mysterious glowing lake droplet creature, deep blue shimmer |
| 108 | Tacarigua | lake spirit with deep blue aura and ancient eyes | ancient lake spirit creature with deep blue aura, wise eyes |

**Evolution thread:** Always lake/water spirit. Baby=glowing droplet → Final=ancient lake spirit.
**Palette:** AGUA.

---

## LINE 42 — HIERBA/METAL (2-stage)

| # | Name | Base Concept | Safe Keywords |
|---|---|---|---|
| 109 | Tijerín | small plant with scissor-shaped leaves | small plant creature with metallic scissor-shaped leaves |
| 110 | Podarex | plant with scissor arms that trims everything | plant creature with scissor blade arms, trimming everything |

**Evolution thread:** Always plant with cutting tools. Baby=scissor leaves → Final=scissor-armed pruner.
**Palette:** HIERBA.

---

## LINE 43 — BRASA/VIENTO (2-stage)

| # | Name | Base Concept | Safe Keywords |
|---|---|---|---|
| 111 | Chispita | tiny bouncing spark | tiny bouncing spark creature, energetic and erratic |
| 112 | Llamarada | wind-fueled fire gust | blazing fire gust creature fueled by swirling wind |

**Evolution thread:** Always sparks/fire bursts. Baby=bouncing spark → Final=wind-fed fire gust.
**Palette:** BRASA.

---

## LINE 44 — CRISTAL/METAL

| # | Name | Base Concept | Safe Keywords |
|---|---|---|---|
| 113 | Perkito | small crystal tube with metal frame | small crystal tube creature with metal frame, bubbles inside |
| 114 | Perkador | complex crystal filtration system with metal structure | complex crystal filtration creature with metal structural frame |
| 115 | Perkmaster | clockwork crystal tower with metallic mechanisms | clockwork crystal tower creature with intricate metallic gears |

**Evolution thread:** Always crystal filtration machinery. Baby=tiny tube → Mid=complex system → Final=clockwork tower.
**Palette:** CRISTAL.

---

## LINE 45 — RESINA/ESPIRITU (2-stage)

| # | Name | Base Concept | Safe Keywords |
|---|---|---|---|
| 116 | Aromín | floating aromatic droplet, hypnotic scent | floating fragrant droplet creature with hypnotic aromatic glow |
| 117 | Aromantis | sentient aromatic cloud inducing peace | sentient aromatic cloud creature that induces calm and peace |

**Evolution thread:** Always fragrance/aroma. Baby=scented drop → Final=peace-inducing aroma cloud.
**Palette:** RESINA.

---

## LINE 46 — TIERRA/CRISTAL (2-stage, Epic)

| # | Name | Base Concept | Safe Keywords |
|---|---|---|---|
| 118 | Polvorín | mound of fine sparkling dust | small mound of sparkling fine dust creature, glittering |
| 119 | Polvorosa | crystallized sugar-and-flour creature, sweet but powerful | crystallized sugar creature, sweet pastry being, powerful |

**Evolution thread:** Always polvorosa pastry/powder. Baby=dust mound → Final=crystallized pastry being.
**Palette:** TIERRA.

---

## LINE 47 — HIERBA/ESPIRITU (2-stage, Epic)

| # | Name | Base Concept | Safe Keywords |
|---|---|---|---|
| 120 | Guacamín | baby macaw with bright green feathers | baby green macaw creature, bright feathers, fluffy |
| 121 | Guacamaya | majestic macaw with spiritual aura and leaf feathers | majestic macaw creature with spiritual aura and leaf-like feathers |

**Evolution thread:** Always macaw bird. Baby=fluffy chick → Final=majestic spiritual macaw.
**Palette:** HIERBA.

---

## LINE 48 — AGUA/METAL (2-stage, Epic)

| # | Name | Base Concept | Safe Keywords |
|---|---|---|---|
| 122 | Conservín | tin can with magical liquid inside | small tin can creature with magical glowing liquid inside |
| 123 | Conservero | giant metal jar containing oceans | giant metal jar creature containing swirling ocean water within |

**Evolution thread:** Always tin can/preserved container. Baby=small can → Final=ocean-containing jar.
**Palette:** AGUA.

---

## LINE 49 — BRASA/RESINA (2-stage, Epic)

| # | Name | Base Concept | Safe Keywords |
|---|---|---|---|
| 124 | Carboncín | glowing red-hot coal | small glowing red-hot coal creature, ember bright |
| 125 | Narguilor | living ornate water vessel with aromatic mist and eternal embers | living ornate tall vessel creature with aromatic mist and eternal embers |

**Evolution thread:** Always coal/heated vessel. Baby=glowing coal → Final=ornate ceremonial vessel.
**Palette:** BRASA.

---

## LINE 50 — VIENTO/HUMO (2-stage, Epic)

| # | Name | Base Concept | Safe Keywords |
|---|---|---|---|
| 126 | Hallaquín | hallaca (leaf-wrapped food) floating on wind | leaf-wrapped tamale creature floating on the wind, festive |
| 127 | Hallacazo | giant flying hallaca wrapped in aromatic steam | giant flying leaf-wrapped tamale creature in aromatic steam |

**Evolution thread:** Always hallaca (Venezuelan tamale). Baby=floating small hallaca → Final=giant flying hallaca.
**Palette:** VIENTO.

---

## INDEPENDENTS (No Evolution) — #128 to #140

| # | Name | Type | Base Concept | Safe Keywords |
|---|---|---|---|---|
| 128 | Papelón | HIERBA | running paper roll with legs | paper roll creature running with tiny legs, energetic |
| 129 | Filtrox | METAL | cardboard tube bodyguard | tough small cardboard tube creature, bodyguard stance |
| 130 | Clippy | METAL/BRASA | rechargeable fire-starter with spinning wheel and grin | smiling rechargeable fire-starter creature with spinning wheel |
| 131 | Bongolón | CRISTAL/AGUA | huge clumsy crystal vessel, resilient | huge clumsy crystal vessel creature, stumbling but tough |
| 132 | Vaporcito | HUMO/METAL | portable mist device with LED screen personality | portable metal mist device creature with LED screen face |
| 133 | Enrollao | HIERBA/HUMO | humanoid made of rolled leaves, always calm | calm leaf-rolled humanoid creature, serene expression |
| 134 | Moledora | METAL/HIERBA | elegant female gear mill with flowers blooming | elegant gear mill creature with flowers blooming from it |
| 135 | Chaguaramín | HIERBA/VIENTO | small palm tree from the Cabriales promenade, throws coconuts | small palm tree creature throwing coconuts, playful |
| 136 | Hamaquero | VIENTO/ESPIRITU | floating hammock that sleeps and dreams forever | floating hammock creature, perpetually sleeping, dreaming |
| 137 | Papagallo | VIENTO/BRASA | fire kite soaring through skies | blazing kite creature soaring through the sky, fiery tail |
| 138 | Roncador | HUMO/ESPIRITU | sleepy creature snoring relaxing mist clouds | sleepy creature snoring out relaxing mist clouds |
| 139 | Munchero | TIERRA/HIERBA | eternally hungry creature devouring snacks | round hungry creature devouring snacks, ravenous expression |
| 140 | Pasillero | ESPIRITU/CRISTAL | transparent hallway ghost, elusive | transparent hallway ghost creature, elusive and flickering |

---

## EPIC INDEPENDENTS — #141 to #145

| # | Name | Type | Base Concept | Safe Keywords |
|---|---|---|---|---|
| 141 | Caobón | HIERBA/TIERRA | living ancient mahogany tree, enormous | massive ancient mahogany tree creature, wise and enormous |
| 142 | Teleférix | VIENTO/METAL | living cable car cabin patrolling heights | living cable car cabin creature patrolling mountain heights |
| 143 | Pilandero | TIERRA/BRASA | giant wooden mortar pounding with volcanic force | giant wooden mortar creature pounding with volcanic force |
| 144 | Sambilón | CRISTAL/METAL | living miniature shopping mall entity | living miniature shopping mall creature, glass and steel |
| 145 | Redactor | ESPIRITU/METAL | ghostly guardian with keys to every shop | ghostly building guardian creature holding many glowing keys |

---

## LEGENDARIES — #146 to #150

| # | Name | Type | Base Concept | Safe Keywords |
|---|---|---|---|---|
| 146 | Cabrialesix | AGUA/ESPIRITU | ancestral river dragon-serpent | majestic ancestral river serpent dragon creature, water aura |
| 147 | Peñalveris | HIERBA/ESPIRITU | sacred giant tree guardian whose roots span the city | sacred giant tree guardian creature, roots spanning outward |
| 148 | Carabobex | METAL/BRASA | spectral golden warrior with fire sword | spectral golden armored warrior creature with blazing sword |
| 149 | Redantom | ESPIRITU/CRISTAL | dimensional entity warping reality between floors | dimensional crystal-spirit entity creature distorting reality |
| 150 | Enrolador | ALL TYPES | supreme master being, crown of mist, crystal body, ember heart | supreme master being, crystal body, mist crown, ember heart, all elements |

---

# PART 2: GENERATION BATCHES

Each batch = one evolutionary line (or group of independents). Generated sequentially within each batch.

**Prompt format for every creature:**

```
[SAFE DESCRIPTION, under 200 chars]. Pokemon Crystal GBC sprite, 56x56 pixel art, 4 colors only, front-facing, 1px black outline, upper-left light, no anti-aliasing, no dithering, chibi, transparent bg, colors: [OUTLINE] [BODY] [HIGHLIGHT]
```

The `[SAFE DESCRIPTION]` below is what goes into the prompt along with the style suffix.

---

### B01 — LINEA 1 HIERBA: Cogollito → Cogollero → Cogolord [DONE]

- **Files:** `001-cogollito.png`, `002-cogollero.png`, `003-cogolord.png`
- **Palette:** HIERBA (#1A2E1A, #4A7A3A, #8EC86A)
- **Status:** Already generated

**001-cogollito:** `Tiny cute round botanical bud creature with small leaves and big eyes, baby chibi`
**002-cogollero:** `Mature flowering herb creature with lush leaves and relaxed posture, medium chibi`
**003-cogolord:** `Majestic aromatic tree creature covered in glistening resin droplets, noble stance, large`

---

### B02 — LINEA 2 BRASA: Mechita → Flamero → Inferñal [DONE]

- **Files:** `004-mechita.png`, `005-flamero.png`, `006-infernal.png`
- **Palette:** BRASA (#4A1A0A, #C8623A, #F0C878)
- **Status:** Already generated

**004-mechita:** `Tiny cute flame creature shaped like a small fire-starter, flickering, baby chibi`
**005-flamero:** `Walking torch creature with steady confident stride, medium chibi`
**006-infernal:** `Fire beast with forged metal armor plates and blazing mane, noble powerful stance`

---

### B03 — LINEA 3 AGUA: Gotirro → Cabrialin → Cabriator [DONE]

- **Files:** `007-gotirro.png`, `008-cabrialin.png`, `009-cabriator.png`
- **Palette:** AGUA (#0A2A4A, #4888B0, #90D0E8)
- **Status:** Already generated

**007-gotirro:** `Cute small water droplet creature with playful mischievous face, baby chibi`
**008-cabrialin:** `Aquatic fish spirit creature with flowing fins and gentle eyes, medium chibi`
**009-cabriator:** `Colossal river guardian creature, half water half stone, noble and powerful`

---

### B04 — LINEA 4 VIENTO: Jalita → Ventolero → Huracanal

- **Files:** `010-jalita.png`, `011-ventolero.png`, `012-huracanal.png`
- **Palette:** VIENTO (#1A3A2A, #78A890, #C0E8D0)

**010-jalita:** `Tiny playful breeze whirlwind creature with a cute smiling face, baby chibi`
**011-ventolero:** `Small tornado creature carrying leaves and parchment scraps, medium chibi`
**012-huracanal:** `Tropical storm creature with cyclone eyes and swirling rain, noble powerful`

---

### B05 — LINEA 5 CRISTAL: Bonguito → Bonglass → Prismorfo

- **Files:** `013-bonguito.png`, `014-bonglass.png`, `015-prismorfo.png`
- **Palette:** CRISTAL (#1A2A3A, #6898B8, #B8E0F0)

**013-bonguito:** `Small crystal flask creature with rising bubbles and cute face, baby chibi`
**014-bonglass:** `Elaborate iridescent crystal vessel creature with internal chambers, medium chibi`
**015-prismorfo:** `Pure crystal entity creature refracting light into rainbow beams, ethereal noble`

---

### B06 — LINEA 6 TIERRA: Arepita → Arepaso → Arepaking

- **Files:** `016-arepita.png`, `017-arepaso.png`, `018-arepaking.png`
- **Palette:** TIERRA (#2A1A0A, #A07848, #D8C098)

**016-arepita:** `Tiny round corn cake creature with stubby legs and warm smile, baby chibi`
**017-arepaso:** `Giant stuffed corn cake creature with corn-husk arms and cheese filling, medium chibi`
**018-arepaking:** `Majestic corn cake king creature with golden corn crown and heat aura, noble`

---

### B07 — LINEA 7 METAL: Grindito → Grindark → Moledron

- **Files:** `019-grindito.png`, `020-grindark.png`, `021-moledron.png`
- **Palette:** METAL (#1A1A2A, #7888A0, #B8C8D8)

**019-grindito:** `Small toothed gear mill creature with curious eyes, compact metallic body, baby chibi`
**020-grindark:** `Dark multi-chambered gear crusher creature with spinning blades, medium chibi`
**021-moledron:** `Giant crushing robot creature with plants growing between its gears, noble powerful`

---

### B08 — LINEA 8 HUMO: Humito → Nebuloso → Fumantis

- **Files:** `022-humito.png`, `023-nebuloso.png`, `024-fumantis.png`
- **Palette:** HUMO (#2A2A3A, #8888A0, #C8C8D8)

**022-humito:** `Tiny sleepy mist cloud creature with drowsy face and floating wisps, baby chibi`
**023-nebuloso:** `Dense fog bank creature with glowing eyes peering through the mist, medium chibi`
**024-fumantis:** `Serene ancestral mist spirit creature floating peacefully, ancient and wise, noble`

---

### B09 — LINEA 9 RESINA: Terpino → Terpenol → Dabmaster

- **Files:** `025-terpino.png`, `026-terpenol.png`, `027-dabmaster.png`
- **Palette:** RESINA (#3A2A0A, #B89040, #E8D090)

**025-terpino:** `Tiny amber resin droplet creature with sweet fragrant glow, golden, baby chibi`
**026-terpenol:** `Golden translucent resin humanoid creature, dripping amber, medium chibi`
**027-dabmaster:** `Regal molten resin master creature with golden vapor aura, noble stance`

---

### B10 — LINEA 10 ESPIRITU: Calmita → Serenox → Nirvanol

- **Files:** `028-calmita.png`, `029-serenox.png`, `030-nirvanol.png`
- **Palette:** ESPIRITU (#2A1A3A, #8868A8, #C8A8E0)

**028-calmita:** `Small floating violet light orb creature with peaceful gentle glow, baby chibi`
**029-serenox:** `Meditative figure creature wrapped in violet aura, calm expression, medium chibi`
**030-nirvanol:** `Enlightened transcendent being creature surrounded by sacred mist, noble serene`

---

### B11 — LINEA 11 HIERBA/TIERRA: Cachapín → Cachapote → Maizotán

- **Files:** `031-cachapin.png`, `032-cachapote.png`, `033-maizotan.png`
- **Palette:** HIERBA (#1A2E1A, #4A7A3A, #8EC86A)

**031-cachapin:** `Small rolled corn pancake creature with cute sweet eyes, golden, baby chibi`
**032-cachapote:** `Giant corn pancake creature overflowing with melted cheese, medium chibi`
**033-maizotan:** `Corn titan creature with corn-cob arms and palm leaf crown, noble powerful`

---

### B12 — LINEA 12 VIENTO/HIERBA: Turpial → Turpialar

- **Files:** `034-turpial.png`, `035-turpialar.png`
- **Palette:** VIENTO (#1A3A2A, #78A890, #C0E8D0)

**034-turpial:** `Baby orange and black songbird creature, fluffy and perched, baby chibi`
**035-turpialar:** `Majestic orange bird creature with tropical leaf wings soaring, noble`

---

### B13 — LINEA 13 AGUA/CRISTAL: Burbujin → Percolin → Filtrador

- **Files:** `036-burbujin.png`, `037-percolin.png`, `038-filtrador.png`
- **Palette:** AGUA (#0A2A4A, #4888B0, #90D0E8)

**036-burbujin:** `Cute floating water bubble creature with innocent baby face, baby chibi`
**037-percolin:** `Crystal tower creature filled with bubbling water chambers, medium chibi`
**038-filtrador:** `Tall crystal tower creature with cascading internal waterfalls, noble and pure`

---

### B14 — LINEA 14 BRASA/HUMO: Cenicín → Cenicero

- **Files:** `039-cenicin.png`, `040-cenicero.png`
- **Palette:** BRASA (#4A1A0A, #C8623A, #F0C878)

**039-cenicin:** `Small ash mound creature with glowing ember core in center, warm, baby chibi`
**040-cenicero:** `Animated stone dish creature with misty arms and grumpy face, medium chibi`

---

### B15 — LINEA 15 METAL/CRISTAL: Pipita → Pipalux → Pipatron

- **Files:** `041-pipita.png`, `042-pipalux.png`, `043-pipatron.png`
- **Palette:** METAL (#1A1A2A, #7888A0, #B8C8D8)

**041-pipita:** `Small ornate metal tube creature with short legs and curious eyes, baby chibi`
**042-pipalux:** `Elegant engraved metal tube creature with crystal accents, medium chibi`
**043-pipatron:** `Colossal steampunk mechanical tube creature shooting crystal beams, noble`

---

### B16 — LINEA 16 TIERRA/METAL: Cunaguín → Cunaguaro

- **Files:** `044-cunaguin.png`, `045-cunaguaro.png`
- **Palette:** TIERRA (#2A1A0A, #A07848, #D8C098)

**044-cunaguin:** `Baby ocelot cub creature with mud-spotted fur, playful pose, baby chibi`
**045-cunaguaro:** `Fierce ocelot creature with metallic claws and earthy spotted fur, noble`

---

### B17 — LINEA 17 HIERBA/VIENTO: Semillín → Plántula → Floresta

- **Files:** `046-semillin.png`, `047-plantula.png`, `048-floresta.png`
- **Palette:** HIERBA (#1A2E1A, #4A7A3A, #8EC86A)

**046-semillin:** `Tiny winged seed creature floating gently on a breeze, baby chibi`
**047-plantula:** `Young plant creature with first five-pointed leaves growing upward, medium chibi`
**048-floresta:** `Grand flowering tree creature releasing seeds with each breeze, noble majestic`

---

### B18 — LINEA 18 RESINA/CRISTAL: Hashito → Hashrak

- **Files:** `049-hashito.png`, `050-hashrak.png`
- **Palette:** RESINA (#3A2A0A, #B89040, #E8D090)

**049-hashito:** `Small dark amber resin ball creature with smooth soft texture, cute, baby chibi`
**050-hashrak:** `Crystallized amber resin block creature with glowing fracture lines, noble`

---

### B19 — LINEA 19 BRASA/TIERRA: Budarín → Budarazo → Fogonero

- **Files:** `051-budarin.png`, `052-budarazo.png`, `053-fogonero.png`
- **Palette:** BRASA (#4A1A0A, #C8623A, #F0C878)

**051-budarin:** `Small hot iron cooking disc creature with little eyes, glowing red, baby chibi`
**052-budarazo:** `Giant walking iron disc creature leaving fire footprints behind, medium chibi`
**053-fogonero:** `Living clay oven creature with roaring internal flames visible, noble powerful`

---

### B20 — LINEA 20 AGUA/VIENTO: Llovizna → Aguaceño

- **Files:** `054-llovizna.png`, `055-aguaceno.png`
- **Palette:** AGUA (#0A2A4A, #4888B0, #90D0E8)

**054-llovizna:** `Tiny drizzling rain cloud creature, constantly dripping water drops, baby chibi`
**055-aguaceno:** `Dark storm cloud creature with swirling winds and heavy rain, noble powerful`

---

### B21 — LINEA 21 HUMO/VIENTO: Vaperín → Vapornox → Nebulón

- **Files:** `056-vaperin.png`, `057-vapornox.png`, `058-nebulon.png`
- **Palette:** HUMO (#2A2A3A, #8888A0, #C8C8D8)

**056-vaperin:** `Tiny aromatic wispy mist creature, fragrant and delicate, baby chibi`
**057-vapornox:** `Dense vapor tornado creature with aromatic swirling patterns, medium chibi`
**058-nebulon:** `Vast living nebula creature covering areas with dense atmospheric mist, noble`

---

### B22 — LINEA 22 ESPIRITU/HIERBA: Chamán → Curandol

- **Files:** `059-chaman.png`, `060-curandol.png`
- **Palette:** ESPIRITU (#2A1A3A, #8868A8, #C8A8E0)

**059-chaman:** `Small spirit creature wearing a leaf mask, mystical and curious, baby chibi`
**060-curandol:** `Spirit healer creature surrounded by medicinal herbs, serene wise, noble`

---

### B23 — LINEA 23 METAL/BRASA: Chispín → Chispador → Zipporion

- **Files:** `061-chispin.png`, `062-chispador.png`, `063-zipporion.png`
- **Palette:** METAL (#1A1A2A, #7888A0, #B8C8D8)

**061-chispin:** `Small flint stone creature with electric sparking face, energetic, baby chibi`
**062-chispador:** `Sparking ignition mechanism creature with constant sparks flying, medium chibi`
**063-zipporion:** `Colossal gleaming chrome creature with eternal flame crown, noble powerful`

---

### B24 — LINEA 24 TIERRA/AGUA: Barrín → Fanguero → Lodazón

- **Files:** `064-barrin.png`, `065-fanguero.png`, `066-lodazon.png`
- **Palette:** TIERRA (#2A1A0A, #A07848, #D8C098)

**064-barrin:** `Small round wet mud ball creature with tiny innocent eyes, baby chibi`
**065-fanguero:** `Mud golem creature with small plants growing on its body, medium chibi`
**066-lodazon:** `Massive walking swamp creature dragging mud and plant debris, noble powerful`

---

### B25 — LINEA 25 CRISTAL/BRASA: Chimbito → Quemacris

- **Files:** `067-chimbito.png`, `068-quemacris.png`
- **Palette:** CRISTAL (#1A2A3A, #6898B8, #B8E0F0)

**067-chimbito:** `Small hot crystal shard creature glowing red-orange with warmth, baby chibi`
**068-quemacris:** `Red-hot crystal structure creature with molten magma visible in core, noble`

---

### B26 — LINEA 26 RESINA/TIERRA: Pegosin → Pegostro → Melazón

- **Files:** `069-pegosin.png`, `070-pegostro.png`, `071-melazon.png`
- **Palette:** RESINA (#3A2A0A, #B89040, #E8D090)

**069-pegosin:** `Sticky amber resin blob creature rolling on the ground, cute, baby chibi`
**070-pegostro:** `Slow dense mud-and-resin creature, heavy and unstoppable, medium chibi`
**071-melazon:** `Massive dark dense absorbing creature that engulfs everything it touches, noble`

---

### B27 — LINEA 27 VIENTO/ESPIRITU: Suspirín → Exhalón

- **Files:** `072-suspirin.png`, `073-exhalon.png`
- **Palette:** VIENTO (#1A3A2A, #78A890, #C0E8D0)

**072-suspirin:** `Gentle visible sigh creature with peaceful relaxed dreamy face, baby chibi`
**073-exhalon:** `Serene wind spirit creature drifting peacefully bringing calm, noble`

---

### B28 — LINEA 28 AGUA/RESINA: Bubblín → Bubblash → Icextract

- **Files:** `074-bubblin.png`, `075-bubblash.png`, `076-icextract.png`
- **Palette:** AGUA (#0A2A4A, #4888B0, #90D0E8)

**074-bubblin:** `Water bubble creature with amber liquid swirling inside it, baby chibi`
**075-bubblash:** `Water sphere creature with golden resin floating within, medium chibi`
**076-icextract:** `Ice crystal creature with pure amber trapped in its frozen core, noble epic`

---

### B29 — LINEA 29 HIERBA/BRASA: Porrito → Canuto → Bluntazo

- **Files:** `077-porrito.png`, `078-canuto.png`, `079-bluntazo.png`
- **Palette:** HIERBA (#1A2E1A, #4A7A3A, #8EC86A)

**077-porrito:** `Tiny rolled parchment scroll creature with cute eyes and short legs, baby chibi`
**078-canuto:** `Large rolled scroll creature with glowing tip and rising wisps, medium chibi`
**079-bluntazo:** `Colossal leaf-wrapped staff creature with fire aura, majestic noble stance`

---

### B30 — LINEA 30 METAL/VIENTO: Filtrito → Filtramax

- **Files:** `080-filtrito.png`, `081-filtramax.png`
- **Palette:** METAL (#1A1A2A, #7888A0, #B8C8D8)

**080-filtrito:** `Small metal filter disc creature with bouncy spring legs, cute, baby chibi`
**081-filtramax:** `Wind turbine filtration creature that purifies air around it, noble powerful`

---

### B31 — LINEA 31 CRISTAL/AGUA: Heladín → Glacirín → Crionebla

- **Files:** `082-heladin.png`, `083-glacirin.png`, `084-crionebla.png`
- **Palette:** CRISTAL (#1A2A3A, #6898B8, #B8E0F0)

**082-heladin:** `Cute ice cube creature with frozen surprised face expression, baby chibi`
**083-glacirin:** `Ice structure creature with water flowing through its interior, medium chibi`
**084-crionebla:** `Freezing mist creature that crystallizes everything it touches, noble epic`

---

### B32 — LINEA 32 HUMO/RESINA: Rosinín → Rosinero

- **Files:** `085-rosinin.png`, `086-rosinero.png`
- **Palette:** HUMO (#2A2A3A, #8888A0, #C8C8D8)

**085-rosinin:** `Tiny amber-tinted mist cloud creature with pine-scented wisps, baby chibi`
**086-rosinero:** `Living heat press creature exuding golden resin from every pore, noble`

---

### B33 — LINEA 33 TIERRA/ESPIRITU: Totémico → Petroglin → Ancestrón

- **Files:** `087-totemico.png`, `088-petroglin.png`, `089-ancestron.png`
- **Palette:** TIERRA (#2A1A0A, #A07848, #D8C098)

**087-totemico:** `Small stone totem creature with ancient carved symbols, sturdy, baby chibi`
**088-petroglin:** `Animated petroglyph creature glowing with mysterious inner light, medium chibi`
**089-ancestron:** `Massive ancestral stone guardian creature, ancient living sculpture, noble epic`

---

### B34 — LINEA 34 BRASA/ESPIRITU: Velita → Velarión

- **Files:** `090-velita.png`, `091-velarion.png`
- **Palette:** BRASA (#4A1A0A, #C8623A, #F0C878)

**090-velita:** `Small flickering candle creature with blinking warm flame on top, baby chibi`
**091-velarion:** `Floating candelabra creature with multiple whispering mystical flames, noble`

---

### B35 — LINEA 35 HIERBA/AGUA: Mangolín → Mangotal → Mangoboss

- **Files:** `092-mangolin.png`, `093-mangotal.png`, `094-mangoboss.png`
- **Palette:** HIERBA (#1A2E1A, #4A7A3A, #8EC86A)

**092-mangolin:** `Tiny mango fruit creature with leaf on head and sweet face, baby chibi`
**093-mangotal:** `Mango tree creature with juicy fruits dripping golden nectar, medium chibi`
**094-mangoboss:** `Giant mango creature with cascading juice waterfall and leaf crown, noble`

---

### B36 — LINEA 36 METAL/TIERRA: Bolivín → Carabobín → Libertador

- **Files:** `095-bolivin.png`, `096-carabobin.png`, `097-libertador.png`
- **Palette:** METAL (#1A1A2A, #7888A0, #B8C8D8)

**095-bolivin:** `Tiny metal toy soldier creature with battle hat, cute stance, baby chibi`
**096-carabobin:** `Armored soldier creature with stone and earth shield, medium chibi`
**097-libertador:** `Majestic golden general creature with sword, cape, and golden aura, noble epic`

---

### B37 — LINEA 37 CRISTAL/ESPIRITU: Vitralín → Vitralux

- **Files:** `098-vitralin.png`, `099-vitralux.png`
- **Palette:** CRISTAL (#1A2A3A, #6898B8, #B8E0F0)

**098-vitralin:** `Small glowing stained glass shard creature emitting colorful light, baby chibi`
**099-vitralux:** `Floating stained glass window creature projecting colored light beams, noble`

---

### B38 — LINEA 38 RESINA/HUMO: Waxito → Waxmelt

- **Files:** `100-waxito.png`, `101-waxmelt.png`
- **Palette:** RESINA (#3A2A0A, #B89040, #E8D090)

**100-waxito:** `Tiny golden creamy wax droplet creature, soft and round, baby chibi`
**101-waxmelt:** `Melting golden wax creature constantly generating warm rising vapor, noble`

---

### B39 — LINEA 39 VIENTO/METAL: Molinín → Turbinox

- **Files:** `102-molinin.png`, `103-turbinox.png`
- **Palette:** VIENTO (#1A3A2A, #78A890, #C0E8D0)

**102-molinin:** `Small spinning metal windmill creature, lightweight and cheerful, baby chibi`
**103-turbinox:** `Living wind turbine creature generating sharp cutting winds, noble powerful`

---

### B40 — LINEA 40 HUMO/TIERRA: Sahumerín → Sahumador → Incensario

- **Files:** `104-sahumerin.png`, `105-sahumador.png`, `106-incensario.png`
- **Palette:** HUMO (#2A2A3A, #8888A0, #C8C8D8)

**104-sahumerin:** `Small clay incense burner creature gently steaming with warm glow, baby chibi`
**105-sahumador:** `Ceramic vessel creature with constant aromatic mist rising upward, medium chibi`
**106-incensario:** `Miniature clay temple creature exhaling sacred aromatic mist plumes, noble epic`

---

### B41 — LINEA 41 AGUA/ESPIRITU: Tacarito → Tacarigua

- **Files:** `107-tacarito.png`, `108-tacarigua.png`
- **Palette:** AGUA (#0A2A4A, #4888B0, #90D0E8)

**107-tacarito:** `Mysterious glowing lake droplet creature with deep blue shimmer, baby chibi`
**108-tacarigua:** `Ancient lake spirit creature with deep blue aura and wise eyes, noble`

---

### B42 — LINEA 42 HIERBA/METAL: Tijerín → Podarex

- **Files:** `109-tijerin.png`, `110-podarex.png`
- **Palette:** HIERBA (#1A2E1A, #4A7A3A, #8EC86A)

**109-tijerin:** `Small plant creature with metallic scissor-shaped leaves, cute, baby chibi`
**110-podarex:** `Plant creature with scissor blade arms trimming leaves around it, noble`

---

### B43 — LINEA 43 BRASA/VIENTO: Chispita → Llamarada

- **Files:** `111-chispita.png`, `112-llamarada.png`
- **Palette:** BRASA (#4A1A0A, #C8623A, #F0C878)

**111-chispita:** `Tiny bouncing spark creature, energetic and erratic, flickering, baby chibi`
**112-llamarada:** `Blazing fire gust creature fueled by swirling wind currents, noble powerful`

---

### B44 — LINEA 44 CRISTAL/METAL: Perkito → Perkador → Perkmaster

- **Files:** `113-perkito.png`, `114-perkador.png`, `115-perkmaster.png`
- **Palette:** CRISTAL (#1A2A3A, #6898B8, #B8E0F0)

**113-perkito:** `Small crystal tube creature with metal frame and tiny bubbles inside, baby chibi`
**114-perkador:** `Complex crystal filtration creature with metal structural framework, medium chibi`
**115-perkmaster:** `Clockwork crystal tower creature with intricate metallic gear mechanisms, noble epic`

---

### B45 — LINEA 45 RESINA/ESPIRITU: Aromín → Aromantis

- **Files:** `116-aromin.png`, `117-aromantis.png`
- **Palette:** RESINA (#3A2A0A, #B89040, #E8D090)

**116-aromin:** `Floating fragrant amber droplet creature with hypnotic aromatic glow, baby chibi`
**117-aromantis:** `Sentient aromatic cloud creature inducing calm and peace, wise, noble`

---

### B46 — LINEA 46 TIERRA/CRISTAL: Polvorín → Polvorosa

- **Files:** `118-polvorin.png`, `119-polvorosa.png`
- **Palette:** TIERRA (#2A1A0A, #A07848, #D8C098)

**118-polvorin:** `Small mound of sparkling fine crystalline dust creature, glittering, baby chibi`
**119-polvorosa:** `Crystallized sugar pastry creature, sweet but powerful presence, noble epic`

---

### B47 — LINEA 47 HIERBA/ESPIRITU: Guacamín → Guacamaya

- **Files:** `120-guacamin.png`, `121-guacamaya.png`
- **Palette:** HIERBA (#1A2E1A, #4A7A3A, #8EC86A)

**120-guacamin:** `Baby green macaw creature with bright fluffy feathers, adorable, baby chibi`
**121-guacamaya:** `Majestic macaw creature with spiritual aura and leaf-like plumage, noble epic`

---

### B48 — LINEA 48 AGUA/METAL: Conservín → Conservero

- **Files:** `122-conservin.png`, `123-conservero.png`
- **Palette:** AGUA (#0A2A4A, #4888B0, #90D0E8)

**122-conservin:** `Small tin can creature with magical glowing liquid sloshing inside, baby chibi`
**123-conservero:** `Giant metal jar creature containing swirling ocean water within it, noble epic`

---

### B49 — LINEA 49 BRASA/RESINA: Carboncín → Narguilor

- **Files:** `124-carboncin.png`, `125-narguilor.png`
- **Palette:** BRASA (#4A1A0A, #C8623A, #F0C878)

**124-carboncin:** `Small glowing red-hot coal creature, ember bright and warm, baby chibi`
**125-narguilor:** `Living ornate tall vessel creature with aromatic mist and eternal embers, noble epic`

---

### B50 — LINEA 50 VIENTO/HUMO: Hallaquín → Hallacazo

- **Files:** `126-hallaquin.png`, `127-hallacazo.png`
- **Palette:** VIENTO (#1A3A2A, #78A890, #C0E8D0)

**126-hallaquin:** `Leaf-wrapped tamale creature floating on the wind, festive and cute, baby chibi`
**127-hallacazo:** `Giant flying leaf-wrapped tamale creature trailing aromatic steam, noble epic`

---

### B51 — INDEPENDIENTES COMUNES (grupo 1): Papelón, Filtrox, Clippy

- **Files:** `128-papelon.png`, `129-filtrox.png`, `130-clippy.png`
- **Palettes:** HIERBA, METAL, METAL

**128-papelon:** `Paper roll creature running with tiny legs, energetic expression, chibi. Pokemon Crystal GBC sprite, 56x56 pixel art, 4 colors only, front-facing, 1px black outline, upper-left light, no anti-aliasing, no dithering, chibi, transparent bg, colors: #1A2E1A #4A7A3A #8EC86A`
**129-filtrox:** `Tough small cardboard tube creature in bodyguard stance, determined, chibi. Pokemon Crystal GBC sprite, 56x56 pixel art, 4 colors only, front-facing, 1px black outline, upper-left light, no anti-aliasing, no dithering, chibi, transparent bg, colors: #1A1A2A #7888A0 #B8C8D8`
**130-clippy:** `Smiling rechargeable fire-starter creature with spinning wheel on top, chibi. Pokemon Crystal GBC sprite, 56x56 pixel art, 4 colors only, front-facing, 1px black outline, upper-left light, no anti-aliasing, no dithering, chibi, transparent bg, colors: #1A1A2A #7888A0 #B8C8D8`

---

### B52 — INDEPENDIENTES COMUNES (grupo 2): Bongolón, Vaporcito, Enrollao

- **Files:** `131-bongolon.png`, `132-vaporcito.png`, `133-enrollao.png`
- **Palettes:** CRISTAL, HUMO, HIERBA

**131-bongolon:** `Huge clumsy crystal vessel creature stumbling but tough and resilient, chibi. Pokemon Crystal GBC sprite, 56x56 pixel art, 4 colors only, front-facing, 1px black outline, upper-left light, no anti-aliasing, no dithering, chibi, transparent bg, colors: #1A2A3A #6898B8 #B8E0F0`
**132-vaporcito:** `Portable metal mist device creature with LED screen face, tech personality, chibi. Pokemon Crystal GBC sprite, 56x56 pixel art, 4 colors only, front-facing, 1px black outline, upper-left light, no anti-aliasing, no dithering, chibi, transparent bg, colors: #2A2A3A #8888A0 #C8C8D8`
**133-enrollao:** `Calm leaf-rolled humanoid creature with serene meditative expression, chibi. Pokemon Crystal GBC sprite, 56x56 pixel art, 4 colors only, front-facing, 1px black outline, upper-left light, no anti-aliasing, no dithering, chibi, transparent bg, colors: #1A2E1A #4A7A3A #8EC86A`

---

### B53 — INDEPENDIENTES COMUNES (grupo 3): Moledora, Chaguaramín, Hamaquero

- **Files:** `134-moledora.png`, `135-chaguaramin.png`, `136-hamaquero.png`
- **Palettes:** METAL, HIERBA, VIENTO

**134-moledora:** `Elegant gear mill creature with flowers blooming from its surface, chibi. Pokemon Crystal GBC sprite, 56x56 pixel art, 4 colors only, front-facing, 1px black outline, upper-left light, no anti-aliasing, no dithering, chibi, transparent bg, colors: #1A1A2A #7888A0 #B8C8D8`
**135-chaguaramin:** `Small palm tree creature throwing coconuts with playful mischief, chibi. Pokemon Crystal GBC sprite, 56x56 pixel art, 4 colors only, front-facing, 1px black outline, upper-left light, no anti-aliasing, no dithering, chibi, transparent bg, colors: #1A2E1A #4A7A3A #8EC86A`
**136-hamaquero:** `Floating hammock creature perpetually sleeping and dreaming peacefully, chibi. Pokemon Crystal GBC sprite, 56x56 pixel art, 4 colors only, front-facing, 1px black outline, upper-left light, no anti-aliasing, no dithering, chibi, transparent bg, colors: #1A3A2A #78A890 #C0E8D0`

---

### B54 — INDEPENDIENTES COMUNES (grupo 4): Papagallo, Roncador, Munchero, Pasillero

- **Files:** `137-papagallo.png`, `138-roncador.png`, `139-munchero.png`, `140-pasillero.png`
- **Palettes:** VIENTO, HUMO, TIERRA, ESPIRITU

**137-papagallo:** `Blazing kite creature soaring through sky with fiery streaming tail, chibi. Pokemon Crystal GBC sprite, 56x56 pixel art, 4 colors only, front-facing, 1px black outline, upper-left light, no anti-aliasing, no dithering, chibi, transparent bg, colors: #1A3A2A #78A890 #C0E8D0`
**138-roncador:** `Sleepy creature snoring out relaxing mist clouds, dozing contentedly, chibi. Pokemon Crystal GBC sprite, 56x56 pixel art, 4 colors only, front-facing, 1px black outline, upper-left light, no anti-aliasing, no dithering, chibi, transparent bg, colors: #2A2A3A #8888A0 #C8C8D8`
**139-munchero:** `Round eternally hungry creature devouring snacks with ravenous joy, chibi. Pokemon Crystal GBC sprite, 56x56 pixel art, 4 colors only, front-facing, 1px black outline, upper-left light, no anti-aliasing, no dithering, chibi, transparent bg, colors: #2A1A0A #A07848 #D8C098`
**140-pasillero:** `Transparent flickering hallway ghost creature, elusive and mysterious, chibi. Pokemon Crystal GBC sprite, 56x56 pixel art, 4 colors only, front-facing, 1px black outline, upper-left light, no anti-aliasing, no dithering, chibi, transparent bg, colors: #2A1A3A #8868A8 #C8A8E0`

---

### B55 — EPICOS INDEPENDIENTES (grupo 1): Caobón, Teleférix, Pilandero

- **Files:** `141-caobon.png`, `142-teleferix.png`, `143-pilandero.png`
- **Palettes:** HIERBA, VIENTO, TIERRA

**141-caobon:** `Massive ancient mahogany tree creature, wise enormous and rooted deeply, epic. Pokemon Crystal GBC sprite, 56x56 pixel art, 4 colors only, front-facing, 1px black outline, upper-left light, no anti-aliasing, no dithering, chibi, transparent bg, colors: #1A2E1A #4A7A3A #8EC86A`
**142-teleferix:** `Living cable car cabin creature patrolling mountain heights, adventurous, epic. Pokemon Crystal GBC sprite, 56x56 pixel art, 4 colors only, front-facing, 1px black outline, upper-left light, no anti-aliasing, no dithering, chibi, transparent bg, colors: #1A3A2A #78A890 #C0E8D0`
**143-pilandero:** `Giant wooden mortar creature pounding with volcanic force, powerful, epic. Pokemon Crystal GBC sprite, 56x56 pixel art, 4 colors only, front-facing, 1px black outline, upper-left light, no anti-aliasing, no dithering, chibi, transparent bg, colors: #2A1A0A #A07848 #D8C098`

---

### B56 — EPICOS INDEPENDIENTES (grupo 2): Sambilón, Redactor

- **Files:** `144-sambilon.png`, `145-redactor.png`
- **Palettes:** CRISTAL, ESPIRITU

**144-sambilon:** `Living miniature shopping mall creature made of glass and steel, imposing, epic. Pokemon Crystal GBC sprite, 56x56 pixel art, 4 colors only, front-facing, 1px black outline, upper-left light, no anti-aliasing, no dithering, chibi, transparent bg, colors: #1A2A3A #6898B8 #B8E0F0`
**145-redactor:** `Ghostly building guardian creature holding many glowing keys, mysterious, epic. Pokemon Crystal GBC sprite, 56x56 pixel art, 4 colors only, front-facing, 1px black outline, upper-left light, no anti-aliasing, no dithering, chibi, transparent bg, colors: #2A1A3A #8868A8 #C8A8E0`

---

### B57 — LEGENDARIOS (grupo 1): Cabrialesix, Peñalveris

- **Files:** `146-cabrialesix.png`, `147-penalveris.png`
- **Palettes:** AGUA, HIERBA

**146-cabrialesix:** `Majestic ancestral river serpent dragon creature with flowing water aura, legendary. Pokemon Crystal GBC sprite, 56x56 pixel art, 4 colors only, front-facing, 1px black outline, upper-left light, no anti-aliasing, no dithering, semi-chibi, transparent bg, colors: #0A2A4A #4888B0 #90D0E8`
**147-penalveris:** `Sacred giant tree guardian creature with roots spanning outward, ancient, legendary. Pokemon Crystal GBC sprite, 56x56 pixel art, 4 colors only, front-facing, 1px black outline, upper-left light, no anti-aliasing, no dithering, semi-chibi, transparent bg, colors: #1A2E1A #4A7A3A #8EC86A`

---

### B58 — LEGENDARIOS (grupo 2): Carabobex, Redantom, Enrolador

- **Files:** `148-carabobex.png`, `149-redantom.png`, `150-enrolador.png`
- **Palettes:** METAL, ESPIRITU, ESPIRITU (special)

**148-carabobex:** `Spectral golden armored warrior creature with blazing sword raised, legendary. Pokemon Crystal GBC sprite, 56x56 pixel art, 4 colors only, front-facing, 1px black outline, upper-left light, no anti-aliasing, no dithering, semi-chibi, transparent bg, colors: #1A1A2A #7888A0 #B8C8D8`
**149-redantom:** `Dimensional crystal-spirit entity creature distorting reality around it, legendary. Pokemon Crystal GBC sprite, 56x56 pixel art, 4 colors only, front-facing, 1px black outline, upper-left light, no anti-aliasing, no dithering, semi-chibi, transparent bg, colors: #2A1A3A #8868A8 #C8A8E0`
**150-enrolador:** `Supreme master being creature with crystal body, mist crown, and ember heart, all elements, legendary. Pokemon Crystal GBC sprite, 56x56 pixel art, 4 colors only, front-facing, 1px black outline, upper-left light, no anti-aliasing, no dithering, semi-chibi, transparent bg, colors: #2A1A3A #8868A8 #C8A8E0`

---

# PART 3: SHELL SCRIPT TEMPLATE

```bash
#!/bin/bash
# ============================================================
# ENROLA LEGENDS — Sprite Generation Script
# Generates 150 creature sprites sequentially
# Uses OpenAI gpt-image-1 via the API
# ============================================================

set -euo pipefail

# --- CONFIG ---
OUTPUT_DIR="/Users/daniellopez/Desktop/ryo store/game/sprites/creatures"
TEMP_DIR="/tmp/enrola-sprites"
LOG_FILE="$OUTPUT_DIR/generation.log"
API_DELAY=2  # seconds between API calls

# --- STYLE SUFFIX (appended to every prompt) ---
STYLE="Pokemon Crystal GBC sprite, 56x56 pixel art, 4 colors only (black outline + 2 body tones + transparent), front-facing, 1px black outline, upper-left light, no anti-aliasing, no dithering, chibi proportions, large expressive eyes, transparent background"

# --- INIT ---
mkdir -p "$OUTPUT_DIR"
mkdir -p "$TEMP_DIR"
echo "=== Generation started at $(date) ===" >> "$LOG_FILE"

# --- HELPER FUNCTION ---
generate() {
    local ID="$1"         # e.g. "010-jalita"
    local DESC="$2"       # creature description (safe language)
    local COLORS="$3"     # e.g. "colors: #1A3A2A #78A890 #C0E8D0"
    local FINAL="$OUTPUT_DIR/$ID.png"

    # Skip if already exists
    if [ -f "$FINAL" ]; then
        echo "[SKIP] $ID already exists" | tee -a "$LOG_FILE"
        return 0
    fi

    local PROMPT="$DESC. $STYLE, $COLORS"
    local TEMP_OUT="$TEMP_DIR/$ID"
    mkdir -p "$TEMP_OUT"

    echo "[GEN]  $ID — generating..." | tee -a "$LOG_FILE"

    # ---- REPLACE THIS WITH YOUR ACTUAL API CALL ----
    # Example using OpenAI API (adapt to your tool):
    #
    # curl -s https://api.openai.com/v1/images/generations \
    #   -H "Authorization: Bearer $OPENAI_API_KEY" \
    #   -H "Content-Type: application/json" \
    #   -d "{
    #     \"model\": \"gpt-image-1\",
    #     \"prompt\": \"$PROMPT\",
    #     \"n\": 1,
    #     \"size\": \"1024x1024\",
    #     \"quality\": \"low\"
    #   }" | jq -r '.data[0].b64_json' | base64 -d > "$TEMP_OUT/output.png"
    #
    # OR using the CLI tool you have:
    # openai-image-gen --prompt "$PROMPT" --output "$TEMP_OUT/output.png"
    # ---- END API CALL ----

    # Validate output exists
    if [ -f "$TEMP_OUT/output.png" ]; then
        mv "$TEMP_OUT/output.png" "$FINAL"
        echo "[OK]   $ID — saved to $FINAL" | tee -a "$LOG_FILE"
    else
        echo "[FAIL] $ID — no output file generated" | tee -a "$LOG_FILE"
        echo "$ID" >> "$OUTPUT_DIR/failed.txt"
    fi

    # Rate limit delay
    sleep "$API_DELAY"
}

# ============================================================
# BATCH B01 — LINEA 1 HIERBA: Cogollito/Cogollero/Cogolord [DONE]
# ============================================================
# Already generated — skipping

# ============================================================
# BATCH B02 — LINEA 2 BRASA: Mechita/Flamero/Inferñal [DONE]
# ============================================================
# Already generated — skipping

# ============================================================
# BATCH B03 — LINEA 3 AGUA: Gotirro/Cabrialin/Cabriator [DONE]
# ============================================================
# Already generated — skipping

# ============================================================
# BATCH B04 — LINEA 4 VIENTO: Jalita/Ventolero/Huracanal
# ============================================================
generate "010-jalita"     "Tiny playful breeze whirlwind creature with a cute smiling face, baby chibi" "colors: #1A3A2A #78A890 #C0E8D0"
generate "011-ventolero"  "Small tornado creature carrying leaves and parchment scraps, medium chibi" "colors: #1A3A2A #78A890 #C0E8D0"
generate "012-huracanal"  "Tropical storm creature with cyclone eyes and swirling rain, noble powerful" "colors: #1A3A2A #78A890 #C0E8D0"

# ============================================================
# BATCH B05 — LINEA 5 CRISTAL: Bonguito/Bonglass/Prismorfo
# ============================================================
generate "013-bonguito"   "Small crystal flask creature with rising bubbles and cute face, baby chibi" "colors: #1A2A3A #6898B8 #B8E0F0"
generate "014-bonglass"   "Elaborate iridescent crystal vessel creature with internal chambers, medium chibi" "colors: #1A2A3A #6898B8 #B8E0F0"
generate "015-prismorfo"  "Pure crystal entity creature refracting light into rainbow beams, ethereal noble" "colors: #1A2A3A #6898B8 #B8E0F0"

# ============================================================
# BATCH B06 — LINEA 6 TIERRA: Arepita/Arepaso/Arepaking
# ============================================================
generate "016-arepita"    "Tiny round corn cake creature with stubby legs and warm smile, baby chibi" "colors: #2A1A0A #A07848 #D8C098"
generate "017-arepaso"    "Giant stuffed corn cake creature with corn-husk arms and cheese filling, medium chibi" "colors: #2A1A0A #A07848 #D8C098"
generate "018-arepaking"  "Majestic corn cake king creature with golden corn crown and heat aura, noble" "colors: #2A1A0A #A07848 #D8C098"

# ============================================================
# BATCH B07 — LINEA 7 METAL: Grindito/Grindark/Moledron
# ============================================================
generate "019-grindito"   "Small toothed gear mill creature with curious eyes, compact metallic body, baby chibi" "colors: #1A1A2A #7888A0 #B8C8D8"
generate "020-grindark"   "Dark multi-chambered gear crusher creature with spinning blades, medium chibi" "colors: #1A1A2A #7888A0 #B8C8D8"
generate "021-moledron"   "Giant crushing robot creature with plants growing between its gears, noble powerful" "colors: #1A1A2A #7888A0 #B8C8D8"

# ============================================================
# BATCH B08 — LINEA 8 HUMO: Humito/Nebuloso/Fumantis
# ============================================================
generate "022-humito"     "Tiny sleepy mist cloud creature with drowsy face and floating wisps, baby chibi" "colors: #2A2A3A #8888A0 #C8C8D8"
generate "023-nebuloso"   "Dense fog bank creature with glowing eyes peering through the mist, medium chibi" "colors: #2A2A3A #8888A0 #C8C8D8"
generate "024-fumantis"   "Serene ancestral mist spirit creature floating peacefully, ancient and wise, noble" "colors: #2A2A3A #8888A0 #C8C8D8"

# ============================================================
# BATCH B09 — LINEA 9 RESINA: Terpino/Terpenol/Dabmaster
# ============================================================
generate "025-terpino"    "Tiny amber resin droplet creature with sweet fragrant glow, golden, baby chibi" "colors: #3A2A0A #B89040 #E8D090"
generate "026-terpenol"   "Golden translucent resin humanoid creature, dripping amber, medium chibi" "colors: #3A2A0A #B89040 #E8D090"
generate "027-dabmaster"  "Regal molten resin master creature with golden vapor aura, noble stance" "colors: #3A2A0A #B89040 #E8D090"

# ============================================================
# BATCH B10 — LINEA 10 ESPIRITU: Calmita/Serenox/Nirvanol
# ============================================================
generate "028-calmita"    "Small floating violet light orb creature with peaceful gentle glow, baby chibi" "colors: #2A1A3A #8868A8 #C8A8E0"
generate "029-serenox"    "Meditative figure creature wrapped in violet aura, calm expression, medium chibi" "colors: #2A1A3A #8868A8 #C8A8E0"
generate "030-nirvanol"   "Enlightened transcendent being creature surrounded by sacred mist, noble serene" "colors: #2A1A3A #8868A8 #C8A8E0"

# ============================================================
# BATCH B11 — LINEA 11 HIERBA/TIERRA: Cachapín/Cachapote/Maizotán
# ============================================================
generate "031-cachapin"   "Small rolled corn pancake creature with cute sweet eyes, golden, baby chibi" "colors: #1A2E1A #4A7A3A #8EC86A"
generate "032-cachapote"  "Giant corn pancake creature overflowing with melted cheese, medium chibi" "colors: #1A2E1A #4A7A3A #8EC86A"
generate "033-maizotan"   "Corn titan creature with corn-cob arms and palm leaf crown, noble powerful" "colors: #1A2E1A #4A7A3A #8EC86A"

# ============================================================
# BATCH B12 — LINEA 12 VIENTO/HIERBA: Turpial/Turpialar
# ============================================================
generate "034-turpial"    "Baby orange and black songbird creature, fluffy and perched, baby chibi" "colors: #1A3A2A #78A890 #C0E8D0"
generate "035-turpialar"  "Majestic orange bird creature with tropical leaf wings soaring, noble" "colors: #1A3A2A #78A890 #C0E8D0"

# ============================================================
# BATCH B13 — LINEA 13 AGUA/CRISTAL: Burbujin/Percolin/Filtrador
# ============================================================
generate "036-burbujin"   "Cute floating water bubble creature with innocent baby face, baby chibi" "colors: #0A2A4A #4888B0 #90D0E8"
generate "037-percolin"   "Crystal tower creature filled with bubbling water chambers, medium chibi" "colors: #0A2A4A #4888B0 #90D0E8"
generate "038-filtrador"  "Tall crystal tower creature with cascading internal waterfalls, noble and pure" "colors: #0A2A4A #4888B0 #90D0E8"

# ============================================================
# BATCH B14 — LINEA 14 BRASA/HUMO: Cenicín/Cenicero
# ============================================================
generate "039-cenicin"    "Small ash mound creature with glowing ember core in center, warm, baby chibi" "colors: #4A1A0A #C8623A #F0C878"
generate "040-cenicero"   "Animated stone dish creature with misty arms and grumpy face, medium chibi" "colors: #4A1A0A #C8623A #F0C878"

# ============================================================
# BATCH B15 — LINEA 15 METAL/CRISTAL: Pipita/Pipalux/Pipatron
# ============================================================
generate "041-pipita"     "Small ornate metal tube creature with short legs and curious eyes, baby chibi" "colors: #1A1A2A #7888A0 #B8C8D8"
generate "042-pipalux"    "Elegant engraved metal tube creature with crystal accents, medium chibi" "colors: #1A1A2A #7888A0 #B8C8D8"
generate "043-pipatron"   "Colossal steampunk mechanical tube creature shooting crystal beams, noble" "colors: #1A1A2A #7888A0 #B8C8D8"

# ============================================================
# BATCH B16 — LINEA 16 TIERRA/METAL: Cunaguín/Cunaguaro
# ============================================================
generate "044-cunaguin"   "Baby ocelot cub creature with mud-spotted fur, playful pose, baby chibi" "colors: #2A1A0A #A07848 #D8C098"
generate "045-cunaguaro"  "Fierce ocelot creature with metallic claws and earthy spotted fur, noble" "colors: #2A1A0A #A07848 #D8C098"

# ============================================================
# BATCH B17 — LINEA 17 HIERBA/VIENTO: Semillín/Plántula/Floresta
# ============================================================
generate "046-semillin"   "Tiny winged seed creature floating gently on a breeze, baby chibi" "colors: #1A2E1A #4A7A3A #8EC86A"
generate "047-plantula"   "Young plant creature with first five-pointed leaves growing upward, medium chibi" "colors: #1A2E1A #4A7A3A #8EC86A"
generate "048-floresta"   "Grand flowering tree creature releasing seeds with each breeze, noble majestic" "colors: #1A2E1A #4A7A3A #8EC86A"

# ============================================================
# BATCH B18 — LINEA 18 RESINA/CRISTAL: Hashito/Hashrak
# ============================================================
generate "049-hashito"    "Small dark amber resin ball creature with smooth soft texture, cute, baby chibi" "colors: #3A2A0A #B89040 #E8D090"
generate "050-hashrak"    "Crystallized amber resin block creature with glowing fracture lines, noble" "colors: #3A2A0A #B89040 #E8D090"

# ============================================================
# BATCH B19 — LINEA 19 BRASA/TIERRA: Budarín/Budarazo/Fogonero
# ============================================================
generate "051-budarin"    "Small hot iron cooking disc creature with little eyes, glowing red, baby chibi" "colors: #4A1A0A #C8623A #F0C878"
generate "052-budarazo"   "Giant walking iron disc creature leaving fire footprints behind, medium chibi" "colors: #4A1A0A #C8623A #F0C878"
generate "053-fogonero"   "Living clay oven creature with roaring internal flames visible, noble powerful" "colors: #4A1A0A #C8623A #F0C878"

# ============================================================
# BATCH B20 — LINEA 20 AGUA/VIENTO: Llovizna/Aguaceño
# ============================================================
generate "054-llovizna"   "Tiny drizzling rain cloud creature, constantly dripping water drops, baby chibi" "colors: #0A2A4A #4888B0 #90D0E8"
generate "055-aguaceno"   "Dark storm cloud creature with swirling winds and heavy rain, noble powerful" "colors: #0A2A4A #4888B0 #90D0E8"

# ============================================================
# BATCH B21 — LINEA 21 HUMO/VIENTO: Vaperín/Vapornox/Nebulón
# ============================================================
generate "056-vaperin"    "Tiny aromatic wispy mist creature, fragrant and delicate, baby chibi" "colors: #2A2A3A #8888A0 #C8C8D8"
generate "057-vapornox"   "Dense vapor tornado creature with aromatic swirling patterns, medium chibi" "colors: #2A2A3A #8888A0 #C8C8D8"
generate "058-nebulon"    "Vast living nebula creature covering areas with dense atmospheric mist, noble" "colors: #2A2A3A #8888A0 #C8C8D8"

# ============================================================
# BATCH B22 — LINEA 22 ESPIRITU/HIERBA: Chamán/Curandol
# ============================================================
generate "059-chaman"     "Small spirit creature wearing a leaf mask, mystical and curious, baby chibi" "colors: #2A1A3A #8868A8 #C8A8E0"
generate "060-curandol"   "Spirit healer creature surrounded by medicinal herbs, serene wise, noble" "colors: #2A1A3A #8868A8 #C8A8E0"

# ============================================================
# BATCH B23 — LINEA 23 METAL/BRASA: Chispín/Chispador/Zipporion
# ============================================================
generate "061-chispin"    "Small flint stone creature with electric sparking face, energetic, baby chibi" "colors: #1A1A2A #7888A0 #B8C8D8"
generate "062-chispador"  "Sparking ignition mechanism creature with constant sparks flying, medium chibi" "colors: #1A1A2A #7888A0 #B8C8D8"
generate "063-zipporion"  "Colossal gleaming chrome creature with eternal flame crown, noble powerful" "colors: #1A1A2A #7888A0 #B8C8D8"

# ============================================================
# BATCH B24 — LINEA 24 TIERRA/AGUA: Barrín/Fanguero/Lodazón
# ============================================================
generate "064-barrin"     "Small round wet mud ball creature with tiny innocent eyes, baby chibi" "colors: #2A1A0A #A07848 #D8C098"
generate "065-fanguero"   "Mud golem creature with small plants growing on its body, medium chibi" "colors: #2A1A0A #A07848 #D8C098"
generate "066-lodazon"    "Massive walking swamp creature dragging mud and plant debris, noble powerful" "colors: #2A1A0A #A07848 #D8C098"

# ============================================================
# BATCH B25 — LINEA 25 CRISTAL/BRASA: Chimbito/Quemacris
# ============================================================
generate "067-chimbito"   "Small hot crystal shard creature glowing red-orange with warmth, baby chibi" "colors: #1A2A3A #6898B8 #B8E0F0"
generate "068-quemacris"  "Red-hot crystal structure creature with molten magma visible in core, noble" "colors: #1A2A3A #6898B8 #B8E0F0"

# ============================================================
# BATCH B26 — LINEA 26 RESINA/TIERRA: Pegosin/Pegostro/Melazón
# ============================================================
generate "069-pegosin"    "Sticky amber resin blob creature rolling on the ground, cute, baby chibi" "colors: #3A2A0A #B89040 #E8D090"
generate "070-pegostro"   "Slow dense mud-and-resin creature, heavy and unstoppable, medium chibi" "colors: #3A2A0A #B89040 #E8D090"
generate "071-melazon"    "Massive dark dense absorbing creature that engulfs everything it touches, noble" "colors: #3A2A0A #B89040 #E8D090"

# ============================================================
# BATCH B27 — LINEA 27 VIENTO/ESPIRITU: Suspirín/Exhalón
# ============================================================
generate "072-suspirin"   "Gentle visible sigh creature with peaceful relaxed dreamy face, baby chibi" "colors: #1A3A2A #78A890 #C0E8D0"
generate "073-exhalon"    "Serene wind spirit creature drifting peacefully bringing calm, noble" "colors: #1A3A2A #78A890 #C0E8D0"

# ============================================================
# BATCH B28 — LINEA 28 AGUA/RESINA: Bubblín/Bubblash/Icextract
# ============================================================
generate "074-bubblin"    "Water bubble creature with amber liquid swirling inside it, baby chibi" "colors: #0A2A4A #4888B0 #90D0E8"
generate "075-bubblash"   "Water sphere creature with golden resin floating within, medium chibi" "colors: #0A2A4A #4888B0 #90D0E8"
generate "076-icextract"  "Ice crystal creature with pure amber trapped in its frozen core, noble epic" "colors: #0A2A4A #4888B0 #90D0E8"

# ============================================================
# BATCH B29 — LINEA 29 HIERBA/BRASA: Porrito/Canuto/Bluntazo
# ============================================================
generate "077-porrito"    "Tiny rolled parchment scroll creature with cute eyes and short legs, baby chibi" "colors: #1A2E1A #4A7A3A #8EC86A"
generate "078-canuto"     "Large rolled scroll creature with glowing tip and rising wisps, medium chibi" "colors: #1A2E1A #4A7A3A #8EC86A"
generate "079-bluntazo"   "Colossal leaf-wrapped staff creature with fire aura, majestic noble stance" "colors: #1A2E1A #4A7A3A #8EC86A"

# ============================================================
# BATCH B30 — LINEA 30 METAL/VIENTO: Filtrito/Filtramax
# ============================================================
generate "080-filtrito"   "Small metal filter disc creature with bouncy spring legs, cute, baby chibi" "colors: #1A1A2A #7888A0 #B8C8D8"
generate "081-filtramax"  "Wind turbine filtration creature that purifies air around it, noble powerful" "colors: #1A1A2A #7888A0 #B8C8D8"

# ============================================================
# BATCH B31 — LINEA 31 CRISTAL/AGUA: Heladín/Glacirín/Crionebla
# ============================================================
generate "082-heladin"    "Cute ice cube creature with frozen surprised face expression, baby chibi" "colors: #1A2A3A #6898B8 #B8E0F0"
generate "083-glacirin"   "Ice structure creature with water flowing through its interior, medium chibi" "colors: #1A2A3A #6898B8 #B8E0F0"
generate "084-crionebla"  "Freezing mist creature that crystallizes everything it touches, noble epic" "colors: #1A2A3A #6898B8 #B8E0F0"

# ============================================================
# BATCH B32 — LINEA 32 HUMO/RESINA: Rosinín/Rosinero
# ============================================================
generate "085-rosinin"    "Tiny amber-tinted mist cloud creature with pine-scented wisps, baby chibi" "colors: #2A2A3A #8888A0 #C8C8D8"
generate "086-rosinero"   "Living heat press creature exuding golden resin from every pore, noble" "colors: #2A2A3A #8888A0 #C8C8D8"

# ============================================================
# BATCH B33 — LINEA 33 TIERRA/ESPIRITU: Totémico/Petroglin/Ancestrón
# ============================================================
generate "087-totemico"   "Small stone totem creature with ancient carved symbols, sturdy, baby chibi" "colors: #2A1A0A #A07848 #D8C098"
generate "088-petroglin"  "Animated petroglyph creature glowing with mysterious inner light, medium chibi" "colors: #2A1A0A #A07848 #D8C098"
generate "089-ancestron"  "Massive ancestral stone guardian creature, ancient living sculpture, noble epic" "colors: #2A1A0A #A07848 #D8C098"

# ============================================================
# BATCH B34 — LINEA 34 BRASA/ESPIRITU: Velita/Velarión
# ============================================================
generate "090-velita"     "Small flickering candle creature with blinking warm flame on top, baby chibi" "colors: #4A1A0A #C8623A #F0C878"
generate "091-velarion"   "Floating candelabra creature with multiple whispering mystical flames, noble" "colors: #4A1A0A #C8623A #F0C878"

# ============================================================
# BATCH B35 — LINEA 35 HIERBA/AGUA: Mangolín/Mangotal/Mangoboss
# ============================================================
generate "092-mangolin"   "Tiny mango fruit creature with leaf on head and sweet face, baby chibi" "colors: #1A2E1A #4A7A3A #8EC86A"
generate "093-mangotal"   "Mango tree creature with juicy fruits dripping golden nectar, medium chibi" "colors: #1A2E1A #4A7A3A #8EC86A"
generate "094-mangoboss"  "Giant mango creature with cascading juice waterfall and leaf crown, noble" "colors: #1A2E1A #4A7A3A #8EC86A"

# ============================================================
# BATCH B36 — LINEA 36 METAL/TIERRA: Bolivín/Carabobín/Libertador
# ============================================================
generate "095-bolivin"    "Tiny metal toy soldier creature with battle hat, cute stance, baby chibi" "colors: #1A1A2A #7888A0 #B8C8D8"
generate "096-carabobin"  "Armored soldier creature with stone and earth shield, medium chibi" "colors: #1A1A2A #7888A0 #B8C8D8"
generate "097-libertador" "Majestic golden general creature with sword, cape, and golden aura, noble epic" "colors: #1A1A2A #7888A0 #B8C8D8"

# ============================================================
# BATCH B37 — LINEA 37 CRISTAL/ESPIRITU: Vitralín/Vitralux
# ============================================================
generate "098-vitralin"   "Small glowing stained glass shard creature emitting colorful light, baby chibi" "colors: #1A2A3A #6898B8 #B8E0F0"
generate "099-vitralux"   "Floating stained glass window creature projecting colored light beams, noble" "colors: #1A2A3A #6898B8 #B8E0F0"

# ============================================================
# BATCH B38 — LINEA 38 RESINA/HUMO: Waxito/Waxmelt
# ============================================================
generate "100-waxito"     "Tiny golden creamy wax droplet creature, soft and round, baby chibi" "colors: #3A2A0A #B89040 #E8D090"
generate "101-waxmelt"    "Melting golden wax creature constantly generating warm rising vapor, noble" "colors: #3A2A0A #B89040 #E8D090"

# ============================================================
# BATCH B39 — LINEA 39 VIENTO/METAL: Molinín/Turbinox
# ============================================================
generate "102-molinin"    "Small spinning metal windmill creature, lightweight and cheerful, baby chibi" "colors: #1A3A2A #78A890 #C0E8D0"
generate "103-turbinox"   "Living wind turbine creature generating sharp cutting winds, noble powerful" "colors: #1A3A2A #78A890 #C0E8D0"

# ============================================================
# BATCH B40 — LINEA 40 HUMO/TIERRA: Sahumerín/Sahumador/Incensario
# ============================================================
generate "104-sahumerin"  "Small clay incense burner creature gently steaming with warm glow, baby chibi" "colors: #2A2A3A #8888A0 #C8C8D8"
generate "105-sahumador"  "Ceramic vessel creature with constant aromatic mist rising upward, medium chibi" "colors: #2A2A3A #8888A0 #C8C8D8"
generate "106-incensario" "Miniature clay temple creature exhaling sacred aromatic mist plumes, noble epic" "colors: #2A2A3A #8888A0 #C8C8D8"

# ============================================================
# BATCH B41 — LINEA 41 AGUA/ESPIRITU: Tacarito/Tacarigua
# ============================================================
generate "107-tacarito"   "Mysterious glowing lake droplet creature with deep blue shimmer, baby chibi" "colors: #0A2A4A #4888B0 #90D0E8"
generate "108-tacarigua"  "Ancient lake spirit creature with deep blue aura and wise eyes, noble" "colors: #0A2A4A #4888B0 #90D0E8"

# ============================================================
# BATCH B42 — LINEA 42 HIERBA/METAL: Tijerín/Podarex
# ============================================================
generate "109-tijerin"    "Small plant creature with metallic scissor-shaped leaves, cute, baby chibi" "colors: #1A2E1A #4A7A3A #8EC86A"
generate "110-podarex"    "Plant creature with scissor blade arms trimming leaves around it, noble" "colors: #1A2E1A #4A7A3A #8EC86A"

# ============================================================
# BATCH B43 — LINEA 43 BRASA/VIENTO: Chispita/Llamarada
# ============================================================
generate "111-chispita"   "Tiny bouncing spark creature, energetic and erratic, flickering, baby chibi" "colors: #4A1A0A #C8623A #F0C878"
generate "112-llamarada"  "Blazing fire gust creature fueled by swirling wind currents, noble powerful" "colors: #4A1A0A #C8623A #F0C878"

# ============================================================
# BATCH B44 — LINEA 44 CRISTAL/METAL: Perkito/Perkador/Perkmaster
# ============================================================
generate "113-perkito"    "Small crystal tube creature with metal frame and tiny bubbles inside, baby chibi" "colors: #1A2A3A #6898B8 #B8E0F0"
generate "114-perkador"   "Complex crystal filtration creature with metal structural framework, medium chibi" "colors: #1A2A3A #6898B8 #B8E0F0"
generate "115-perkmaster" "Clockwork crystal tower creature with intricate metallic gear mechanisms, noble epic" "colors: #1A2A3A #6898B8 #B8E0F0"

# ============================================================
# BATCH B45 — LINEA 45 RESINA/ESPIRITU: Aromín/Aromantis
# ============================================================
generate "116-aromin"     "Floating fragrant amber droplet creature with hypnotic aromatic glow, baby chibi" "colors: #3A2A0A #B89040 #E8D090"
generate "117-aromantis"  "Sentient aromatic cloud creature inducing calm and peace, wise, noble" "colors: #3A2A0A #B89040 #E8D090"

# ============================================================
# BATCH B46 — LINEA 46 TIERRA/CRISTAL: Polvorín/Polvorosa
# ============================================================
generate "118-polvorin"   "Small mound of sparkling fine crystalline dust creature, glittering, baby chibi" "colors: #2A1A0A #A07848 #D8C098"
generate "119-polvorosa"  "Crystallized sugar pastry creature, sweet but powerful presence, noble epic" "colors: #2A1A0A #A07848 #D8C098"

# ============================================================
# BATCH B47 — LINEA 47 HIERBA/ESPIRITU: Guacamín/Guacamaya
# ============================================================
generate "120-guacamin"   "Baby green macaw creature with bright fluffy feathers, adorable, baby chibi" "colors: #1A2E1A #4A7A3A #8EC86A"
generate "121-guacamaya"  "Majestic macaw creature with spiritual aura and leaf-like plumage, noble epic" "colors: #1A2E1A #4A7A3A #8EC86A"

# ============================================================
# BATCH B48 — LINEA 48 AGUA/METAL: Conservín/Conservero
# ============================================================
generate "122-conservin"  "Small tin can creature with magical glowing liquid sloshing inside, baby chibi" "colors: #0A2A4A #4888B0 #90D0E8"
generate "123-conservero" "Giant metal jar creature containing swirling ocean water within it, noble epic" "colors: #0A2A4A #4888B0 #90D0E8"

# ============================================================
# BATCH B49 — LINEA 49 BRASA/RESINA: Carboncín/Narguilor
# ============================================================
generate "124-carboncin"  "Small glowing red-hot coal creature, ember bright and warm, baby chibi" "colors: #4A1A0A #C8623A #F0C878"
generate "125-narguilor"  "Living ornate tall vessel creature with aromatic mist and eternal embers, noble epic" "colors: #4A1A0A #C8623A #F0C878"

# ============================================================
# BATCH B50 — LINEA 50 VIENTO/HUMO: Hallaquín/Hallacazo
# ============================================================
generate "126-hallaquin"  "Leaf-wrapped tamale creature floating on the wind, festive and cute, baby chibi" "colors: #1A3A2A #78A890 #C0E8D0"
generate "127-hallacazo"  "Giant flying leaf-wrapped tamale creature trailing aromatic steam, noble epic" "colors: #1A3A2A #78A890 #C0E8D0"

# ============================================================
# BATCH B51 — INDEPENDIENTES COMUNES (1): Papelón/Filtrox/Clippy
# ============================================================
generate "128-papelon"    "Paper roll creature running with tiny legs, energetic expression, chibi" "colors: #1A2E1A #4A7A3A #8EC86A"
generate "129-filtrox"    "Tough small cardboard tube creature in bodyguard stance, determined, chibi" "colors: #1A1A2A #7888A0 #B8C8D8"
generate "130-clippy"     "Smiling rechargeable fire-starter creature with spinning wheel on top, chibi" "colors: #1A1A2A #7888A0 #B8C8D8"

# ============================================================
# BATCH B52 — INDEPENDIENTES COMUNES (2): Bongolón/Vaporcito/Enrollao
# ============================================================
generate "131-bongolon"   "Huge clumsy crystal vessel creature stumbling but tough and resilient, chibi" "colors: #1A2A3A #6898B8 #B8E0F0"
generate "132-vaporcito"  "Portable metal mist device creature with LED screen face, tech personality, chibi" "colors: #2A2A3A #8888A0 #C8C8D8"
generate "133-enrollao"   "Calm leaf-rolled humanoid creature with serene meditative expression, chibi" "colors: #1A2E1A #4A7A3A #8EC86A"

# ============================================================
# BATCH B53 — INDEPENDIENTES COMUNES (3): Moledora/Chaguaramín/Hamaquero
# ============================================================
generate "134-moledora"   "Elegant gear mill creature with flowers blooming from its surface, chibi" "colors: #1A1A2A #7888A0 #B8C8D8"
generate "135-chaguaramin" "Small palm tree creature throwing coconuts with playful mischief, chibi" "colors: #1A2E1A #4A7A3A #8EC86A"
generate "136-hamaquero"  "Floating hammock creature perpetually sleeping and dreaming peacefully, chibi" "colors: #1A3A2A #78A890 #C0E8D0"

# ============================================================
# BATCH B54 — INDEPENDIENTES COMUNES (4): Papagallo/Roncador/Munchero/Pasillero
# ============================================================
generate "137-papagallo"  "Blazing kite creature soaring through sky with fiery streaming tail, chibi" "colors: #1A3A2A #78A890 #C0E8D0"
generate "138-roncador"   "Sleepy creature snoring out relaxing mist clouds, dozing contentedly, chibi" "colors: #2A2A3A #8888A0 #C8C8D8"
generate "139-munchero"   "Round eternally hungry creature devouring snacks with ravenous joy, chibi" "colors: #2A1A0A #A07848 #D8C098"
generate "140-pasillero"  "Transparent flickering hallway ghost creature, elusive and mysterious, chibi" "colors: #2A1A3A #8868A8 #C8A8E0"

# ============================================================
# BATCH B55 — EPICOS INDEPENDIENTES (1): Caobón/Teleférix/Pilandero
# ============================================================
generate "141-caobon"     "Massive ancient mahogany tree creature, wise enormous and rooted deeply, epic" "colors: #1A2E1A #4A7A3A #8EC86A"
generate "142-teleferix"  "Living cable car cabin creature patrolling mountain heights, adventurous, epic" "colors: #1A3A2A #78A890 #C0E8D0"
generate "143-pilandero"  "Giant wooden mortar creature pounding with volcanic force, powerful, epic" "colors: #2A1A0A #A07848 #D8C098"

# ============================================================
# BATCH B56 — EPICOS INDEPENDIENTES (2): Sambilón/Redactor
# ============================================================
generate "144-sambilon"   "Living miniature shopping mall creature made of glass and steel, imposing, epic" "colors: #1A2A3A #6898B8 #B8E0F0"
generate "145-redactor"   "Ghostly building guardian creature holding many glowing keys, mysterious, epic" "colors: #2A1A3A #8868A8 #C8A8E0"

# ============================================================
# BATCH B57 — LEGENDARIOS (1): Cabrialesix/Peñalveris
# ============================================================
generate "146-cabrialesix" "Majestic ancestral river serpent dragon creature with flowing water aura, legendary" "colors: #0A2A4A #4888B0 #90D0E8"
generate "147-penalveris"  "Sacred giant tree guardian creature with roots spanning outward, ancient, legendary" "colors: #1A2E1A #4A7A3A #8EC86A"

# ============================================================
# BATCH B58 — LEGENDARIOS (2): Carabobex/Redantom/Enrolador
# ============================================================
generate "148-carabobex"  "Spectral golden armored warrior creature with blazing sword raised, legendary" "colors: #1A1A2A #7888A0 #B8C8D8"
generate "149-redantom"   "Dimensional crystal-spirit entity creature distorting reality around it, legendary" "colors: #2A1A3A #8868A8 #C8A8E0"
generate "150-enrolador"  "Supreme master being creature with crystal body, mist crown, ember heart, all elements, legendary" "colors: #2A1A3A #8868A8 #C8A8E0"

# ============================================================
# SUMMARY
# ============================================================
echo ""
echo "=== Generation completed at $(date) ===" | tee -a "$LOG_FILE"

TOTAL=$(ls "$OUTPUT_DIR"/*.png 2>/dev/null | wc -l)
FAILED=$(wc -l < "$OUTPUT_DIR/failed.txt" 2>/dev/null || echo "0")

echo "Total sprites: $TOTAL / 150" | tee -a "$LOG_FILE"
echo "Failed: $FAILED" | tee -a "$LOG_FILE"

if [ -f "$OUTPUT_DIR/failed.txt" ]; then
    echo ""
    echo "Failed creatures:"
    cat "$OUTPUT_DIR/failed.txt"
fi
```

---

# PART 4: COST ESTIMATE

## OpenAI gpt-image-1 Pricing (as of March 2026)

| Parameter | Value |
|---|---|
| Model | gpt-image-1 |
| Quality | low (sufficient for pixel art) |
| Size | 1024x1024 (will be downscaled to 56x56) |
| Cost per image (low quality) | ~$0.011 |
| Cost per image (medium quality) | ~$0.042 |

## Estimate: LOW quality

| Item | Count | Unit Cost | Total |
|---|---|---|---|
| Base generation (150 sprites) | 150 | $0.011 | $1.65 |
| Retry buffer (20% failure rate) | 30 | $0.011 | $0.33 |
| Extra retries for tricky prompts | 15 | $0.011 | $0.17 |
| **TOTAL (low quality)** | **~195 calls** | | **$2.15** |

## Estimate: MEDIUM quality (recommended)

| Item | Count | Unit Cost | Total |
|---|---|---|---|
| Base generation (150 sprites) | 150 | $0.042 | $6.30 |
| Retry buffer (20% failure rate) | 30 | $0.042 | $1.26 |
| Extra retries for tricky prompts | 15 | $0.042 | $0.63 |
| **TOTAL (medium quality)** | **~195 calls** | | **$8.19** |

## Time Estimate

| Parameter | Value |
|---|---|
| Average time per image | ~8-15 seconds generation + 2 seconds delay |
| Time per batch of 3 | ~45 seconds |
| Time per batch of 2 | ~30 seconds |
| Total batches | 58 |
| **Estimated total time** | **~35-50 minutes** (sequential) |

## Moderation Risk Assessment

| Risk Level | Creatures | Notes |
|---|---|---|
| **LOW risk** (safe concepts) | ~100 | Animals, food, weather, cultural items, soldiers, trees |
| **MEDIUM risk** (need careful wording) | ~35 | Resin creatures, vapor creatures, fire-starter creatures |
| **HIGH risk** (most likely to be flagged) | ~15 | Porrito/Canuto/Bluntazo (scroll remapping), Bongolón/Bonguito (vessel remapping), Hashito/Hashrak (resin block remapping) |

### High-risk creatures and their mitigation:

| # | Name | Risk | Mitigation |
|---|---|---|---|
| 013-015 | Bonguito line | HIGH | Use "crystal flask", "crystal vessel" — never say the B-word |
| 041-043 | Pipita line | HIGH | Use "ornate metal tube", "mechanical tube" — never say the P-word |
| 049-050 | Hashito line | HIGH | Use "dark amber resin ball/block" — never use the H-word |
| 077-079 | Porrito line | HIGH | Use "rolled parchment scroll", "leaf-wrapped staff" |
| 085-086 | Rosinín line | MEDIUM | Use "amber pressed extract", "heat press" |
| 100-101 | Waxito line | MEDIUM | "Golden wax" is likely safe |
| 125 | Narguilor | HIGH | Use "ornate tall vessel with mist" — never say hookah/narguile |
| 128 | Papelón | MEDIUM | Use "paper roll creature" — avoid "rolling papers" |
| 131 | Bongolón | HIGH | Use "crystal vessel creature" |
| 133 | Enrollao | MEDIUM | Use "leaf-rolled humanoid" — avoid "enrollar" context |

---

# APPENDIX: FILENAME CHECKLIST

All 150 files expected in `/Users/daniellopez/Desktop/ryo store/game/sprites/creatures/`:

```
001-cogollito.png    [DONE]
002-cogollero.png    [DONE]
003-cogolord.png     [DONE]
004-mechita.png      [DONE]
005-flamero.png      [DONE]
006-infernal.png     [DONE]
007-gotirro.png      [DONE]
008-cabrialin.png    [DONE]
009-cabriator.png    [DONE]
010-jalita.png
011-ventolero.png
012-huracanal.png
013-bonguito.png
014-bonglass.png
015-prismorfo.png
016-arepita.png
017-arepaso.png
018-arepaking.png
019-grindito.png
020-grindark.png
021-moledron.png
022-humito.png
023-nebuloso.png
024-fumantis.png
025-terpino.png
026-terpenol.png
027-dabmaster.png
028-calmita.png
029-serenox.png
030-nirvanol.png
031-cachapin.png
032-cachapote.png
033-maizotan.png
034-turpial.png
035-turpialar.png
036-burbujin.png
037-percolin.png
038-filtrador.png
039-cenicin.png
040-cenicero.png
041-pipita.png
042-pipalux.png
043-pipatron.png
044-cunaguin.png
045-cunaguaro.png
046-semillin.png
047-plantula.png
048-floresta.png
049-hashito.png
050-hashrak.png
051-budarin.png
052-budarazo.png
053-fogonero.png
054-llovizna.png
055-aguaceno.png
056-vaperin.png
057-vapornox.png
058-nebulon.png
059-chaman.png
060-curandol.png
061-chispin.png
062-chispador.png
063-zipporion.png
064-barrin.png
065-fanguero.png
066-lodazon.png
067-chimbito.png
068-quemacris.png
069-pegosin.png
070-pegostro.png
071-melazon.png
072-suspirin.png
073-exhalon.png
074-bubblin.png
075-bubblash.png
076-icextract.png
077-porrito.png
078-canuto.png
079-bluntazo.png
080-filtrito.png
081-filtramax.png
082-heladin.png
083-glacirin.png
084-crionebla.png
085-rosinin.png
086-rosinero.png
087-totemico.png
088-petroglin.png
089-ancestron.png
090-velita.png
091-velarion.png
092-mangolin.png
093-mangotal.png
094-mangoboss.png
095-bolivin.png
096-carabobin.png
097-libertador.png
098-vitralin.png
099-vitralux.png
100-waxito.png
101-waxmelt.png
102-molinin.png
103-turbinox.png
104-sahumerin.png
105-sahumador.png
106-incensario.png
107-tacarito.png
108-tacarigua.png
109-tijerin.png
110-podarex.png
111-chispita.png
112-llamarada.png
113-perkito.png
114-perkador.png
115-perkmaster.png
116-aromin.png
117-aromantis.png
118-polvorin.png
119-polvorosa.png
120-guacamin.png
121-guacamaya.png
122-conservin.png
123-conservero.png
124-carboncin.png
125-narguilor.png
126-hallaquin.png
127-hallacazo.png
128-papelon.png
129-filtrox.png
130-clippy.png
131-bongolon.png
132-vaporcito.png
133-enrollao.png
134-moledora.png
135-chaguaramin.png
136-hamaquero.png
137-papagallo.png
138-roncador.png
139-munchero.png
140-pasillero.png
141-caobon.png
142-teleferix.png
143-pilandero.png
144-sambilon.png
145-redactor.png
146-cabrialesix.png
147-penalveris.png
148-carabobex.png
149-redantom.png
150-enrolador.png
```

---

*Documento generado para Enrola Legends v2.0 — enrola.shop*
*150 criaturas, 58 batches, listos para generar.*
