# COMPLIANCE — SEGURIDAD Y DATOS

**Para:** dev backend, dev fullstack, sysadmin, responsable de privacidad, security officer
**Alcance:** Venezuela
**Versión:** 1.0 — Mayo 2026
**Documento maestro:** ver `06-MARCO-LEGAL-Y-PLANTILLAS.md` para marco normativo completo y glosario

---

## ⚠️ Disclaimer

Documento técnico-operacional. No constituye asesoría legal vinculante. La materia de seguridad informática y privacidad evoluciona rápido — revisión semestral mínima recomendada.

---

## Tabla de contenidos

1. [Marco legal aplicable](#1-marco-legal-aplicable)
2. [Inventario de datos personales (PII)](#2-inventario-de-datos-personales-pii)
3. [Datos altamente sensibles](#3-datos-altamente-sensibles)
4. [Custodia técnica del VPS](#4-custodia-técnica-del-vps)
5. [Cifrado, backups y control de acceso](#5-cifrado-backups-y-control-de-acceso)
6. [Logs y auditoría](#6-logs-y-auditoría)
7. [Habeas Data — flujo interno](#7-habeas-data--flujo-interno)
8. [Inteligencia Artificial (Claude, DeepSeek)](#8-inteligencia-artificial-claude-deepseek)
9. [Riesgos activos identificados](#9-riesgos-activos-identificados)
10. [Plan de respuesta a incidentes](#10-plan-de-respuesta-a-incidentes)
11. [Notificación de brechas](#11-notificación-de-brechas)
12. [Checklist accionable de seguridad](#12-checklist-accionable-de-seguridad)

---

## 1. Marco legal aplicable

### 1.1. Constitución de la República Bolivariana de Venezuela

| Artículo | Materia | Aplicación |
|---|---|---|
| **Art. 28** | Habeas Data | Cliente puede solicitar acceso, rectificación, destrucción de sus datos |
| **Art. 48** | Inviolabilidad de comunicaciones | Chats, emails, WhatsApp no se interceptan/divulgan sin orden judicial |
| **Art. 60** | Honor, intimidad, vida privada | Imagen del cliente, foto cédula, comprobantes |

### 1.2. Ley Especial Contra los Delitos Informáticos (LECDI, 2001)

| Artículo | Conducta penalizada | Implicación para Enrola |
|---|---|---|
| **Art. 6** | Acceso indebido a sistemas | Si credenciales filtran y permiten acceso → responsabilidad por negligencia |
| **Art. 9** | Sabotaje informático | Si ataque externo destruye datos → debe haber tomado medidas de prevención |
| **Art. 13** | Hurto informático | Si datos financieros filtran → responsabilidad si no había custodia diligente |
| **Art. 14** | Fraude informático | Pérdidas por suplantación → carga probatoria de medidas |
| **Art. 16** | Manejo fraudulento de tarjetas inteligentes | Custodia de comprobantes con datos de tarjetas |
| **Art. 19** | Violación de privacidad de la data | Si empleado divulga datos → Enrola responde solidariamente |
| **Art. 20** | Violación privacidad comunicaciones | Compartir chats sin autorización |
| **Art. 22** | Revelación indebida de data | Filtrar info de clientes a tercero |

### 1.3. Otras leyes relevantes

- **Ley sobre Protección a la Privacidad de las Comunicaciones (1991)** — refuerza Art. 48 constitucional
- **Decreto-Ley sobre Mensajes de Datos y Firmas Electrónicas (2001)** — validez jurídica de registros digitales
- **LOPNNA** — restricción especial para datos de menores
- **LOCDOFT** — KYC y reporte antilavado (cuando aplique)

### 1.4. Sin ley general de protección de datos sector privado

Venezuela **no tiene una ley estilo GDPR/LFPDPPP/LGPD**. El marco aplicable se construye desde:
- Constitución (Habeas Data Art. 28)
- LECDI (penalización de violaciones)
- Buenas prácticas internacionales (referencia operacional)

Esto NO significa "no hay obligaciones" — significa que las obligaciones están dispersas y la carga de cumplimiento es tanto operacional (deber de cuidado) como reactiva (responder a Habeas Data).

---

## 2. Inventario de datos personales (PII)

### 2.1. Catálogo de datos que maneja Enrola

| Categoría | Datos específicos | Sensibilidad | Origen |
|---|---|---|---|
| **Identificativos** | Nombre, apellido, cédula, fecha de nacimiento | Alta | Registro de cuenta, checkout |
| **Contacto** | Email, teléfono, dirección de envío | Media | Registro, checkout |
| **Pago** | Comprobantes Pago Móvil, número operación, banco origen, monto, fecha | **Crítica** (PII de tercero) | Subido por cliente o operador |
| **Conducta** | Compras, navegación, IP, dispositivo, ubicación aproximada | Media | Tracking automático |
| **Comunicaciones** | Chats Dana, WhatsApp, email | Alta | Conversaciones |
| **Lealtad** | Puntos, premios, referidos | Baja | Generado por sistema |
| **Edad/imagen** | Foto cédula (si se solicita) | **Crítica** (datos biométricos de hecho) | Subido en verificación de edad |
| **Operativos** | Logs, sesiones, cookies | Baja-media | Tracking automático |

### 2.2. Tablas de la BD que contienen PII

(Nombres aproximados según convenciones de Medusa v2)

- `customer` — datos de cliente
- `address` — direcciones de envío y facturación
- `order` + `order_items` — historial de compra
- `payment_proof` (módulo finanzas) — comprobantes de pago
- `cedula_cache` — validaciones de cédula contra registro civil
- `whatsapp_message` (si existe) — historial de WhatsApp
- `dana_conversation` (si existe) — historial chatbot
- `loyalty_transaction` — transacciones de puntos
- `referral` — programa de referidos
- `subscriber` (Listmonk) — suscriptores newsletter

### 2.3. Bases legales para procesamiento

Aunque Venezuela no tiene "bases legales" tipo GDPR, la finalidad debe ser lícita y declarada:

| Categoría | Base operacional |
|---|---|
| Identificativos + Contacto | Ejecutar el contrato (compra-venta) |
| Cédula y fecha nacimiento | Cumplimiento legal (verificación edad LOPNNA) |
| Pago | Ejecución contractual + obligación SENIAT |
| Conducta + Lealtad | Interés legítimo + consentimiento opt-in |
| Comunicaciones | Servicio al cliente (consentimiento implícito al contactar) |
| Marketing | Consentimiento explícito opt-in |

### 2.4. Minimización

Principio: **recolectar solo lo necesario** para la finalidad declarada. Auditar periódicamente:
- ¿Qué campos del formulario son realmente usados?
- ¿Hay datos que se piden pero nunca se procesan?
- Si sí, eliminarlos de los formularios

---

## 3. Datos altamente sensibles

### 3.1. Cédula de identidad

- Identificador único nacional → alto valor para suplantación
- Combinada con dirección + teléfono + email → perfil completo para fraude

**Custodia:**
- ✅ Cifrado en reposo de la columna `cedula` (cifrado simétrico, llave en variable de entorno o KMS)
- ✅ Acceso restringido (solo roles que la necesiten)
- ✅ Log de cada acceso a la cédula completa
- ✅ Mostrar enmascarada en interfaces (`V-12.345.***`) salvo que el rol específicamente la requiera

### 3.2. Fotos de cédula (si se solicitan)

Si el flujo de verificación de edad solicita foto de cédula:
- **Datos biométricos de hecho** (foto del rostro)
- Sensibilidad equivalente a datos biométricos en jurisdicciones con GDPR

**Custodia:**
- ✅ Storage en volumen específico cifrado
- ✅ NO en repositorio público (gitignore confirmado: `backend/static/payment-proofs/`, etc.)
- ✅ URL no pública (servidas solo a operadores autenticados)
- ✅ Eliminación tras verificación (si se almacenan, deben tener TTL)
- ⚠️ Mejor práctica: validar y NO almacenar la foto, solo la confirmación de validez

### 3.3. Comprobantes de Pago Móvil

Los recibos típicamente contienen:
- Nombre completo del titular del banco origen (puede ser **un tercero**, no el cliente Enrola)
- Banco emisor y banco receptor
- Número de operación
- Monto y fecha exactos
- A veces número de cuenta parcial

**Esto es información financiera de un tercero**. Implicaciones LECDI:

| Artículo | Riesgo |
|---|---|
| Art. 13 (Hurto Informático) | Si filtran y alguien hace fraude con esa info → responsabilidad penal |
| Art. 19 (Violación privacidad data) | Si publican o acceden indebidamente → sanción |
| Art. 22 (Revelación indebida data) | Si empleado los comparte → delito |

**Acciones obligatorias:**
1. ✅ **No commitear** comprobantes a git (verificado en .gitignore: `backend/static/payment-proofs/`)
2. ✅ **Cifrado en reposo** del volumen `payment_proofs` (BitLocker/LUKS, o cifrado de Hostinger si lo provee)
3. ✅ **Acceso restringido**: solo operadores autorizados con login y log
4. ✅ **Retención definida**: 5 años (trazabilidad SENIAT) y luego eliminación
5. ✅ **No mostrar al público**: URL no descubrible
6. ✅ **NDA** firmado por todo operador con acceso

### 3.4. Datos de menores — restricción absoluta

Si por error un menor crea cuenta o compra:
- **LOPNNA Art. 235**: sanción para quien venda parafernalia a menor (multa o arresto)
- **LOPNNA Art. 79**: prohíbe utilización de menores en publicidad
- Si Enrola tiene base de datos con menores identificados → debe **eliminarla** y reportar el incidente

**Mecanismos preventivos:**
- ✅ Verificación de edad robusta en checkout (cédula + fecha nacimiento del registro civil)
- ✅ Si fecha nacimiento computa < 18 → rechazar pedido y NO almacenar datos de menor
- ✅ Auditoría periódica: ¿hay cuentas con fecha nacimiento < 18? Eliminar

---

## 4. Custodia técnica del VPS

### 4.1. Topología actual (según docs)

- VPS único en Hostinger (IP `72.60.114.242`)
- Docker Compose orquesta: Postgres, Redis, Medusa, Storefront, Panel, Listmonk, Mailserver, instagrapi-worker
- Reverse proxy Traefik (compartido con n8n vía red `n8n_default`)
- Cloudflare como DNS/WAF en el frente

### 4.2. Riesgos de la topología

- **Single point of failure**: si el VPS muere, todo cae
- **Si comparte red con n8n**: vulnerabilidad en n8n puede pivotar a Enrola
- **Volúmenes Docker**: si el VPS se reconstruye sin backup → pérdida total

### 4.3. Medidas técnicas mínimas (deber de cuidado bajo LECDI)

| Medida | Estado actual | Acción si falta |
|---|---|---|
| HTTPS en todos los endpoints públicos | ✅ vía Traefik | — |
| SSH con llaves (no password) | ⚠️ verificar | Deshabilitar password auth en `/etc/ssh/sshd_config` |
| Puerto SSH no estándar | ❌ usa 22 (per CONTEXT_SUMMARY) | Cambiar a puerto >10000, actualizar Cloudflare/firewall |
| Fail2ban activo | ⚠️ verificar | Instalar y configurar para SSH, Postgres, login Medusa |
| Firewall (ufw/firewalld) | ⚠️ verificar | Solo abrir 80, 443, SSH (puerto custom) |
| Backups automáticos DB | ⚠️ verificar | `pg_dump` cron diario a almacenamiento externo |
| Backups de volúmenes | ⚠️ verificar | Snapshot regular |
| Cifrado de discos | ⚠️ verificar oferta Hostinger | Activar si disponible |
| Logs de acceso administrativo | ⚠️ parcial | Centralizar logs Medusa, Postgres, SSH |
| Rotación de credenciales | ❌ credenciales en repo público | Rotar inmediatamente todas las expuestas |
| 2FA en panels admin | ⚠️ verificar | Activar para Medusa admin, Listmonk, Panel |
| Updates regulares OS y Docker | ⚠️ verificar | `apt update && apt upgrade` mensual + restart |

### 4.4. Cloudflare como WAF

- Cloudflare actúa como CDN + WAF + protección DDoS
- ✅ Verificar reglas WAF activas
- ✅ Bot Fight Mode activo
- ✅ Rate limiting en endpoints sensibles (login, checkout, contacto)
- ✅ Country restriction si aplica (bloquear países sin actividad legítima)

---

## 5. Cifrado, backups y control de acceso

### 5.1. Cifrado en tránsito

- ✅ HTTPS (TLS 1.2+) para todo el tráfico HTTP
- ✅ Conexiones DB con TLS si aplica (interno Docker es OK no cifrado si la red es aislada)
- ✅ Conexiones a APIs externas (Resend, DeepSeek, Google) por HTTPS
- ⚠️ Conexiones SMTP/IMAP del mailserver: STARTTLS o TLS implícito

### 5.2. Cifrado en reposo

**Crítico para:**
- Volumen `payment_proofs` (comprobantes Pago Móvil)
- Volumen `wa-proofs` (capturas WhatsApp)
- Volumen `mrw-receipts` (recibos MRW)
- Backups de DB
- Logs sensibles

**Opciones:**
- LUKS (Linux full disk encryption)
- BitLocker (si Windows server)
- Cifrado a nivel de aplicación: cifrar archivos antes de guardar
- Cifrado de campo en BD para columnas sensibles (cédula, teléfono)

**Llaves de cifrado:**
- ❌ NO en código
- ❌ NO en variables de entorno commiteadas a git
- ✅ En vault (HashiCorp Vault, Doppler, AWS KMS, Bitwarden Secrets)
- ✅ Rotación periódica (anual mínimo)

### 5.3. Backups

**Política recomendada:**

| Frecuencia | Qué | Dónde | Retención |
|---|---|---|---|
| **Cada 6 horas** | DB Postgres (incremental) | Local + remoto cifrado | 7 días |
| **Diario** | DB Postgres (full) + volúmenes | Remoto cifrado | 30 días |
| **Semanal** | Snapshot completo VPS | Remoto cifrado | 8 semanas |
| **Mensual** | Snapshot archivado | Storage frío cifrado | 12 meses |

**Verificación periódica**: probar restore real una vez al mes. Backup que no se prueba no existe.

**Almacenamiento remoto**: NO solo en Hostinger. Usar storage independiente:
- Backblaze B2 (económico, cifrado)
- Wasabi
- AWS S3 con cifrado SSE-KMS
- Disco físico rotativo en oficina (low-tech pero válido)

### 5.4. Control de acceso

**Principio**: mínimo privilegio. Cada persona accede solo a lo que necesita.

**Roles típicos:**

| Rol | Acceso |
|---|---|
| **Owner** | Todo (incluye DB, infra) |
| **Admin operacional** | Panel completo, dashboards, reportes — NO DB directa, NO infra |
| **Operador almacén** | Pedidos, inventario, envíos — NO datos financieros, NO clientes inactivos |
| **Marketing** | Listmonk, Analytics, segmentos — NO datos transaccionales individuales |
| **Atención al cliente** | Chats, pedidos del cliente que atiende — NO base completa |
| **Contador externo** | Reportes financieros — NO acceso operacional ni a clientes |

**Implementación:**
- ✅ Cada persona con cuenta nominal (no compartir credenciales)
- ✅ MFA/2FA obligatorio
- ✅ Log de acceso por usuario
- ✅ Revocación inmediata al salir de la organización
- ✅ Revisión trimestral de quién tiene acceso a qué

---

## 6. Logs y auditoría

### 6.1. Qué loggear

**Eventos críticos (siempre):**
- Login admin/panel (éxito y fallo)
- Cambios de credenciales/contraseñas
- Cambios en configuración (envíos, pagos, módulos)
- Acceso a comprobantes de pago
- Acceso a datos de clientes (export, búsqueda masiva)
- Eliminación de cuenta o datos
- Aceptación de T&C / privacidad
- Solicitudes Habeas Data

**Eventos operacionales (sampling o agregado):**
- Pedidos creados/cancelados
- Pagos confirmados
- Envíos despachados
- Errores aplicación

### 6.2. Cómo loggear

- ✅ **Append-only**: logs no editables (idealmente firmados)
- ✅ **Centralizados**: stack tipo Loki+Grafana o Elasticsearch o servicio externo (Logtail, Datadog)
- ✅ **Sin PII innecesaria**: no loggear contraseñas ni tokens completos; cédulas enmascaradas
- ✅ **Retención**:
  - Logs de seguridad: 12 meses mínimo
  - Logs operacionales: 3-6 meses
  - Logs de auditoría legal (Habeas Data, T&C): 5 años

### 6.3. Detección de anomalías

- Alerta si: múltiples fallos de login desde misma IP
- Alerta si: acceso administrativo desde IP no usual
- Alerta si: descarga masiva de datos
- Alerta si: cambio en configuración crítica fuera de horario

---

## 7. Habeas Data — flujo interno

### 7.1. Recepción de la solicitud

Canal público: `privacidad@enrola.shop` (definir en `02-WEB.md`).

Al llegar:
1. Auto-respuesta inmediata con ID de caso (#YYYY-NNNN)
2. Ticket interno creado en sistema (panel o herramienta dedicada)
3. Asignar a responsable de privacidad

### 7.2. Verificación de identidad del solicitante

⚠️ **Crítico**: nunca dar datos sin verificar que el solicitante es realmente el titular.

Métodos:
- Foto de cédula coincidiendo con la registrada
- Email/teléfono desde el cual se registró originalmente
- Confirmación de últimos 4 dígitos del comprobante de última compra

### 7.3. Búsqueda interna de datos

Para cada solicitud, buscar en:
- BD principal (Medusa: customer, address, order, etc.)
- Listmonk (subscriber)
- Logs de chatbot Dana
- Comprobantes de pago (si los tiene asociados)
- Sistema de email (Resend logs)
- Redes sociales (DMs, comentarios) — si aplica

### 7.4. Tipos de respuesta

| Solicitud | Acción |
|---|---|
| **Acceso** | Generar export en formato legible (PDF + CSV/JSON) con todos los datos asociados |
| **Rectificación** | Corregir y confirmar al cliente; loggear cambio |
| **Destrucción** | Eliminar lo que NO sea retenido por obligación legal; explicar al cliente qué se conserva y por qué (ej.: facturas SENIAT por 5 años) |
| **Conocer finalidad** | Respuesta detallada referenciando Política de Privacidad |

### 7.5. Plazo

- Respuesta en **15 días hábiles máximo** (estándar operacional)
- Si requiere más tiempo, comunicar al cliente con justificación
- Casos complejos: máximo 30 días

### 7.6. Log

Cada solicitud queda registrada:
```
{
  "case_id": "2026-0042",
  "received_at": "2026-05-04T10:00:00Z",
  "requester": "cliente_id_o_email",
  "type": "access|rectification|destruction|info",
  "verification_completed_at": "2026-05-05T...",
  "response_sent_at": "2026-05-15T...",
  "response_summary": "Provided export of customer data; explained retention of orders for SENIAT compliance.",
  "responsible": "user_id"
}
```

Conservar 5 años.

### 7.7. Eliminación técnica al ejecutar destrucción

- Marca cuenta como `deletion_requested`
- Cron job ejecuta:
  - Eliminación de campos no retenidos legalmente
  - Anonimización de campos retenidos (cédula → hash, nombre → "Cliente #N")
- Logging de la operación
- Confirmación al cliente

---

## 8. Inteligencia Artificial (Claude, DeepSeek)

### 8.1. Sin marco regulatorio venezolano específico

Venezuela no tiene "AI Act" como UE. Pero principios constitucionales aplicables:
- **Art. 117**: información veraz (no engañar haciéndose pasar por humano)
- **Art. 60**: intimidad (la IA no debe procesar más datos que necesarios)

### 8.2. Modelos en uso (según docs)

- **DeepSeek** (China) — backend del chatbot Dana
- **Claude / GPT** (USA) — posiblemente uso interno para desarrollo
- **Otros** — verificar

### 8.3. Riesgos por uso de IA

**a) Errores de IA con consecuencias comerciales**
- Si Dana promete algo (descuento, plazo, devolución) que Enrola no honrará → reclamo legítimo
- Mitigación: cláusula en T&C aclarando que Dana es orientativa (ver `02-WEB.md` § 10.4)

**b) Datos enviados al LLM**
- Cualquier dato enviado a un modelo de tercero queda potencialmente en sus logs
- DeepSeek está en China — datos viajan a jurisdicción china

**c) Sesgos**
- Si la IA discrimina (ej.: ofrece distinto trato según patrón) → riesgo bajo SUNDDE

### 8.4. Política interna de uso de IA

✅ **Permitido:**
- IA para tareas asistivas: redacción, clasificación, sugerencia
- IA con humano en el loop (humano revisa antes de enviar)
- IA para generación de contenido marketing (con disclaimer si aplica)

❌ **Prohibido:**
- IA para decisiones automáticas con impacto material sin revisión humana (aprobar/denegar pedidos, suspender cuentas)
- Enviar datos sensibles (cédulas completas, comprobantes financieros, contraseñas) a LLMs externos
- Confiar en respuesta de IA como hecho verificado sin contraste

### 8.5. Sanitización antes de enviar al LLM

Para Dana y cualquier integración con LLM externo:

**Implementar pre-procesamiento del input del usuario:**
```
- Detectar y reemplazar: cédula (regex \d{7,8}) → "[CEDULA]"
- Detectar y reemplazar: teléfonos VE → "[TELEFONO]"
- Detectar y reemplazar: emails → "[EMAIL]"
- Detectar y reemplazar: números de tarjeta → "[TARJETA]"
- Limitar contexto enviado: NO incluir lista completa de clientes, NO precios de costos
```

### 8.6. Almacenamiento de conversaciones IA

- Conversaciones del cliente con Dana = datos personales
- Aplica Habeas Data
- Retención: 6 meses → anonimización
- Log: quién accede a conversaciones, cuándo, por qué

### 8.7. Migración recomendada (futuro)

Si presupuesto lo permite, considerar migrar de DeepSeek a:
- Claude (Anthropic, USA) — marcos compliance maduros
- GPT (OpenAI, USA) — DPAs disponibles
- Gemini (Google, USA) — integrado con stack Google ya en uso

Razones: jurisdicción más predecible, DPAs disponibles, soporte enterprise.

---

## 9. Riesgos activos identificados

Síntesis de hallazgos al revisar el repo y arquitectura. Ver `06-MARCO-LEGAL-Y-PLANTILLAS.md` § Riesgos consolidados para el listado completo.

| # | Riesgo | Severidad | Acción |
|---|---|---|---|
| 1 | **Credenciales VPS y admin en repo público** (`CONTEXT_SUMMARY.md`) | 🔴 Crítico | Rotar TODAS hoy; remover archivo del histórico git (`git filter-repo`) |
| 2 | **Storefront sin código en git** (deploy por rsync desde Mac del dev) | 🟡 Alto operacional | Subir a git con secretos en `.env` separado |
| 3 | **Sin cifrado en reposo confirmado** del volumen `payment_proofs` | 🟡 Alto | Implementar LUKS o cifrado app-level |
| 4 | **SSH en puerto 22 estándar** | 🟡 Alto | Cambiar a puerto custom + fail2ban |
| 5 | **DeepSeek = transferencia internacional sin sanitización** | 🟡 Alto | Implementar sanitización de inputs |
| 6 | **Backups externos no documentados** | 🟡 Alto | Implementar y documentar política |
| 7 | **Logs no centralizados ni auditados** | 🟢 Medio | Stack de observabilidad |
| 8 | **Sin 2FA confirmado** en panels admin | 🟡 Alto | Activar 2FA en Medusa, Listmonk, Panel |
| 9 | **WaSenderAPI no oficial** = riesgo de pérdida del canal | 🟡 Alto | Plan B documentado |
| 10 | **instagrapi no oficial** = riesgo de baneo cuenta | 🟡 Alto | Cuenta secundaria, rotación |
| 11 | **Sin política escrita de retención y eliminación** | 🟢 Medio | Documentar y automatizar |
| 12 | **Single VPS = single point of failure** | 🟢 Medio (asumido por costo) | Backup externo robusto, plan de DR |

---

## 10. Plan de respuesta a incidentes

### 10.1. Equipo de respuesta (designar antes de que pase algo)

| Rol | Responsabilidad | Persona |
|---|---|---|
| **Coordinador del incidente** | Decisiones, comunicación interna | Owner / CTO |
| **Técnico responsable** | Contención técnica, forense | Dev backend principal |
| **Asesor legal externo** | Decisiones sobre denuncia, comunicación a afectados | Abogado de cabecera |
| **Vocero único** | Comunicación a clientes y prensa | Owner o gerente |

### 10.2. Tipos de incidente

**Nivel 1 — Bajo:** intento fallido de acceso, vulnerabilidad detectada y contenida, falla parcial sin exposición de datos.

**Nivel 2 — Medio:** acceso indebido sin exfiltración confirmada, falla extendida, ransomware contenido.

**Nivel 3 — Crítico:** exfiltración confirmada, fraude masivo, exposición pública de datos, ransomware no contenido.

### 10.3. Fases de respuesta

#### Fase 1 — Detección y contención (primeras horas)
- Aislar el sistema afectado (firewall, off de servicio si necesario)
- Cambiar credenciales potencialmente comprometidas
- **Preservar evidencia forense** (NO borrar logs ni archivos)
- Snapshot del estado actual (DB, sistema, logs)

#### Fase 2 — Análisis (24-72 horas)
- ¿Qué pasó exactamente?
- ¿Qué datos se afectaron?
- ¿Cuántas personas?
- ¿Hay difusión externa (datos publicados, vendidos)?
- ¿Vector de entrada identificado?
- ¿Atacante aún tiene acceso?

#### Fase 3 — Notificación
- A los **afectados directos**: email + canal habitual (sugerido en plazo razonable, máximo 7 días)
- A las **autoridades** si aplica:
  - **CICPC División Delitos Informáticos**: si hay delito (acceso, fraude, extorsión)
  - **SUNDDE**: si afecta operación con consumidores
  - **SENIAT**: si afecta integridad fiscal (ej.: borrado de facturas)
- A **medios** SOLO si masivo y previa asesoría legal

#### Fase 4 — Remediación
- Cerrar la vulnerabilidad raíz
- Restaurar desde backup limpio si necesario
- Reset de credenciales para todos los usuarios afectados
- Patches y actualizaciones

#### Fase 5 — Post-mortem y mejoras
- Reporte interno completo (qué, cuándo, cómo, por qué, qué hicimos)
- Lecciones aprendidas
- Mejoras estructurales (cambios de proceso, herramientas, equipo)
- Conservar reporte 5+ años

### 10.4. Runbook técnico (qué hacer en los primeros 30 minutos)

```
1. Identificar el sistema afectado: ¿VPS principal? ¿BD? ¿Cuenta admin?
2. Si VPS comprometido:
   - SSH desde IP de confianza
   - Cerrar puertos no esenciales: ufw deny incoming
   - Desactivar usuarios con acceso reciente sospechoso: usermod -L <user>
3. Si DB comprometida:
   - Snapshot inmediato: pg_dump > emergency_<timestamp>.sql
   - Cambiar password Postgres
   - Revisar pg_stat_activity y pg_locks por sesiones anómalas
4. Si cuenta admin comprometida:
   - Logout forzado de todas las sesiones (rotar JWT_SECRET)
   - Reset password admin
   - Deshabilitar cuenta
5. Notificar al coordinador del incidente
6. Documentar TODO en log paralelo (notas con timestamp)
```

---

## 11. Notificación de brechas

### 11.1. Sin obligación legal explícita en VE

Venezuela no tiene "72-hour breach notification" del GDPR. Pero:
- **LECDI Art. 20** penaliza violación de privacidad de comunicaciones
- **Constitución Art. 28** garantiza derecho a conocer uso de datos propios
- **Buena práctica**: notificar a afectados es lo correcto y reduce daño reputacional vs. silencio

### 11.2. A quién y cómo notificar

**Afectados directos:**
- Email personalizado al cliente afectado
- Banner en su cuenta cuando ingrese
- Si afectó WhatsApp: mensaje proactivo (con cuidado de no agravar)

**Autoridades:**
- **CICPC División Delitos Informáticos**: si hay delito (acceso indebido, fraude, extorsión)
  - Denuncia formal en sede física o vía email institucional
  - Acompañar con evidencia preservada
- **SUNDDE**: si la brecha afecta operación con consumidores (caída prolongada, pedidos no entregados por la brecha)
- **SENIAT**: si la brecha afecta integridad fiscal (ej.: facturas alteradas o destruidas)

### 11.3. Plantilla de comunicación al cliente

> Estimado/a cliente,
>
> Le escribimos para informarle de un incidente de seguridad que afectó nuestros sistemas el día [fecha]. En el incidente, [tipo de datos] de su cuenta puede haber sido [accedido/expuesto].
>
> **Lo que ya hicimos:**
> - [Contención técnica]
> - [Cambio de credenciales]
> - [Notificación a autoridades cuando aplique]
>
> **Lo que recomendamos:**
> - Cambie su contraseña en enrola.shop
> - Esté atento a comunicaciones sospechosas
> - Si recibe contacto inusual mencionando Enrola, repórtelo a [canal]
>
> Estamos a su disposición en privacidad@enrola.shop para cualquier pregunta.
>
> Atentamente,
> Enrola C.A.
> RIF: [...]

---

## 12. Checklist accionable de seguridad

### Inmediato (próximos 14 días)

- [ ] **Rotar TODAS las credenciales** expuestas en `CONTEXT_SUMMARY.md`
- [ ] Remover credenciales del histórico git (`git filter-repo`) — operación coordinada
- [ ] Cambiar puerto SSH del 22 a uno custom
- [ ] Verificar/instalar fail2ban
- [ ] Activar 2FA en Medusa admin, Listmonk, Panel
- [ ] Verificar que `.gitignore` excluye correctamente: `payment_proofs/`, `wa-proofs/`, `mrw-receipts/`, `.env`
- [ ] Cifrado en reposo del volumen `payment_proofs`
- [ ] Backup automatizado DB diario a almacenamiento externo
- [ ] NDA firmado por todo operador con acceso al panel
- [ ] Email `privacidad@enrola.shop` configurado y procedimiento documentado
- [ ] Implementar sanitización de inputs antes de enviar a Dana/DeepSeek
- [ ] Designar formalmente responsable de privacidad

### Mediano plazo (1-3 meses)

- [ ] Política escrita de retención y eliminación de datos
- [ ] Cron jobs de eliminación según política
- [ ] Logs centralizados con stack de observabilidad
- [ ] Política de roles y permisos documentada
- [ ] Revisión trimestral de quién tiene acceso a qué
- [ ] Documentar plan de respuesta a incidentes y compartir con equipo
- [ ] Test de restore de backup (probar que realmente funciona)
- [ ] Auditoría de configuración Cloudflare (WAF, rate limiting)
- [ ] Plan B documentado para caída de WhatsApp/Instagram
- [ ] Implementar exportación Habeas Data (acceso) para self-service del cliente
- [ ] Implementar flujo de eliminación de cuenta (Habeas Data destrucción)

### Estructural (6 meses+)

- [ ] Pentesting externo anual
- [ ] Migración de DeepSeek a proveedor con DPA disponible (Claude/GPT/Gemini)
- [ ] Cifrado de campos sensibles en BD (cédula, teléfono)
- [ ] Vault para secretos (HashiCorp Vault, Doppler, etc.)
- [ ] Estrategia de Disaster Recovery: RTO y RPO definidos
- [ ] Considerar segregación de servicios críticos en VPS separado
- [ ] Bug bounty / responsible disclosure (`security@enrola.shop`)

---

## Referencias cruzadas

- Marco legal completo y glosario: `06-MARCO-LEGAL-Y-PLANTILLAS.md`
- Implementación de Habeas Data en el frontend: `02-WEB.md` § 13
- Custodia de comprobantes desde óptica administrativa: `03-ADMINISTRATIVO.md` § 5.4
- NDAs y políticas con operadores: `03-ADMINISTRATIVO.md` § 10
- Riesgos derivados del uso de instagrapi/WaSenderAPI desde óptica de marketing: `01-MERCADEO-Y-PUBLICIDAD.md` § 2.3, § 3.2

---

*Última revisión: mayo 2026. Revisión sugerida: semestral mínimo, o ante cualquier incidente.*
