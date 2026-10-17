# HACKATON30X-TOKENGATE — Faro

> No te decimos cuánto cuesta un lead. Te decimos cuánto cuesta uno que vale la pena.

Faro busca clientes para pymes en fuentes públicas (SECOP II + RUES y Google Places), los contacta respetando la ley, deja que el agente de Dapta los califique y dice dónde buscar y cómo contactar al menor costo por lead calificado. Decisiones en [`docs/grillme/`](docs/grillme/02-definicion-producto.md) (los ADR mandan; la sesión 5 manda sobre los ADR).

## Arranque

```bash
pnpm install
cp .env.example .env.local   # rellenar; nunca subir secretos
pnpm db:migrate              # aplica src/db/migrations a DATABASE_URL
pnpm dev
```

| Script | Qué hace |
|---|---|
| `pnpm test` | Tests unitarios (Vitest) |
| `pnpm typecheck` / `pnpm lint` | TypeScript y ESLint |
| `pnpm db:generate` | Nueva migración desde `src/db/schema.ts` |

Stack (ADR-004): Next.js 16 (App Router, sin `cacheComponents`), Drizzle + Postgres (Supabase), Zod, Claude Sonnet 5.5 / Haiku 5.5, Brevo, Dapta, Trigger.dev.

## Estado

**Hecho (Fase 0):**
- Esquema completo y migración inicial (`src/db/`). De Places solo existe la columna `place_id`.
- Lógica pura con tests (54): filtro de cumplimiento con festivos de Colombia y excepción D53, deduplicación NIT → teléfono → dominio → nombre+ciudad, Thompson con apagado y piso del 10%, asignación por oleada, libro de costos (créditos Dapta, LLM, Places, email, fijos), métricas (CPL bruto/incremental, CPQL, Wilson 90%), madurez de 3 h, frase por plantilla y verificador de cifras.
- Adaptadores con interfaz y fake: `Llm` (Anthropic), `Calificador` (Dapta), `Mailer` (Brevo), `OpenData` (Socrata), `Places`.
- Webhook `/api/webhooks/dapta`: secreto + IPs, payload crudo, idempotente por `call_id`, correlación por `faro_attempt_id` o número + ventana; si no cuadra, ambiguo.
- Puente de mando (`/`) leyendo la base; catálogo ES y tokens de tema; páginas legales en borrador.

**Pendiente (siguientes issues):**
1. Prueba técnica de Dapta → payload real en `fixtures/dapta/` y ajustar `parseDaptaWebhook` (el esquema actual es provisional).
2. Supabase Auth con lista de operadores.
3. Trigger.dev: `discover` → `enrich` → `score` → `compose` → `verify` → `send-wave` → `mature` → `reassign`.
4. Pantallas: nueva campaña, revisión de oleada, leads, detalle del lead, diagnóstico `/d/[token]` con "Llámenme ahora".
5. Webhook de respuestas de Brevo y formulario de baja.
6. Textos legales definitivos y paleta de Dapta en `src/theme/tokens.css` (persona C).

## Módulos

| Carpeta | Contenido |
|---|---|
| `src/db/` | Esquema Drizzle, migraciones, cliente |
| `src/server/discovery/` | OpenData, Places, deduplicación |
| `src/server/messaging/` | Mailer, verificador de afirmaciones |
| `src/server/qualifier/` | Adaptador Dapta, ingesta del webhook, fake para tests |
| `src/server/lab/` | Configuración, cumplimiento, Thompson, asignación, métricas, frase, puente |
| `src/server/costs/` | Tarifas y asientos del libro de costos |
| `src/server/llm/` | Adaptador Llm |
| `src/app/` | UI del operador, API, páginas legales |
| `src/i18n/`, `src/theme/` | Catálogo ES y tokens visuales |

## Supuestos y limitaciones a revisar
- Los leads que solo vienen de Places se marcan como persona jurídica porque Places no lo distingue. Hay que revisarlo antes de la oleada.
- La tarifa de email de Brevo es [NC] (S-F).
- La excepción D53 ("llamada solicitada por el titular") exime del horario **y** del intervalo de 7 días, porque el contacto lo inicia el titular. Interpretación legal [NC].
