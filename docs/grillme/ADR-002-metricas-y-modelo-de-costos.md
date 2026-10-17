# ADR-002 — Métricas y modelo de costos

**Estado:** Aceptado en las sesiones grill-me [1](./sesion-01-problema-alcance-ideas.md) y [2](./sesion-02-propuesta-valor-metricas.md) (16-oct-2026)

> **Modificado en la [sesión grill-me 5](./sesion-05-mvp-demo.md):** ver D45–D53 (2 oleadas con maduración de 3 h, frase por plantilla primero, solo español rellenado, un cliente, 2 señales, sin conciliación MCP ni referidos, campaña propia de Faro, excepción de llamada solicitada por el titular). Donde este ADR contradiga a D45–D53, manda la sesión 5.

## Contexto
- El reto mide leads del perfil, CPL por canal y % de calificados por canal.
- Con fuentes gratuitas el costo de datos es casi cero; el costo real está en contactar.
- Faro tiene que decir **dónde buscar y cómo contactar** con números defendibles.

## Decisión

### Embudo
`encontrado → del_perfil → aprobado → contactado → conversación_real → calificado`

Además se registra `rechazo` en cualquier punto después de *contactado*.

| Etapa | Definición |
|---|---|
| **contactado** | el proveedor confirmó el envío o la llamada |
| **conversación real** | email respondido por una persona (sin autorespuestas ni rebotes, según un clasificador) **o** llamada de Dapta contestada por un humano, sin buzón, de ≥ 30 s y con respuestas del lead. El umbral se ajusta con el payload real |
| **calificado** | la variable de calificación del webhook de Dapta es verdadera |
| **rechazo** | opt-out, queja de spam, respuesta hostil (LLM con evidencia citada), cuelgue < 10 s tras identificarnos o sentimiento negativo en la llamada |

### Atribución
- **Fila del experimento:** si un lead lo encontraron varias fuentes, se sortea entre ellas. Se guarda `found_by[]`.
- **Columna:** el canal que salió en el sorteo de la oleada.

### Libro de costos
Cada acción con costo escribe un asiento:

```
cost_event(id, campaign_id, lead_id?, source?, channel?, kind, quantity, unit,
           list_unit_cost_usd, list_amount_usd, actual_amount_usd, fx_cop_per_usd,
           is_fixed, estimated, evidence, created_at)
```

| Campo | Regla |
|---|---|
| `list_*` | precio de lista por unidad (de `config/rates`, con URL y fecha) |
| `actual_amount_usd` | gasto real de bolsillo (0 si entra en el free tier) |
| `fx_cop_per_usd` | TRM del día de la campaña |
| `kind` | `places_request`, `llm_tokens`, `email_send`, `dapta_call_minutes`, `dapta_call_attempt`, `fixed_prorated`, `human_minutes` |
| Costos fijos | se prorratean por los días de la campaña. Los exclusivos de un canal van a ese canal; los compartidos se reparten por contactos |
| Tiempo humano | se mide en las pantallas de aprobación y revisión. Solo se suma al costo si el usuario activa una tarifa por hora |

### Métricas
Todas se muestran en COP y USD, en vista *variable* (por defecto) o *total*.

| Métrica | Fórmula |
|---|---|
| CPL bruto (fuente) | costos de búsqueda, enriquecimiento y ajuste de la fuente ÷ sus leads del perfil |
| CPL incremental (fuente) | los mismos costos ÷ los leads del perfil que **solo** esa fuente aportó |
| Costo por conversación real (brazo) | costo del brazo ÷ conversaciones reales |
| CPQL (brazo) | costo del brazo ÷ calificados |
| Costo por lead sin rechazo (brazo) | costo del brazo ÷ (contactados − rechazos) |
| Tasa de rechazo y % de calificados | con intervalo de Wilson al 90% |
| Comparación | contra el CPL de pauta ingresado por el cliente (o una referencia externa marcada como no verificada) |

### Asignación y recomendación
- **3 oleadas.** La primera reparte por igual. La 2 y la 3 usan **muestreo de Thompson** sobre el valor ponderado ÷ costo, contando solo resultados **maduros** (≥ 4 h desde el contacto).
- **Pesos por defecto, configurables:** conversación = 1, calificado = 3, rechazo = −1.
- **Apagado:** un brazo se apaga si P(mejor) < 5% con un mínimo de contactos (el mínimo se define en la sesión 4).
- **Frase de recomendación:** la redacta un LLM a partir de las métricas. Un verificador comprueba cada número contra el cálculo; si falla, o el LLM supera los 10 s, se usa una plantilla determinista. Se regenera cuando cambian las métricas y queda guardada.

## Consecuencias
- Cada número del tablero se descompone en asientos. Hay que testear el cálculo de cada métrica y el verificador de la frase.
- La plantilla determinista de la frase se construye aunque el LLM sea el camino principal.
- El tablero tiene que comunicar la evidencia insuficiente como un estado normal, no como un error.
