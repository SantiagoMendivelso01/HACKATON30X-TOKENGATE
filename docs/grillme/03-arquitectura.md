# Arquitectura de Faro

**Estado:** Aceptada en la [sesión grill-me 4](./sesion-04-arquitectura-dapta.md) (16-oct-2026). Decisiones: [ADR-001](./ADR-001-alcance-y-angulo.md) a [ADR-006](./ADR-006-integracion-dapta.md).

## 1. Diagrama de componentes

```
                         ┌──────────────────────── Vercel (Next.js) ────────────────────────┐
 Operador (ES/EN) ─────▶ │  UI operador: clientes · campaña · puente de mando · leads ·     │
                         │  revisión de oleada · laboratorio          (consulta cada 3 s)    │
 Lead (celular) ───────▶ │  /d/[token] diagnóstico público · /baja · /privacidad             │
                         │                                                                    │
                         │  Server actions / API routes                                       │
                         │   ├─ /api/webhooks/dapta   (x-faro-secret + IPs, idempotente)      │
                         │   ├─ /api/webhooks/brevo   (respuestas entrantes)                  │
                         │   └─ /api/d/[token]/call   (opt-in + límites → Calificador.callNow)│
                         └───────────────┬───────────────────────────────┬──────────────────┘
                                         │ Drizzle                        │ dispara tareas
                                         ▼                                ▼
                         ┌──────── Supabase Postgres ──────┐   ┌──────── Trigger.dev ─────────┐
                         │ clientes, campañas, oleadas,    │◀──│ discover · enrich · score ·   │
                         │ leads, hechos, señales, brazos, │   │ compose · verify · send-wave ·│
                         │ intentos, llamadas, respuestas, │   │ mature(4 h) · reassign ·      │
                         │ rechazos, cost_event, llm_call, │   │ reconcile-dapta(10 min) ·     │
                         │ activity_event, consentimientos │   │ recommend                     │
                         └─────────────────────────────────┘   └──────┬───────────────────────┘
                                                                      │ adaptadores
        ┌──────────────┬───────────────┬──────────────────┬──────────┴──────┬──────────────────┐
        ▼              ▼               ▼                  ▼                 ▼                  ▼
  OpenData        Places          WebFetcher            Llm             Mailer          Calificador
  (datos.gov.co:  (Google Places  (webs corporativas,   (Claude Sonnet  (Brevo;         (Dapta: flow A
  SECOP, RUES)    New, solo       robots.txt)           5.5 / Haiku 5.5) plan B Gmail)   callNow, flow B
                  place_id)                                                              enqueue; MCP)
```

**Qué depende de Dapta:** llamar, calificar y entregar los resultados.
**Qué es nuestro:**
- descubrir, deduplicar, puntuar y redactar;
- cumplimiento;
- asignar a los brazos;
- correlacionar;
- costo, métricas y recomendación.

**Componentes externos críticos:** Dapta (sin él no hay calificación), datos.gov.co (fuente principal), Brevo (dos de los tres canales) y Claude (redacción y clasificación).

## 2. Flujos principales

**F1. Descubrir y preparar (por campaña)**
1. El operador escribe la descripción libre. `Llm` (Sonnet) la convierte en CIIU, consultas de Places y filtros. El operador edita y ve una vista previa de los conteos.
2. `discover`: OpenData (SECOP + RUES, solo personas jurídicas) y Places (`place_id`) → registros por fuente → **deduplicación** (NIT → teléfono E.164 → dominio → nombre normalizado + ciudad) → `lead` con `found_by[]`.
3. `enrich`: WebFetcher sobre la web del lead → hechos con fuente y licencia. Places se lee al vuelo, sin persistir.
4. `score`: reglas del perfil + `Llm` (Haiku) para señales → ajuste 0–100 y señales del radar.
5. Asientos de costo por cada consulta, fetch y llamada al LLM.

**F2. Oleada**
1. Selección de los leads del perfil que aún no se contactaron. Fuente de los compartidos por sorteo (D17). Canal por sorteo (oleada 1) o por Thompson (oleadas 2 y 3), con un mínimo del 10% por brazo activo.
2. `compose` (Sonnet): mensaje y diagnóstico. `verify` (Haiku): cada afirmación debe estar respaldada → se bloquean las que no lo estén.
3. Revisión de la oleada por el operador (se mide el tiempo humano) → aprobación.
4. `send-wave`: filtro de cumplimiento → `Mailer.send` (brazos de email) o `Calificador.enqueue` (voz). El intento queda *sin confirmar* hasta que el proveedor lo acepte.

**F3. "Llámenme ahora"**
`/d/[token]` → casilla de autorización + teléfono → límites (enlace, IP, número, exclusión) → registro del consentimiento → `Calificador.callNow` → registro en vivo "esperando a Dapta".

**F4. Resultados**
- **Dapta:** webhook → validación → payload crudo → `parseResult` → actualizar el intento, la llamada, la conversación real, la calificación y el rechazo → asiento de costo.
- **Conciliación:** `reconcile-dapta` recupera lo que falte.
- **Brevo:** webhook de respuesta → `Llm` (Haiku) clasifica la respuesta (humana o automática, hostil, baja) → conversación real o rechazo.

