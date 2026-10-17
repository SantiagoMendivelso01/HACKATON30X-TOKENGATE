# Faro v1: qué es, qué falta y qué hay que decidir

**Fecha:** sábado 17-oct-2026, madrugada · **Estado:** versión 1, en local, con datos reales de datos.gov.co y una base de demo · **Autor:** equipo

Este documento resume los 6 commits de la versión 1 (`fe7955b` → `8c11fd0`). Se apoya en la [definición de producto](./grillme/02-definicion-producto.md), la [arquitectura](./grillme/03-arquitectura.md) y los ADR. Cuando la v1 se aparta de ellos, se dice en la sección 5.

---

## 1. De qué va Faro

> **No te decimos cuánto cuesta un lead. Te decimos cuánto cuesta uno que vale la pena.**

Faro busca clientes para una pyme en fuentes públicas, los contacta respetando la ley, deja que el agente de Dapta los califique y dice **dónde buscar y cómo contactar al menor costo por lead calificado**.

El usuario es el operador de Dapta. Para cada campaña:

1. Describe en lenguaje natural a quién busca.
2. Faro lo traduce a filtros sobre el registro mercantil.
3. Faro encuentra empresas reales y las contacta en oleadas.
4. Faro compara 6 combinaciones de **fuente × canal**:
   - fuentes: datos abiertos y Google Places;
   - canales: email simple, email con diagnóstico y llamada de Dapta.

---

## 2. Qué hace la v1 (y cómo se verificó)

| Pantalla o pieza | Qué hace | Verificado |
|---|---|---|
| **Nueva campaña** (`/campanas/nueva`) | Descripción libre → Claude Sonnet 5.5 propone códigos CIIU, cámara de comercio, palabras clave, exclusiones y búsquedas de Places. Todo se valida contra catálogos oficiales (649 CIIU, 58 cámaras). El operador edita y ve una **vista previa** (conteo exacto en el RUES; contactables y del perfil estimados con una muestra cruzada con SECOP; costo). Luego crea la campaña y busca. Ejemplos para empezar, modo manual sin IA, Ctrl+Enter | ✅ En vivo con Claude ("inmobiliarias en Cali": 2 CIIU, cámara de Cali, US$0,03 por propuesta) |
| **Descubrimiento real** | RUES por CIIU (perfil, estado, renovación) → SECOP II por NIT (contacto) → deduplicación (NIT → teléfono → dominio → nombre + ciudad) → filtro de perfil → señal "matrícula reciente" → hechos con fuente y licencia por campo | ✅ Datos reales: clínicas en Bogotá, inmobiliarias en Cali, talleres en Medellín |
| **Puente de mando** (`/`) | Progreso de la campaña en 6 fases. Tarjeta principal que cambia según la fase (siguiente paso, esperando resultados con hora de maduración, o recomendación). Indicadores, matriz fuente × canal con ayuda "?" en lenguaje claro, registro en vivo, selector de campaña, borrar campaña | ✅ Con la campaña de demo y con campañas reales |
| **Leads** (`/leads`, `/leads/[id]`) | Tabla con filtros por perfil y búsqueda; resumen (correo, teléfono, señales); ajuste al perfil; motivo del perfil en lenguaje claro. Detalle con contacto, hechos citados, señales, registros de origen, historial y recibo de costos | ✅ |
| **Diagnóstico público** (`/d/[token]`) | Pensado para celular, con la marca del cliente. "Llámenme ahora" con casilla de autorización, límites (2 llamadas al día por enlace, 3 por hora por IP, 2 al día por número), lista de exclusión, consentimiento auditado, filtro de cumplimiento con la excepción D53 y flow A de Dapta | ✅ Flujo y límites con tests. ⚠️ Sin Dapta real: sin URL del flow, el intento queda "fallido" |
| **Webhook de Dapta** (`/api/webhooks/dapta`) | Secreto + IPs, payload crudo guardado, idempotente por `call_id`. Correlación por `faro_attempt_id`; si falta, por número (del lead o del consentimiento) + ventana de tiempo; si no cuadra, la llamada queda **ambigua** | ✅ Con tests. ⚠️ **Formato provisional** hasta la prueba técnica |
| **Lógica de negocio** | Filtro de cumplimiento (horario legal, festivos de Colombia, 7 días, exclusión, persona natural, presupuesto, pausas, D53); Thompson con apagado y piso del 10 %; oleada 1 uniforme; madurez de 3 h; libro de costos (créditos de Dapta, LLM, Places, email, fijos prorrateados); CPL bruto e incremental, CPQL, Wilson al 90 %; frase por plantilla con verificador de cifras | ✅ 88 tests |
| **Borrar campañas** | Borrado definitivo solo si la campaña **no** tiene contactos ni autorizaciones; confirmación escribiendo «borrar», validada en el servidor | ✅ Con tests de integración |
| **Tema** | "Módulo de Dapta": negro, acento lima `#CBE850`, DM Sans + Poppins, marco oscuro con contenido claro, rótulo "construido para Dapta (proyecto de hackathon)". Plan B "instrumento de medición" en los tokens | ✅ |

