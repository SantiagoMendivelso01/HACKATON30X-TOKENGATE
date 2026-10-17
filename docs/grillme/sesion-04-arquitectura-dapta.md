# Sesión grill-me 4: arquitectura e integración con Dapta

**Fecha:** 16-oct-2026 · **Participantes:** equipo · **Estado:** cerrada

## Decisiones tomadas

| # | Pregunta | Decisión | Descartado y por qué |
|---|---|---|---|
| D34 | Cómo se disparan las llamadas | **Dos flows de Dapta detrás de un adaptador `Calificador`:**<br>• **Flow A** (Public Route → nodo *Dapta Phone Call*) para "Llámenme ahora", porque es inmediato.<br>• **Flow B** (Public Route → *Add Contact To Sequence*) para la llamada directa en lote: Dapta gestiona ritmo, concurrencia y reintentos | Llamar siempre por llamada directa obliga a reimplementar colas y arriesga exceder la concurrencia. Usar siempre secuencias no garantiza llamar en menos de 1 min |
| D35 | Cómo recibimos los resultados | **Webhook + conciliación por MCP:**<br>• el análisis post-llamada se envía a un flow de reenvío que llama a nuestro endpoint con una **cabecera secreta propia**;<br>• validamos esa cabecera y las IPs documentadas;<br>• guardamos el payload crudo y procesamos sin duplicar por `call_id`;<br>• un job cada 10 min consulta `list_calls`/`get_call` en el MCP y recupera las llamadas cuyo webhook se perdió | Con solo webhook, un webhook perdido es un calificado perdido. Con solo MCP se agota el límite de 60 consultas por minuto y el tablero deja de verse en vivo |
| D36 | Correlación llamada ↔ lead | Se envía `faro_attempt_id` como variable dinámica y como external ID. Si Dapta no lo devuelve, se empareja por número destino + ventana de tiempo. Si aun así no cuadra, la llamada queda marcada como **ambigua** (nunca se adivina). *Decidida sin consulta por ser la opción convencional* | — |
| D37 | Abuso de "Llámenme ahora" | **Límites + confirmación:**<br>• enlace ligado a un lead, máximo 2 llamadas al día;<br>• límite por IP y por número; lista de exclusión;<br>• el agente abre con "¿Usted solicitó esta llamada desde el diagnóstico de [marca]?" y, si la respuesta es no, cuelga y registra rechazo;<br>• auditoría con hora, IP y texto aceptado | La verificación por SMS o WhatsApp añade costo y fricción, y su versión por WhatsApp necesita la Cloud API. Llamar solo al número corporativo elimina el momento en vivo |
| D38 | Orquestación | **Trigger.dev:** tareas duraderas, esperas largas, cron, concurrencia y panel | Una cola propia en Postgres es código nuevo que depurar en 24 h. Inngest es equivalente pero sin verificar |
| D39 | Email | **Brevo** (300/día gratis) con recepción de respuestas por webhook en un **subdominio de respuesta**. Píxel de apertura y rastreo de enlaces **desactivados**. Detrás de un adaptador `Mailer` con Gmail API como plan B | *Decisión del equipo frente a la recomendación "buzón real + Gmail API".* Amazon SES es inviable en 24 h (modo sandbox) |
| D40 | LLM | **Claude en dos niveles:**<br>• Sonnet 5.5 redacta: perfil a CIIU, dossier, mensaje y frase;<br>• Haiku 5.5 hace el volumen: señales, verificación y clasificación de respuestas.<br>Salidas estructuradas validadas con Zod. Webs leídas por nuestro código | Usar el mismo proveedor que Dapta no aporta nada técnico. Un solo modelo paga de más o pierde calidad |
| D41 | Datos | **Drizzle** sobre Postgres de Supabase. **Consulta cada 3 s** para el tiempo real. **Sin columnas para los datos de Places** distintos del `place_id`: el cumplimiento queda impuesto por el esquema. *Decididas sin consulta, reversibles* | — |
| D42 | Umbrales estadísticos | **Moderados**, configurables:<br>• evidencia insuficiente si algún brazo tiene < 10 contactos maduros;<br>• según P(mejor) del líder: débil < 80%, moderada 80–95%, fuerte ≥ 95%;<br>• apagado con P(mejor) < 5% y ≥ 15 contactos maduros;<br>• mínimo 10% de la oleada para cada brazo activo | Con umbrales conservadores nunca se apagaría nada en el evento. Con agresivos se apagaría por ruido |
| D43 | Autenticación, entornos y simulador | **Autenticación:** Supabase Auth con email y contraseña, restringida a una lista de operadores.<br>**Entornos:** dos proyectos Supabase (desarrollo y producción) y despliegues de vista previa en Vercel.<br>**Simulador del Calificador:** solo para tests, nunca en producción. *Decididas sin consulta, reversibles* | — |
| D44 | Trazas del LLM | **Tabla propia `llm_call`:** tarea, modelo, versión del prompt, tokens, costo, latencia, validación y salida, ligadas al lead y al asiento de costo | Langfuse es una cuenta y un SDK más. Usar ambas duplica la instrumentación |

## Supuestos pendientes de validar
- **S-N:** el nodo *Dapta Phone Call* dispara la llamada en < 1 min desde el POST. Lo valida la prueba técnica.
- **S-O:** el análisis post-llamada se puede enviar a un flow de Dapta que reenvíe con cabeceras propias. Si no, se usa un secreto en la URL más la allowlist de IPs.
- **S-P:** Dapta devuelve las variables dinámicas o el external ID en el payload (D36).
- **S-Q:** la política de uso de Brevo permite email B2B 1 a 1 de bajo volumen a direcciones corporativas públicas. **Hay que verificarlo antes del evento.**
- **S-R:** los recursos de Trigger.dev y Supabase del plan gratuito alcanzan para el evento.
- **S-S:** el agente calificador de los organizadores admite modificar su frase de apertura (D37). Si no, creamos nuestro propio agente "Lead Qualifier" en el entorno de prueba.

## Riesgos identificados
- **R11:** la integración con Dapta tiene 4 incógnitas (S-N, S-O, S-P, S-S). **La prueba técnica de Dapta es la primera tarea del evento** y bloquea la integración.
- **R12:** Brevo puede suspender la cuenta. El plan B (Gmail API) requiere OAuth y un buzón: **conviene dejarlo preparado antes del evento.**
- **R13:** el dominio nuevo no tiene reputación y puede caer en spam. Volumen bajo, texto simple y SPF/DKIM/DMARC desde el día 0.

## Siguientes pasos
- Hecho al cerrar esta sesión: [arquitectura](./03-arquitectura.md), ADR-003 y ADR-004 consolidados, ADR-006 (integración con Dapta) nuevo.
- **Sesión 5: MVP de 24 h y estrategia de demo.** Volumen objetivo (S-A), orden de construcción, recortes por el alcance que creció (R8), cronograma de oleadas en función del horario legal, guion de la demo y plan B.