**F5. Recomendación**
`mature` marca los resultados con 4 h o más → `reassign` calcula P(mejor) por Thompson sobre el valor ponderado ÷ costo, con apagado por umbral → `recommend`: Sonnet redacta la frase y un verificador compara cada número con el cálculo. Si falla o tarda más de 10 s, se usa la plantilla.

## 3. Modelo de datos (esquema inicial)

```
client(id, name, brand_name, brand_color, offer, icp_text, ad_cpl_cop?, contact_language)
campaign(id, client_id, config jsonb, budget_cap_usd, fx_cop_per_usd, status, weights jsonb, thresholds jsonb)
wave(id, campaign_id, n, status, approved_at, approved_by, human_seconds)
lead(id, campaign_id, nit?, name, normalized_name, city, ciiu?, domain?, phone_e164?, email?, is_legal_entity,
     fit_score, assigned_source, found_by text[], place_id?)          -- sin columnas de datos de Places
source_record(id, lead_id, source, external_id, license, payload jsonb, fetched_at)  -- solo fuentes almacenables
fact(id, lead_id, text, source, url, license, field)                  -- hechos del dossier
signal(id, lead_id, kind, evidence, source, url)
dossier(lead_id, line_who, line_why, line_opener, generated_at)
arm_assignment(lead_id, wave_id, source, channel, method: 'random'|'thompson')
message(id, lead_id, wave_id, channel, body, claims jsonb, verification jsonb, status)
contact_attempt(id, lead_id, channel, provider, provider_ref?, status: pending|unconfirmed|sent|failed, sent_at)
call(id, attempt_id?, dapta_call_id unique, answered, voicemail, duration_sec, qualified?, variables jsonb,
     summary, recording_url?, ambiguous, raw_id)
reply(id, attempt_id, received_at, from, body, class: human|auto|bounce, hostile, unsubscribe)
outcome(lead_id, real_conversation_at?, qualified_at?, rejection_kind?, rejection_evidence?)
consent(id, lead_id, token, phone_e164, ip, text_version, accepted_at)
exclusion(id, phone_e164?, email?, reason, created_at)
diagnostic_token(token, lead_id, expires_at, calls_today)
cost_event(... según ADR-002)
llm_call(id, task, model, prompt_version, input_tokens, output_tokens, cost_usd, latency_ms, valid, output jsonb, lead_id?)
activity_event(id, campaign_id, lead_id?, kind: working|waiting|attention|done, message_key, params jsonb, created_at)
recommendation(id, campaign_id, wave_id, text_es, text_en, source: llm|template, metrics jsonb, created_at)
dapta_webhook_raw(id, received_at, headers jsonb, body jsonb, processed)
```

## 4. Límites de módulos (para trabajar en paralelo)

| Módulo | Carpeta | Dueño único de |
|---|---|---|
| Esquema y migraciones | `src/db/` | Esquema Drizzle, migraciones, seeds de tarifas |
| Descubrimiento y deduplicación | `src/server/discovery/` | Adaptadores OpenData y Places, dedupe |
| Enriquecimiento y puntuación | `src/server/enrichment/` | WebFetcher, dossier, señales, ajuste |
| Mensajería | `src/server/messaging/` | Redacción, verificador, `Mailer`, respuestas de Brevo |
| Calificador | `src/server/qualifier/` | Adaptador Dapta, webhook, conciliación |
| Experimento y métricas | `src/server/lab/` | Asignación, Thompson, madurez, métricas, cumplimiento, frase |
| Costos | `src/server/costs/` | `cost_event`, tarifas, prorrateo |
| Procesos | `src/trigger/` | Definiciones de tareas (solo llaman a los módulos) |
| UI operador | `src/app/(operator)/` | Pantallas y componentes del operador |
| UI pública | `src/app/d/`, `src/app/(legal)/` | Diagnóstico, baja, privacidad |
| Traducciones y tema | `src/i18n/`, `src/theme/` | Catálogos ES/EN y tokens visuales |

**Regla:** solo el módulo de esquema cambia `src/db/`. Los demás piden los cambios por escrito en su issue.

## 5. Seguridad

| Área | Medida |
|---|---|
| Secretos | Solo en variables de entorno del servidor: URLs de Public Route, API key del MCP, secreto del webhook, Brevo, Anthropic, Google, Supabase service key. `.env.example` sin valores |
| Webhooks | Secreto en la cabecera + allowlist de IPs (Dapta), firma o secreto (Brevo), idempotencia y payload crudo guardado |
| Diagnóstico | Token aleatorio de 128 bits sin datos personales. Límites por enlace, IP y número. Auditoría del consentimiento |
| Operador | Supabase Auth con lista de operadores. Todas las acciones con efecto externo (aprobar oleada, pausar) del lado del servidor |
| Gasto | Tope de presupuesto por campaña comprobado en el filtro de cumplimiento. Pausa global |
| Datos personales | Solo personas jurídicas. Sin representante legal. Sin datos de Places persistidos |
