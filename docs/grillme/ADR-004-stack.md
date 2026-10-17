# ADR-004 — Stack técnico

**Estado:** Aceptado en la [sesión grill-me 4](./sesion-04-arquitectura-dapta.md) (16-oct-2026)

## Decisión
| Pieza | Elección | Por qué |
|---|---|---|
| Lenguaje | TypeScript en todo | Tipos compartidos entre módulos y agentes de código |
| App | Next.js (App Router) en Vercel | Despliegue en minutos y entornos de vista previa |
| Datos | Postgres en Supabase con **Drizzle** | Migraciones SQL legibles y revisables |
| Autenticación | Supabase Auth (email + contraseña, lista de operadores permitidos) | Sin dependencia de correo durante la demo |
| Procesos | **Trigger.dev** | Esperas largas, cron, reintentos, concurrencia y panel |
| LLM | **Claude Sonnet 5.5** (redacción) + **Claude Haiku 5.5** (clasificación y verificación), con salidas estructuradas | Calidad donde importa, costo bajo en volumen |
| Validación | Zod en todo límite externo (APIs, webhooks, salidas del LLM) | Contratos explícitos |
| Email | **Brevo** detrás del adaptador `Mailer` (plan B: Gmail API) | Decisión del equipo (D39) |
| Calificación | Dapta detrás del adaptador `Calificador` (ADR-006) | Aislar la dependencia crítica |
| Internacionalización | Catálogos de traducción ES/EN (librería a elegir en el setup: next-intl o equivalente) | D32 |
| Tiempo real | Consulta cada 3 s | Robusto; Realtime solo si sobra tiempo |
| Observabilidad | Tablas `activity_event` y `llm_call`, panel de Trigger.dev, logs de Vercel | Sin dependencias nuevas (D44) |
| Entornos | Supabase dev + prod; Vercel preview + prod | El plan gratuito permite 2 proyectos |

## Consecuencias
- Prohibido introducir otro framework de agentes, cola, ORM o proveedor sin un nuevo ADR.
- Cada adaptador externo (`Calificador`, `Mailer`, `Places`, `OpenData`, `Llm`) tiene una interfaz y un fake para tests.
