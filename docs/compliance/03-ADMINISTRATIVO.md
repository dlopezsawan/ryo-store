# COMPLIANCE — ADMINISTRATIVO

**Para:** dueños, gerencia, contador, asesor financiero, encargado de operaciones
**Alcance:** Venezuela
**Versión:** 1.0 — Mayo 2026
**Documento maestro:** ver `06-MARCO-LEGAL-Y-PLANTILLAS.md` para marco normativo completo y glosario

---

## ⚠️ Disclaimer

Documento operacional. No constituye asesoría legal ni contable vinculante. Validar con abogado venezolano y contador colegiado antes de implementar cambios estructurales en facturación, régimen tributario o esquema laboral.

Áreas con alta incertidumbre normativa al 2026 (requieren revisión específica):
- Régimen criptocambiario tras la disolución de SUNACRIP
- Tasa actual y reglamentación del IGTF sobre USDT
- Providencias SENIAT actualizadas sobre facturación electrónica
- Reglamentación complementaria a la Ley Antibloqueo

---

## Tabla de contenidos

1. [Identidad legal del operador](#1-identidad-legal-del-operador)
2. [Constitución mercantil y RIF](#2-constitución-mercantil-y-rif)
3. [Facturación electrónica y SENIAT](#3-facturación-electrónica-y-seniat)
4. [Régimen tributario: IVA, ISLR, IGTF](#4-régimen-tributario-iva-islr-igtf)
5. [Pagos: Pago Móvil, USDT, divisas](#5-pagos-pago-móvil-usdt-divisas)
6. [Régimen cambiario y BCV](#6-régimen-cambiario-y-bcv)
7. [Antilavado de capitales (LOCDOFT)](#7-antilavado-de-capitales-locdoft)
8. [Logística (MRW y envíos)](#8-logística-mrw-y-envíos)
9. [Devoluciones y derechos del consumidor (SUNDDE)](#9-devoluciones-y-derechos-del-consumidor-sundde)
10. [Empleados y operadores (LOTTT)](#10-empleados-y-operadores-lottt)
11. [Custodia documental y retención](#11-custodia-documental-y-retención)
12. [Checklist accionable administrativo](#12-checklist-accionable-administrativo)

---

## 1. Identidad legal del operador

### 1.1. Datos que deben constar públicamente

El **Decreto-Ley sobre Mensajes de Datos y Firmas Electrónicas (2001)** y la **Ley Orgánica de Precios Justos** exigen que toda operación comercial identifique al oferente. En la web, en factura, en correos transaccionales, debe constar:

- **Razón social completa** (ej.: "Enrola C.A.")
- **RIF** vigente
- **Domicilio fiscal** completo
- **Datos de inscripción** en Registro Mercantil (oficina, tomo, número, fecha)
- **Email y teléfono** de contacto comercial
- **Representante legal** (nombre y cédula del responsable)

### 1.2. Persona jurídica vs. persona natural

**Operar como persona jurídica (C.A., S.R.L.)** es la opción recomendada porque:
- Limita responsabilidad personal de los socios al capital aportado
- Mayor seriedad ante proveedores y clientes
- Facilita contratos formales (Hostinger, Resend, MRW)
- Estructura más sólida ante fiscalización

**Operar como persona natural / firma personal:**
- ⚠️ Responsabilidad ilimitada del dueño con su patrimonio personal
- Aceptable solo en fase muy temprana o si volumen es pequeño
- Riesgo: si hay reclamación SUNDDE/SENIAT/judicial, casa, vehículo, cuentas personales pueden ser embargadas

### 1.3. Responsable legal designado internamente

Designar formalmente (acta de socios o decisión escrita del titular):
- **Responsable de tratamiento de datos** (Habeas Data, privacidad)
- **Responsable de quejas SUNDDE** (atención al consumidor)
- **Apoderado legal** (para emergencias o requerimientos judiciales)

Sin esta designación, los dueños/socios responden de forma personal solidariamente.

---

## 2. Constitución mercantil y RIF

### 2.1. Inscripción en Registro Mercantil

Para constitución de Compañía Anónima (C.A.):
1. **Acta constitutiva** redactada por abogado o notario
2. Capital social mínimo: actualmente nominal (verificar con asesor)
3. **2+ socios** (mínimo legal)
4. **Junta directiva** designada
5. Inscripción en Registro Mercantil del domicilio (tomo, número, fecha)
6. Publicación en gaceta del registro
7. Solicitud de RIF inmediatamente

### 2.2. RIF (Registro de Información Fiscal)

- **Vigencia**: el RIF expira y debe renovarse periódicamente (verificar fecha)
- **Actividad económica registrada**: debe **incluir comercio electrónico** (código CIIU correspondiente)
  - Si la actividad principal registrada no contempla los productos del catálogo → riesgo de calificación errónea y multas
- **Estado**: debe figurar en **lista blanca** del Portal SENIAT (no en deudas, no en suspensión)

### 2.3. Otras inscripciones obligatorias (según operación)

| Inscripción | Cuándo aplica |
|---|---|
| **IVSS** (Instituto Venezolano Seguros Sociales) | Si hay empleados directos |
| **INCES** (formación) | Si hay empleados directos |
| **FAOV** (vivienda) | Si hay empleados directos |
| **INPSASEL** (seguridad laboral) | Si hay empleados directos |
| **Patente municipal** | Casi siempre (depende del municipio del domicilio) |
| **Permiso sanitario** | Si productos requieren registro sanitario MPPS |
| **Permiso CONATEL** | Si presta servicios de telecomunicaciones (no aplica a Enrola comercial) |
| **Permiso SUNDDE** | Como comerciante en general — verificar con abogado si requiere registro adicional |

---

## 3. Facturación electrónica y SENIAT

### 3.1. Marco aplicable

La **Providencia 0071/2011** establece formatos de comprobantes fiscales (factura, nota de débito, nota de crédito). Hubo modificaciones posteriores — **verificar versión vigente con contador**.

### 3.2. Reglas duras

- ✅ **Toda venta debe generar factura fiscal** (sin excepción)
- ✅ La factura debe ser emitida por:
  - **Máquina fiscal homologada**, o
  - **Imprenta autorizada** (pre-impresas), o
  - **Sistema de facturación electrónica autorizado** ante SENIAT
- ❌ Una "factura no fiscal", "ticket interno", "nota de venta" **NO sustituye** la factura fiscal

### 3.3. Contenido obligatorio de la factura

- Número correlativo (no se puede saltar números)
- Fecha y hora de emisión
- **Datos del vendedor**: razón social, RIF, domicilio
- **Datos del comprador**: nombre/razón social, cédula/RIF, domicilio
- **Descripción** del bien (no genérico tipo "varios" — debe especificar)
- **Cantidad** y precio unitario
- **Base imponible** (subtotal)
- **IVA** desglosado
- **IGTF** cuando aplique (3% en divisas/USDT)
- **Total a pagar**
- Forma de pago

### 3.4. Estado actual y riesgo

El módulo `finanzas` del backend hace tracking real, pero **no se mencionó integración con sistema de facturación electrónica homologado**. Riesgo:

> ⚠️ **Crítico:** si SENIAT fiscaliza y no hay factura fiscal por cada venta → multa, posible cierre temporal, y en casos graves cierre definitivo.

### 3.5. Acciones obligatorias

1. **Integrar con un proveedor de facturación electrónica autorizado** por SENIAT:
   - The Factory HKA (uno de los más usados)
   - eFactura
   - Fact On Line
   - Otros — verificar lista actualizada de proveedores autorizados
2. **Cada venta del storefront → emisión automática de factura fiscal** con datos del cliente
3. Almacenar copia digital de cada factura por **mínimo 5 años** (idealmente 10)
4. Reconciliar mensualmente: ventas del storefront vs. facturas emitidas (no debe haber gap)

### 3.6. Notas de crédito (devoluciones)

Si una venta se cancela o devuelve:
- ❌ No "borrar" la factura original (números correlativos no pueden saltarse)
- ✅ Emitir **nota de crédito** que anula total o parcialmente la factura
- ✅ Reembolso al cliente por la **misma vía de pago original** (trazabilidad)

---

## 4. Régimen tributario: IVA, ISLR, IGTF

### 4.1. IVA (Impuesto al Valor Agregado)

- Tasa general: **16%** (verificar tasa vigente)
- Algunos productos tienen tasas especiales o están exentos
- Parafernalia: tasa general aplicable
- **IVA debe estar incluido en el precio publicado** (Ley Orgánica de Precios Justos)
- **Declaración mensual** (Forma 30 SENIAT)
- **Pago dentro de los primeros 15 días del mes siguiente**

### 4.2. ISLR (Impuesto Sobre la Renta)

- **Personas jurídicas**: declaración anual
- **Anticipos trimestrales** (Forma 91 SENIAT)
- **Retenciones a terceros**: si Enrola paga servicios profesionales, alquiler, comisiones → debe retener ISLR según tablas y enterar a SENIAT
- Conservar comprobantes de retención mínimo 5 años

### 4.3. IGTF (Impuesto a las Grandes Transacciones Financieras)

- **3%** sobre operaciones en **divisas y criptomonedas distintas a las emitidas por el Estado** (Ley 2022)
- ⚠️ Tasa y alcance han tenido modificaciones — **verificar versión vigente con contador**
- **Aplica a:**
  - Pagos en USD (efectivo, Zelle, transferencia internacional)
  - Pagos en EUR
  - Pagos en USDT y otras criptos
- **NO aplica a:**
  - Pagos en Bs (pago móvil, transferencia bancaria local)
  - Petro (cripto del Estado, hoy descontinuado)
- Enrola debe **agregar el 3%** al total de cualquier compra pagada en divisa
- **Declaración semanal** (Forma 33 SENIAT)
- **Pago dentro de los 5 días hábiles siguientes** a la semana de operación

**Implementación en checkout:**
```
Subtotal (con IVA):    $58.00
IGTF (3% por USDT):    $1.74
─────────────────────────────
Total a pagar:         $59.74 USDT
```

### 4.4. Otros tributos posibles

- **Patente Municipal** (impuesto a actividad económica del municipio)
- **Tasas ambientales o publicitarias** (algunas alcaldías)
- **Aporte LOCTI** (ciencia, tecnología e innovación) — para empresas con ingresos > umbral
- **Aportes parafiscales** (IVSS, INCES, FAOV) si hay nómina

---

## 5. Pagos: Pago Móvil, USDT, divisas

### 5.1. Pago Móvil

El sistema "Pago Móvil Interbancario (P2P)" del BCV es el método dominante.

**Requisitos al recibir Pago Móvil:**
- ✅ Cuenta registrada **a nombre de Enrola C.A.** (o titular RIF)
- ✅ Conservar comprobante de cada transacción (5 años por SENIAT)
- ✅ Reconciliación: cada Pago Móvil recibido debe estar asociado a un pedido (módulo `finanzas` ya hace esto)
- ⚠️ Si alguien paga "de más" sin pedido → **no es propiedad de Enrola** — devolver o registrar como pasivo (cuenta por pagar)

**Riesgo contable identificado:**
> El módulo `finanzas` del backend declara que "el `pago_movil` es la fuente de verdad de revenue, NO el total del order". Esto es contablemente correcto pero crea desfase con SENIAT — **la factura debe emitirse por el monto cobrado realmente al cliente, en Bs, con la tasa BCV del día**. Coordinar con contador para que la conciliación sea limpia ante fiscalización.

### 5.2. USDT y operaciones en criptomonedas

**Estado normativo (mayo 2026):**
- SUNACRIP fue intervenida y disuelta por escándalos en 2023-2024
- El régimen de criptoactivos quedó en transición sin ente regulador claro
- Operaciones en USDT son **legales pero no exentas** de IGTF
- BCV no reconoce USDT como medio oficial pero tampoco lo prohíbe

**Implicaciones para Enrola:**
- ✅ Aceptar USDT está permitido
- ⚠️ **IGTF 3%** aplica sobre cada cobro en USDT (asimilable a divisa)
- ⚠️ Factura debe emitirse en **Bs**, con la tasa del día (BCV o paralelo según lo acordado con SENIAT — **paralelo es de hecho usado pero genera disputas**)
- ⚠️ Reportar operaciones a partir de cierto umbral a UNIF — verificar umbral vigente con asesor (típicamente USD 10.000 por operación o acumulado)
- ❌ **No emitir facturación en USDT puro** — debe haber equivalente en Bs

**Custodia de USDT recibido:**
- ✅ Wallet a nombre de Enrola (no personal del dueño)
- ✅ 2FA activo en wallet
- ✅ Frase de recuperación custodiada en lugar seguro (no en cloud, no en repos git)
- ⚠️ Si hay volumen significativo → considerar wallet hardware (Ledger, Trezor) para reservas

### 5.3. Operaciones en divisas (USD, EUR)

**Ley del Régimen Cambiario (2018)** liberalizó tenencia y uso de divisas:
- ✅ Recibir pagos en USD/EUR es legal
- ⚠️ **IGTF 3%** sobre el monto en divisa
- ⚠️ Reporte BCV mensual si se opera formalmente en divisas
- ⚠️ Conversión a Bs para fines fiscales: tasa BCV del día

### 5.4. Custodia de comprobantes — alta sensibilidad

Los recibos de Pago Móvil que sube el cliente típicamente contienen:
- Nombre completo del titular del banco origen (puede ser tercero, no el cliente Enrola)
- Banco emisor y banco receptor
- Número de operación
- Monto y fecha exactos

Esto es **información financiera de un tercero**. Implicaciones detalladas en `04-SEGURIDAD-Y-DATOS.md`. Lo que administración debe asegurar:

- ✅ **Acceso restringido**: solo operadores autorizados, con login y log de acceso
- ✅ **Retención definida**: 5 años (trazabilidad SENIAT) y luego eliminación
- ✅ **No mostrar al público**: nunca exponer URL pública de un comprobante
- ✅ **Acuerdo de confidencialidad** firmado por todo operador con acceso

---

## 6. Régimen cambiario y BCV

### 6.1. Tasa oficial vs. paralelo

- **Tasa BCV** (Banco Central de Venezuela): publicada diariamente, oficial
- **Tasa paralelo**: no oficial, pero ampliamente utilizada en el mercado real

**Para fines fiscales** debe usarse la **tasa BCV** del día de la operación. SENIAT exige consistencia.

**Para fines comerciales** (precio público al cliente) Enrola puede usar la tasa que prefiera, pero declararlo claramente:
- "Precio referencia USD: $X (tasa BCV día Y)" — fiscal
- O "Precio referencia USD: $X (tasa de mercado)" — comercial; aún así la factura sale con tasa BCV

**Recomendación**: usar tasa BCV en factura y en checkout para evitar inconsistencias.

### 6.2. Reportes BCV

Empresas que operan habitualmente en divisas deben:
- Reportar mensualmente operaciones en divisas al BCV (formularios específicos)
- Conservar comprobantes de cada operación
- ⚠️ Verificar umbral y forma de reporte con contador

### 6.3. Convenio Cambiario N° 1 (2018) y modificaciones

Liberalizó:
- Tenencia legal de divisas
- Uso de divisas para pagos privados
- Apertura de cuentas en divisas en banca venezolana

Restringió:
- Operaciones cambiarias requieren autorización si superan umbrales
- Algunas transacciones requieren paso por banca formal

**Verificar versión vigente con asesor cambiario** — el régimen ha tenido ajustes desde 2018.

---

## 7. Antilavado de capitales (LOCDOFT)

### 7.1. Marco

**Ley Orgánica contra la Delincuencia Organizada y Financiamiento al Terrorismo (LOCDOFT, 2012)** exige a sujetos obligados (banca, casas de cambio, sectores con riesgo) hacer KYC y reportar operaciones sospechosas a UNIF.

### 7.2. ¿Aplica a Enrola?

En sentido estricto, **no** — Enrola no es banca ni casa de cambio. **Pero:**

- Si volumen de USDT/divisas es alto → atrae atención fiscal y antilavado
- Si recibe pagos de muchas cuentas a una misma cuenta de cobro → puede ser visto como "concentrador" de operaciones (riesgo de calificación como "actividad financiera no autorizada")
- Si se observan patrones sospechosos:
  - Compras grandes en efectivo sin sentido comercial
  - Pagos fraccionados (varios pagos pequeños en lugar de uno grande, para evitar umbrales)
  - Múltiples cuentas pagando a un mismo cliente final
  - Compras de catálogo entero por una sola persona
  - Pagos desde cuentas no relacionadas con el cliente

→ Idealmente reportar a UNIF aunque no sea sujeto obligado formal.

### 7.3. Política mínima recomendada

- **KYC en compras > USD 1.000**: cédula obligatoria, validación cruzada con cedula-cache
- **Bloqueo automático** si misma cédula intenta múltiples compras grandes en corto tiempo
- **Registro de operaciones sospechosas** internas (aunque no se reporte formalmente, tener log)
- **Política escrita interna** sobre qué hacer ante operación sospechosa
- **Capacitación del equipo** sobre señales de alarma

### 7.4. Reportes a UNIF (cuando aplique)

- Formularios oficiales de UNIF (Reporte de Actividad Sospechosa - RAS)
- Plazo de reporte (verificar — típicamente 24-72 horas tras detección)
- Confidencialidad: NO informar al cliente que se le reportó

---

## 8. Logística (MRW y envíos)

### 8.1. Relación contractual con MRW

MRW es transportista privado. Enrola actúa como remitente.

- ✅ **Contrato de servicios MRW formalizado** (no operación informal)
- ✅ Datos del receptor entregados a MRW son **transferencia de datos a tercero** — debe estar declarado en Política de Privacidad
- ⚠️ Si MRW pierde paquete o lo extravía → **responsabilidad solidaria** con Enrola frente al cliente (jurisprudencia SUNDDE protege al consumidor)
- ⚠️ MRW geo-bloquea su sitio para IPs no venezolanas (limitación operacional)

### 8.2. Productos prohibidos en envío

MRW (y la mayoría de couriers) prohíben en sus términos:
- Sustancias estupefacientes
- Materiales inflamables, explosivos
- Productos perecederos sin condiciones
- Animales vivos
- Armas

**Parafernalia "neutra"** (papel para fumar, filtros) **sí se puede enviar**, pero **declarando la mercancía honestamente**.

❌ **No declarar como otra cosa** (riesgo de fraude documental + responsabilidad penal).

### 8.3. Plazo de entrega

- Debe estar **publicado claramente** en el storefront (Ley Orgánica de Precios Justos)
- Si se incumple → cliente tiene derecho a cancelar y reembolso (Art. 75 LOPJ)
- **Buena práctica**: actualización proactiva al cliente con número de guía y tracking

### 8.4. Recepción por terceros

- Si la persona que recibe en domicilio no es el comprador → debe haber autorización
- MRW exige cédula al receptor — si distinto al comprador, marca como entrega autorizada
- ⚠️ **Riesgo**: entrega a menor en hogar — depende del courier validar

### 8.5. Retención de información de envío

- Conservar guías y comprobantes de entrega 5 años (prueba de cumplimiento)
- Si reclamación SUNDDE → guía es prueba clave

---

## 9. Devoluciones y derechos del consumidor (SUNDDE)

### 9.1. Marco aplicable

**Ley Orgánica de Precios Justos** (LOPJ) garantiza:
- Información veraz y oportuna (Art. 8)
- Calidad del producto (Art. 9)
- Garantía del producto (Art. 73)
- Derecho a devolución por defectos o vicios (Art. 75)
- Derecho a indemnización por daños

### 9.2. Procedimiento de reclamación SUNDDE

Si un cliente reclama formalmente a SUNDDE:
1. SUNDDE notifica a Enrola
2. Enrola tiene plazo para responder (típicamente 10-15 días)
3. SUNDDE puede mediar, sancionar, o requerir corrección
4. Sanciones posibles: multa, cierre temporal, prohibición de operar

**Mejor estrategia**: resolver internamente antes de que escale a SUNDDE. Tener canal de quejas claro y respuesta rápida.

### 9.3. Cláusulas mínimas de Política de Devoluciones

(Ver implementación técnica en `02-WEB.md` § 5)

- Plazo para reportar defectos (48-72h evidentes; hasta garantía para vicios ocultos)
- Producto en condiciones originales
- Costos de envío de retorno (cliente si arrepentimiento; Enrola si defecto)
- Forma de reembolso: misma vía de pago original
- Plazo de reembolso: 7-15 días hábiles
- Productos no retornables (declararlos expresamente)

### 9.4. Garantía del producto

- **Garantía legal mínima**: aplica por ley, no se puede excluir contractualmente
- **Garantía comercial adicional** (si Enrola la ofrece): debe ser clara, escrita
- Plazo: depende del producto (consumibles tienen plazos cortos; durables más largos)
- Cobertura: defectos de fabricación, no daños por uso indebido del cliente

---

## 10. Empleados y operadores (LOTTT)

### 10.1. Trabajadores directos vs. servicios profesionales

**Trabajador directo (LOTTT)**:
- Subordinación, dependencia, exclusividad, horario fijo, herramientas del empleador
- Inscripción IVSS, INCES, FAOV obligatoria
- Pago de utilidades, vacaciones, prestaciones sociales
- Despido injustificado da derecho a indemnización
- Reglamento interno aplicable

**Servicios profesionales (civil)**:
- Facturación propia del prestador
- Herramientas propias
- Libertad de horario
- Múltiples clientes (no exclusividad)
- Pago por entregable, no por tiempo
- No hay vacaciones, utilidades ni prestaciones

### 10.2. Riesgo de simulación de relación laboral

Si Enrola contrata como "servicios profesionales" pero en la práctica hay subordinación:
- ⚠️ INPSASEL/SUNDDE pueden **recalificar** como relación laboral
- → Pago retroactivo de prestaciones, multas, intereses
- → Indemnización si se "termina" la relación

**Indicadores de relación laboral encubierta:**
- Horario fijo
- Reporta a un jefe directo
- Trabaja en oficinas/equipos de Enrola
- No factura a otros clientes
- Recibe instrucciones específicas día a día
- Pago periódico fijo (no por entregable)

**Si en duda**: contratar como trabajador directo y cumplir todas las cargas. Es más caro pero evita contingencia legal grande.

### 10.3. Acuerdo de Confidencialidad para acceso a datos

**Todo operador con acceso al panel/admin debe firmar:**

1. **Acuerdo de Confidencialidad (NDA)** sobre datos de clientes
2. **Acuerdo de Tratamiento de Datos**: solo procesar lo autorizado, no copiar fuera, no compartir
3. **Cláusula penal**: por incumplimiento

**Cláusula modelo:**
> *"El/la trabajador/a se obliga a guardar absoluta confidencialidad sobre los datos personales de clientes a los que tenga acceso por razón de su función, no copiarlos fuera de los sistemas de Enrola, no compartirlos con terceros, ni utilizarlos para fines distintos a los estrictamente laborales. El incumplimiento dará lugar a despido justificado y a las acciones civiles y penales correspondientes según LECDI Arts. 19, 20 y 22."*

(Ver `06-MARCO-LEGAL-Y-PLANTILLAS.md` § Plantilla NDA para versión completa.)

### 10.4. Reglamento interno

Si hay 5+ empleados, recomendable tener Reglamento Interno con:
- Horario de trabajo
- Política de uso de equipos y sistemas
- Manejo de datos de clientes (referenciando NDA)
- Política antiacoso
- Causales de despido justificado
- Procedimiento disciplinario

---

## 11. Custodia documental y retención

### 11.1. Plazos mínimos de retención

| Documento | Plazo | Base |
|---|---|---|
| **Facturas emitidas y recibidas** | 5 años (idealmente 10) | Código Orgánico Tributario |
| **Libros contables** | 5 años | COT |
| **Comprobantes de Pago Móvil** | 5 años | Trazabilidad SENIAT |
| **Guías y comprobantes de entrega** | 5 años | Prueba ante SUNDDE |
| **Contratos con empleados** | 10 años post-terminación | LOTTT |
| **Contratos con proveedores** | 10 años post-terminación | Código de Comercio |
| **Aceptaciones T&C / Privacidad de clientes** | 5 años post última transacción | Prueba de consentimiento |
| **Logs de Habeas Data** | 5 años | Trazabilidad |
| **Logs de chatbot Dana** | 6 meses | Privacidad |
| **Backups de DB** | Rotativos según política | Continuidad operacional |

### 11.2. Formato y custodia

- **Digitales**: aceptables si cumplen criterios de Decreto-Ley sobre Mensajes de Datos (autenticidad, integridad, no repudio)
- **Backups múltiples**: nunca un solo punto de falla
- **Cifrado en reposo** para datos sensibles
- **Acceso restringido** y log de quién accede a qué

### 11.3. Eliminación al final del plazo

- Definir política escrita de eliminación
- Cron job que ejecute eliminación tras retención
- Logs de la eliminación (qué se eliminó, cuándo, por qué)

---

## 12. Checklist accionable administrativo

### Inmediato (próximos 14 días)

- [ ] Verificar que Enrola está constituida como persona jurídica (C.A. o S.R.L.) — si no, iniciar constitución
- [ ] Verificar que RIF está vigente y actividad económica registrada incluye comercio electrónico
- [ ] Designar formalmente (acta) responsable de privacidad, responsable de quejas, apoderado legal
- [ ] **Iniciar integración con facturador electrónico autorizado** (TheFactoryHKA, eFactura, etc.) — bloqueante crítico
- [ ] Verificar que cuentas de cobro (Pago Móvil, banco) están a nombre de Enrola C.A.
- [ ] Verificar que wallet USDT está a nombre de Enrola y no del dueño personal
- [ ] Implementar IGTF 3% en checkout cuando aplique (USDT, USD, EUR)
- [ ] Política mínima de KYC para compras > USD 1.000
- [ ] NDA firmado por todo operador con acceso al panel
- [ ] Verificar contrato formal con MRW

### Mediano plazo (1-3 meses)

- [ ] Contador colegiado revisa últimos 6 meses de operación: detecta gaps de facturación, recomienda ajustes
- [ ] Reconciliación mensual sistemática: ventas storefront vs. facturas emitidas
- [ ] Política escrita de retención documental (con plazos por tipo)
- [ ] Cron job de eliminación de datos según política
- [ ] Política escrita de antilavado y señales de alarma
- [ ] Capacitación al equipo en señales de operación sospechosa
- [ ] Si hay empleados: inscripción IVSS, INCES, FAOV (si no está hecho)
- [ ] Reglamento interno básico (si 5+ empleados)
- [ ] Reportes BCV mensuales si opera en divisas (consultar con contador)

### Estructural (6 meses+)

- [ ] Auditoría tributaria preventiva con contador externo
- [ ] Auditoría legal anual integral
- [ ] Plan de contingencia ante fiscalización SENIAT/SUNDDE
- [ ] Plan de continuidad si caída del VPS o brecha grande
- [ ] Considerar seguro de responsabilidad civil profesional (si existe oferta venezolana válida)
- [ ] Revisión de estructura jurídica: ¿conviene escindir alguna línea de negocio?
- [ ] Documentar SOP (Standard Operating Procedures) por área operacional

---

## Referencias cruzadas

- Marco legal completo, plantillas de contratos y glosario: `06-MARCO-LEGAL-Y-PLANTILLAS.md`
- Custodia técnica y seguridad de los comprobantes: `04-SEGURIDAD-Y-DATOS.md`
- Reglas de marketing, programa lealtad y referidos (con implicaciones tributarias): `01-MERCADEO-Y-PUBLICIDAD.md`
- Implementación de IGTF y precios en el checkout: `02-WEB.md`
- Restricciones del catálogo y permisos sanitarios: `05-PRODUCTO-Y-CATALOGO.md`

---

*Última revisión: mayo 2026. Revisión sugerida: trimestral con contador y anual con abogado.*