**Cómo correrla:** ver el [README](../README.md). Resumen: `pnpm db:demo`, luego `pnpm dev`, con `.env.local` apuntando a la base de demo. La llave de Anthropic va en `.env.local`, que **no se sube**.

---

## 3. Qué falta

### 3.1 Camino crítico hacia la oleada 1 (código)

| # | Pieza | Qué es |
|---|---|---|
| 1 | **Armar la oleada** | Elegir los leads del perfil sin contactar, sortearlos a los brazos (la lógica ya existe) y generar el dossier de 3 líneas con Claude |
| 2 | **Redactar y verificar** | Mensajes con Claude Sonnet; verificación de cada afirmación con Haiku (la parte estructural ya existe) |
| 3 | **Revisión y aprobación** | Pantalla por brazo con 3 muestras, afirmaciones enlazadas a su fuente, bloqueados con su motivo y confirmación final; medir el tiempo humano |
| 4 | **Envío** | Filtro de cumplimiento → Brevo (email) o Dapta flow B (voz). El intento queda "sin confirmar" hasta que el proveedor acepte; nunca se reintenta solo |
| 5 | **Google Places en el descubrimiento** | El adaptador existe; falta la llave e integrarlo al flujo. Es la segunda fuente que exige el reto |
| 6 | **Respuestas de email** | Webhook de Brevo + clasificación con Haiku (humana, automática, hostil, baja) |
| 7 | **Formulario de baja** | Hoy `/baja` es un borrador; debe escribir en la lista de exclusión |

### 3.2 Para poder salir de "local"

- **Supabase** (desarrollo y producción) y **Vercel**.
- **Login de operadores (D43).** Hoy las acciones de crear y borrar campañas **no exigen login**. No se debe desplegar en público sin esto.
- **Señal "web con WhatsApp o chat"** (lector de webs que respete robots.txt).
- **Refresco cada 3 s, pausa global y por brazo (D30), recibo al hacer clic en cada cifra.**

### 3.3 Bloqueos externos

| Quién | Qué | Bloquea |
|---|---|---|
| Persona A | **Prueba técnica de Dapta**: número que llame a Colombia, agente calificador, flows A y B, webhook real | Voz, "Llámenme ahora" real y la demo en vivo (riesgo R14) |
| Persona A | **Llave de Google Places** con facturación | Segunda fuente (riesgo R16) y el volumen |
| Persona A | **Brevo**: dominio con SPF, DKIM y DMARC; revisar su política de uso | Canales de email |
| Persona A | Supabase, Vercel y token de Socrata | Despliegue |
| Persona C | Textos legales (privacidad, baja, autorización del diagnóstico: hoy versión `v1-2026-10-17`, borrador), guion y video de respaldo | Cumplimiento y demo |
| Organizadores | Permiso para usar la marca de Dapta (S-J) | Tema visual |

---

## 4. Decisiones que hay que tomar

Ordenadas por urgencia. Cada una trae una recomendación; la decisión es del equipo.

### D-v1-1. ¿De dónde sale el volumen para la oleada 1? *(urgente)*
**Hecho:** con datos abiertos solo hay contacto de las empresas que le venden al Estado. Esto es lo que salió con datos reales:

| Búsqueda | Empresas en el RUES | Contactables | Del perfil |
|---|---|---|---|
| Clínicas odontológicas y estéticas en Bogotá | 4.182 | 287 | 19 |
| Inmobiliarias en Cali | 4.280 | 51 | 21 |
| Talleres mecánicos en Medellín | 580 | 25 | 25 |

El plan pide unos 90 leads del perfil por oleada.

**Opciones:**
- (a) Conseguir la llave de Places ya.
- (b) Ampliar el perfil (por ejemplo, todo el CIIU 8621 de centros médicos).
- (c) Varias ciudades o rubros en la misma campaña.
- (d) Oleadas más pequeñas, aceptando intervalos más anchos.

