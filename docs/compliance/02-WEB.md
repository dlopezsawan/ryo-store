# COMPLIANCE — WEB (STOREFRONT)

**Para:** equipo de producto, dev frontend, dev fullstack
**Alcance:** Venezuela
**Versión:** 1.0 — Mayo 2026
**Documento maestro:** ver `06-MARCO-LEGAL-Y-PLANTILLAS.md` para marco normativo completo, plantillas y glosario

---

## ⚠️ Disclaimer

Documento operacional. No constituye asesoría legal vinculante. Validar con abogado venezolano antes de publicar nuevos términos, política de privacidad, o cambios significativos en el storefront.

---

## Tabla de contenidos

1. [Documentos legales obligatorios visibles](#1-documentos-legales-obligatorios-visibles)
2. [Aviso Legal](#2-aviso-legal)
3. [Términos y Condiciones](#3-términos-y-condiciones)
4. [Política de Privacidad](#4-política-de-privacidad)
5. [Política de Devoluciones](#5-política-de-devoluciones)
6. [Verificación de edad (+18)](#6-verificación-de-edad-18)
7. [Cookie banner y consentimiento](#7-cookie-banner-y-consentimiento)
8. [reCAPTCHA y servicios de Google](#8-recaptcha-y-servicios-de-google)
9. [Analytics y session replay](#9-analytics-y-session-replay)
10. [Chatbot Dana (IA conversacional)](#10-chatbot-dana-ia-conversacional)
11. [Información de productos y precios](#11-información-de-productos-y-precios)
12. [HTTPS, seguridad y headers](#12-https-seguridad-y-headers)
13. [Habeas Data — flujo público](#13-habeas-data--flujo-público)
14. [Checklist accionable web](#14-checklist-accionable-web)

---

## 1. Documentos legales obligatorios visibles

Toda tienda online operando bajo ley venezolana debe publicar (links accesibles desde el footer y/o checkout):

| Documento | Obligatoriedad | Base legal | URL sugerida |
|---|---|---|---|
| **Aviso Legal** | Obligatorio | Ley Orgánica de Precios Justos; Ley sobre Mensajes de Datos | `/aviso-legal` |
| **Términos y Condiciones** | Obligatorio (define el contrato) | Código Civil; Decreto-Ley Mensajes de Datos Art. 12 | `/terminos` |
| **Política de Privacidad** | Recomendado fuertemente | Constitución Art. 28; LECDI | `/privacidad` |
| **Política de Cookies** | Recomendado | Buena práctica | `/cookies` |
| **Política de Devoluciones** | Obligatorio | Ley Orgánica de Precios Justos Art. 75 | `/devoluciones` |
| **Política de Garantía** | Obligatorio | Ley Orgánica de Precios Justos Art. 73 | `/garantia` |
| **Información de envío** | Obligatorio | Ley Orgánica de Precios Justos | `/envios` |
| **Verificación de edad +18** | Obligatorio para parafernalia | LOPNNA + Ley Tabaco | banner global |

### 1.1. Reglas de implementación

- ✅ Links visibles en **footer en todas las páginas**
- ✅ Link de Términos visible al final del checkout, antes del botón "Confirmar pedido"
- ✅ Checkbox "He leído y acepto los Términos y la Política de Privacidad" **NO preseleccionado**
- ✅ Cada documento accesible **sin necesidad de iniciar sesión**
- ✅ Versionar las políticas (fecha de última actualización visible en cada documento)
- ✅ Notificar a clientes cuando hay cambios materiales (banner + email a registrados)

---

## 2. Aviso Legal

### 2.1. Datos públicos obligatorios

El Aviso Legal debe identificar al oferente con:

- **Razón social completa** (ej.: "Enrola C.A.")
- **RIF** (Registro de Información Fiscal)
- **Domicilio fiscal** completo (estado, municipio, dirección, código postal si aplica)
- **Datos de inscripción** en Registro Mercantil (oficina, tomo, número, fecha)
- **Email de contacto comercial** (ej.: `hola@enrola.shop`)
- **Teléfono de contacto** (idealmente WhatsApp Business)
- **Representante legal** (nombre y cédula del responsable)

### 2.2. Si Enrola opera como persona natural

Si no hay sociedad mercantil constituida y opera como firma personal:
- Nombre completo
- Cédula
- RIF
- Domicilio
- Email y teléfono

> ⚠️ **Operar sin estructura jurídica formal y sin Aviso Legal expone al dueño a responsabilidad personal ilimitada** ante reclamos SUNDDE, SENIAT y judiciales. Coordinar con `03-ADMINISTRATIVO.md` para constitución formal.

---

## 3. Términos y Condiciones

### 3.1. Cláusulas mínimas obligatorias

1. **Identidad del oferente** (igual al Aviso Legal)
2. **Objeto del contrato**: qué se vende y para qué público
3. **Proceso de compra paso a paso**: registro/invitado, carrito, checkout, pago, confirmación, envío
4. **Precios**: en Bs (con referencial USD/EUR), incluyendo IVA, IGTF cuando aplique
5. **Formas de pago aceptadas** y sus condiciones (Pago Móvil, Zelle, USDT, Binance Pay, transferencia, etc.)
6. **Plazos de entrega** y zonas de cobertura
7. **Política de cancelación por parte del cliente** (antes de despacho: cancelable; después: aplican costos)
8. **Política de cancelación por parte de Enrola** (rotura stock, sospecha fraude, edad no verificada)
9. **Devoluciones** (link a `/devoluciones`)
10. **Garantía** del producto (link a `/garantia`)
11. **Limitación de responsabilidad** (Enrola no responde por uso indebido del producto por parte del cliente)
12. **Propiedad intelectual** (las imágenes, marca, contenido del sitio no se pueden reutilizar sin autorización)
13. **Verificación de edad** (cliente declara y acepta penalmente ser mayor de 18)
14. **Tratamiento de datos** (link a `/privacidad`)
15. **Modificación de términos**: Enrola puede actualizarlos con preaviso de 15 días vía email + banner
16. **Jurisdicción y ley aplicable**: tribunales de Venezuela competentes en domicilio de Enrola, ley venezolana
17. **Resolución de disputas**: contacto interno de quejas (`reclamos@enrola.shop`) → SUNDDE como instancia administrativa
18. **Aceptación expresa**: checkbox no preseleccionado en el checkout

### 3.2. Validez jurídica del clic-aceptación

El **Decreto-Ley sobre Mensajes de Datos y Firmas Electrónicas (2001)** reconoce validez jurídica a la aceptación electrónica si:
- Hay registro técnico de la aceptación (timestamp + IP + sesión)
- El cliente tuvo acceso real al texto antes de aceptar
- La aceptación es activa (clic en checkbox), no pasiva

**Implementación técnica recomendada:**
- Loggear cada aceptación: `{user_id, accepted_at, terms_version, ip, user_agent}`
- Conservar registros mínimo 5 años
- Versionado de Términos: cada cambio material genera nueva versión y obliga a re-aceptación

---

## 4. Política de Privacidad

### 4.1. Contenidos exigibles

Aunque Venezuela no tiene ley estilo GDPR, la **Constitución Art. 28 (Habeas Data)** y la **LECDI** generan obligaciones implícitas. La política debe declarar:

#### 4.1.1. Quién recolecta los datos
- Razón social, RIF, domicilio
- Responsable de datos designado (nombre, email)

#### 4.1.2. Qué datos se recolectan

| Categoría | Datos específicos |
|---|---|
| Identificativos | Nombre, apellido, cédula, fecha de nacimiento |
| Contacto | Email, teléfono, dirección de envío |
| Pago | Comprobantes Pago Móvil, número operación, banco origen, monto, fecha |
| Conducta | Historial compras, navegación, dispositivo, IP, ubicación aproximada |
| Comunicación | Mensajes con Dana, WhatsApp, email, contacto |
| Lealtad | Puntos, recompensas canjeadas, referidos |

#### 4.1.3. Para qué se usan (finalidades específicas)
- Ejecutar la compra y entregar el producto
- Verificar identidad y edad
- Cumplir obligaciones SENIAT (factura)
- Marketing (con consentimiento separado opt-in)
- Mejorar el servicio (analítica)

#### 4.1.4. Con quién se comparten (lista exhaustiva)
- MRW (transportista)
- Resend (proveedor email transaccional, EE.UU.)
- Listmonk (newsletter, autohospedado)
- WhatsApp/WaSenderAPI
- Google (Analytics, reCAPTCHA, EE.UU.)
- PostHog (analítica, EE.UU.)
- Microsoft Clarity (heatmaps, EE.UU.)
- **DeepSeek (chatbot Dana — China)** ⚠️
- Hostinger (alojamiento)
- SENIAT (cumplimiento factura)
- Autoridades cuando sean requeridas por orden judicial

#### 4.1.5. Cuánto tiempo se conservan
- Datos contables (facturas): 5-10 años (exigencia SENIAT)
- Datos de cliente activo: mientras dure relación + 2 años
- Comprobantes pago: 5 años (prueba de operación)
- Logs de chatbot: 6 meses
- Cookies analítica: ver §7.4

#### 4.1.6. Derechos del cliente (Habeas Data)
- Acceder a sus datos
- Rectificar errores
- Solicitar destrucción cuando ya no sean necesarios
- Conocer la finalidad del uso
- Canal: `privacidad@enrola.shop`, respuesta en 15 días hábiles

#### 4.1.7. Seguridad
- Medidas técnicas (HTTPS, cifrado en reposo, control de acceso) **sin entrar en detalle que ayude a atacantes**

#### 4.1.8. Menores
- No se recolectan datos de menores de 18
- Si se detecta, se eliminan
- Mecanismos de verificación de edad activos

#### 4.1.9. Modificaciones
- Cómo se notifican al cliente
- Plazo de preaviso

#### 4.1.10. Fecha última actualización

### 4.2. Plantilla esqueleto

Ver `06-MARCO-LEGAL-Y-PLANTILLAS.md` § Plantilla de Política de Privacidad.

---

## 5. Política de Devoluciones

### 5.1. Marco aplicable

**Ley Orgánica de Precios Justos** garantiza al consumidor:
- **Devolución por defecto/vicio oculto**: hasta los plazos de garantía
- **Cambio por error en el pedido**: dentro de plazo razonable (típicamente 7-15 días)
- **Reembolso por incumplimiento del proveedor** (no entrega, producto distinto)

> **Nota:** Venezuela no exige "derecho de retracto" automático de 14 días como UE. Pero ofrecer 1-7 días aumenta confianza del cliente y reduce disputas.

### 5.2. Cláusulas mínimas

1. **Plazo para reportar defectos evidentes**: 48-72h tras recepción
2. **Plazo para reportar vicios ocultos**: hasta el plazo de garantía del producto
3. **Condiciones del producto retornado**: empaque original, sin uso, accesorios completos
4. **Costos de envío de retorno**:
   - A cargo del cliente si es arrepentimiento
   - A cargo de Enrola si es defecto, error de envío, o producto distinto
5. **Forma de reembolso**: misma vía de pago original (importante por trazabilidad SENIAT — un reembolso por canal distinto puede ser visto como operación irregular)
6. **Plazo de reembolso**: típicamente 7-15 días hábiles
7. **Productos no retornables**: si los hay (ej.: por higiene, productos personalizados), declararlo expresamente
8. **Cómo iniciar el proceso**: email a `devoluciones@enrola.shop` o canal específico

### 5.3. Implementación técnica

- Botón "Solicitar devolución" visible en historial de pedidos del cliente
- Formulario que capture: pedido, producto, motivo, fotos si defecto
- Caso queda registrado y trazable internamente
- Comunicación al cliente con número de caso

---

## 6. Verificación de edad (+18)

### 6.1. Estado actual y mejora requerida

Actualmente el storefront tiene un *age gate* (banner "¿Eres mayor de 18?"). Esto es **mínimo necesario pero insuficiente** desde rigor legal.

| Nivel | Mecanismo | Rigor legal | Estado actual |
|---|---|---|---|
| Básico | Banner "soy +18" con clic | Bajo — declarable como simbólico | ✅ implementado |
| Medio | Banner + checkbox T&C + verificación de cédula al checkout | Medio — hay registro de la declaración | parcial |
| Alto | Verificación contra registro civil (cedula.com.ve) + cruce con base de datos | Alto — prueba documental | parcial (cedula-cache existe) |

### 6.2. Implementación recomendada (medio→alto)

#### 6.2.1. Banner de entrada
```
"Este sitio comercializa productos para personas mayores de 18 años.

Declaro bajo fe que soy mayor de 18 años. Falsear esta declaración 
me responsabiliza penalmente bajo la legislación venezolana."

[ ] Acepto                 [ Soy mayor de 18 ]   [ No tengo 18 años ]
```

- Loggear cada aceptación: `{session_id, accepted_at, ip, user_agent}` (cookie + BD)
- Si "no tengo 18": redirigir fuera del sitio
- Cookie con TTL razonable (sugerido: 30 días)

#### 6.2.2. Checkout — verificación cruzada
- **Cédula obligatoria** en formulario de compra
- Validar contra `/store/cedula-cache` (ya implementado)
- Cruzar con fecha de nacimiento del registro civil
- Si computa < 18 → **rechazar pedido** con mensaje:
  > *"Este pedido no puede procesarse. Para más información, contáctanos en hola@enrola.shop."*
  (No revelar el motivo exacto para evitar gaming del sistema)

#### 6.2.3. Casos borde
- **Cédula no encontrada en cedula.com.ve**: requerir foto de cédula (custodia con cifrado, ver `04-SEGURIDAD-Y-DATOS.md`)
- **Pasaporte u otro documento**: solicitud manual con review humano
- **Compra recurrente +18 verificada previamente**: marcar la cuenta y no re-validar

### 6.3. Pixels y tracking — ANTES del age-gate

❌ **No cargar pixels de Meta, TikTok, GA4 ni Clarity antes de aceptar el age-gate.** Cargarlos solo después.

Razones:
- Si menor entra al sitio y pixels disparan → tracking de menor → riesgo LOPNNA
- Políticas de Meta/Google penalizan tracking de menores
- Clarity podría grabar sesión de menor

Implementación:
```javascript
// Pseudo-código
if (cookie.ageVerified === true) {
  loadPixelMeta();
  loadPixelTikTok();
  loadGA4();
  loadClarity();
}
```

---

## 7. Cookie banner y consentimiento

### 7.1. Marco aplicable

Venezuela **no exige** banner de cookies como sí la UE. Pero es **recomendable** por:
- Transparencia hacia el cliente
- Buena práctica universal
- Reduce riesgo si proveedores (Google, Meta) endurecen exigencias
- Facilita futuras expansiones

### 7.2. Modelo recomendado

Banner con tres opciones:

```
┌─────────────────────────────────────────────────────────┐
│ Usamos cookies para hacer funcionar el sitio, recordar  │
│ tu carrito y entender cómo nos visitan. Puedes elegir   │
│ qué cookies aceptar.                                    │
│                                                          │
│  [ Aceptar todas ]  [ Solo necesarias ]  [ Configurar ] │
└─────────────────────────────────────────────────────────┘
```

### 7.3. Categorías

| Categoría | Cookies | Consentimiento |
|---|---|---|
| **Estrictamente necesarias** | Sesión, carrito, anti-CSRF, login | No requiere — esenciales |
| **Funcionales** | Preferencias UI, idioma, tema | Opt-in |
| **Analíticas** | GA4, PostHog, Clarity | Opt-in |
| **Marketing** | Pixel Meta, Pixel TikTok, remarketing | Opt-in |

### 7.4. Implementación técnica

- Banner aparece en primera visita (después del age-gate)
- Selección persistida en cookie `cookieConsent` con TTL 1 año
- Re-mostrar banner cuando se actualice la política o cada 12 meses
- Link permanente a "Configurar cookies" en footer

### 7.5. Coordinación con age-gate

Orden correcto en primera visita:
1. **Age-gate** (¿+18?) → si no, salir del sitio
2. **Cookie banner** (qué cookies aceptas)
3. Cargar pixels/analytics según selección

---

## 8. reCAPTCHA y servicios de Google

### 8.1. reCAPTCHA captura datos

reCAPTCHA v3 (probable uso) opera silenciosamente capturando:
- Movimientos del mouse
- Patrones de tipeo
- Cookies y comportamiento de navegación
- IP

Esto es **transferencia de datos a Google EE.UU.** sin que el usuario lo perciba activamente.

### 8.2. Disclosure obligatorio

**Google exige (en sus propios términos)** que sitios que usan reCAPTCHA muestren la siguiente leyenda visible:

> *"Este sitio está protegido por reCAPTCHA y se aplican la [Política de Privacidad](https://policies.google.com/privacy) y los [Términos de Servicio](https://policies.google.com/terms) de Google."*

Ubicación: al pie del formulario donde aparece reCAPTCHA o al pie de la página.

### 8.3. Otros servicios Google

- **Google Search Console** (datos del sitio, no del usuario) — bajo riesgo
- **GA4** (visitantes) — declarar en privacidad
- **Google Cloud APIs** (si se usan para Drive, Maps, etc.) — depende de uso
- **Google Fonts** (si se usan vía CDN de Google) — envía IP del visitante a Google → mejor self-host

---

## 9. Analytics y session replay

### 9.1. Stack analítico actual

- **Google Analytics 4** — eventos de página, conversión
- **PostHog** — product analytics, funnels
- **Microsoft Clarity** — heatmaps + **session replay**
- **Pixel Meta** (probable) — eventos de conversión
- **Pixel TikTok** (probable) — eventos de conversión

### 9.2. Microsoft Clarity — alta sensibilidad

Clarity literalmente **graba video de la sesión del visitante en el navegador**. Si el usuario tipea cédula, dirección, teléfono → quedan grabados.

**Acciones obligatorias:**
1. Configurar **data masking** en panel de Clarity
2. Por defecto, marcar todos los inputs como sensibles
3. Solo whitelist explícito: campos no sensibles (botones, links, navegación)
4. Específicamente enmascarar: cédula, teléfono, dirección, email, contraseña, número de tarjeta, montos

**HTML hint para Clarity (atributo `data-clarity-mask="true"`):**
```html
<input type="text" name="cedula" data-clarity-mask="True" />
<input type="text" name="direccion" data-clarity-mask="True" />
```

O CSS class:
```html
<input type="text" name="cedula" class="clarity-mask" />
```

### 9.3. Acceso interno a las grabaciones

- Restringir acceso a Clarity a un número mínimo de personas
- NUNCA usar Clarity para verificar identidad de cliente específico (eso es tratamiento individual no consentido)
- Solo análisis agregado y mejoras de UX

---

## 10. Chatbot Dana (IA conversacional)

### 10.1. Transparencia

Venezuela no tiene "AI Act". Pero por **Constitución Art. 117** (derecho a información veraz), engañar al cliente diciéndole que habla con persona puede ser engañoso.

**Reglas operacionales:**
- ✅ **Mensaje de bienvenida identificándose como bot**:
  > *"Hola, soy Dana, asistente automático de Enrola. Si necesitas hablar con un humano, escribe AGENTE."*
- ✅ **Botón visible** "Hablar con humano" en la interfaz
- ✅ Si la conversación se transfiere a humano, notificarlo claramente
- ❌ NO darle a Dana un nombre/voz que sugiera persona real específica

### 10.2. DeepSeek — transferencia internacional a China

DeepSeek es empresa china. Implicaciones:
- Cada conversación se procesa en servidores en China
- DeepSeek conserva logs (revisar política de retención específica)
- Datos del cliente venezolano viajan a jurisdicción china — debe declararse en Política de Privacidad
- Riesgo geopolítico: posible acceso gubernamental chino

**Acciones de mitigación:**
1. **Declarar uso de DeepSeek explícitamente** en Política de Privacidad
2. **Sanitizar inputs antes de enviarlos al LLM**:
   - Remover patrones de cédula (regex `\d{7,8}`)
   - Remover patrones de teléfono (regex venezolano)
   - Remover emails completos
   - Reemplazar por placeholders: `[CEDULA]`, `[TELEFONO]`, `[EMAIL]`
3. **No incluir contexto sensible** en el system prompt enviado a DeepSeek (ej.: catálogo completo con stocks, lista de clientes)
4. **Considerar alternativa con mejor garantía** para futuro: Claude (Anthropic, USA), GPT (OpenAI, USA), Gemini (Google, USA) — siguen siendo transferencia internacional pero con marcos de compliance más maduros

### 10.3. Limitaciones que debe tener Dana

- ❌ NO dar asesoría legal, médica o financiera vinculante
- ❌ NO confirmar precios diferentes a los del storefront
- ❌ NO procesar pagos directamente
- ❌ NO compartir información de otros clientes
- ❌ NO crear cuentas, modificar cuentas, o resetear contraseñas
- ✅ SÍ orientar sobre productos, políticas, estado del pedido (con verificación previa de identidad)

### 10.4. Cláusula en T&C sobre Dana

Incluir en `/terminos`:

> *"Dana es un asistente automático impulsado por inteligencia artificial. Sus respuestas tienen carácter orientativo y no constituyen ofertas vinculantes. Las ofertas vinculantes son las publicadas en este sitio (precios, disponibilidad, plazos) y las confirmadas por nuestro equipo humano. Si Dana provee información incorrecta, prevalece lo publicado oficialmente. Para consultas que requieran decisión vinculante, escribe AGENTE en el chat."*

### 10.5. Verificación de edad antes de chat

- ✅ Dana solo aparece **después** del age-gate
- ✅ Si el flujo del chat sugiere posible menor (ej.: lenguaje, patrones), Dana debe responder con disclaimer de +18 y, si confirma menor, terminar la conversación

### 10.6. Almacenamiento de conversaciones

- Las conversaciones son **datos personales** del cliente
- Aplican Habeas Data: cliente puede pedir acceso o eliminación
- **Retención sugerida: 6 meses** salvo razón comercial específica (ej.: queja en curso)
- Después de retención: anonimizar (mantener para análisis agregado, sin cédula/email)
- Coordinar custodia con `04-SEGURIDAD-Y-DATOS.md`

---

## 11. Información de productos y precios

### 11.1. Reglas Ley Orgánica de Precios Justos

- ✅ **Precios siempre con IVA incluido** — el precio publicado es el precio que paga el consumidor
- ✅ **IGTF declarado** cuando aplique (3% sobre divisas/USDT) — visible antes del checkout
- ✅ **Disponibilidad real**: producto agotado debe marcarse como "agotado", no como disponible
- ✅ **Etiquetado en español** de cada producto
- ✅ **Marca, modelo, contenido neto**, fabricante, país de origen, fecha de vencimiento (si aplica)

### 11.2. Publicidad engañosa — qué evitar

❌ **Nunca:**
- Tachar precio "antes/ahora" si nunca se vendió al precio "antes"
- Mostrar producto agotado sin advertirlo
- Imágenes que no corresponden al producto entregado
- Ocultar costos relevantes (IGTF, envío, comisión de pago)
- "Gratis" si en realidad hay costo (ej.: "envío gratis" cuando hay condición no visible)
- Comparativas de precio que mientan

### 11.3. Implementación técnica de precios

```
Precio del producto:        $50.00
IVA (16%):                  $8.00 (incluido en visualización)
Subtotal:                   $58.00 (con IVA)
IGTF (3% si pago en USDT):  $1.74
─────────────────────────────────────
Total a pagar (USDT):       $59.74
```

Mostrar el desglose si el cliente lo solicita; mostrar el total prominentemente.

---

## 12. HTTPS, seguridad y headers

### 12.1. HTTPS obligatorio

- ✅ Todos los endpoints públicos en HTTPS
- ✅ HTTP redirige a HTTPS (301)
- ✅ HSTS header activo (`Strict-Transport-Security: max-age=31536000; includeSubDomains`)
- ✅ TLS 1.2+ (idealmente TLS 1.3)
- ✅ Certificado válido (Let's Encrypt vía Traefik está bien)

### 12.2. Headers de seguridad recomendados

```
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
Content-Security-Policy: [definir según recursos del sitio]
```

### 12.3. Login y autenticación

- ✅ Contraseñas con hashing fuerte (bcrypt, argon2)
- ✅ Rate limiting en login (anti brute-force)
- ✅ Sesiones con expiración razonable
- ✅ Cookies de sesión con flags `HttpOnly; Secure; SameSite=Lax`
- ✅ 2FA opcional para clientes (recomendado para clientes de alto valor)

### 12.4. CSRF y XSS

- ✅ Tokens CSRF en formularios
- ✅ Sanitización de inputs en backend
- ✅ CSP headers para mitigar XSS
- ✅ Escape de outputs en frontend

---

## 13. Habeas Data — flujo público

### 13.1. Canal público

Email dedicado: `privacidad@enrola.shop` (o ruta `/privacidad/solicitudes`).

### 13.2. Flujo recomendado

```
1. Cliente envía solicitud → email recibido
2. Auto-respuesta inmediata: "Recibimos tu solicitud, ID #XXX"
3. Verificación de identidad (foto cédula vs. cédula registrada)
4. Procesamiento interno (responsable de privacidad busca datos)
5. Respuesta al cliente en máximo 15 días hábiles
6. Log interno: {fecha, solicitante, tipo de solicitud, respuesta, fecha respuesta}
```

### 13.3. Tipos de solicitud y respuesta

| Solicitud | Respuesta esperada |
|---|---|
| **Acceso** ("¿qué datos tienes míos?") | Export en formato legible (PDF, CSV, JSON) con todos los datos asociados a la cuenta |
| **Rectificación** ("este dato está mal") | Corrección dentro del plazo, confirmación al cliente |
| **Destrucción** ("borra mis datos") | Eliminación de todo lo no requerido legalmente; los datos requeridos (facturas SENIAT) se conservan con justificación escrita al cliente |
| **Conocer finalidad** | Explicación detallada de para qué se usan sus datos |

### 13.4. Implementación técnica sugerida

- Campo `account_status: active | deletion_requested | anonymized` en BD
- Cron job que limpia datos según política de retención
- Anonimización: reemplazar PII por hash o `[REDACTED]`, conservar registros transaccionales
- Logging de cada operación de destrucción para audit

---

## 14. Checklist accionable web

### Inmediato (próximos 14 días)

- [ ] Publicar Aviso Legal en `/aviso-legal` con datos completos
- [ ] Publicar Términos y Condiciones en `/terminos` con cláusulas mínimas (§3.1)
- [ ] Publicar Política de Privacidad en `/privacidad` con todas las secciones de §4.1
- [ ] Publicar Política de Devoluciones en `/devoluciones`
- [ ] Verificar que footer tiene los 4 links visibles en todas las páginas
- [ ] Reforzar age-gate: agregar declaración penal en banner; loggear aceptación
- [ ] Verificar que pixels NO se cargan antes del age-gate
- [ ] Configurar data masking en Microsoft Clarity (todos los campos sensibles)
- [ ] Agregar disclosure de reCAPTCHA al pie de formularios
- [ ] Configurar `privacidad@enrola.shop` y procedimiento Habeas Data
- [ ] Cláusula sobre Dana incluida en T&C
- [ ] Verificar HTTPS y headers de seguridad básicos

### Mediano plazo (1-3 meses)

- [ ] Cookie banner implementado (3 opciones: aceptar todo / necesarias / configurar)
- [ ] Verificación de edad robusta en checkout (cédula + cruce con fecha nacimiento)
- [ ] Versionado de políticas con fechas visibles
- [ ] Sistema de log de aceptación de T&C por cliente
- [ ] Implementar sanitización de inputs antes de enviarlos a Dana/DeepSeek
- [ ] Botón visible "Hablar con humano" en chat
- [ ] Implementar exportación de datos (Habeas Data → acceso) para usuario en su cuenta
- [ ] Implementar flujo de eliminación de cuenta (Habeas Data → destrucción)
- [ ] CSP headers configurados sin romper recursos del sitio

### Estructural (6 meses+)

- [ ] Auditoría de seguridad externa (pentesting)
- [ ] Revisión legal anual de políticas
- [ ] Migrar Dana a proveedor con mejor garantía si presupuesto lo permite
- [ ] 2FA opcional para clientes
- [ ] Self-host de Google Fonts si se usan
- [ ] WAF endurecido (Cloudflare ya está; revisar reglas)

---

## Referencias cruzadas

- Marco legal completo, plantillas y glosario: `06-MARCO-LEGAL-Y-PLANTILLAS.md`
- Restricciones de marketing y publicidad: `01-MERCADEO-Y-PUBLICIDAD.md`
- Custodia de datos del cliente y seguridad: `04-SEGURIDAD-Y-DATOS.md`
- Identidad legal del operador (Aviso Legal): `03-ADMINISTRATIVO.md`
- Restricciones del catálogo (etiquetado): `05-PRODUCTO-Y-CATALOGO.md`

---

*Última revisión: mayo 2026. Revisión sugerida: trimestral o ante cambios materiales del sitio.*
