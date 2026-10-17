# ADR-006 — Integración con Dapta

**Estado:** Aceptado en la [sesión grill-me 4](./sesion-04-arquitectura-dapta.md) (16-oct-2026). Hay supuestos pendientes de la prueba técnica de Dapta.

## Contexto
Dapta no tiene una API REST pública para disparar llamadas. Sí documenta tres mecanismos:
- flows con trigger *Public Route*;
- análisis post-llamada con destinos;
- un MCP (`https://mcp.dapta.ai/mcp`) con herramientas para leer llamadas y saldo.

Fuente: https://docs.dapta.ai/llms.txt

## Decisión
Toda interacción con Dapta pasa por el adaptador `Calificador` (`src/server/qualifier/`). Ningún otro módulo conoce URLs, payloads ni nombres de Dapta.

```ts
interface Qualifier {
  callNow(input: { attemptId: string; phoneE164: string; vars: CallVars }): Promise<{ accepted: boolean; raw: unknown }>;
  enqueue(input: { attemptId: string; phoneE164: string; vars: CallVars }): Promise<{ accepted: boolean; raw: unknown }>;
  parseResult(raw: unknown): QualifierResult | { ambiguous: true; reason: string };
  reconcile(since: Date): Promise<QualifierResult[]>; // vía MCP
}
// CallVars: faro_attempt_id, brand, offer, dossier_summary (3 líneas), opening_check (D37), language
// QualifierResult: callId, attemptId?, toNumber, answered, voicemail, durationSec, qualified, variables, summary, sentiment?, recordingUrl?, raw
```

| Pieza | Implementación |
|---|---|
| Flow A "callNow" | Public Route → nodo *Dapta Phone Call* (From = número de Dapta, To = E.164, agente calificador, variables) |
| Flow B "enqueue" | Public Route → *Add Contact To Sequence* (secuencia del agente calificador; external ID = `faro_attempt_id`) |
| Resultado | El análisis post-llamada va a un flow de reenvío, que hace POST a `/api/webhooks/dapta` con la cabecera `x-faro-secret` |
| Validación | Secreto + IPs documentadas (3.135.117.63, 3.14.139.223). Payload crudo en `dapta_webhook_raw`. Procesamiento idempotente por `call_id` |
| Conciliación | Job de Trigger.dev cada 10 min: el MCP con `list_calls`/`get_call` recupera los resultados que faltan. Límite de 60 consultas/min |
| Correlación | `faro_attempt_id` (variable/external ID). Si falta → número + ventana de tiempo. Si no cuadra → `ambiguous` |
| Apertura | El agente confirma que la llamada fue solicitada (opt-in) o se identifica y ofrece la baja (llamada directa) |
| Secretos | URLs de Public Route (llevan la autenticación embebida), API key del MCP y `x-faro-secret`, solo como variables de entorno del servidor |
| Costo | Se calcula con la tabla de créditos (333 créditos por minuto contestado, 75 por buzón, 45 sin respuesta) y la duración real si viene en el payload; si no viene, se marca `estimated` |

**Tests:** existe un `FakeQualifier` solo para tests automatizados. Nunca está disponible en producción.

## Consecuencias
- La **prueba técnica de Dapta (hora 0–2)** fija el esquema real. Su payload se guarda en `fixtures/dapta/` y alimenta los tests de `parseResult`.
- Si el entorno de los organizadores difiere (otro agente, otra vía de entrada), solo cambia el adaptador.
- Lo que depende de Dapta: llamar, calificar y entregar los resultados. Lo que es nuestro: decidir a quién, cuándo y por qué, la correlación, el costo y la métrica.
