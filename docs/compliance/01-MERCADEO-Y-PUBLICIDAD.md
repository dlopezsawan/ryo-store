# COMPLIANCE — MERCADEO Y PUBLICIDAD

**Para:** equipo de marketing, community manager, copywriter, encargado de campañas
**Alcance:** Venezuela
**Versión:** 1.0 — Mayo 2026
**Documento maestro:** ver `06-MARCO-LEGAL-Y-PLANTILLAS.md` para marco normativo completo y glosario

---

## ⚠️ Disclaimer

Documento operacional. No constituye asesoría legal vinculante. Validar con abogado venezolano antes de aprobar campañas con presupuesto significativo o que mencionen el catálogo de manera explícita.

---

## Tabla de contenidos

1. [Reglas duras de publicidad](#1-reglas-duras-de-publicidad)
2. [Redes sociales (Instagram, TikTok, Facebook)](#2-redes-sociales)
3. [WhatsApp marketing (WaSenderAPI)](#3-whatsapp-marketing)
4. [Email marketing (Listmonk + Resend)](#4-email-marketing)
5. [Tracking y pixels publicitarios](#5-tracking-y-pixels-publicitarios)
6. [Influencers y publicidad encubierta](#6-influencers-y-publicidad-encubierta)
7. [Programa de lealtad (Club RYO)](#7-programa-de-lealtad-club-ryo)
8. [Programa de referidos](#8-programa-de-referidos)
9. [Mini-juego "Enrola Legends"](#9-mini-juego-enrola-legends)
10. [Sorteos y promociones](#10-sorteos-y-promociones)
11. [Checklist accionable de mercadeo](#11-checklist-accionable-de-mercadeo)

---

## 1. Reglas duras de publicidad

### 1.1. Marco legal venezolano que aplica a TODA campaña

| Norma | Lo que prohíbe / exige |
|---|---|
| **Ley para el Control del Tabaco (2011)** + Resolución MPPS-INPSASEL Nº 030/2011 | Prohíbe publicidad directa o indirecta de tabaco. Por extensión analógica, aplica riesgo a publicidad de parafernalia |
| **LOPNNA Art. 79** | Prohíbe publicidad dirigida a menores y uso de menores en publicidad |
| **LOPNNA Art. 235** | Sanciona venta de tabaco/parafernalia a menores |
| **Ley Orgánica de Drogas (2010)** | Sanciona inducción al consumo de sustancias prohibidas |
| **Ley Orgánica de Precios Justos (2015)** | Prohíbe publicidad engañosa, comparativa desleal, precios encubiertos |
| **Constitución Art. 117** | Derecho del consumidor a información veraz |

### 1.2. Reglas absolutas (no negociables)

❌ **Nunca:**
- Promover, glorificar o instruir el consumo de cannabis ni de ninguna sustancia prohibida en Venezuela
- Mostrar el acto de fumar, combustión, humo activo en imagen principal de campaña
- Usar imaginería juvenil (escolar, infantil, cartoon, dibujos animados, mascotas estilo niño)
- Patrocinar contenido, eventos o influencers con audiencia mayoritaria menor de 18
- Publicidad encubierta sin disclosure (#ad, #publicidad, "colaboración pagada")
- Comparar negativamente con competencia citándola por nombre
- Anunciar precio sin IVA incluido
- Anunciar disponibilidad de producto agotado

✅ **Siempre:**
- Línea editorial **producto-neutro**: estética, packaging, lifestyle adulto
- Leyenda permanente en piezas: "Producto destinado exclusivamente a uso adulto. Su uso indebido puede afectar la salud."
- Confirmar audiencia segmentada a +18 en todas las plataformas
- Disclosure visible en colaboraciones pagadas
- Precio publicado = precio que paga el consumidor (con IVA)

### 1.3. Productos que JAMÁS pueden mencionarse en campañas (riesgo penal)

- Cannabis o derivados (CBD, THC) — ilegal en Venezuela
- Semillas de cannabis
- Vaporizadores con cartuchos de THC
- "Sales de baño", incienso herbal con cannabinoides sintéticos
- Tabaco de contrabando (sin estampilla fiscal)
- Cualquier mención a uso medicinal de cannabis

---

## 2. Redes sociales (Instagram, TikTok, Facebook)

### 2.1. Restricciones de las plataformas

**Meta (Instagram + Facebook)**
- ❌ Prohibe **anuncios pagados** de tabaco, parafernalia, productos relacionados con cannabis
- ⚠️ Permite **contenido orgánico** con restricciones — algoritmo penaliza humo, combustión
- ⚠️ Puede suspender la cuenta sin previo aviso ni recurso efectivo

**TikTok**
- Política equivalente a Meta
- Contenido viralizado puede ser revisado y desmonetizado retroactivamente
- TikTok Shop tiene política aún más estricta

### 2.2. Implicaciones operacionales

- ❌ **NO comprar publicidad pagada** en estas plataformas para productos del catálogo
- ⚠️ Contenido orgánico debe ser **producto-neutro**: foco en estética, packaging, lifestyle, marca
- ⚠️ Riesgo permanente de baneo sin notificación
- 💡 **Diversificar canales**: tener presencia también en YouTube, blog propio, newsletter, comunidades cerradas

### 2.3. instagrapi-worker — automatización no oficial

El stack incluye un container Python (`backend/instagrapi-worker/`) que usa la biblioteca `instagrapi` (no oficial, ingeniería inversa de Instagram).

**Riesgos:**
- Violación de Términos de Meta → ban permanente sin recurso
- Riesgo legal débil pero existente bajo LECDI Art. 6 si Meta denunciara
- Si filtran las credenciales → acceso completo a la cuenta

**Recomendaciones:**
- Usar **cuenta secundaria**, no la principal de Enrola
- Rotar credenciales mensualmente
- Documentar internamente el riesgo asumido
- Tener plan B (Buffer.com oficial, Meta Business Suite) para tareas migrables

---

## 3. WhatsApp marketing

### 3.1. Política comercial de WhatsApp/Meta

WhatsApp **prohíbe explícitamente** en su Política Comercial:
- Productos de tabaco y derivados
- Parafernalia para consumo de drogas
- Cannabinoides

Implicación: **WhatsApp Business API oficial puede suspender la cuenta sin recurso**. Templates promocionales de productos restringidos no se aprueban.

### 3.2. WaSenderAPI — gateway no oficial

Enrola usa **WaSenderAPI** (gateway no oficial vía WhatsApp Web Multi-Device).

**Riesgos:**
- Violación de Términos WhatsApp → ban permanente del número
- Pérdida del número de servicio = impacto operacional crítico (clientes acostumbrados al número)
- Si el número es personal del operador → queda en riesgo personal

**Mitigaciones obligatorias:**
- ✅ **Chip empresarial dedicado**, no asociado a persona física
- ✅ No usar en otras cuentas personales
- ✅ Limitar volumen (no enviar miles de mensajes por día)
- ✅ No usar para mensajes claramente promocionales masivos
- ✅ Tener **plan B documentado**: si el número cae, ¿cómo se contacta a clientes?

### 3.3. Reglas de envío de mensajes

✅ **Siempre:**
- Solo enviar a clientes que dieron su número en compra/registro (consentimiento previo)
- Primer mensaje identifica a Enrola y ofrece baja: *"Responde STOP para no recibir más mensajes."*
- Respetar la baja inmediatamente
- Conservar registro del consentimiento (cuándo, cómo)

❌ **Nunca:**
- Comprar/usar listas de números externas
- Enviar a quien nunca compró ni interactuó
- Ignorar pedidos de baja
- Enviar contenido promocional masivo sin segmentación

### 3.4. Inviolabilidad de comunicaciones

**Constitución Art. 48** + **Ley sobre Privacidad de las Comunicaciones (1991)** protegen las conversaciones privadas. Implicaciones:
- ❌ Capturas de chats de clientes en redes (incluso para "exponer un mal cliente") → ilegal sin difuminar datos personales y sin autorización
- ❌ Compartir chats fuera del ámbito laboral → delito (LECDI Art. 20)
- ❌ Usar chats para fines distintos al servicio (ej.: análisis de mercado vendido a tercero) → violación de privacidad

---

## 4. Email marketing

### 4.1. Marco aplicable

Venezuela **no tiene ley anti-spam** específica. Pero:
- CONATEL ha emitido lineamientos sobre comunicaciones no solicitadas
- Abuso reiterado puede calificarse como acoso (Código Penal)
- Sender reputation de Resend/Mailgun exige opt-in real para no ser bloqueado
- Buenas prácticas internacionales son la referencia operacional

### 4.2. Reglas obligatorias (estándar internacional adoptado)

✅ **Siempre:**
- **Doble opt-in**: cliente se suscribe → recibe email confirmación → confirma → entra a la lista
- **Link de baja en cada email** (one-click unsubscribe)
- **Identificación clara del remitente**: nombre Enrola C.A., dirección física, RIF en pie de cada email
- **Asunto no engañoso** (no falsear como "Re:", no clickbait)
- Periodicidad razonable (sugerido: máximo 2 emails/semana, salvo transaccionales)

❌ **Nunca:**
- Comprar listas externas
- Enviar a quien nunca aceptó
- Ocultar el link de baja
- Enviar bajo nombre de remitente engañoso

### 4.3. Listmonk (autohospedado)

Listmonk corre en la VPS de Enrola. Implicaciones:
- Las listas de suscriptores son **responsabilidad directa de Enrola** (no del proveedor)
- El acceso al panel debe estar restringido (login fuerte, 2FA si posible)
- Las listas son datos personales — aplica todo lo del documento `04-SEGURIDAD-Y-DATOS.md`

### 4.4. Resend (proveedor transaccional)

Resend procesa los emails transaccionales (confirmación de compra, fulfillment, recovery, etc.). Implicaciones:
- Resend es empresa de EE.UU. → transferencia internacional (declarable en Política de Privacidad)
- Logs de Resend conservan emails enviados típicamente 30-90 días
- Firmar Data Processing Agreement con Resend si está disponible

---

## 5. Tracking y pixels publicitarios

### 5.1. Tecnologías en uso (según docs del proyecto)

- Pixel Meta (probable, para conversiones IG/Facebook)
- Pixel TikTok (probable)
- Google Analytics 4
- Microsoft Clarity (heatmaps + session replay)
- PostHog (product analytics)

### 5.2. Implicaciones para el equipo de marketing

**Microsoft Clarity es lo más sensible:** literalmente graba el video de la sesión del usuario en el navegador. Si el usuario tipea cédula, dirección, teléfono → quedan grabados en Clarity.

**Acciones obligatorias:**
- Configurar **data masking** en Clarity para campos sensibles (cédula, dirección, password, teléfono)
- Confirmar que el equipo de marketing NO acceda a las grabaciones para verificar identidades de clientes específicos
- Las grabaciones son herramienta agregada, no individual

**Pixel Meta y TikTok:**
- Envían eventos de conversión (vista producto, agregado carrito, compra)
- Cruzan con perfil publicitario del usuario en la plataforma
- Si la cuenta de Enrola es baneada por publicar parafernalia, los pixels también dejan de funcionar

### 5.3. Edad-gate antes de pixels

❌ **Nunca cargar pixels antes de confirmar +18 del visitante.**
- Si un menor entra al sitio y el pixel dispara → hay tracking de menor → riesgo bajo LOPNNA y políticas de Meta/Google
- Cargar pixels solo **después** de aceptar el banner +18

---

## 6. Influencers y publicidad encubierta

### 6.1. Contrato escrito obligatorio

Si Enrola contrata a un influencer:
- **Contrato firmado** que defina:
  - Alcance: cuántas piezas, en qué formato, en qué plataformas
  - **Prohibiciones**: no promover consumo, no a menores, no usar competencia
  - Disclosure obligatorio (#ad, #publicidad)
  - Cláusula de retirada: Enrola puede exigir bajar contenido inapropiado
  - Pago: monto, forma, plazos
  - Propiedad: ¿el contenido es de Enrola o del influencer?

### 6.2. Disclosure obligatorio

Si Enrola paga (en dinero, producto, descuento) a alguien para que mencione el catálogo:
- **El influencer DEBE identificar el contenido como publicidad**
- Hashtags válidos: `#ad`, `#publicidad`, `#colaboraciónpagada`
- Texto válido: *"En colaboración pagada con @enrola"*
- ❌ Publicidad encubierta (mostrar el producto sin declarar la relación) → potencialmente engañosa según LOPJ y reglas de plataformas

### 6.3. Audiencia del influencer

Antes de contratar verificar que la audiencia del influencer:
- ✅ Sea mayoritariamente +18 (la plataforma indica esto en analytics)
- ✅ Esté en zonas de cobertura de Enrola (Venezuela)
- ❌ NO sea infantil/juvenil
- ❌ NO incluya patrocinios competidores activos del mismo nicho

---

## 7. Programa de lealtad (Club RYO)

### 7.1. Reglas vigentes (módulo loyalty del backend)

- 10 puntos por cada $1 gastado
- 100 pts = $1 al canjear
- Recompensas en catálogo (productos físicos)

### 7.2. Reglamento que debe estar publicado (ver doc `02-WEB.md` para implementación)

- Quién puede participar (clientes registrados, +18)
- Cómo se acumulan puntos (qué compras dan puntos, cuáles no — ej.: ¿devoluciones restan?)
- Cómo se canjean (catálogo, restricciones, mínimos)
- **Caducidad de puntos**: ¿caducan? ¿en cuánto tiempo? — definir o queda como pasivo contable indefinido
- Causales de eliminación de puntos (fraude, devolución de la compra que generó puntos)
- **Modificación o terminación del programa**: con preaviso de X días (sugerido 30)

### 7.3. Recomendaciones específicas

- 💡 **Que los puntos sean exclusivamente descuentos en próxima compra**, no premios físicos. Razón: premios físicos generan obligación SENIAT (factura por valor de mercado, IVA podría aplicar). Descuentos solo descuentan de base imponible. Más simple fiscalmente.
- 💡 Comunicar saldo y vencimiento próximo proactivamente (UX + transparencia)
- 💡 No usar el programa para discriminar precios: los precios públicos deben ser los mismos para todos; los puntos son beneficio adicional

### 7.4. Pasivo contable (heads-up para administración)

- Los puntos acumulados son **deuda implícita** con el cliente
- Si Enrola cierra el programa sin honrar puntos → reclamable en SUNDDE
- Provisionar contablemente el valor estimado del pasivo (coordinar con `03-ADMINISTRATIVO.md`)

---

## 8. Programa de referidos

### 8.1. Diferencia entre referido legítimo y esquema piramidal

**Referido legítimo (válido):**
- Cliente A invita a B
- B compra una vez → A recibe recompensa puntual
- La recompensa NO depende de que B reclute a más personas
- No hay niveles jerárquicos ni cadenas

**Esquema piramidal (ilegal — Ley Orgánica de Precios Justos + Código Penal):**
- Recompensa por reclutar (no por venta)
- Niveles jerárquicos (A gana también de los que B reclute)
- Pago de cuotas de entrada
- Promesa de ingresos por reclutamiento

**Verificación del programa actual:**
- ✅ Recompensa solo si referido **compra** (no solo registra)
- ✅ Sin niveles/cascada
- ✅ Sin promesas de ingresos recurrentes

### 8.2. Consentimiento del referido

❌ **Riesgo:** A le da el email/teléfono de B → Enrola le envía mensaje a B → B nunca consintió → spam
✅ **Solución:** el flujo debe generar un **link único de referido** que A le comparta a B por SU canal personal (WhatsApp personal, mensaje directo). Enrola NO contacta a B hasta que B se registra por iniciativa propia.

### 8.3. Reglamento que debe estar publicado

- Cómo funciona (referente, referido, recompensa)
- Recompensa exacta (puntos, descuento, monto)
- Cuándo se acredita (al registro, primera compra, segunda compra)
- Mínimos del referido para que cuente (ej.: compra mínima)
- Causales de invalidación (fraude, autoreferencia, mismo IP, mismo dispositivo)
- Límite de referidos por persona (si aplica)

---

## 9. Mini-juego "Enrola Legends"

Aún en planificación según el repo (`game/GAME-DEV-PLAN.md`). Si se llega a desplegar, **alto riesgo legal por atractivo a menores**.

### 9.1. Riesgo crítico

Un juego es por naturaleza más atractivo para públicos jóvenes. Si:
- Recolecta datos (email, edad, nombre)
- Otorga premios canjeables en la tienda
- Está vinculado al ecosistema Enrola

→ Hay alto riesgo de que menores participen.

**LOPNNA**: protección integral exige no recolectar datos de menores sin consentimiento del representante legal. Sanciones graves si fiscalización detecta.

### 9.2. Mitigaciones obligatorias antes del lanzamiento

- ✅ **Edad-gate ANTES** de cargar el juego (no después)
- ✅ Si premios → canjeables solo en cuenta verificada como +18
- ✅ Si recolecta data → política específica del juego declarando que no se acepta participación de menores
- ❌ NO usar estética cartoon/infantil
- ❌ NO promover el juego en plataformas con audiencia juvenil
- ❌ NO mencionar el juego en redes sin disclaimer +18

---

## 10. Sorteos y promociones

### 10.1. Marco regulatorio

Sorteos en Venezuela están sujetos a regulación de **Comisión Nacional de Lotería (CONALOT)** si involucran:
- Azar puro (no habilidad)
- Premios de valor económico
- Apertura al público general

### 10.2. Recomendaciones

- ✅ Si es sorteo de azar puro con premio de valor → consultar con abogado si requiere autorización CONALOT
- ✅ Si es **concurso de habilidad** (mejor foto, mejor mensaje) → no es sorteo, no requiere autorización
- ✅ **Bases del concurso publicadas** desde el día 1 (formato HTML, no PDF descargable solo)
- ✅ Bases incluyen: período, cómo participar, premios exactos, cómo se elige ganador, fecha de sorteo, plazo para reclamar premio
- ✅ Premio: declarar valor de mercado, comunicar al ganador con factura/comprobante
- ⚠️ Tributación: premios de valor pueden generar obligación de retención ISLR — consultar con `03-ADMINISTRATIVO.md` o contador

---

## 11. Checklist accionable de mercadeo

### Inmediato (próximos 14 días)

- [ ] Revisar que ninguna pieza activa muestre humo, combustión, ni acto de fumar como elemento principal
- [ ] Revisar que ninguna pieza activa use imaginería juvenil
- [ ] Confirmar que segmentación de audiencia en Meta/TikTok excluye menores de 18
- [ ] Implementar leyenda permanente en piezas: "Producto destinado exclusivamente a uso adulto."
- [ ] Verificar que Enrola **NO tiene activas campañas pagadas** en Meta/TikTok que mencionen catálogo
- [ ] Revisar última semana de emails enviados: cumplen identificación de remitente y link de baja
- [ ] Auditar lista Listmonk: ¿hay direcciones que entraron sin opt-in? Limpiar
- [ ] Documentar el chip de WhatsApp: ¿es empresarial o personal? Si personal → migrar
- [ ] Configurar data masking en Microsoft Clarity para campos sensibles
- [ ] Verificar que pixels NO se cargan antes del age-gate
- [ ] Documentar todos los influencers activos: ¿tienen contrato escrito? ¿hacen disclosure?

### Mediano plazo (1-3 meses)

- [ ] Reglamento completo del programa de lealtad publicado
- [ ] Reglamento completo del programa de referidos publicado
- [ ] Plan B documentado para caída de cuenta WhatsApp/Instagram
- [ ] Auditoría de cuentas en redes: estado de salud, riesgo de baneo, plan de recuperación
- [ ] Plantilla de contrato con influencer aprobada por abogado
- [ ] Política interna de aprobación de campañas (quién aprueba qué)
- [ ] Si se lanza mini-juego: completar mitigaciones de §9.2 ANTES del despliegue

### Estructural (6 meses+)

- [ ] Diversificación real de canales (no depender de IG+TikTok)
- [ ] Construcción de canal propio con bajo riesgo de baneo (newsletter, blog, comunidad)
- [ ] Auditoría legal anual de campañas (revisión por abogado)
- [ ] Si se hacen sorteos: validar mecánica con abogado antes de lanzar

---

## Referencias cruzadas

- Marco legal completo y glosario: `06-MARCO-LEGAL-Y-PLANTILLAS.md`
- Implementación técnica del age-gate y cookies: `02-WEB.md`
- Custodia de datos de clientes captados por marketing: `04-SEGURIDAD-Y-DATOS.md`
- Tributación de premios y obligaciones SENIAT: `03-ADMINISTRATIVO.md`
- Restricciones del catálogo: `05-PRODUCTO-Y-CATALOGO.md`

---

*Última revisión: mayo 2026. Revisión sugerida: cada 6 meses o ante cambios normativos.*