**Recomendación:** (a) + (d) como respaldo.

### D-v1-2. ¿Hay voz el sábado?
**Opciones:**
- (a) Número de EE. UU. de Dapta, si llama a Colombia.
- (b) Plan B2: sin llamada directa; la voz solo por "Llámenme ahora" con autorización, y el brazo de voz se declara no ejecutado.

Decidir apenas termine la prueba técnica. **Nunca simular la voz.**

### D-v1-3. Correos que parecen personales en SECOP
**Hecho:** 161 de 287 correos de la búsqueda de clínicas son de Gmail, Hotmail u otros dominios gratuitos. Muchas veces son del dueño.

**Opciones:**
- (a) Usarlos (la empresa los registró como contacto en SECOP).
- (b) Excluir del email los dominios gratuitos y contactar esas empresas solo por voz.
- (c) Marcarlos y decidir en la revisión de la oleada.

**Recomendación:** (b), por prudencia con la Ley 1581.

### D-v1-4. Leads que solo vienen de Places
Places no dice si es persona natural o jurídica, y hoy se asumen jurídicas.

**Opciones:**
- (a) Exigir que se emparejen con el RUES (NIT) para contactarlos.
- (b) Aceptarlos con revisión humana.

**Recomendación:** (a) para la voz y (b) para el email.

### D-v1-5. Alcance de la excepción D53
La v1 exime del horario **y** del intervalo de 7 días cuando el titular pide la llamada en ese momento: el contacto lo inicia él. Hay que validar esa interpretación y decirla en el pitch como [NC].

### D-v1-6. Orquestación para el evento
**Opciones:**
- (a) Trigger.dev, como dicen los ADR.
- (b) Acciones de servidor y scripts, como funciona hoy el descubrimiento.

**Recomendación:** (b) para el sábado y Trigger.dev después. Es un recorte que cambia el ADR-004 y queda por escrito aquí.

### D-v1-7. ¿Qué campaña real corre el sábado?
D52 dice clínicas odontológicas y estéticas de Bogotá, pero con datos abiertos salen solo 19 del perfil. Hay que decidir si se mantiene (con Places) o se cambia de rubro o ciudad según la vista previa.

### D-v1-8. Despliegue y seguridad
No exponer la app en una URL pública sin el login de operadores. **Recomendación:** login mínimo (Supabase Auth con lista de correos) antes de Vercel.

### D-v1-9. Menores, sin urgencia
- **TRM:** hoy está fija en 3.900. Tomar la del día de la campaña (D18).
- **Tarifa de email de Brevo:** sin confirmar [NC]. Confirmarla.
- **Costo de la propuesta con Claude** (US$0,03, porque el catálogo CIIU va completo en el prompt): activar la caché del prompt.
- **Campañas con contactos:** no se pueden borrar. ¿Hace falta "archivar" para ocultarlas?

---

## 5. Cambios respecto a los documentos

| Documento | Decía | En la v1 | Por qué |
|---|---|---|---|
| D52 / producto §4 | Campaña fija de clínicas en Bogotá | El perfil es **por campaña**, en lenguaje natural (D25); las clínicas son una campaña más | Faro sirve para cualquier pyme cliente (ADR-001) |
| ADR-004 | Trigger.dev para los procesos | Acciones de servidor y scripts (pendiente de D-v1-6) | Tiempo |
| Configuración | Consultas de Places obligatorias | Opcionales | Sin llave, el descubrimiento usa solo datos abiertos |
| ADR-005 | Selector de cliente (luego recortado por D50) | Un solo cliente; selector de **campaña** | D50 |
| ADR-004 | Next.js | Next.js 16 **sin** `cacheComponents` | Todo es dinámico; modelo más simple |
| Desarrollo | Supabase de desarrollo | Base de demo local (PGlite) en `.demo-db/`, ignorada por git | Ver la app sin cuentas |

---

## 6. Riesgos abiertos

- **R14:** sin número que llame a Colombia antes de las 8:00, no hay brazo de voz.
- **R16:** sin Places no hay segunda fuente real, y el reto exige al menos 2.
- **Volumen:** la matriz con oleadas pequeñas tendrá intervalos muy anchos. Se comunica como "evidencia insuficiente", no como falla (R1).
- **Formato del webhook de Dapta:** provisional. Puede requerir ajustar `parseDaptaWebhook` en minutos, con el payload real en `fixtures/dapta/`.
